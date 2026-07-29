import assert from 'node:assert/strict';
import test from 'node:test';
import { SpreadState } from '../src/spreadState.js';

function createMemoryLogger() {
  const entries = [];
  const logger = {};
  for (const level of ['debug', 'info', 'warn', 'error']) {
    logger[level] = (event, details = {}) => entries.push({ level, event, ...details });
  }
  logger.entries = entries;
  return logger;
}

test('calculates executable spread from fresh quotes', () => {
  let now = 1_000;
  const logger = createMemoryLogger();
  const state = new SpreadState({
    pair: 'BTCUSDT',
    staleAfterMs: 10_000,
    thresholdPercent: 0.3,
    logger,
    now: () => now
  });

  state.updateQuote({ exchange: 'binance', symbol: 'BTCUSDT', bid: 100, ask: 101, receivedAt: now });
  state.updateQuote({ exchange: 'bybit', symbol: 'BTCUSDT', bid: 103, ask: 104, receivedAt: now });

  const snapshot = state.getSnapshot();

  assert.equal(snapshot.spread.available, true);
  assert.equal(snapshot.spread.buyExchange, 'binance');
  assert.equal(snapshot.spread.sellExchange, 'bybit');
  assert.equal(snapshot.spread.thresholdExceeded, true);
  assert.equal(Number(snapshot.spread.percent.toFixed(4)), 1.9802);
});

test('does not calculate spread with a stale quote', () => {
  let now = 1_000;
  const logger = createMemoryLogger();
  const state = new SpreadState({
    pair: 'BTCUSDT',
    staleAfterMs: 500,
    thresholdPercent: 0.3,
    logger,
    now: () => now
  });

  state.updateQuote({ exchange: 'binance', symbol: 'BTCUSDT', bid: 100, ask: 101, receivedAt: now });
  state.updateQuote({ exchange: 'bybit', symbol: 'BTCUSDT', bid: 103, ask: 104, receivedAt: now });
  now = 1_700;

  const snapshot = state.getSnapshot();

  assert.equal(snapshot.quotes.binance.fresh, false);
  assert.equal(snapshot.quotes.bybit.fresh, false);
  assert.equal(snapshot.spread.available, false);
  assert.equal(snapshot.spread.reason, 'not_enough_fresh_quotes');
  assert.equal(logger.entries.filter((entry) => entry.event === 'quote_stale').length, 2);
});

test('logs threshold crossing once for the same spread snapshot', () => {
  let now = 1_000;
  const logger = createMemoryLogger();
  const state = new SpreadState({
    pair: 'BTCUSDT',
    staleAfterMs: 10_000,
    thresholdPercent: 0.3,
    logger,
    now: () => now
  });

  state.updateQuote({ exchange: 'binance', symbol: 'BTCUSDT', bid: 100, ask: 101, receivedAt: now });
  state.updateQuote({ exchange: 'bybit', symbol: 'BTCUSDT', bid: 103, ask: 104, receivedAt: now });

  state.getSnapshot();
  state.getSnapshot();

  assert.equal(logger.entries.filter((entry) => entry.event === 'spread_threshold_exceeded').length, 1);
});

test('fresh quote after stale state participates in spread again', () => {
  let now = 1_000;
  const logger = createMemoryLogger();
  const state = new SpreadState({
    pair: 'BTCUSDT',
    staleAfterMs: 500,
    thresholdPercent: 0.3,
    logger,
    now: () => now
  });

  state.updateQuote({ exchange: 'binance', symbol: 'BTCUSDT', bid: 100, ask: 101, receivedAt: now });
  state.updateQuote({ exchange: 'bybit', symbol: 'BTCUSDT', bid: 103, ask: 104, receivedAt: now });
  now = 1_700;
  state.getSnapshot();

  state.updateQuote({ exchange: 'binance', symbol: 'BTCUSDT', bid: 100, ask: 101, receivedAt: now });
  state.updateQuote({ exchange: 'bybit', symbol: 'BTCUSDT', bid: 103, ask: 104, receivedAt: now });

  const snapshot = state.getSnapshot();

  assert.equal(snapshot.quotes.binance.fresh, true);
  assert.equal(snapshot.quotes.bybit.fresh, true);
  assert.equal(snapshot.spread.available, true);
  assert.equal(logger.entries.filter((entry) => entry.event === 'quote_fresh_again').length, 2);
});
