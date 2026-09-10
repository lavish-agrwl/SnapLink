/**
 * Populate MongoDB with the deterministic SnapLink benchmark dataset.
 *
 * Inserts ONLY the 100 hot + 1000 cold URLs from performance/data/urls.json.
 * The 10 reserved NEW URLs are NEVER inserted (they are created later
 * through the real API during the benchmark).
 *
 * Rerun behavior per slug:
 *   - missing                       -> create with expiresAt = now + 24h
 *   - exists with same originalUrl   -> refresh expiresAt to now + 24h only
 *                                       (createdAt, totalClicks and
 *                                        originalUrl are left untouched)
 *   - exists with different mapping  -> abort with an error, never overwrite
 *
 * Never deletes or wipes collections. Uses the existing Url Mongoose model
 * (src/models/url.js) so the schema, field names and TTL index
 * behavior are exactly those of the application.
 *
 * Usage (host checkout, from the repository root):
 *   NODE_PATH=backend/node_modules \
 *   MONGODB_URI="mongodb://localhost:27017/url-shortener" \
 *     node performance/scripts/populate-mongodb.js
 *
 * Usage (app container, dependencies resolve from /usr/src/app/node_modules):
 *   docker compose exec app node performance/scripts/populate-mongodb.js
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

// Load env the same way the backend does, without hardcoding secrets.
// The explicit .env fallback only exists in host checkouts (it is excluded
// from the image). Existing environment variables are never overridden.
dotenv.config();
dotenv.config({ path: path.join(APP_ROOT, ".env") });

const Url = require(path.join(APP_ROOT, "src", "models", "url"));

const DATASET_PATH = path.join(__dirname, "..", "data", "urls.json");
const CREATED_BY = "perf-benchmark";
const ONE_DAY_MS = 24 * 60 * 60 * 1000;

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
 * Ensure MongoDB documents for the hot + cold benchmark entries.
 *
 * @param {object} args
 * @param {Array} args.entries - [{ slug, originalUrl }] (hot + cold only)
 * @param {Date} [args.now] - reference time for expiresAt computation
 * @returns {Promise<object>} summary { created, reused, total }
 */
async function ensureBenchmarkUrls({ entries, now = new Date() }) {
  const expiresAt = new Date(now.getTime() + ONE_DAY_MS);

  // Pass 1 (read-only): load every existing benchmark document first so a
  // conflicting slug aborts the run BEFORE anything is written.
  const slugs = entries.map((entry) => entry.slug);
  const existingDocs = await Url.find({ slug: { $in: slugs } }).lean();
  const existingBySlug = new Map(existingDocs.map((doc) => [doc.slug, doc]));

  const conflicts = [];
  for (const entry of entries) {
    const existing = existingBySlug.get(entry.slug);
    if (existing && existing.originalUrl !== entry.originalUrl) {
      conflicts.push({
        slug: entry.slug,
        expected: entry.originalUrl,
        found: existing.originalUrl,
      });
    }
  }

  if (conflicts.length > 0) {
    const preview = conflicts
      .slice(0, 20)
      .map(
        (conflict) =>
          `  ${conflict.slug}: expected ${conflict.expected}, found ${conflict.found}`,
      )
      .join("\n");
    const suffix =
      conflicts.length > 20
        ? `\n  ... and ${conflicts.length - 20} more`
        : "";
    throw new Error(
      `Aborting: ${conflicts.length} benchmark slug(s) already exist with a different destination. ` +
        `Benchmark slug -> destination mappings are immutable and will not be overwritten.\n` +
        `${preview}${suffix}`,
    );
  }

  // Pass 2: create missing documents, refresh expiresAt on matching ones.
  let created = 0;
  let reused = 0;

  for (const entry of entries) {
    const existing = existingBySlug.get(entry.slug);

    if (!existing) {
      await Url.create({
        slug: entry.slug,
        originalUrl: entry.originalUrl,
        createdAt: now,
        expiresAt,
        totalClicks: 0,
        createdBy: CREATED_BY,
      });
      created += 1;
    } else {
      await Url.updateOne(
        { slug: entry.slug },
        { $set: { expiresAt } },
      );
      reused += 1;
    }
  }

  return { created, reused, total: entries.length };
}

async function run({ mongoUri, dataset, now = new Date() } = {}) {
  const uri = mongoUri || process.env.MONGODB_URI;
  if (!uri) {
    throw new Error("Missing MONGODB_URI. Set it in the environment.");
  }

  const data = dataset || loadDataset();
  const benchmarkEntries = [...data.hot, ...data.cold];

  await mongoose.connect(uri);
  try {
    const summary = await ensureBenchmarkUrls({
      entries: benchmarkEntries,
      now,
    });

    // Non-fatal warning: a reserved NEW slug already present in MongoDB
    // would make the benchmark's API creation for it fail with 409.
    const reservedSlugs = data.new.map((entry) => entry.slug);
    const blockingNew =
      reservedSlugs.length > 0
        ? await Url.find({ slug: { $in: reservedSlugs } })
            .select({ slug: 1 })
            .lean()
        : [];

    return {
      hot: data.hot.length,
      cold: data.cold.length,
      reservedNew: data.new.length,
      created: summary.created,
      reused: summary.reused,
      total: summary.total,
      blockingReservedSlugs: blockingNew.map((doc) => doc.slug),
    };
  } finally {
    await mongoose.disconnect();
  }
}

async function main() {
  const summary = await run({});
  const lines = [
    "MongoDB population complete",
    `Hot URLs: ${summary.hot}`,
    `Cold URLs: ${summary.cold}`,
    `Reserved NEW URLs (never inserted): ${summary.reservedNew}`,
    `Existing mappings reused: ${summary.reused}`,
    `New mappings created: ${summary.created}`,
    "Conflicts: 0",
  ];
  if (summary.blockingReservedSlugs.length > 0) {
    lines.push(
      `WARNING: ${summary.blockingReservedSlugs.length} reserved NEW slug(s) already exist in MongoDB ` +
        `(benchmark API creation for them would return 409): ${summary.blockingReservedSlugs.join(", ")}`,
    );
  }
  console.log(lines.join("\n"));
}

if (require.main === module) {
  main().catch((err) => {
    console.error(`MongoDB population failed: ${err.message}`);
    process.exitCode = 1;
  });
}

module.exports = {
  run,
  ensureBenchmarkUrls,
  loadDataset,
  DATASET_PATH,
  CREATED_BY,
  ONE_DAY_MS,
};
