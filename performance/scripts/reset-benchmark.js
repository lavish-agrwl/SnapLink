/**
 * Reset benchmark state so a fresh run can start cleanly.
 *
 * - MongoDB: deletes ONLY the 10 reserved NEW documents
 *   (perf-new-00 ... perf-new-09, taken from performance/data/urls.json).
 *   Hot + cold documents are never touched.
 * - Redis: deletes ONLY cold + NEW redirect keys
 *   (url:perf-cold-*, url:perf-new-*) and their analytics keys
 *   (analytics:perf-cold-*, analytics:perf-new-*).
 *   Hot cache entries, rate-limiter (rl:*) keys, BullMQ keys and every
 *   non-benchmark key are left untouched. NEVER FLUSHDB/FLUSHALL.
 *
 * Typical use: after a TEST=new benchmark created the reserved URLs, run
 * this reset so the next TEST=new run finds a clean state (otherwise API
 * creation would return 409 for the already-existing slugs).
 *
 * Usage (host checkout, from the repository root):
 *   NODE_PATH=backend/node_modules \
 *   MONGODB_URI="mongodb://localhost:27017/url-shortener" \
 *   REDIS_URL="redis://localhost:6379" \
 *     node performance/scripts/reset-benchmark.js
 *
 * Usage (app container, dependencies resolve from /usr/src/app/node_modules):
 *   docker compose exec app node performance/scripts/reset-benchmark.js
 */

const fs = require("fs");
const path = require("path");

// Application sources live directly under /usr/src/app in the container
// image and under backend/ in a host checkout. Probe for the layout instead
// of hardcoding a backend/ directory.
function findAppRoot() {
  const candidates = [
    path.join(__dirname, "..", ".."),
    path.join(__dirname, "..", "..", "backend"),
  ];

  for (const dir of candidates) {
    if (fs.existsSync(path.join(dir, "src", "models", "url.js"))) {
      return dir;
    }
  }

  throw new Error(
    "Cannot locate the SnapLink application (src/models/url.js was not found).",
  );
}

const APP_ROOT = findAppRoot();

// Normal Node module resolution against the already-installed dependencies
// (/usr/src/app/node_modules in the container). On a host checkout, run with
// NODE_PATH=backend/node_modules so the same bare specifiers resolve.
const mongoose = require("mongoose");
const dotenv = require("dotenv");

// Same env mechanism as the backend, without hardcoding secrets. The
// explicit .env fallback only exists in host checkouts (it is excluded from
// the image). Existing environment variables are never overridden.
dotenv.config();
dotenv.config({ path: path.join(APP_ROOT, ".env") });

const Url = require(path.join(APP_ROOT, "src", "models", "url"));
const { getRedisClient } = require(
  path.join(APP_ROOT, "src", "services", "redisClient"),
);

const DATASET_PATH = path.join(__dirname, "..", "data", "urls.json");

function redirectKey(slug) {
  return `url:${slug}`;
}

function analyticsKey(slug) {
  return `analytics:${slug}`;
}

function loadDataset(datasetPath = DATASET_PATH) {
  const raw = fs.readFileSync(datasetPath, "utf8");
  const dataset = JSON.parse(raw);

  if (
    !dataset ||
    !Array.isArray(dataset.hot) ||
    !Array.isArray(dataset.cold) ||
    !Array.isArray(dataset.new)
  ) {
    throw new Error(
      `Invalid benchmark dataset at ${datasetPath}: expected { hot, cold, new } arrays`,
    );
  }

  return dataset;
}

/**
 * @param {object} args
 * @param {object} [args.redisClient] - connected ioredis client (injected in validation)
 * @param {string} [args.redisUrl] - used with the backend client factory when no client is injected
 * @param {object} args.dataset - parsed urls.json
 */
async function run({ redisClient, redisUrl, dataset } = {}) {
  const data = dataset || loadDataset();
  const coldSlugs = data.cold.map((entry) => entry.slug);
  const newSlugs = data.new.map((entry) => entry.slug);

  // MongoDB: remove only the reserved NEW documents, identified by their
  // exact deterministic slugs. Hot + cold documents are never matched.
  const mongoResult =
    newSlugs.length > 0
      ? await Url.deleteMany({ slug: { $in: newSlugs } })
      : { deletedCount: 0 };

  // Redis: evict only cold + NEW redirect keys and their analytics keys.
  // Hot entries and all shared-instance keys (rl:*, BullMQ, ...) are kept.
  let client = redisClient || null;
  if (!client) {
    const url = redisUrl || process.env.REDIS_URL;
    if (!url) {
      throw new Error("Missing REDIS_URL. Set it in the environment.");
    }
    client = getRedisClient(url);
    await client.ping();
  }

  const redirectKeys = [...coldSlugs, ...newSlugs].map(redirectKey);
  const analyticsKeys = [...coldSlugs, ...newSlugs].map(analyticsKey);

  const pipeline = client.pipeline();
  if (redirectKeys.length > 0) {
    pipeline.del(...redirectKeys);
  }
  if (analyticsKeys.length > 0) {
    pipeline.del(...analyticsKeys);
  }
  await pipeline.exec();

  return {
    mongoNewDeleted: mongoResult.deletedCount || 0,
    mongoNewTotal: newSlugs.length,
    redisRedirectCleared: redirectKeys.length,
    redisAnalyticsCleared: analyticsKeys.length,
  };
}

async function main() {
  const mongoUri = process.env.MONGODB_URI;
  if (!mongoUri) {
    throw new Error("Missing MONGODB_URI. Set it in the environment.");
  }

  await mongoose.connect(mongoUri);
  try {
    const summary = await run({});
    console.log(
      [
        "Benchmark reset complete",
        `MongoDB reserved NEW URLs deleted: ${summary.mongoNewDeleted} of ${summary.mongoNewTotal}`,
        `Redis redirect keys cleared (cold + new): ${summary.redisRedirectCleared}`,
        `Redis analytics keys cleared (cold + new): ${summary.redisAnalyticsCleared}`,
        "Untouched: hot/cold MongoDB documents, hot Redis entries, rl:* and BullMQ keys",
      ].join("\n"),
    );
  } finally {
    await mongoose.disconnect();
    try {
      const url = process.env.REDIS_URL;
      if (url) {
        await getRedisClient(url).quit().catch(() => {});
      }
    } catch (_) {
      // Best-effort client shutdown; the summary above is authoritative.
    }
  }
}

if (require.main === module) {
  main().catch((err) => {
    console.error(`Benchmark reset failed: ${err.message}`);
    process.exitCode = 1;
  });
}

module.exports = {
  run,
  loadDataset,
  redirectKey,
  analyticsKey,
  DATASET_PATH,
};
