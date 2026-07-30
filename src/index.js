import { loadDotEnv, readConfig } from './config.js';
import { createLogger } from './logger.js';
import { SpreadState } from './spreadState.js';
import { createHttpServer } from './httpServer.js';
import { createBinanceClient } from './exchanges/binance.js';
import { createBybitClient } from './exchanges/bybit.js';

loadDotEnv();

const config = readConfig();
const logger = createLogger({ level: config.logLevel });
const state = new SpreadState({
  pair: config.pair,
  staleAfterMs: config.staleAfterMs,
  thresholdPercent: config.spreadThresholdPercent,
  logger
});
state.startStaleCheck(1000);

const factories = {
  binance: createBinanceClient,
  bybit: createBybitClient
};

const clients = config.exchanges.map((exchange) => factories[exchange]({
  pair: config.pair,
  logger,
  reconnectMinMs: config.reconnectMinMs,
  reconnectMaxMs: config.reconnectMaxMs,
  onQuote: (quote) => state.updateQuote(quote)
}));

const server = createHttpServer({ state, logger });

server.listen(config.port, () => {
  logger.info('http_server_started', {
    port: config.port,
    pair: config.pair,
    exchanges: config.exchanges
  });
  for (const client of clients) {
    client.start();
  }
});

const shutdown = () => {
  logger.info('service_stopping');
  state.stopStaleCheck();
  for (const client of clients) {
    client.stop();
  }
  server.close(() => {
    logger.info('service_stopped');
    process.exit(0);
  });
};

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
