const { findActiveUrlBySlug } = require("../data/urlRepository");
const logger = require("../lib/logger");
const constants = require("../config/constants");


/**
 * Retrieve a URL for redirect, with Redis-first lookup and MongoDB fallback.
 * If found in MongoDB, repopulates the Redis cache.
 * Validates expiry on every access (soft-expiry check).
 *
 * @param {string} slug - The short slug to look up
 * @param {object} cacheClient - Redis ioredis client
 * @param {Date} [now] - Current time (for expiry checks)
 * @returns {Promise<string|null>} - Original URL or null if not found/expired
 */
async function getRedirectUrl(slug, cacheClient, now = new Date()) {
  const cacheKey = `url:${slug}`;
  const negativeValue = constants.CACHE.NEGATIVE_VALUE;
  const negativeTtl = constants.CACHE.NEGATIVE_TTL_SECONDS;

  // Try Redis first
  const cachedMetadata = await cacheClient.get(cacheKey);
  if (cachedMetadata) {
    // Short-lived negative cache: a previous MongoDB miss. Serve the
    // 404 without touching MongoDB again.
    if (cachedMetadata === negativeValue) {
      return null;
    }
    try {
      const metadata = JSON.parse(cachedMetadata);
      // Forward-compatible check in case the sentinel encoding changes.
      if (metadata && metadata.notFound === true) {
        return null;
      }
      const { originalUrl, expiresAt } = metadata;

      // Check if the cached entry has expired
      if (expiresAt) {
        const expiryTime = new Date(expiresAt);
        if (now >= expiryTime) {
          // Soft-expired: replace with a short-lived negative entry so
          // repeated requests for this expired slug do not hit MongoDB.
          // Safe because slug -> URL is immutable; an expired slug can
          // never become active again.
          await cacheClient
            .set(cacheKey, negativeValue, "EX", negativeTtl)
            .catch(() => {});
          return null;
        }
      }

      return originalUrl;
    } catch (_err) {
      logger.warn({ slug }, "Malformed cache entry for redirect");
      // Malformed cache entry; treat as miss
    }
  }

  // Cache miss — fall back to MongoDB
  const urlRecord = await findActiveUrlBySlug(slug, now);
  if (!urlRecord) {
    // Not found or expired: write a short-lived negative cache entry so
    // repeated requests for this unknown slug do not reach MongoDB.
    // NX avoids clobbering a positive entry if the slug was created
    // concurrently between the MongoDB lookup and this write, bounding
    // the worst-case masking window to NEGATIVE_TTL_SECONDS.
    await cacheClient
      .set(cacheKey, negativeValue, "EX", negativeTtl, "NX")
      .catch((err) => {
        logger.warn({ slug, err }, "Failed to write negative redirect cache");
      });
    return null;
  }

  // Repopulate Redis cache with the found URL and its expiry
  const metadata = {
    originalUrl: urlRecord.originalUrl,
    expiresAt: urlRecord.expiresAt ? urlRecord.expiresAt.toISOString() : null,
  };
    await cacheClient.set(
      cacheKey,
      JSON.stringify(metadata),
      "EX",
      constants.CACHE.REDIRECT_TTL_SECONDS,
    ).catch((err) => {
    logger.warn({ slug, err }, "Failed to repopulate redirect cache");
  });

  return urlRecord.originalUrl;
}

module.exports = {
  getRedirectUrl,
};
