import fs from 'node:fs';
import path from 'node:path';

const DEFAULTS = {
  PORT: '3000',
  PAIR: 'BTCUSDT',
  EXCHANGES: 'binance,bybit',
  SPREAD_THRESHOLD_PERCENT: '0.3',
  STALE_AFTER_SECONDS: '10',
  RECONNECT_MIN_MS: '1000',
  RECONNECT_MAX_MS: '30000',
  LOG_LEVEL: 'info'
};

export function loadDotEnv(filePath = path.resolve(process.cwd(), '.env')) {
  if (!fs.existsSync(filePath)) {
    return;
  }

  const lines = fs.readFileSync(filePath, 'utf8').split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) {
      continue;
    }

    const separator = trimmed.indexOf('=');
    if (separator === -1) {
      continue;
    }

    const key = trimmed.slice(0, separator).trim();
    const rawValue = trimmed.slice(separator + 1).trim();
    const value = rawValue.replace(/^['"]|['"]$/g, '');
    if (key && process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
}

export function readConfig(env = process.env) {
  const get = (key) => env[key] ?? DEFAULTS[key];
  const pair = get('PAIR').replace(/[^a-z0-9]/gi, '').toUpperCase();
  const exchanges = get('EXCHANGES')
    .split(',')
    .map((exchange) => exchange.trim().toLowerCase())
    .filter(Boolean);

  const config = {
    port: parseInteger(get('PORT'), 'PORT'),
    pair,
    exchanges,
    spreadThresholdPercent: parseNumber(get('SPREAD_THRESHOLD_PERCENT'), 'SPREAD_THRESHOLD_PERCENT'),
    staleAfterMs: parseNumber(get('STALE_AFTER_SECONDS'), 'STALE_AFTER_SECONDS') * 1000,
    reconnectMinMs: parseInteger(get('RECONNECT_MIN_MS'), 'RECONNECT_MIN_MS'),
    reconnectMaxMs: parseInteger(get('RECONNECT_MAX_MS'), 'RECONNECT_MAX_MS'),
    logLevel: get('LOG_LEVEL').toLowerCase()
  };

  validateConfig(config);
  return config;
}

function parseNumber(value, name) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    throw new Error(`${name} must be a finite number`);
  }
  return parsed;
}

function parseInteger(value, name) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isInteger(parsed)) {
    throw new Error(`${name} must be an integer`);
  }
  return parsed;
}

function validateConfig(config) {
  if (!config.pair) {
    throw new Error('PAIR must not be empty');
  }

  if (config.port < 1 || config.port > 65535) {
    throw new Error('PORT must be between 1 and 65535');
  }

  if (config.exchanges.length !== 2) {
    throw new Error('Exactly two exchanges must be configured');
  }

  if (new Set(config.exchanges).size !== config.exchanges.length) {
    throw new Error('Exchanges must be distinct');
  }

  const supported = new Set(['binance', 'bybit']);
  for (const exchange of config.exchanges) {
    if (!supported.has(exchange)) {
      throw new Error(`Unsupported exchange: ${exchange}`);
    }
  }

  if (config.spreadThresholdPercent < 0) {
    throw new Error('SPREAD_THRESHOLD_PERCENT must be non-negative');
  }

  if (config.staleAfterMs <= 0) {
    throw new Error('STALE_AFTER_SECONDS must be greater than 0');
  }

  if (config.reconnectMinMs <= 0 || config.reconnectMaxMs < config.reconnectMinMs) {
    throw new Error('Reconnect settings are invalid');
  }
}
