import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC_DIR = path.resolve(__dirname, '..', 'public');
const STATIC_FILES = new Map([
  ['/', { file: 'index.html', type: 'text/html; charset=utf-8' }],
  ['/app.js', { file: 'app.js', type: 'text/javascript; charset=utf-8' }],
  ['/styles.css', { file: 'styles.css', type: 'text/css; charset=utf-8' }]
]);

export function createHttpServer({ state, logger }) {
  return http.createServer((request, response) => {
    const url = new URL(request.url, 'http://localhost');

    if (request.method === 'GET' && STATIC_FILES.has(url.pathname)) {
      sendStatic(response, STATIC_FILES.get(url.pathname));
      return;
    }

    if (request.method === 'GET' && url.pathname === '/spread') {
      sendJson(response, 200, state.getSnapshot());
      return;
    }

    if (request.method === 'GET' && url.pathname === '/health') {
      sendJson(response, 200, { ok: true });
      return;
    }

    logger.warn('http_not_found', {
      method: request.method,
      url: url.pathname
    });
    sendJson(response, 404, { error: 'not_found' });
  });
}

function sendJson(response, statusCode, body) {
  const payload = JSON.stringify(body, null, 2);
  response.writeHead(statusCode, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store'
  });
  response.end(payload);
}

function sendStatic(response, asset) {
  const filePath = path.join(PUBLIC_DIR, asset.file);
  fs.readFile(filePath, (error, content) => {
    if (error) {
      sendJson(response, 500, { error: 'static_asset_unavailable' });
      return;
    }

    response.writeHead(200, {
      'content-type': asset.type,
      'cache-control': 'no-store'
    });
    response.end(content);
  });
}
