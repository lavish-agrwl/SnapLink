/*
 * SnapLink k6 benchmark (redirect + creation capacity).
 *
 * Target:       https://api.lavishagrwl.dev by default (never localhost).
 *               Override explicitly with: --env BASE_URL=https://...
 * Dataset:      performance/data/urls.json (deterministic hot/cold/new slugs).
 *
 * Workloads (--env TEST=hot|cold|new|mixed, default hot):
 *   hot    = 100% HOT redirects
 *   cold   = 100% COLD redirects
 *   new    = exactly 10 reserved URL creations
 *   mixed  = 90% HOT + 10% COLD redirects
 *
 * MIXED intentionally contains no NEW requests: NEW is a finite deterministic
 * workload (10 reserved slugs), so it cannot sustain a long-running test
 * without producing duplicate-slug 409s. Run TEST=new separately instead.
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
 * NOTE on TEST=new: only 10 reserved slugs exist. The scenario runs exactly
 * one shared iteration per reserved URL, so a run creates each reserved NEW
 * URL once and then stops. Re-run only after resetting the dataset, since
 * already-created slugs fail with 409 (slug -> destination is immutable).
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
  scenarios: newScenario(),
  thresholds: {
    http_req_failed: ["rate<0.05"],
    http_req_duration: ["p(95)<2000"],
    checks: ["rate>0.95"],
  },
};

// TEST=new runs exactly one iteration per reserved URL so no slug is ever
// created twice. All other workloads use constant arrival rate.
function newScenario() {
  if (TEST === "new") {
    return {
      benchmark: {
        executor: "shared-iterations",
        iterations: NEW_URLS.length,
        vus: Math.min(Math.max(RPS, 1), NEW_URLS.length),
        maxDuration: DURATION,
      },
    };
  }

  return {
    benchmark: {
      executor: "constant-arrival-rate",
      rate: RPS,
      timeUnit: "1s",
      duration: DURATION,
      preAllocatedVUs: Math.min(Math.max(RPS * 2, 10), 500),
      maxVUs: Math.max(RPS * 4, 100),
    },
  };
}

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
    if (Math.random() < 0.9) {
      getRedirect(randomOf(HOT_URLS).slug);
    } else {
      getRedirect(randomOf(COLD_URLS).slug);
    }
  } else {
    throw new Error(
      `unknown TEST workload "${TEST}" (expected hot, cold, new or mixed)`,
    );
  }
}
