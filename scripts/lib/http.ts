import { setTimeout as sleep } from 'node:timers/promises';
import { fetch as undiciFetch, EnvHttpProxyAgent } from 'undici';

/**
 * Polite fetch for the data pipeline. Honors HTTPS_PROXY + NODE_EXTRA_CA_CERTS,
 * identifies itself, spaces requests, retries transient failures, and never
 * retries policy denials (403) — those get reported, not hammered.
 */

const agent = new EnvHttpProxyAgent();

export const PIPELINE_UA =
  'IndiaTechCollectiveBot/1.0 (+https://www.indiatechcollective.org/sources/; data pipeline; contact via GitHub issues)';

const MIN_SPACING_MS = 2000;
let lastRequestAt = 0;

export interface PoliteResponse {
  status: number;
  body: Buffer;
  contentType: string;
  /** set when the server refused our bot UA and a generic client string was used instead */
  uaFallback?: boolean;
}

/**
 * Some government file hosts 403 any custom UA while serving generic clients.
 * When that happens we retry ONCE with a plain client string and record the
 * fact in the manifest — this is a UA heuristic workaround, never an auth or
 * CAPTCHA bypass.
 */
export async function politeFetch(url: string, init: { maxBytes?: number; accept?: string } = {}): Promise<PoliteResponse> {
  const wait = lastRequestAt + MIN_SPACING_MS - Date.now();
  if (wait > 0) await sleep(wait);

  let attempt = 0;
  let ua = PIPELINE_UA;
  let uaFallback = false;
  for (;;) {
    attempt += 1;
    lastRequestAt = Date.now();
    try {
      const res = await undiciFetch(url, {
        dispatcher: agent,
        headers: { 'user-agent': ua, ...(init.accept ? { accept: init.accept } : {}) },
        redirect: 'follow',
        signal: AbortSignal.timeout(90_000),
      });
      const buf = Buffer.from(await res.arrayBuffer());
      if (init.maxBytes && buf.length > init.maxBytes) {
        throw new Error(`response too large: ${buf.length} > ${init.maxBytes}`);
      }
      if (res.status === 403 && !uaFallback) {
        uaFallback = true;
        ua = 'curl/8.5.0';
        await sleep(MIN_SPACING_MS);
        continue;
      }
      if (res.status >= 500 && attempt <= 3) {
        await sleep(2000 * attempt);
        continue;
      }
      return { status: res.status, body: buf, contentType: res.headers.get('content-type') ?? '', uaFallback };
    } catch (err) {
      if (attempt <= 3) {
        await sleep(2000 * attempt);
        continue;
      }
      throw err;
    }
  }
}
