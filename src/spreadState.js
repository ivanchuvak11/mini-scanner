export class SpreadState {
  constructor({ pair, staleAfterMs, thresholdPercent, logger, now = () => Date.now() }) {
    this.pair = pair;
    this.staleAfterMs = staleAfterMs;
    this.thresholdPercent = thresholdPercent;
    this.logger = logger;
    this.now = now;
    this.quotes = new Map();
    this.alertKey = null;
    this.currentSnapshot = null;
    this.timer = null;
  }

  startStaleCheck(intervalMs = 1000) {
    if (this.timer) return;
    this.timer = setInterval(() => this.evaluate(), intervalMs);
    if (this.timer.unref) {
      this.timer.unref();
    }
  }

  stopStaleCheck() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
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

    this.evaluate();
  }

  evaluate() {
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

    this.currentSnapshot = {
      pair: this.pair,
      now: new Date(now).toISOString(),
      staleAfterSeconds: this.staleAfterMs / 1000,
      thresholdPercent: this.thresholdPercent,
      quotes,
      spread
    };

    return this.currentSnapshot;
  }

  getSnapshot() {
  if (!this.currentSnapshot) {
    return {
      pair: this.pair,
      now: new Date(this.now()).toISOString(),
      staleAfterSeconds: this.staleAfterMs / 1000,
      thresholdPercent: this.thresholdPercent,
      quotes: {},
      spread: {
        available: false,
        reason: 'not_enough_fresh_quotes',
        freshExchanges: []
      }
    };
  }

  return this.currentSnapshot;
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

    let bestPair = null;
    let maxPercent = -Infinity;

    for (const buyCandidate of freshQuotes) {
      for (const sellCandidate of freshQuotes) {
        if (buyCandidate.exchange === sellCandidate.exchange) {
          continue;
        }
        const percent = ((sellCandidate.bid - buyCandidate.ask) / buyCandidate.ask) * 100;
        if (percent > maxPercent) {
          maxPercent = percent;
          bestPair = { buy: buyCandidate, sell: sellCandidate, percent };
        }
      }
    }

    if (!bestPair) {
      this.alertKey = null;
      return {
        available: false,
        reason: 'not_enough_fresh_quotes',
        freshExchanges: freshQuotes.map((quote) => quote.exchange)
      };
    }

    const { buy, sell, percent } = bestPair;
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
