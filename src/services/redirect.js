const { findActiveUrlBySlug } = require("../data/urlRepository");

const REDIRECT_CACHE_TTL_SECONDS = 86400; // 24 hours

/**
 * Retrieve a URL for redirect, with Redis-first lookup and MongoDB fallback.
 * If found in MongoDB, repopulates the Redis cache.
 *
 * @param {string} slug - The short slug to look up
 * @param {object} cacheClient - Redis ioredis client
 * @param {Date} [now] - Current time (for expiry checks)
 * @returns {Promise<string|null>} - Original URL or null if not found/expired
 */
async function getRedirectUrl(slug, cacheClient, now = new Date()) {
  const cacheKey = `url:${slug}`;

  // Try Redis first
  const cachedUrl = await cacheClient.get(cacheKey);
  if (cachedUrl) {
    return cachedUrl;
  }

  // Cache miss — fall back to MongoDB
  const urlRecord = await findActiveUrlBySlug(slug, now);
  if (!urlRecord) {
    // Not found or expired
    return null;
  }

  // Repopulate Redis cache with the found URL
  await cacheClient.set(
    cacheKey,
    urlRecord.originalUrl,
    "EX",
    REDIRECT_CACHE_TTL_SECONDS,
  );

  return urlRecord.originalUrl;
}

module.exports = {
  getRedirectUrl,
};
