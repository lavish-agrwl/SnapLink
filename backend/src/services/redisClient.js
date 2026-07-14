const IORedis = require("ioredis");

const clients = new Map();

function getRedisClient(redisUrl) {
  const url = redisUrl || process.env.REDIS_URL || "redis://localhost:6379";

  if (!clients.has(url)) {
    const client = new IORedis(url);
    client.on("error", () => {});
    clients.set(url, client);
  }

  return clients.get(url);
}

module.exports = {
  getRedisClient,
};
