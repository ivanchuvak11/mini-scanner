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
  exchangeRows: document.querySelector('#exchangeRows'),
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
  const panel = elements.spreadPercent.closest('.summary-panel');
  panel.classList.toggle('alert', Boolean(spread.thresholdExceeded));
  panel.classList.toggle('ready', Boolean(spread.available && !spread.thresholdExceeded));

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
  elements.exchangeRows.replaceChildren(...knownExchanges.map((exchange) => {
    const quote = quotes[exchange];
    const row = document.createElement('tr');

    if (!quote) {
      row.innerHTML = `
        <td>${titleCase(exchange)} <span class="muted">--</span></td>
        <td>--</td>
        <td>--</td>
        <td class="muted">--</td>
        <td><span class="quote-status bad">No data</span></td>
      `;
      return row;
    }

    row.innerHTML = `
      <td>${titleCase(exchange)} <span class="muted">${quote.symbol}</span></td>
      <td>${formatPrice(quote.bid)}</td>
      <td>${formatPrice(quote.ask)}</td>
      <td class="muted">${formatAge(quote.ageMs)}</td>
      <td><span class="quote-status ${quote.fresh ? 'ok' : 'bad'}">${quote.fresh ? 'Fresh' : 'Stale'}</span></td>
    `;
    return row;
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
