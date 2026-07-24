import { mkdirSync, writeFileSync } from 'node:fs';

const worker = `const worker = {
  async fetch(request, env) {
    if (env.ASSETS && typeof env.ASSETS.fetch === "function") {
      return env.ASSETS.fetch(request);
    }
    return new Response("Site assets are unavailable.", {
      status: 503,
      headers: { "content-type": "text/plain; charset=utf-8" },
    });
  },
};

export default worker;
`;

mkdirSync('dist/server', { recursive: true });
writeFileSync('dist/server/index.js', worker);
console.log('[sites] staged static worker entrypoint');
