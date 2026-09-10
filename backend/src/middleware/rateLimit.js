const {
  checkRateLimit,
  setRateLimitHeaders,
} = require("../services/rateLimiter");
const { getClientIp } = require("../services/queue");

function createRateLimitMiddleware(redisClient, options = {}) {
  const enabled =
    typeof options === 'boolean' ? options : options.enabled !== false;

  return function rateLimit(endpoint, config) {
    return async (req, res, next) => {
      const now = new Date();

      if (!enabled) {
        req.rateLimitNow = now;
        return next();
      }
      const result = await checkRateLimit(
        redisClient,
        getClientIp(req),
        endpoint,
        config.limit,
        now,
        config.windowMs,
      );

      setRateLimitHeaders(res, result, config.limit);
      if (!result.allowed) {
        return res.status(429).json({ error: "Rate limit exceeded" });
      }

      req.rateLimitNow = now;
      return next();
    };
  };
}

module.exports = {
  createRateLimitMiddleware,
};
