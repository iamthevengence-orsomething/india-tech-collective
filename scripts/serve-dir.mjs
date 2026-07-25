/**
 * Minimal static file server for built output (tests/screenshots).
 * Mirrors static-host behavior: directory indexes, .html fallback, 404.html.
 */
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { existsSync, statSync } from 'node:fs';
import { extname, join, resolve, sep } from 'node:path';

const [dir = 'dist', port = '4331'] = process.argv.slice(2);
const root = resolve(dir);
const TYPES = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css',
  '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png',
  '.woff2': 'font/woff2', '.txt': 'text/plain; charset=utf-8', '.xml': 'application/xml',
  '.csv': 'text/csv; charset=utf-8', '.ico': 'image/x-icon',
};

createServer(async (req, res) => {
  try {
    const url = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    let path = resolve(root, url.replace(/^[/\\]+/, ''));
    if (path !== root && !path.startsWith(`${root}${sep}`)) path = root;
    if (existsSync(path) && statSync(path).isDirectory()) path = join(path, 'index.html');
    else if (!existsSync(path) && existsSync(path + '.html')) path = path + '.html';
    if (!existsSync(path)) {
      const notFound = join(root, '404.html');
      res.writeHead(404, { 'content-type': 'text/html; charset=utf-8' });
      res.end(existsSync(notFound) ? await readFile(notFound) : 'Not found');
      return;
    }
    res.writeHead(200, { 'content-type': TYPES[extname(path)] ?? 'application/octet-stream' });
    res.end(await readFile(path));
  } catch (err) {
    res.writeHead(500);
    res.end(String(err));
  }
}).listen(Number(port), '127.0.0.1', () => {
  console.log(`serving ${dir} on http://127.0.0.1:${port}`);
});
