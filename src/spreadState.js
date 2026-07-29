export class SpreadState {
  constructor({ pair, staleAfterMs, thresholdPercent, logger, now = () => Date.now() }) {
    this.pair = pair;
    this.staleAfterMs = staleAfterMs;
    this.thresholdPercent = thresholdPercent;
    this.logger = logger;
    this.now = now;
    this.quotes = new Map();
    this.alertKey = null;
  }

  updateQuote(quote) {
    const normalized = normalizeQuote(quote, this.now());
    const previous = this.quotes.get(normalized.exchange);

    this.quotes.set(normalized.exchange, {
      ...normalized,
      staleLogged: false
    });

    this.logger.debug('quote_updated', {
      exchange: normalized.exchange,
      symbol: normalized.symbol,
      bid: normalized.bid,
      ask: normalized.ask
    });

    if (previous?.staleLogged) {
      this.logger.info('quote_fresh_again', {
        exchange: normalized.exchange,
        symbol: normalized.symbol
      });
    }
  }

  getSnapshot() {
    const now = this.now();
    const quotes = {};
    const freshQuotes = [];

    for (const [exchange, quote] of this.quotes.entries()) {
      const ageMs = now - quote.receivedAt;
      const fresh = ageMs <= this.staleAfterMs;

      if (!fresh && !quote.staleLogged) {
        quote.staleLogged = true;
        this.logger.warn('quote_stale', {
          exchange,
          symbol: quote.symbol,
          ageMs,
          staleAfterMs: this.staleAfterMs
        });
      }

      const view = {
        exchange,
        symbol: quote.symbol,
        bid: quote.bid,
        ask: quote.ask,
        lastUpdated: new Date(quote.receivedAt).toISOString(),
        ageMs,
        fresh
      };

      quotes[exchange] = view;
      if (fresh) {
        freshQuotes.push(view);
      }
    }

    const spread = this.calculateSpread(freshQuotes);

    return {
      pair: this.pair,
      now: new Date(now).toISOString(),
      staleAfterSeconds: this.staleAfterMs / 1000,
      thresholdPercent: this.thresholdPercent,
      quotes,
      spread
    };
  }

  calculateSpread(freshQuotes) {
    if (freshQuotes.length < 2) {
      this.alertKey = null;
      return {
        available: false,
        reason: 'not_enough_fresh_quotes',
        freshExchanges: freshQuotes.map((quote) => quote.exchange)
      };
    }

    const buy = freshQuotes.reduce((best, quote) => (quote.ask < best.ask ? quote : best));
    const sell = freshQuotes.reduce((best, quote) => (quote.bid > best.bid ? quote : best));
    const percent = ((sell.bid - buy.ask) / buy.ask) * 100;
    const thresholdExceeded = percent >= this.thresholdPercent;

    if (thresholdExceeded) {
      const alertKey = `${buy.exchange}:${sell.exchange}:${percent.toFixed(4)}`;
      if (alertKey !== this.alertKey) {
        this.alertKey = alertKey;
        this.logger.warn('spread_threshold_exceeded', {
          pair: this.pair,
          percent,
          thresholdPercent: this.thresholdPercent,
          buyExchange: buy.exchange,
          sellExchange: sell.exchange,
          buyAsk: buy.ask,
          sellBid: sell.bid
        });
      }
    } else {
      this.alertKey = null;
    }

    return {
      available: true,
      percent,
      buyExchange: buy.exchange,
      sellExchange: sell.exchange,
      buyAsk: buy.ask,
      sellBid: sell.bid,
      thresholdExceeded
    };
  }
}

function normalizeQuote(quote, fallbackReceivedAt) {
  const bid = Number(quote.bid);
  const ask = Number(quote.ask);
  const receivedAt = Number(quote.receivedAt ?? fallbackReceivedAt);

  if (!quote.exchange || !quote.symbol) {
    throw new Error('Quote must include exchange and symbol');
  }

  if (!Number.isFinite(bid) || !Number.isFinite(ask) || bid <= 0 || ask <= 0) {
    throw new Error(`Invalid bid/ask for ${quote.exchange}`);
  }

  if (!Number.isFinite(receivedAt)) {
    throw new Error(`Invalid receivedAt for ${quote.exchange}`);
  }

  return {
    exchange: quote.exchange,
    symbol: quote.symbol,
    bid,
    ask,
    receivedAt
  };
}
