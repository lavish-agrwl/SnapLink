require('dotenv').config();

const requiredVariables = [
  'MONGODB_URI',
  'REDIS_URL',
  'BASE_URL',
  'FRONTEND_URL',
  'ADMIN_PASSWORD',
];
const allowedNodeEnvs = new Set(['development', 'test', 'production']);

function validateRequiredValue(name, value) {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value.trim();
}

function loadEnv(source = process.env) {
  const env = {};

  for (const name of requiredVariables) {
    env[name] = validateRequiredValue(name, source[name]);
  }

  const nodeEnv = source.NODE_ENV ? source.NODE_ENV.trim() : 'development';

  if (!allowedNodeEnvs.has(nodeEnv)) {
    throw new Error('NODE_ENV must be development, test, or production');
  }

  env.NODE_ENV = nodeEnv;
  env.RATE_LIMIT_ENABLED = parseRateLimitEnabled(source.RATE_LIMIT_ENABLED);

  return Object.freeze(env);
}

function parseRateLimitEnabled(value) {
  if (typeof value !== 'string') {
    return true;
  }

  const normalized = value.trim().toLowerCase();

  if (normalized === 'true') {
    return true;
  }

  if (normalized === 'false') {
    return false;
  }

  return true;
}

module.exports = {
  loadEnv,
  parseRateLimitEnabled,
};
