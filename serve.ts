// Solmar — tiny static server for local play-testing.
//
// Serves game/ on http://localhost:8080 with no build step and no network
// dependency. Usage: `node serve.ts`, then open the printed address.
// (Plain `python3 -m http.server` from inside game/ works just as well.)

import { createReadStream } from 'node:fs';
import { createServer } from 'node:http';
import { extname, join, normalize } from 'node:path';

const ROOT = join(process.cwd(), 'game');
const PORT = 8080;

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
};

const server = createServer((req, res) => {
  const urlPath = decodeURIComponent((req.url || '/').split('?')[0]);
  const rel = normalize(urlPath === '/' ? 'index.html' : urlPath.replace(/^\/+/, ''));
  const file = join(ROOT, rel);
  if (!file.startsWith(ROOT)) {
    res.writeHead(403);
    res.end('forbidden');
    return;
  }
  const stream = createReadStream(file);
  stream.on('open', () => {
    res.writeHead(200, { 'Content-Type': TYPES[extname(file)] || 'application/octet-stream' });
    stream.pipe(res);
  });
  stream.on('error', () => {
    res.writeHead(404);
    res.end('not found');
  });
});

server.listen(PORT, () => {
  console.log(`Solmar served at http://localhost:${PORT} (game/ as root)`);
});
