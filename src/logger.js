const LEVELS = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40
};

export function createLogger({ level = 'info' } = {}) {
  const threshold = LEVELS[level] ?? LEVELS.info;

  const write = (severity, event, details = {}) => {
    if ((LEVELS[severity] ?? LEVELS.info) < threshold) {
      return;
    }

    const payload = {
      time: new Date().toISOString(),
      level: severity,
      event,
      ...details
    };

    const line = JSON.stringify(payload);
    if (severity === 'error') {
      console.error(line);
    } else if (severity === 'warn') {
      console.warn(line);
    } else {
      console.log(line);
    }
  };

  return {
    debug: (event, details) => write('debug', event, details),
    info: (event, details) => write('info', event, details),
    warn: (event, details) => write('warn', event, details),
    error: (event, details) => write('error', event, details)
  };
}
