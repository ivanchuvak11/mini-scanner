import { ExchangeWebSocketClient } from '../websocketClient.js';

export function createBinanceClient({ pair, logger, reconnectMinMs, reconnectMaxMs, onQuote }) {
  const symbol = pair.toUpperCase();
  const streamSymbol = symbol.toLowerCase();

  return new ExchangeWebSocketClient({
    exchange: 'binance',
    url: `wss://stream.binance.com:9443/ws/${streamSymbol}@bookTicker`,
    logger,
    reconnectMinMs,
    reconnectMaxMs,
    onQuote,
    parseMessage: (raw, receivedAt) => parseBinanceBookTicker(raw, receivedAt)
  });
}

export function parseBinanceBookTicker(raw, receivedAt = Date.now()) {
  const message = JSON.parse(raw);
  const bid = Number(message.b);
  const ask = Number(message.a);

  if (!message.s || !Number.isFinite(bid) || !Number.isFinite(ask)) {
    return null;
  }

  return {
    exchange: 'binance',
    symbol: message.s,
    bid,
    ask,
    receivedAt
  };
}
