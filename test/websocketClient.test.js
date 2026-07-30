import assert from 'node:assert/strict';
import test from 'node:test';
import { ExchangeWebSocketClient } from '../src/websocketClient.js';

class MockWebSocket {
  constructor(url) {
    this.url = url;
    this.listeners = {};
  }

  addEventListener(event, listener) {
    if (!this.listeners[event]) {
      this.listeners[event] = [];
    }
    this.listeners[event].push(listener);
  }

  emit(event, data) {
    for (const listener of this.listeners[event] || []) {
      listener(data);
    }
  }

  close() {
    this.emit('close', { code: 1000 });
  }
}

function createMemoryLogger() {
  const entries = [];
  const logger = {};
  for (const level of ['debug', 'info', 'warn', 'error']) {
    logger[level] = (event, details = {}) => entries.push({ level, event, ...details });
  }
  logger.entries = entries;
  return logger;
}

test('does not reset reconnectAttempt on open, but resets on first valid message', () => {
  const logger = createMemoryLogger();
  let latestSocket = null;

  const client = new ExchangeWebSocketClient({
    exchange: 'binance',
    url: 'wss://example.com',
    logger,
    reconnectMinMs: 1000,
    reconnectMaxMs: 30000,
    parseMessage: (data) => (data === 'valid' ? { symbol: 'BTCUSDT', bid: 100, ask: 101 } : null),
    onQuote: () => {},
    WebSocketImpl: function Mock(url) {
      latestSocket = new MockWebSocket(url);
      return latestSocket;
    }
  });

  client.reconnectAttempt = 2;

  client.start();

  latestSocket.emit('open', {});
  assert.equal(client.reconnectAttempt, 2, 'reconnectAttempt should not be reset on open event');

  latestSocket.emit('message', { data: 'ping' });
  assert.equal(client.reconnectAttempt, 2, 'reconnectAttempt should not be reset on non-quote message');

  latestSocket.emit('message', { data: 'valid' });
  assert.equal(client.reconnectAttempt, 0, 'reconnectAttempt should be reset on first valid quote message');

  client.stop();
});
