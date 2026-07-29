const elements = {
  pair: document.querySelector('#pair'),
  serviceStatus: document.querySelector('#serviceStatus'),
  refreshButton: document.querySelector('#refreshButton'),
  spreadPercent: document.querySelector('#spreadPercent'),
  spreadState: document.querySelector('#spreadState'),
  buyExchange: document.querySelector('#buyExchange'),
  buyAsk: document.querySelector('#buyAsk'),
  sellExchange: document.querySelector('#sellExchange'),
  sellBid: document.querySelector('#sellBid'),
  threshold: document.querySelector('#threshold'),
  updatedAt: document.querySelector('#updatedAt'),
  exchangeGrid: document.querySelector('#exchangeGrid'),
  staleAfter: document.querySelector('#staleAfter'),
  freshCount: document.querySelector('#freshCount')
};

const knownExchanges = ['binance', 'bybit'];
const formatter = new Intl.NumberFormat('en-US', {
  maximumFractionDigits: 8
});

elements.refreshButton.addEventListener('click', () => refresh());
refresh();
setInterval(refresh, 1_000);

async function refresh() {
  try {
    const response = await fetch('/spread', { cache: 'no-store' });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const snapshot = await response.json();
    render(snapshot);
    setServiceStatus('Live', 'ok');
  } catch (error) {
    setServiceStatus('Offline', 'bad');
    elements.spreadState.textContent = error.message;
  }
}

function render(snapshot) {
  const quotes = snapshot.quotes ?? {};
  const spread = snapshot.spread ?? { available: false };
  const freshQuotes = Object.values(quotes).filter((quote) => quote.fresh);

  elements.pair.textContent = snapshot.pair;
  elements.threshold.textContent = `${formatPercent(snapshot.thresholdPercent)}%`;
  elements.staleAfter.textContent = `${snapshot.staleAfterSeconds}s`;
  elements.freshCount.textContent = `${freshQuotes.length}/${knownExchanges.length}`;
  elements.updatedAt.textContent = `Last update ${formatTime(snapshot.now)}`;

  renderSpread(spread);
  renderQuotes(quotes);
}

function renderSpread(spread) {
  const metric = elements.spreadPercent.closest('.metric');
  metric.classList.toggle('alert', Boolean(spread.thresholdExceeded));
  metric.classList.toggle('ready', Boolean(spread.available && !spread.thresholdExceeded));

  if (!spread.available) {
    elements.spreadPercent.textContent = '--';
    elements.spreadState.textContent = 'Not enough fresh quotes';
    elements.buyExchange.textContent = '--';
    elements.buyAsk.textContent = 'Ask --';
    elements.sellExchange.textContent = '--';
    elements.sellBid.textContent = 'Bid --';
    return;
  }

  elements.spreadPercent.textContent = `${formatPercent(spread.percent)}%`;
  elements.spreadState.textContent = spread.thresholdExceeded ? 'Threshold exceeded' : 'Below threshold';
  elements.buyExchange.textContent = titleCase(spread.buyExchange);
  elements.buyAsk.textContent = `Ask ${formatPrice(spread.buyAsk)}`;
  elements.sellExchange.textContent = titleCase(spread.sellExchange);
  elements.sellBid.textContent = `Bid ${formatPrice(spread.sellBid)}`;
}

function renderQuotes(quotes) {
  elements.exchangeGrid.replaceChildren(...knownExchanges.map((exchange) => {
    const quote = quotes[exchange];
    const card = document.createElement('article');
    card.className = 'quote-card';

    if (!quote) {
      card.innerHTML = `
        <div class="quote-head">
          <h2>${titleCase(exchange)}</h2>
          <span class="quote-status bad">No data</span>
        </div>
        <div class="quote-prices">
          <div class="price-box"><span class="metric-label">Bid</span><strong>--</strong></div>
          <div class="price-box"><span class="metric-label">Ask</span><strong>--</strong></div>
        </div>
        <div class="quote-meta">
          <span>Symbol --</span>
          <span>Age --</span>
        </div>
      `;
      return card;
    }

    card.innerHTML = `
      <div class="quote-head">
        <h2>${titleCase(exchange)}</h2>
        <span class="quote-status ${quote.fresh ? 'ok' : 'bad'}">${quote.fresh ? 'Fresh' : 'Stale'}</span>
      </div>
      <div class="quote-prices">
        <div class="price-box"><span class="metric-label">Bid</span><strong>${formatPrice(quote.bid)}</strong></div>
        <div class="price-box"><span class="metric-label">Ask</span><strong>${formatPrice(quote.ask)}</strong></div>
      </div>
      <div class="quote-meta">
        <span>Symbol ${quote.symbol}</span>
        <span>Age ${formatAge(quote.ageMs)}</span>
      </div>
    `;
    return card;
  }));
}

function setServiceStatus(text, mode) {
  elements.serviceStatus.textContent = text;
  elements.serviceStatus.classList.toggle('ok', mode === 'ok');
  elements.serviceStatus.classList.toggle('bad', mode === 'bad');
}

function formatPrice(value) {
  return Number.isFinite(value) ? formatter.format(value) : '--';
}

function formatPercent(value) {
  return Number.isFinite(value) ? value.toFixed(4) : '--';
}

function formatAge(ageMs) {
  if (!Number.isFinite(ageMs)) {
    return '--';
  }

  if (ageMs < 1_000) {
    return `${ageMs}ms`;
  }

  return `${(ageMs / 1_000).toFixed(1)}s`;
}

function formatTime(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '--';
  }

  return date.toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  });
}

function titleCase(value) {
  return value ? `${value[0].toUpperCase()}${value.slice(1)}` : '--';
}
