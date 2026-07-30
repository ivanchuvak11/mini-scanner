import assert from 'node:assert/strict';
import test from 'node:test';
import { readConfig } from '../src/config.js';

test('throws error when EXCHANGES contains duplicates', () => {
  const env = {
    PAIR: 'BTCUSDT',
    EXCHANGES: 'binance,binance',
    PORT: '3000',
    SPREAD_THRESHOLD_PERCENT: '0.3',
    STALE_AFTER_SECONDS: '10',
    RECONNECT_MIN_MS: '1000',
    RECONNECT_MAX_MS: '30000',
    LOG_LEVEL: 'info'
  };

  assert.throws(() => readConfig(env), /Exchanges must be distinct/);
});

test('throws error when SPREAD_THRESHOLD_PERCENT is negative', () => {
  const env = {
    PAIR: 'BTCUSDT',
    EXCHANGES: 'binance,bybit',
    PORT: '3000',
    SPREAD_THRESHOLD_PERCENT: '-0.5',
    STALE_AFTER_SECONDS: '10',
    RECONNECT_MIN_MS: '1000',
    RECONNECT_MAX_MS: '30000',
    LOG_LEVEL: 'info'
  };

  assert.throws(() => readConfig(env), /SPREAD_THRESHOLD_PERCENT must be non-negative/);
});

test('throws error when PORT is out of range', () => {
  const envLow = {
    PAIR: 'BTCUSDT',
    EXCHANGES: 'binance,bybit',
    PORT: '0',
    SPREAD_THRESHOLD_PERCENT: '0.3',
    STALE_AFTER_SECONDS: '10',
    RECONNECT_MIN_MS: '1000',
    RECONNECT_MAX_MS: '30000',
    LOG_LEVEL: 'info'
  };

  const envHigh = {
    ...envLow,
    PORT: '70000'
  };

  assert.throws(() => readConfig(envLow), /PORT must be between 1 and 65535/);
  assert.throws(() => readConfig(envHigh), /PORT must be between 1 and 65535/);
});
