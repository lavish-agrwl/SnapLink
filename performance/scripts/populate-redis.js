/**
 * Populate Redis with the deterministic SnapLink benchmark dataset.
 *
 * - 100 hot URLs: read from MongoDB (source of truth) and cached using the
 *   exact application redirect-cache format:
 *     key   `url:${slug}`
 *     value JSON.stringify({ originalUrl, expiresAt })
 *     TTL   EX <CACHE.REDIRECT_TTL_SECONDS> (24h, from backend constants)
 * - 1000 cold URLs: redirect cache keys explicitly DELETEd (Redis misses).
 * - 10 reserved NEW URLs: redirect cache keys explicitly DELETEd.
 * - analytics:${slug} keys for all 1110 benchmark slugs: DELETEd so repeated
 *   runs never see stale analytics cache state.
 *
 * Only targeted benchmark keys are touched. NEVER FLUSHDB/FLUSHALL: this
 * Redis instance is shared with the analytics cache, the rate limiter
 * (rl:* keys) and BullMQ queues.
 *
 * Usage (from the repository root):
 *   MONGODB_URI="mongodb://localhost:27017/url-shortener" \
 *   REDIS_URL="redis://localhost:6379" \
 *     node performance/scripts/populate-redis.js
 */

const fs = require("fs");
const path = require("path");

const BACKEND_ROOT = path.join(__dirname, "..", "..", "backend");
const mongoose = require(path.join(BACKEND_ROOT, "node_modules", "mongoose"));
const dotenv = require(path.join(BACKEND_ROOT, "node_modules", "dotenv"));

// Same env mechanism as the backend; backend/.env fallback covers running
// from the repository root. Existing environment variables are not overridden.
dotenv.config();
dotenv.config({ path: path.join(BACKEND_ROOT, ".env") });

const Url = require(path.join(BACKEND_ROOT, "src", "models", "url"));
const constants = require(path.join(BACKEND_ROOT, "src", "config", "constants"));
const { getRedisClient } = require(
  path.join(BACKEND_ROOT, "src", "services", "redisClient"),
);

const DATASET_PATH = path.join(__dirname, "..", "data", "urls.json");

function redirectKey(slug) {
  return `url:${slug}`;
}

function analyticsKey(slug) {
  return `analytics:${slug}`;
}

/**
 * Build the Redis cache value exactly as the application does
 * (backend/src/services/shorten.js cacheShortUrl and
 * backend/src/services/redirect.js cache repopulation).
 */
function buildCacheValue(originalUrl, expiresAt) {
  return JSON.stringify({
    originalUrl,
    expiresAt: expiresAt ? new Date(expiresAt).toISOString() : null,
  });
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
 * @param {boolean} [args.manageConnections] - connect/disconnect Mongo + quit Redis when true (CLI mode)
 */
async function run({ redisClient, redisUrl, dataset, manageConnections = false } = {}) {
  const data = dataset || loadDataset();
  const hotSlugs = data.hot.map((entry) => entry.slug);
  const coldSlugs = data.cold.map((entry) => entry.slug);
  const newSlugs = data.new.map((entry) => entry.slug);
  const allSlugs = [...hotSlugs, ...coldSlugs, ...newSlugs];

  let client = redisClient || null;
  let ownsClient = false;

  try {
    if (!client) {
      const url = redisUrl || process.env.REDIS_URL;
      if (!url) {
        throw new Error(
          "Missing REDIS_URL. Set it in the environment or backend/.env.",
        );
      }
      client = getRedisClient(url);
      ownsClient = manageConnections;
      await client.ping();
    }

    // MongoDB is the source of truth: every hot slug must already exist
    // there (created by populate-mongodb.js). Redis values are derived from
    // the MongoDB documents, never constructed from urls.json directly, so
    // MongoDB mapping == Redis mapping by construction.
    const hotDocs = await Url.find({ slug: { $in: hotSlugs } }).lean();
    const hotBySlug = new Map(hotDocs.map((doc) => [doc.slug, doc]));
    const missingHot = hotSlugs.filter((slug) => !hotBySlug.has(slug));
    if (missingHot.length > 0) {
      throw new Error(
        `Aborting: ${missingHot.length} hot URL(s) missing in MongoDB. ` +
          `Run populate-mongodb.js first. Missing: ${missingHot.slice(0, 20).join(", ")}` +
          (missingHot.length > 20 ? ", ..." : ""),
      );
    }

    const ttlSeconds = constants.CACHE.REDIRECT_TTL_SECONDS;
    const pipeline = client.pipeline();

    for (const slug of hotSlugs) {
      const doc = hotBySlug.get(slug);
      pipeline.set(
        redirectKey(slug),
        buildCacheValue(doc.originalUrl, doc.expiresAt),
        "EX",
        ttlSeconds,
      );
    }

    const coldKeys = coldSlugs.map(redirectKey);
    const newKeys = newSlugs.map(redirectKey);
    const analyticsKeys = allSlugs.map(analyticsKey);

    if (coldKeys.length > 0) {
      pipeline.del(...coldKeys);
    }
    if (newKeys.length > 0) {
      pipeline.del(...newKeys);
    }
    if (analyticsKeys.length > 0) {
      pipeline.del(...analyticsKeys);
    }

    await pipeline.exec();

    return {
      hotPopulated: hotSlugs.length,
      coldCleared: coldSlugs.length,
      newCleared: newSlugs.length,
      analyticsCleared: analyticsKeys.length,
      redirectTtlSeconds: ttlSeconds,
    };
  } finally {
    if (manageConnections) {
      await mongoose.disconnect().catch(() => {});
      if (ownsClient && client) {
        await client.quit().catch(() => {});
      }
    }
  }
}

async function main() {
  const mongoUri = process.env.MONGODB_URI;
  if (!mongoUri) {
    throw new Error(
      "Missing MONGODB_URI. Set it in the environment or backend/.env.",
    );
  }

  await mongoose.connect(mongoUri);
  try {
    const summary = await run({ manageConnections: false });
    console.log(
      [
        "Redis population complete",
        `Hot URLs populated: ${summary.hotPopulated}`,
        `Cold URLs cleared: ${summary.coldCleared}`,
        `New URLs cleared: ${summary.newCleared}`,
        `Analytics keys cleared: ${summary.analyticsCleared}`,
      ].join("\n"),
    );
  } finally {
    await mongoose.disconnect();
    try {
      const { getRedisClient: getClient } = require(
        path.join(BACKEND_ROOT, "src", "services", "redisClient")
      );
      const url = process.env.REDIS_URL;
      if (url) {
        await getClient(url).quit().catch(() => {});
      }
    } catch (_) {
      // Best-effort client shutdown; the summary above is authoritative.
    }
  }
}

if (require.main === module) {
  main().catch((err) => {
    console.error(`Redis population failed: ${err.message}`);
    process.exitCode = 1;
  });
}

module.exports = {
  run,
  loadDataset,
  redirectKey,
  analyticsKey,
  buildCacheValue,
  DATASET_PATH,
};
