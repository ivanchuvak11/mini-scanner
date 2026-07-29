# Mini Scanner

Сервіс на Node.js, який підключається до публічних WebSocket-стрімів Binance та Bybit, нормалізує bid/ask для однієї торгової пари й показує поточний міжбіржовий спред через HTTP.

## Що реалізовано

- Публічні keyless WebSocket-стріми для `bookTicker`/`tickers`.
- Єдина внутрішня структура котирування: біржа, пара, bid, ask, час отримання.
- Розрахунок executable spread: купівля за нижчим ask і продаж за вищим bid.
- Fresh/stale контроль для кожної біржі.
- Reconnect із exponential backoff та jitter.
- Ізоляція помилок парсингу повідомлень: одне погане повідомлення не валить процес.
- Логування підключень, обривів, stale-стану та перевищення порогу.
- HTTP endpoint `GET /spread`.
- Тести для ключової бізнес-логіки.

## Запуск

Потрібен Node.js 22 або новіший, бо сервіс використовує вбудований WebSocket-клієнт Node.

```bash
npm test
npm start
```

За замовчуванням сервіс слухає `http://localhost:3000`.

Візуальна панель доступна тут:

```bash
http://localhost:3000
```

Перевірити стан:

```bash
curl http://localhost:3000/spread
```

## Конфігурація

Можна створити `.env` на основі `.env.example`:

```bash
PORT=3000
PAIR=BTCUSDT
EXCHANGES=binance,bybit
SPREAD_THRESHOLD_PERCENT=0.3
STALE_AFTER_SECONDS=10
RECONNECT_MIN_MS=1000
RECONNECT_MAX_MS=30000
LOG_LEVEL=info
```

`PAIR` задається у форматі без розділювача, наприклад `BTCUSDT`. Для Binance символ автоматично приводиться до lowercase у URL, для Bybit залишається uppercase.

## HTTP API

`GET /spread` повертає JSON:

```json
{
  "pair": "BTCUSDT",
  "now": "2026-07-29T12:00:00.000Z",
  "staleAfterSeconds": 10,
  "thresholdPercent": 0.3,
  "quotes": {
    "binance": {
      "exchange": "binance",
      "symbol": "BTCUSDT",
      "bid": 118000.12,
      "ask": 118000.13,
      "lastUpdated": "2026-07-29T12:00:00.000Z",
      "ageMs": 42,
      "fresh": true
    }
  },
  "spread": {
    "available": true,
    "percent": 0.0184,
    "buyExchange": "binance",
    "sellExchange": "bybit",
    "buyAsk": 118000.13,
    "sellBid": 118021.84,
    "thresholdExceeded": false
  }
}
```

Якщо однієї зі свіжих цін немає, `spread.available` буде `false`, а в `reason` буде пояснення.

## Що станеться, якщо біржа замовкне на 5 хвилин

Кожна ціна має локальну мітку часу отримання. Якщо від біржі немає нових повідомлень довше `STALE_AFTER_SECONDS`, її котирування позначається як `fresh: false` і не бере участі в розрахунку спреду. Сервіс продовжує працювати, друга біржа може оновлюватися далі, але `/spread` чесно поверне, що даних недостатньо для розрахунку між двома біржами. У лог потрапить подія про stale-ціну. Якщо WebSocket фізично обірвався, конектор перепідключатиметься з поступовою затримкою до `RECONNECT_MAX_MS`.

## Розрахунок спреду

Сервіс рахує практичний спред на bid/ask:

```text
spreadPercent = (highestBid - lowestAsk) / lowestAsk * 100
```

Це показує, чи є різниця, за якої теоретично можна купити на біржі з нижчим `ask` і продати на біржі з вищим `bid`. Значення може бути від'ємним, якщо ринки перекриваються без можливого позитивного executable spread.

## Тести

```bash
npm test
```

Тести перевіряють:

- коректний розрахунок спреду на свіжих котируваннях;
- виключення stale-ціни з розрахунку;
- логування перевищення порогу без дублювання на кожному snapshot;
- відновлення fresh-стану після нового котирування.
