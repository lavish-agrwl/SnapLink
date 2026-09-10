/*
 * SnapLink k6 benchmark (redirect + creation capacity).
 *
 * Target:       https://api.lavishagrwl.dev by default (never localhost).
 *               Override explicitly with: --env BASE_URL=https://...
 * Dataset:      performance/data/urls.json (deterministic hot/cold/new slugs).
 *
 * Workloads (--env TEST=hot|cold|new|mixed, default hot):
 *   hot    GET /<hot-slug>              (expects Redis hit  -> 301)
 *   cold   GET /<cold-slug>             (expects miss -> Mongo -> 301)
 *   new    POST /api/shorten            (creates the 10 reserved NEW urls)
 *   mixed  90% hot redirects / 9% cold redirects / 1% creations
 *
 * Redirects are never followed: the 301 from SnapLink is the measurement.
 *
 * Examples:
 *   k6 run performance/k6/benchmark.js
 *   k6 run performance/k6/benchmark.js --env TEST=hot --env RPS=50
 *   k6 run performance/k6/benchmark.js --env TEST=cold --env RPS=50 --env DURATION=60s
 *   k6 run performance/k6/benchmark.js --env TEST=mixed --env RPS=100
 *   k6 run performance/k6/benchmark.js --env TEST=new --env RPS=2 --env DURATION=5s
 *
 * NOTE on TEST=new: only 10 reserved slugs exist, selected sequentially, so a
 * clean run creates each exactly once (e.g. RPS=2 DURATION=5s ~= 10 creates).
 * Further creates repeat slugs and fail with 409 by design (slug -> destination
 * is immutable); reset the dataset before re-running this workload.
 */

import http from "k6/http";
import { check } from "k6";
import exec from "k6/execution";

const BASE_URL = __ENV.BASE_URL || "https://api.lavishagrwl.dev";
const TEST = __ENV.TEST || "hot";
const RPS = parseInt(__ENV.RPS || "50", 10);
const DURATION = __ENV.DURATION || "30s";

const dataset = JSON.parse(open("../data/urls.json"));
const HOT_URLS = dataset.hot;
const COLD_URLS = dataset.cold;
const NEW_URLS = dataset.new;

// Never follow redirects: measure SnapLink's 301, not the destination site.
const NO_FOLLOW = { redirects: 0 };

export const options = {
  // Show p99 in the end-of-test summary (med doubles as p50).
  summaryTrendStats: ["avg", "min", "med", "max", "p(90)", "p(95)", "p(99)"],
  scenarios: {
    benchmark: {
      executor: "constant-arrival-rate",
      rate: RPS,
      timeUnit: "1s",
      duration: DURATION,
      preAllocatedVUs: Math.min(Math.max(RPS * 2, 10), 500),
      maxVUs: Math.max(RPS * 4, 100),
    },
  },
  thresholds: {
    http_req_failed: ["rate<0.05"],
    http_req_duration: ["p(95)<2000"],
    checks: ["rate>0.95"],
  },
};

function getRedirect(slug) {
  const res = http.get(`${BASE_URL}/${slug}`, NO_FOLLOW);
  check(res, { "redirect (301)": (r) => r.status === 301 });
}

function createReservedUrl(entry) {
  const res = http.post(
    `${BASE_URL}/api/shorten`,
    JSON.stringify({
      url: entry.originalUrl,
      customSlug: entry.slug,
      expiresAt: new Date(Date.now() + 86400000).toISOString(),
    }),
    { headers: { "Content-Type": "application/json" } },
  );
  check(res, { "created (201)": (r) => r.status === 201 });
}

function randomOf(entries) {
  return entries[Math.floor(Math.random() * entries.length)];
}

function nextReservedUrl() {
  return NEW_URLS[exec.scenario.iterationInTest % NEW_URLS.length];
}

export default function () {
  if (TEST === "hot") {
    getRedirect(randomOf(HOT_URLS).slug);
  } else if (TEST === "cold") {
    getRedirect(randomOf(COLD_URLS).slug);
  } else if (TEST === "new") {
    createReservedUrl(nextReservedUrl());
  } else if (TEST === "mixed") {
    const roll = Math.random();
    if (roll < 0.9) {
      getRedirect(randomOf(HOT_URLS).slug);
    } else if (roll < 0.99) {
      getRedirect(randomOf(COLD_URLS).slug);
    } else {
      createReservedUrl(nextReservedUrl());
    }
  } else {
    throw new Error(
      `unknown TEST workload "${TEST}" (expected hot, cold, new or mixed)`,
    );
  }
}
