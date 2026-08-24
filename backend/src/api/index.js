const express = require("express");
const helmet = require("helmet");
const cors = require("cors");
const morgan = require("morgan");
const mongoose = require("mongoose");
const IORedis = require("ioredis");

const { loadEnv } = require("../config/env");
const constants = require("../config/constants");
const { getHealthStatus } = require("../services/health");
const { getRedisClient } = require("../services/redisClient");
const { createAdminAuth } = require("../services/adminAuth");
const { registerAdminRoutes } = require("./adminRoutes");
const { createRateLimitMiddleware } = require("../middleware/rateLimit");
const { createShortUrl } = require("../services/shorten");
const { getRedirectUrl } = require("../services/redirect");
const { getAnalytics } = require("../services/analytics");
const { listUrls } = require("../services/urlList");

const {
  getClickQueues,
  enqueueClick,
} = require("../services/queue");
const logger = require("../lib/logger");
const { RATE_LIMITS } = require("../services/rateLimiter");

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
const rateLimit = createRateLimitMiddleware(redisClient);

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

registerAdminRoutes(app, {
  adminAuth,
  adminPassword: env.ADMIN_PASSWORD,
  clickQueue,
  clickDlq,
  rateLimit,
  rateLimits: RATE_LIMITS,
});

app.post("/api/shorten", rateLimit("shorten", RATE_LIMITS.shorten), async (req, res) => {
  try {
    const shortened = await createShortUrl(req.body, {
      baseUrl: env.BASE_URL,
      now: req.rateLimitNow,
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

app.get("/api/analytics/:slug", rateLimit("analytics", RATE_LIMITS.analytics), async (req, res) => {
  try {
    const { slug } = req.params;
    const analytics = await getAnalytics(slug, {
      redisClient,
      now: req.rateLimitNow,
    });
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

app.get("/:slug", rateLimit("redirect", RATE_LIMITS.redirect), async (req, res) => {
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
