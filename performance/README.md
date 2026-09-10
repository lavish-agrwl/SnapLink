# SnapLink Performance Testing

Simple, repeatable performance tests for the deployed SnapLink application.

The benchmark intentionally keeps the setup small:

```text
EC2
├── MongoDB Atlas
├── SnapLink API
├── Redis
└── Worker

Laptop
└── k6 Docker container
        │
        ▼
https://api.lavishagrwl.dev
```

The benchmark always measures the deployed application. It does **not** use a local SnapLink server.

---

## Directory Structure

```text
performance/
├── k6/
│   └── benchmark.js
├── data/
│   └── urls.json
├── scripts/
│   ├── populate-mongodb.js
│   ├── populate-redis.js
│   └── reset-benchmark.js
├── results/
└── README.md
```

---

# Dataset

`data/urls.json` is the single source of truth for benchmark slug → destination mappings.

The dataset contains:

* 100 hot URLs
* 1000 cold URLs
* 10 reserved new URLs

### Hot

```text
perf-hot-000
...
perf-hot-099
```

### Cold

```text
perf-cold-0000
...
perf-cold-0999
```

### New

```text
perf-new-00
...
perf-new-09
```

The dataset stores only:

```text
slug
originalUrl
```

Expiration is calculated when the MongoDB population script runs.

The mapping:

```text
slug → originalUrl
```

is immutable.

---

# Step 1 — Populate MongoDB

The MongoDB population script must be run on the EC2 instance.

The script is executed **inside the existing SnapLink `app` Docker container**.

First SSH into EC2.

From anywhere on EC2, run:

```bash
docker compose -f ~/SnapLink/docker-compose.yml exec app \
  node performance/scripts/populate-mongodb.js
```

The `performance/` directory must already have been copied into the running `app` container.

If necessary, copy it from the EC2 host:

```bash
docker cp ~/SnapLink/performance \
  $(docker compose -f ~/SnapLink/docker-compose.yml ps -q app):/usr/src/app/
```

Verify it exists:

```bash
docker compose -f ~/SnapLink/docker-compose.yml exec app \
  ls -la /usr/src/app/performance/scripts/
```

Then run the MongoDB population script.

### What this creates

The script creates/reuses:

```text
100 hot URLs
1000 cold URLs
```

It does **not** create the 10 new URLs.

Every created benchmark document gets:

```text
createdBy = "perf-benchmark"
totalClicks = 0
createdAt = current time
expiresAt = createdAt + 24 hours
```

The existing MongoDB TTL index will eventually remove the documents.

### Rerunning

The script is safe to rerun.

For an existing benchmark slug:

* matching `originalUrl` → reuse it
* `expiresAt` → refreshed to another 24-hour window
* `createdAt` → unchanged
* `totalClicks` → unchanged
* `originalUrl` → never changed

If an existing benchmark slug has a different destination, the script aborts rather than overwriting it.

---

# Step 2 — Populate Redis

Run this **inside the same EC2 `app` container**:

```bash
docker compose -f ~/SnapLink/docker-compose.yml exec app \
  node performance/scripts/populate-redis.js
```

The script connects to the Redis Compose service using the application's existing Redis configuration.

Redis does **not** need to be installed on the EC2 host.

Redis is not exposed publicly for this operation.

### Redis state after population

```text
Hot:
100 keys populated

Cold:
1000 keys absent

New:
10 keys absent
```

Hot keys use the application's existing format:

```text
url:${slug}
```

with:

```json
{
  "originalUrl": "...",
  "expiresAt": "..."
}
```

and the existing 24-hour Redis TTL.

The hot Redis values are derived from MongoDB, so MongoDB remains the source of truth.

The script also removes benchmark analytics cache keys:

```text
analytics:${slug}
```

for all 1110 benchmark slugs.

### Redis safety

The Redis instance is shared by:

* URL cache
* analytics
* rate limiting
* BullMQ

Therefore the population script only performs targeted operations.

It never uses:

```text
FLUSHDB
FLUSHALL
```

It does not touch:

```text
rl:*
```

or BullMQ keys.

---

# Step 3 — Verify Benchmark State

Before running k6, verify one hot URL:

```bash
docker compose -f ~/SnapLink/docker-compose.yml exec redis \
  redis-cli GET "url:perf-hot-000"
```

Expected value:

```json
{
  "originalUrl": "https://benchmark.snaplink.local/hot/000",
  "expiresAt": "..."
}
```

Check its TTL:

```bash
docker compose -f ~/SnapLink/docker-compose.yml exec redis \
  redis-cli TTL "url:perf-hot-000"
```

Expected:

```text
approximately 86400
```

Verify a cold URL is absent:

```bash
docker compose -f ~/SnapLink/docker-compose.yml exec redis \
  redis-cli EXISTS "url:perf-cold-0000"
```

Expected:

```text
0
```

Verify a new URL is absent:

```bash
docker compose -f ~/SnapLink/docker-compose.yml exec redis \
  redis-cli EXISTS "url:perf-new-00"
```

Expected:

```text
0
```

---

# Resetting Benchmark State

After a `TEST=new` benchmark has created the reserved URLs, reset before the
next creation run (otherwise API creation returns `409` for existing slugs):

```bash
docker compose -f ~/SnapLink/docker-compose.yml exec app \
  node performance/scripts/reset-benchmark.js
```

The reset script (`scripts/reset-benchmark.js`) removes only:

```text
MongoDB: the 10 reserved NEW documents (perf-new-00 ... perf-new-09)
Redis:   url:perf-cold-* + url:perf-new-* redirect keys (1010 total)
Redis:   analytics:perf-cold-* + analytics:perf-new-* keys (1010 total)
```

It never touches hot/cold MongoDB documents, hot Redis entries, `rl:*`
rate-limiter keys, BullMQ keys, or any non-benchmark key. It never uses
`FLUSHDB` / `FLUSHALL`. Safe to rerun.

---

# Step 4 — Configure the Deployed Application

For infrastructure-capacity testing, temporarily disable the application's rate limiting:

```env
RATE_LIMIT_ENABLED=false
```

This must be configured on the deployed EC2 application.

The k6 benchmark does not bypass rate limiting itself.

After performance testing, restore:

```env
RATE_LIMIT_ENABLED=true
```

---

# Step 5 — Run k6 From the Laptop

k6 runs on the laptop, not on EC2.

The benchmark's default target is:

```text
https://api.lavishagrwl.dev
```

There is no localhost default.

Because k6 is installed as a Docker image, mount the local `performance` directory into the k6 container.

## Windows PowerShell

From the SnapLink repository root:

```powershell
docker run --rm -i `
  -v "${PWD}/performance:/performance" `
  grafana/k6 run /performance/k6/benchmark.js
```

This runs the default:

```text
TEST=hot
RPS=50
DURATION=30s
```

against:

```text
https://api.lavishagrwl.dev
```

---

# Running Individual Tests

## Hot Redirect

```powershell
docker run --rm -i `
  -v "${PWD}/performance:/performance" `
  grafana/k6 run /performance/k6/benchmark.js `
  --env TEST=hot `
  --env RPS=50 `
  --env DURATION=30s
```

Expected path:

```text
k6
 ↓
api.lavishagrwl.dev
 ↓
Redis HIT
 ↓
301
```

---

## Cold Redirect

Before a genuine cold benchmark, rerun the Redis population script on EC2 so the cold keys are absent.

Then run from the laptop:

```powershell
docker run --rm -i `
  -v "${PWD}/performance:/performance" `
  grafana/k6 run /performance/k6/benchmark.js `
  --env TEST=cold `
  --env RPS=50 `
  --env DURATION=30s
```

Expected initial path:

```text
k6
 ↓
api.lavishagrwl.dev
 ↓
Redis MISS
 ↓
MongoDB
 ↓
Redis SET
 ↓
301
```

Cold URLs become cached after they are accessed. Therefore, rerun the Redis population script before another cold benchmark if a fresh cold-cache state is required.

---

## New URL Creation

The 10 reserved new URLs are created through the real SnapLink API.

For a clean run, use:

```powershell
docker run --rm -i `
  -v "${PWD}/performance:/performance" `
  grafana/k6 run /performance/k6/benchmark.js `
  --env TEST=new `
  --env RPS=2 `
  --env DURATION=5s
```

Approximately 10 creation operations will be generated.

The 10 reserved slugs are:

```text
perf-new-00
...
perf-new-09
```

Do not rerun this test without resetting/recreating the benchmark dataset appropriately.

The benchmark never modifies an existing slug's destination.

---

# Mixed Workload

The mixed workload uses:

```text
90% hot redirects
9% cold redirects
1% URL creation
```

Run:

```powershell
docker run --rm -i `
  -v "${PWD}/performance:/performance" `
  grafana/k6 run /performance/k6/benchmark.js `
  --env TEST=mixed `
  --env RPS=50 `
  --env DURATION=30s
```

---

# Changing the Target

The default target is always:

```text
https://api.lavishagrwl.dev
```

An explicit target can be supplied:

```powershell
docker run --rm -i `
  -v "${PWD}/performance:/performance" `
  grafana/k6 run /performance/k6/benchmark.js `
  --env BASE_URL=https://api.lavishagrwl.dev `
  --env TEST=hot `
  --env RPS=50
```

Do not use localhost for the performance baseline.

---

# Redirect Handling

SnapLink returns a `301` for successful redirects.

k6 is configured with:

```text
redirects: 0
```

Therefore k6 measures SnapLink's response:

```text
301
```

rather than following the redirect to the destination website.

Expected redirect status:

```text
301 = success
```

Unexpected `4xx` or `5xx` responses are failures.

This includes:

```text
429
```

if rate limiting has accidentally remained enabled.

---

# Metrics

The benchmark focuses on a small set of comparable measurements:

* throughput
* p50 latency
* p95 latency
* p99 latency
* error rate
* dropped iterations

Do not interpret a benchmark as successful merely because the requested RPS was configured.

Check both:

```text
actual request rate
```

and:

```text
dropped iterations
```

---

# Baseline Test Plan — v1.0.0

Do not immediately run a high-load test.

Start with a smoke test:

```powershell
docker run --rm -i `
  -v "${PWD}/performance:/performance" `
  grafana/k6 run /performance/k6/benchmark.js `
  --env TEST=hot `
  --env RPS=10 `
  --env DURATION=10s
```

Once the smoke test is confirmed, run the baseline workloads at:

```text
50 RPS
100 RPS
250 RPS
```

If 250 RPS remains healthy, test:

```text
500 RPS
```

Run:

```text
hot
cold
mixed
```

at each selected load.

Run the `new` workload separately because URL creation is fundamentally different from redirect traffic.

---

# Baseline Results

Record only the important numbers:

| Test  | RPS | p50 | p95 | p99 | Errors | Dropped |
| ----- | --: | --: | --: | --: | -----: | ------: |
| Hot   |     |     |     |     |        |         |
| Cold  |     |     |     |     |        |         |
| Mixed |     |     |     |     |        |         |
| New   |     |     |     |     |        |         |

This becomes the `v1.0.0` baseline.

Future performance changes should use the same dataset and the same workloads so results remain comparable.

---

# Important Design Invariant

The following relationship is immutable:

```text
slug → originalUrl
```

Performance optimizations must never change an existing destination.

MongoDB is the source of truth.

Redis is only a cache.

The benchmark dataset must remain deterministic across performance versions.
