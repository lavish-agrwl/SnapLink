const { Queue } = require("bullmq");
const crypto = require("crypto");
const geoip = require("geoip-lite");
const logger = require("../lib/logger");
const { buildClickEventPayload } = require("../validation/clickEvent");
const constants = require("../config/constants");

const queues = new Map();

/**
 * Get or create a BullMQ queue instance.
 * @param {string} queueName - Name of the queue
 * @param {object} redisConnection - Redis connection details or client
 * @returns {Queue} - BullMQ Queue instance
 */
function getQueue(queueName, redisConnection) {
  if (!queues.has(queueName)) {
    const queue = new Queue(queueName, {
      connection: redisConnection,
      defaultJobOptions: constants.QUEUE.DEFAULT_JOB_OPTIONS,
    });

    queue.on("error", (err) => {
      if (err && typeof err === "object" && err.command && err.command.name === "info") {
        logger.debug({ queueName, err }, "Ignored internal BullMQ info command error");
      } else {
        logger.error({ queueName }, err, "Queue error");
      }
    });

    queues.set(queueName, queue);
  }

  return queues.get(queueName);
}

function getClickQueues(redisConnection) {
  return {
    clickQueue: getQueue(constants.QUEUE.CLICK_EVENTS_QUEUE, redisConnection),
    clickDlq: getQueue(constants.QUEUE.CLICK_EVENTS_DLQ, redisConnection),
  };
}

/**
 * Hash an IP address using SHA-256.
 * @param {string} ip - IP address to hash
 * @returns {string} - SHA-256 hash of the IP
 */
function hashIp(ip) {
  return crypto.createHash("sha256").update(ip).digest("hex");
}

/**
 * Extract client IP from request, accounting for proxies.
 * @param {object} req - Express request object
 * @returns {string} - Client IP address
 */
function getClientIp(req) {
  return (
    req.headers["x-forwarded-for"]?.split(",")[0].trim() ||
    req.connection.remoteAddress ||
    req.socket.remoteAddress ||
    "0.0.0.0"
  );
}

/**
 * Snapshot the cheap raw request fields needed for analytics.
 * This performs no hashing, no GeoIP lookup, no validation, and no
 * queue I/O, so it is safe to call on the redirect hot path before
 * the 301 is sent. The expensive preparation happens later in
 * `enqueueClickFromContext`, after the response has been flushed.
 *
 * @param {string} slug - Short slug
 * @param {object} req - Express request object
 * @param {Date} [timestamp] - Click timestamp (defaults to now)
 * @returns {{slug: string, clientIp: string, userAgent: string, referrer: string|null, geoHeaderCountry: string|null, timestamp: Date}}
 */
function captureClickContext(slug, req, timestamp = new Date()) {
  const geoHeader = process.env.GEOIP_HEADER_NAME;
  return {
    slug,
    clientIp: getClientIp(req),
    userAgent: req.headers["user-agent"] || "",
    referrer: req.headers["referer"] || null,
    geoHeaderCountry: geoHeader ? req.headers[geoHeader] || null : null,
    timestamp: timestamp instanceof Date ? timestamp : new Date(timestamp),
  };
}

/**
 * Perform the expensive analytics preparation (SHA-256 hashing, GeoIP
 * lookup, payload validation) and submit the click job to BullMQ.
 * Intended to run after the redirect response has been sent, so this
 * work no longer delays the 301. The resulting payload and queue
 * behavior are identical to `enqueueClick`.
 *
 * @param {object} queue - BullMQ Queue instance
 * @param {object} ctx - Context captured by `captureClickContext`
 */
async function enqueueClickFromContext(queue, ctx) {
  const ipHash = hashIp(ctx.clientIp);

  // 1. Prefer the explicitly configured geo header captured pre-redirect
  let country = ctx.geoHeaderCountry || null;

  // 2. Fallback to geoip-lite lookup
  if (!country) {
    try {
      const geo = geoip.lookup(ctx.clientIp);
      country = geo ? geo.country : null;
    } catch (err) {
      logger.warn({ ipHash }, err, "GeoIP lookup failed");
    }
  }

  // 3. Use "unknown" sentinel for missing/failed lookups
  country = country || "unknown";

    const jobId = `${ctx.slug}-${ctx.timestamp.getTime()}`;
    try {
      // Fire-and-forget: don't await, add to queue without blocking
      const payload = buildClickEventPayload({
        slug: ctx.slug,
        timestamp: ctx.timestamp,
        ipHash,
        userAgent: ctx.userAgent,
        referrer: ctx.referrer,
        country,
      });

      queue.add("click", payload, { jobId }).catch((err) => {
        logger.error({ slug: ctx.slug, jobId, ipHash }, err, "Failed to enqueue click event");
      });
    } catch (err) {
      // Queue enqueue failure is non-critical; log and continue
      logger.error({ slug: ctx.slug, jobId, ipHash }, err, "Failed to enqueue click event");
    }

}

/**
 * Enqueue a click event asynchronously (non-blocking).
 * @param {object} queue - BullMQ Queue instance
 * @param {string} slug - Short slug
 * @param {object} req - Express request object
 * @param {Date} [timestamp] - Click timestamp (defaults to now)
 */
async function enqueueClick(queue, slug, req, timestamp = new Date()) {
  return enqueueClickFromContext(queue, captureClickContext(slug, req, timestamp));
}

module.exports = {
  CLICK_EVENTS_QUEUE: constants.QUEUE.CLICK_EVENTS_QUEUE,
  CLICK_EVENTS_DLQ: constants.QUEUE.CLICK_EVENTS_DLQ,
  getQueue,
  getClickQueues,
  hashIp,
  getClientIp,
  captureClickContext,
  enqueueClickFromContext,
  enqueueClick,
};
