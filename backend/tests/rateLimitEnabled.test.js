const { loadEnv, parseRateLimitEnabled } = require('../src/config/env');
const { createRateLimitMiddleware } = require('../src/middleware/rateLimit');
const constants = require('../src/config/constants');

function baseEnvSource(overrides = {}) {
  return {
    MONGODB_URI: 'mongodb://localhost:27017/url-shortener',
    REDIS_URL: 'redis://localhost:6379',
    BASE_URL: 'http://localhost:3000',
    FRONTEND_URL: 'http://localhost:5173',
    ADMIN_PASSWORD: 'test-password',
    ...overrides,
  };
}

function createPipelineStub(zcardCount) {
  const stub = {};
  stub.zremrangebyscore = () => stub;
  stub.zadd = () => stub;
  stub.zcard = () => stub;
  stub.expire = () => stub;
  stub.exec = async () => [[null, 0], [null, 0], [null, zcardCount], [null, undefined]];
  return stub;
}

function createMockRes() {
  const headers = {};
  const res = {
    headers,
    statusCode: null,
    body: null,
    set: (name, value) => {
      headers[name] = value;
    },
    status: (code) => {
      res.statusCode = code;
      return res;
    },
    json: (payload) => {
      res.body = payload;
      return res;
    },
  };
  return res;
}

describe('RATE_LIMIT_ENABLED env parsing', () => {
  test('"true" enables rate limiting', () => {
    expect(parseRateLimitEnabled('true')).toBe(true);
    expect(loadEnv(baseEnvSource({ RATE_LIMIT_ENABLED: 'true' })).RATE_LIMIT_ENABLED).toBe(true);
  });

  test('"false" disables rate limiting (string is not truthy)', () => {
    expect(parseRateLimitEnabled('false')).toBe(false);
    expect(loadEnv(baseEnvSource({ RATE_LIMIT_ENABLED: 'false' })).RATE_LIMIT_ENABLED).toBe(false);
  });

  test('missing variable keeps rate limiting enabled', () => {
    const source = baseEnvSource();
    delete source.RATE_LIMIT_ENABLED;
    expect(loadEnv(source).RATE_LIMIT_ENABLED).toBe(true);
  });

  test('unrecognized value keeps rate limiting enabled', () => {
    expect(parseRateLimitEnabled('0')).toBe(true);
    expect(parseRateLimitEnabled('no')).toBe(true);
    expect(parseRateLimitEnabled('')).toBe(true);
    expect(parseRateLimitEnabled(undefined)).toBe(true);
  });
});

describe('rate limit middleware kill switch', () => {
  const config = { limit: 1, windowMs: 60 * 1000 };

  test('enabled: blocks over-limit requests with 429', async () => {
    const redisClient = { pipeline: () => createPipelineStub(5) };
    const rateLimit = createRateLimitMiddleware(redisClient, { enabled: true });
    const req = { headers: {}, connection: {}, socket: {} };
    const res = createMockRes();
    const next = jest.fn();

    await rateLimit('shorten', config)(req, res, next);

    expect(res.statusCode).toBe(429);
    expect(res.body).toEqual({ error: 'Rate limit exceeded' });
    expect(next).not.toHaveBeenCalled();
  });

  test('enabled by default: single-arg factory preserves existing behavior', async () => {
    const redisClient = { pipeline: () => createPipelineStub(5) };
    const rateLimit = createRateLimitMiddleware(redisClient);
    const req = { headers: {}, connection: {}, socket: {} };
    const res = createMockRes();
    const next = jest.fn();

    await rateLimit('shorten', config)(req, res, next);

    expect(res.statusCode).toBe(429);
    expect(next).not.toHaveBeenCalled();
  });

  test('disabled: bypasses Redis entirely and calls next', async () => {
    const redisClient = {
      pipeline: () => {
        throw new Error('Redis must not be touched when disabled');
      },
    };
    const rateLimit = createRateLimitMiddleware(redisClient, { enabled: false });
    const req = { headers: {}, connection: {}, socket: {} };
    const res = createMockRes();
    const next = jest.fn();

    await rateLimit('shorten', config)(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(req.rateLimitNow).toBeInstanceOf(Date);
    expect(res.statusCode).toBeNull();
    expect(res.headers).toEqual({});
  });
});

describe('existing rate-limit configuration is unchanged', () => {
  test('route-specific limits and windows are intact', () => {
    expect(constants.RATE_LIMIT.LIMITS).toEqual({
      redirect: { limit: 60, windowMs: 60 * 1000 },
      shorten: { limit: 10, windowMs: 60 * 1000 },
      analytics: { limit: 30, windowMs: 60 * 1000 },
      admin: { limit: 120, windowMs: 60 * 1000 },
      adminLogin: { limit: 5, windowMs: 15 * 60 * 1000 },
    });
  });
});
