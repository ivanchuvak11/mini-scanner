export class ExchangeWebSocketClient {
  constructor({
    exchange,
    url,
    logger,
    reconnectMinMs,
    reconnectMaxMs,
    parseMessage,
    onQuote,
    onOpen,
    onClose,
    now = () => Date.now(),
    WebSocketImpl = globalThis.WebSocket
  }) {
    if (!WebSocketImpl) {
      throw new Error('This Node.js runtime does not provide a global WebSocket implementation');
    }

    this.exchange = exchange;
    this.url = url;
    this.logger = logger;
    this.reconnectMinMs = reconnectMinMs;
    this.reconnectMaxMs = reconnectMaxMs;
    this.parseMessage = parseMessage;
    this.onQuote = onQuote;
    this.onOpen = onOpen;
    this.onClose = onClose;
    this.now = now;
    this.WebSocketImpl = WebSocketImpl;
    this.reconnectAttempt = 0;
    this.closedByUser = false;
    this.socket = null;
    this.reconnectTimer = null;
  }

  start() {
    this.closedByUser = false;
    this.connect();
  }

  stop() {
    this.closedByUser = true;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    if (this.socket) {
      this.socket.close();
      this.socket = null;
    }
  }

  connect() {
    this.logger.info('websocket_connecting', {
      exchange: this.exchange,
      url: this.url
    });

    const socket = new this.WebSocketImpl(this.url);
    this.socket = socket;

    socket.addEventListener('open', () => {
      this.reconnectAttempt = 0;
      this.logger.info('websocket_connected', {
        exchange: this.exchange
      });
      this.onOpen?.(socket);
    });

    socket.addEventListener('message', (event) => {
      try {
        const quote = this.parseMessage(event.data, this.now());
        if (quote) {
          this.onQuote(quote);
        }
      } catch (error) {
        this.logger.error('websocket_message_error', {
          exchange: this.exchange,
          message: error.message
        });
      }
    });

    socket.addEventListener('error', (event) => {
      this.logger.error('websocket_error', {
        exchange: this.exchange,
        message: event.message ?? 'WebSocket error'
      });
    });

    socket.addEventListener('close', (event) => {
      this.logger.warn('websocket_closed', {
        exchange: this.exchange,
        code: event.code,
        reason: event.reason || undefined
      });
      this.onClose?.(event);
      this.scheduleReconnect();
    });
  }

  scheduleReconnect() {
    if (this.closedByUser) {
      return;
    }

    const delayMs = this.nextDelayMs();
    this.logger.info('websocket_reconnect_scheduled', {
      exchange: this.exchange,
      delayMs
    });

    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.connect();
    }, delayMs);
  }

  nextDelayMs() {
    const exponential = this.reconnectMinMs * 2 ** this.reconnectAttempt;
    this.reconnectAttempt += 1;
    const capped = Math.min(exponential, this.reconnectMaxMs);
    const jitter = Math.round(capped * 0.2 * Math.random());
    return capped + jitter;
  }
}
