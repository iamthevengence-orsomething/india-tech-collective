import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';

export function sha256(buf: Buffer | string): string {
  return createHash('sha256').update(buf).digest('hex');
}

export function sha256File(path: string): string {
  return sha256(readFileSync(path));
}

/** Canonical JSON: sorted keys, 2-space indent, LF, trailing newline. Deterministic across runs. */
export function canonicalJson(value: unknown): string {
  const sort = (v: unknown): unknown => {
    if (Array.isArray(v)) return v.map(sort);
    if (v && typeof v === 'object') {
      return Object.fromEntries(
        Object.entries(v as Record<string, unknown>)
          .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
          .map(([k, val]) => [k, sort(val)])
      );
    }
    return v;
  };
  return JSON.stringify(sort(value), null, 2) + '\n';
}

export function writeJson(path: string, value: unknown): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, canonicalJson(value));
}

export function readJson<T = unknown>(path: string): T {
  return JSON.parse(readFileSync(path, 'utf8')) as T;
}

export function log(step: string, msg: string): void {
  console.log(`[${step}] ${msg}`);
}

export function fail(step: string, errors: string[]): never {
  for (const e of errors) console.error(`[${step}] ERROR: ${e}`);
  console.error(`[${step}] FAILED with ${errors.length} error(s)`);
  process.exit(1);
}

/** Run a python extractor from the project venv, returning parsed JSON stdout. */
export function runPython<T = unknown>(script: string, args: string[]): T {
  const python = process.env.ITC_PYTHON
    ?? (process.platform === 'win32' ? '.venv/Scripts/python.exe' : '.venv/bin/python');
  const out = execFileSync(python, [script, ...args], {
    maxBuffer: 256 * 1024 * 1024,
    encoding: 'utf8',
    env: { ...process.env, PYTHONUTF8: '1', PYTHONIOENCODING: 'utf-8' },
  });
  return JSON.parse(out) as T;
}

export function nowIso(): string {
  return new Date().toISOString().replace(/\.\d+Z$/, 'Z');
}
