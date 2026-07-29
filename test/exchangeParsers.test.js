import assert from 'node:assert/strict';
import test from 'node:test';
import { parseBinanceBookTicker } from '../src/exchanges/binance.js';
import { parseBybitTicker } from '../src/exchanges/bybit.js';

test('parses Binance bookTicker messages into normalized quotes', () => {
  const quote = parseBinanceBookTicker(JSON.stringify({
    s: 'BTCUSDT',
    b: '118000.12',
    a: '118000.13'
  }), 1_000);

  assert.deepEqual(quote, {
    exchange: 'binance',
    symbol: 'BTCUSDT',
    bid: 118000.12,
    ask: 118000.13,
    receivedAt: 1_000
  });
});

test('parses Bybit ticker snapshots into normalized quotes', () => {
  const quote = parseBybitTicker(JSON.stringify({
    topic: 'tickers.BTCUSDT',
    data: {
      symbol: 'BTCUSDT',
      bid1Price: '118001.10',
      ask1Price: '118001.20'
    }
  }), 2_000);

  assert.deepEqual(quote, {
    exchange: 'bybit',
    symbol: 'BTCUSDT',
    bid: 118001.1,
    ask: 118001.2,
    receivedAt: 2_000
  });
});

test('uses previous Bybit values for partial delta updates', () => {
  const previous = {
    exchange: 'bybit',
    symbol: 'BTCUSDT',
    bid: 118001.1,
    ask: 118001.2,
    receivedAt: 2_000
  };

  const quote = parseBybitTicker(JSON.stringify({
    topic: 'tickers.BTCUSDT',
    data: {
      symbol: 'BTCUSDT',
      bid1Price: '118002.50'
    }
  }), 3_000, previous);

  assert.deepEqual(quote, {
    exchange: 'bybit',
    symbol: 'BTCUSDT',
    bid: 118002.5,
    ask: 118001.2,
    receivedAt: 3_000
  });
});

test('ignores unsupported exchange heartbeat messages', () => {
  assert.equal(parseBybitTicker(JSON.stringify({ op: 'pong' }), 1_000), null);
});
