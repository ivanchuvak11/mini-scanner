import { ExchangeWebSocketClient } from '../websocketClient.js';

const PING_INTERVAL_MS = 20_000;

export function createBybitClient({ pair, logger, reconnectMinMs, reconnectMaxMs, onQuote }) {
  const symbol = pair.toUpperCase();
  let pingTimer = null;
  const clearPingTimer = () => {
    if (pingTimer) {
      clearInterval(pingTimer);
      pingTimer = null;
    }
  };

  const client = new ExchangeWebSocketClient({
    exchange: 'bybit',
    url: 'wss://stream.bybit.com/v5/public/linear',
    logger,
    reconnectMinMs,
    reconnectMaxMs,
    onQuote,
    parseMessage: (raw, receivedAt) => parseBybitTicker(raw, receivedAt),
    onOpen: (socket) => {
      socket.send(JSON.stringify({ op: 'subscribe', args: [`tickers.${symbol}`] }));
      pingTimer = setInterval(() => {
        if (socket.readyState === 1) {
          socket.send(JSON.stringify({ op: 'ping' }));
        }
      }, PING_INTERVAL_MS);
    },
    onClose: clearPingTimer
  });

  const originalStop = client.stop.bind(client);
  client.stop = () => {
    clearPingTimer();
    originalStop();
  };

  return client;
}

export function parseBybitTicker(raw, receivedAt = Date.now()) {
  const message = JSON.parse(raw);
  if (!message.topic?.startsWith('tickers.') || !message.data) {
    return null;
  }

  const data = Array.isArray(message.data) ? message.data[0] : message.data;
  const bid = Number(data.bid1Price);
  const ask = Number(data.ask1Price);

  if (!data.symbol || !Number.isFinite(bid) || !Number.isFinite(ask)) {
    return null;
  }

  return {
    exchange: 'bybit',
    symbol: data.symbol,
    bid,
    ask,
    receivedAt
  };
}
