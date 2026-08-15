const express = require("express");
const helmet = require("helmet");
const cors = require("cors");
const morgan = require("morgan");
const mongoose = require("mongoose");
const path = require("path");
const IORedis = require("ioredis");

const { loadEnv } = require("../config/env");
const constants = require("../config/constants");
const { getHealthStatus } = require("../services/health");
const { getRedisClient } = require("../services/redisClient");
const { createQueueBoard } = require("../services/bullBoard");
const { createAdminAuth } = require("../services/adminAuth");
const { createShortUrl } = require("../services/shorten");
const { getRedirectUrl } = require("../services/redirect");
const { getAnalytics } = require("../services/analytics");
const { listUrls } = require("../services/urlList");

const {
  getClickQueues,
  enqueueClick,
  getClientIp,
} = require("../services/queue");
const logger = require("../lib/logger");
const {
  checkRateLimit,
  setRateLimitHeaders,
  RATE_LIMITS,
} = require("../services/rateLimiter");

const env = loadEnv(process.env);

const app = express();
const redisClient = getRedisClient(env.REDIS_URL);
const redisConnection = new IORedis(
  env.REDIS_URL,
  constants.REDIS.CONNECTION_OPTIONS,
);
const { clickQueue, clickDlq } = getClickQueues(redisConnection);
const adminAuth = createAdminAuth({
  password: env.ADMIN_PASSWORD,
  isProduction: env.NODE_ENV === "production",
});

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

app.use(helmet());
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

if (env.NODE_ENV === "production") {
  app.use(cors({ origin: env.FRONTEND_URL }));
} else {
  app.use(
    cors({
      origin: ["http://localhost:5173", env.FRONTEND_URL],
      credentials: true,
    }),
  );
}

app.use(morgan(env.NODE_ENV === "development" ? "dev" : "combined"));

app.get("/", (req, res) => res.json({ status: "ok" }));

app.get("/admin/login", (req, res) => {
  if (adminAuth.isAuthenticated(req)) {
    return res.redirect(303, adminAuth.getReturnTo(req.query.returnTo));
  }

  const returnTo = adminAuth.getReturnTo(req.query.returnTo);
  const error = req.query.error ? "Incorrect password." : "";
  return res.type("html").send(`<!doctype html>
<html lang="en"><head><meta charset="utf-8"><title>Admin login</title></head>
<body><main><h1>Admin login</h1>${error ? `<p role="alert">${error}</p>` : ""}
<form method="post" action="/admin/login">
<input type="hidden" name="returnTo" value="${escapeHtml(returnTo)}">
<label>Password <input type="password" name="password" autocomplete="current-password" required autofocus></label>
<button type="submit">Sign in</button>
</form></main></body></html>`);
});

app.post("/admin/login", (req, res) => {
  const returnTo = adminAuth.getReturnTo(req.body.returnTo);
  if (!adminAuth.safeEqual(req.body.password || "", env.ADMIN_PASSWORD)) {
    return res.redirect(303, `/admin/login?error=1&returnTo=${encodeURIComponent(returnTo)}`);
  }

  adminAuth.setSession(res);
  return res.redirect(303, returnTo);
});

app.post("/admin/logout", (req, res) => {
  adminAuth.clearSession(res);
  res.redirect(303, "/admin/login");
});

app.use(
  "/admin/queues",
  adminAuth.requireAuth,
  createQueueBoard({ clickQueue, clickDlq }),
);

app.post("/api/shorten", async (req, res) => {
  const clientIp = getClientIp(req);
  const now = new Date();
  const rateLimitResult = await checkRateLimit(
    redisClient,
    clientIp,
    "shorten",
    RATE_LIMITS.shorten.limit,
    now,
  );

  setRateLimitHeaders(res, rateLimitResult, RATE_LIMITS.shorten.limit);

  if (!rateLimitResult.allowed) {
    return res.status(429).json({ error: "Rate limit exceeded" });
  }

  try {
    const shortened = await createShortUrl(req.body, {
      baseUrl: env.BASE_URL,
      now,
      cacheClient: redisClient,
    });

    res.status(201).json(shortened);
  } catch (err) {
    if (err && err.name === "ZodError") {
      return res.status(400).json({
        error: "Invalid request body",
        issues: err.issues,
      });
    }

    if (err && err.statusCode === 409) {
      return res.status(409).json({
        error: "Custom slug already taken",
      });
    }

    logger.error({ err }, "Unexpected error during URL shortening");
    res.status(500).json({
      error: "Failed to shorten URL",
    });
  }
});

app.get("/health", async (req, res) => {
  try {
    const health = await getHealthStatus(env);
    const statusCode = health.status === "ok" ? 200 : 503;

    res.status(statusCode).json(health);
  } catch (err) {
    logger.error({ err }, "Health check failure");
    res.status(503).json({
      status: "degraded",
      redis: "disconnected",
      mongodb: "disconnected",
      queueDepth: 0,
      error: err.message,
    });
  }
});

app.get("/api/analytics/:slug", async (req, res) => {
  const clientIp = getClientIp(req);
  const now = new Date();
  const rateLimitResult = await checkRateLimit(
    redisClient,
    clientIp,
    "analytics",
    RATE_LIMITS.analytics.limit,
    now,
  );
  setRateLimitHeaders(res, rateLimitResult, RATE_LIMITS.analytics.limit);

  if (!rateLimitResult.allowed) {
    return res.status(429).json({ error: "Rate limit exceeded" });
  }

  try {
    const { slug } = req.params;
    const analytics = await getAnalytics(slug, { redisClient, now });
    if (!analytics) {
      return res.status(404).json({ error: "Slug not found or expired" });
    }
    res.json(analytics);
  } catch (err) {
    logger.error(
      { slug: req.params.slug, err },
      "Failed to retrieve analytics",
    );
    res.status(500).json({ error: "Failed to retrieve analytics" });
  }
});

app.get("/api/urls", async (req, res) => {
  logger.info(
    { limit: req.query.limit, skip: req.query.skip },
    "Fetching URLs list",
  );
  try {
    const limit = parseInt(req.query.limit, 10) || 100;
    const skip = parseInt(req.query.skip, 10) || 0;
    const urls = await listUrls({ limit, skip });
    logger.info({ count: urls.length }, "Successfully retrieved URLs list");
    res.json(urls);
  } catch (err) {
    logger.error(
      { limit: req.query.limit, skip: req.query.skip, err },
      "Failed to retrieve URLs",
    );
    res.status(500).json({ error: "Failed to retrieve URLs" });
  }
});

app.get("/:slug", async (req, res) => {
  const clientIp = getClientIp(req);
  const now = new Date();
  const rateLimitResult = await checkRateLimit(
    redisClient,
    clientIp,
    "redirect",
    RATE_LIMITS.redirect.limit,
    now,
  );

  setRateLimitHeaders(res, rateLimitResult, RATE_LIMITS.redirect.limit);

  if (!rateLimitResult.allowed) {
    return res.status(429).json({ error: "Rate limit exceeded" });
  }

  try {
    const { slug } = req.params;
    const originalUrl = await getRedirectUrl(slug, redisClient);

    if (!originalUrl) {
      return res.status(404).json({ error: "Slug not found or expired" });
    }

    // Enqueue click event asynchronously (fire-and-forget, non-blocking)
    enqueueClick(clickQueue, slug, req);

    res.redirect(301, originalUrl);
  } catch (err) {
    logger.error({ slug: req.params.slug, err }, "Redirect failure");
    res.status(500).json({
      error: "Failed to redirect",
    });
  }
});

mongoose
  .connect(env.MONGODB_URI, {
    maxPoolSize: 10,
    minPoolSize: 2,
    serverSelectionTimeoutMS: 5000,
    socketTimeoutMS: 45000,
  })
  .then(() => {
    logger.info("MongoDB connected");
    // START LISTENING AFTER MONGODB CONNECTS
    const port = constants.APP.PORT;
    const server = app.listen(port, "0.0.0.0", () => {
      logger.info({ port, env: env.NODE_ENV }, "API listening on 0.0.0.0");
    });

    // Graceful shutdown handlers
    process.on("uncaughtException", (err) => {
      logger.error({ err }, "Uncaught exception - process exiting");
      process.exit(1);
    });
    process.on("unhandledRejection", (reason, promise) => {
      logger.error(
        { reason, promise },
        "Unhandled rejection - process exiting",
      );
      process.exit(1);
    });
    server.on("error", (err) => {
      logger.error({ err }, "Server error");
    });
    server.on("close", () => {
      logger.info("Server closed");
    });
  })
  .catch((err) => {
    logger.error({ err }, "Failed to connect to MongoDB - exiting");
    process.exit(1);
  });
