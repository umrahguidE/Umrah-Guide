// Zero-dependency static server for local development.
// Geolocation and service workers need a secure context: localhost counts,
// but to test on a phone deploy to any HTTPS static host.
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const port = Number(process.env.PORT) || 5173;

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.mp3': 'audio/mpeg',
  '.m4a': 'audio/mp4',
  '.md': 'text/markdown; charset=utf-8',
};

createServer(async (req, res) => {
  const { pathname } = new URL(req.url, 'http://localhost');
  const path = decodeURIComponent(pathname.endsWith('/') ? `${pathname}index.html` : pathname);
  const file = resolve(join(root, normalize(path)));
  if (file !== root && !file.startsWith(root + sep)) {
    res.writeHead(403).end('Forbidden');
    return;
  }
  try {
    const body = await readFile(file);
    res.writeHead(200, { 'content-type': TYPES[extname(file)] ?? 'application/octet-stream', 'cache-control': 'no-cache' });
    res.end(body);
  } catch {
    res.writeHead(404, { 'content-type': 'text/plain' }).end('Not found');
  }
}).listen(port, () => {
  console.log(`Guided Umrah running at http://localhost:${port}`);
  console.log(`Simulated GPS (demo the Tawaf/Sa'i tracking anywhere): http://localhost:${port}/?sim`);
});
