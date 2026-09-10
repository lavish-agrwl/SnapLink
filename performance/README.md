# SnapLink Performance Testing — Dataset, Population Scripts & k6 Benchmark

## Dataset (`data/urls.json`)

Single source of truth for benchmark slug → destination mappings:

- 100 hot URLs: `perf-hot-000` … `perf-hot-099` → `https://benchmark.snaplink.local/hot/NNN`
- 1000 cold URLs: `perf-cold-0000` … `perf-cold-0999` → `https://benchmark.snaplink.local/cold/NNNN`
- 10 reserved NEW URLs: `perf-new-00` … `perf-new-09` → `https://benchmark.snaplink.local/new/NN`

`urls.json` stores only `slug` + `originalUrl`. Expiration is computed at
insertion time, never frozen in the dataset.

## Running the scripts (from the repository root)

```bash
# 1. MongoDB first (creates hot + cold documents)
MONGODB_URI="mongodb://localhost:27017/url-shortener" \
  node performance/scripts/populate-mongodb.js

# 2. Redis second (caches hot documents, clears cold/new + analytics keys)
MONGODB_URI="mongodb://localhost:27017/url-shortener" \
REDIS_URL="redis://localhost:6379" \
  node performance/scripts/populate-redis.js
```

Both scripts read `MONGODB_URI` / `REDIS_URL` from the environment with a
`backend/.env` fallback. No credentials are hardcoded. Always run the MongoDB
script before the Redis script — the Redis script treats MongoDB as the source
of truth and fails if hot documents are missing.

### Redis in the compose project

The compose `redis` container publishes port `6379` to the host, so run the
scripts from the host with an explicit localhost URL:

```bash
# Start the compose redis (if not already running)
docker compose up -d redis

MONGODB_URI="<your-mongo-uri>" \
REDIS_URL="redis://localhost:6379" \
  node performance/scripts/populate-redis.js
```

Why the explicit `REDIS_URL`: `backend/.env` sets
`REDIS_URL="redis://redis:6379"`, where `redis` is the compose-network
hostname — it only resolves *inside* containers, not on the host. An explicit
environment variable always wins over `backend/.env` (dotenv never overrides
existing variables), so passing `REDIS_URL=redis://localhost:6379` targets the
same containerized Redis through the published port. (Inside a compose
container, keep `REDIS_URL="redis://redis:6379"`.)

## What each script changes

`populate-mongodb.js`:

- Creates only the 100 hot + 1000 cold documents using the existing `Url`
  Mongoose model (same schema, field names and types as the application).
- New documents get `createdBy: "perf-benchmark"`, `totalClicks: 0`,
  `createdAt: now`, `expiresAt: now + 24h` (real BSON `Date`).
- Reruns refresh only `expiresAt` on matching documents; `createdAt`,
  `totalClicks` and `originalUrl` are left untouched.
- Never inserts the 10 reserved NEW URLs (warns if one already exists).
- Never deletes or wipes collections.

`populate-redis.js`:

- Hot URLs: `SET url:${slug} '<{"originalUrl","expiresAt"} JSON>' EX 86400`
  (TTL from the backend's `CACHE.REDIRECT_TTL_SECONDS`), with values derived
  from the MongoDB documents — never built from `urls.json` directly.
- Cold + NEW redirect keys (`url:perf-cold-*`, `url:perf-new-*`): deleted so
  the benchmark starts with Redis misses.
- `analytics:${slug}` keys for all 1110 benchmark slugs: deleted to avoid
  stale analytics cache on repeated runs.

## Immutability rule

`slug → originalUrl` is immutable. If MongoDB already contains a benchmark
slug with a different destination, `populate-mongodb.js` aborts with an error
and overwrites nothing. Redis hot entries are always derived from MongoDB, so
both stores agree by construction.

## 24-hour TTL behavior

Every benchmark MongoDB document carries `expiresAt = createdAt + 24h` on
creation (refreshed to `now + 24h` on reruns), so the existing
`urls_expiresAt_ttl` index removes test data naturally after about a day.
Hot Redis entries carry a matching 24-hour `EX` TTL plus the embedded
`expiresAt` the application soft-expiry check enforces.

## Redis safety

The Redis instance is shared by the URL cache, analytics cache, rate limiter
and BullMQ. These scripts perform only targeted `SET`/`DEL` operations on
deterministic `url:perf-*` / `analytics:perf-*` keys and never use
`FLUSHDB` / `FLUSHALL`. Rate-limiter (`rl:*`) and BullMQ keys are untouched.

## k6 benchmark (`k6/benchmark.js`)

One script tests the deployed application at `https://api.lavishagrwl.dev`
(default; never localhost). It produces comparable throughput, p50/p95/p99,
error-rate and dropped-iteration numbers using standard k6 metrics.

```bash
k6 run performance/k6/benchmark.js --env TEST=hot --env RPS=50
k6 run performance/k6/benchmark.js --env TEST=cold --env RPS=50
k6 run performance/k6/benchmark.js --env TEST=new --env RPS=2 --env DURATION=5s
k6 run performance/k6/benchmark.js --env TEST=mixed --env RPS=50
```

Defaults: `TEST=hot`, `RPS=50`, `DURATION=30s`. Override the target only
explicitly: `--env BASE_URL=https://<host>`.

Workloads (all from `data/urls.json`, never random slugs):

- `hot`: `GET /<hot-slug>` — expects Redis hit → `301`.
- `cold`: `GET /<cold-slug>` — expects miss → MongoDB → `301` (first touch
  caches it; reruns naturally warm up, so reset via the scripts for a true
  cold state).
- `new`: `POST /api/shorten` with `{url, customSlug, expiresAt}` — the real
  creation path (`201`). Only 10 reserved slugs exist, selected sequentially,
  so a clean run (e.g. `RPS=2 DURATION=5s` ≈ 10 creates) creates each exactly
  once. Further creates repeat slugs and fail with `409` by design —
  slug → destination is immutable, so reset the dataset before re-running.
- `mixed`: 90% hot redirects / 9% cold redirects / 1% creations.

Redirects are never followed (`redirects: 0`): the measured artifact is
SnapLink's `301`, not the destination site. `301`/`201` are success;
4xx/5xx (including any `429`) surface as failures. Run with
`RATE_LIMIT_ENABLED=false` on the deployed app for capacity runs; the
benchmark itself contains no rate-limit bypass.
