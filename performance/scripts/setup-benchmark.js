/**
 * Run the full benchmark setup in the required order:
 *
 *   1. reset-benchmark.js  (delete reserved NEW docs; evict cold/NEW keys)
 *   2. populate-mongodb.js (create the 100 hot + 1000 cold documents)
 *   3. populate-redis.js   (cache hot entries; clear cold/NEW + analytics keys)
 *
 * Each step runs as a child process with the current environment, so
 * MONGODB_URI / REDIS_URL handling is identical to running the scripts
 * individually. The run aborts on the first failing step.
 *
 * Usage (host checkout, from the repository root):
 *   NODE_PATH=backend/node_modules \
 *   MONGODB_URI="mongodb://localhost:27017/url-shortener" \
 *   REDIS_URL="redis://localhost:6379" \
 *     node performance/scripts/setup-benchmark.js [--dry-run]
 *
 * Usage (app container):
 *   docker compose exec app node performance/scripts/setup-benchmark.js
 */

const { spawnSync } = require("child_process");
const path = require("path");

const STEPS = [
  { name: "reset", file: "reset-benchmark.js" },
  { name: "populate-mongodb", file: "populate-mongodb.js" },
  { name: "populate-redis", file: "populate-redis.js" },
];

function runStep(step, { dryRun = false } = {}) {
  console.log(`--- step: ${step.name} (${step.file}) ---`);

  if (dryRun) {
    return;
  }

  const result = spawnSync(process.execPath, [path.join(__dirname, step.file)], {
    stdio: "inherit",
  });

  if (result.error) {
    throw result.error;
  }

  if (result.status !== 0) {
    throw new Error(
      `Step "${step.name}" failed with exit code ${result.status}. Aborting.`,
    );
  }
}

function main(argv = process.argv.slice(2)) {
  const dryRun = argv.includes("--dry-run");

  for (const step of STEPS) {
    runStep(step, { dryRun });
  }

  console.log(
    dryRun
      ? "Dry run complete (no steps executed)."
      : "Benchmark setup complete: reset -> mongodb -> redis.",
  );
}

if (require.main === module) {
  try {
    main();
  } catch (err) {
    console.error(`Benchmark setup failed: ${err.message}`);
    process.exitCode = 1;
  }
}

module.exports = {
  STEPS,
  runStep,
  main,
};
