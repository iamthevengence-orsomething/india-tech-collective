import { mkdirSync, readdirSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const worker = `const worker = {
  async fetch(request, env) {
    if (!env.ASSETS || typeof env.ASSETS.fetch !== "function") {
      return new Response("Site assets are unavailable.", {
        status: 503,
        headers: { "content-type": "text/plain; charset=utf-8" },
      });
    }

    const response = await env.ASSETS.fetch(request);
    if (response.status !== 404 || (request.method !== "GET" && request.method !== "HEAD")) {
      return response;
    }

    const url = new URL(request.url);
    if (!url.pathname.includes(".")) {
      const directoryIndex = new URL(url);
      directoryIndex.pathname =
        url.pathname === "/"
          ? "/index.html"
          : url.pathname.replace(/\\/$/, "") + "/index.html";
      const indexedResponse = await env.ASSETS.fetch(new Request(directoryIndex, request));
      if (indexedResponse.status !== 404) return indexedResponse;
    }

    const notFound = new URL(url);
    notFound.pathname = "/404.html";
    return env.ASSETS.fetch(new Request(notFound, request));
  },
};

export default worker;
`;

const dist = resolve('dist');
const client = join(dist, 'client');

rmSync(client, { recursive: true, force: true });
mkdirSync(client, { recursive: true });

for (const entry of readdirSync(dist)) {
  if (entry === 'client' || entry === 'server' || entry === '.openai') continue;
  renameSync(join(dist, entry), join(client, entry));
}

mkdirSync(join(dist, 'server'), { recursive: true });
writeFileSync(join(dist, 'server', 'index.js'), worker);
console.log('[sites] staged static assets and worker entrypoint');
