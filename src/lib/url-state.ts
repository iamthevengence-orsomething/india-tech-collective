/**
 * URL-synchronized filter state. Every dashboard view is deep-linkable; state
 * lives in the query string and survives refresh/back. Values are validated
 * against allow-lists by the consuming island — unknown params are dropped.
 */

export type FilterState = Record<string, string>;

export function readUrlState(allowedKeys: string[]): FilterState {
  if (typeof window === 'undefined') return {};
  const params = new URLSearchParams(window.location.search);
  const state: FilterState = {};
  for (const key of allowedKeys) {
    const v = params.get(key);
    if (v !== null && v.length <= 200) state[key] = v;
  }
  return state;
}

export function writeUrlState(state: FilterState, { replace = true }: { replace?: boolean } = {}): void {
  if (typeof window === 'undefined') return;
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(state)) {
    if (v !== '' && v !== undefined && v !== null) params.set(k, v);
  }
  const qs = params.toString();
  const url = window.location.pathname + (qs ? `?${qs}` : '') + window.location.hash;
  if (replace) window.history.replaceState(null, '', url);
  else window.history.pushState(null, '', url);
}
