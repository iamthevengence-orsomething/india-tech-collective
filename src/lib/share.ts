/**
 * Share intents. Every share text carries: what the number means, its
 * numerator/denominator when present, the as-of date, source, the standing
 * disclaimer, and the deep link.
 */
export interface ShareSpec {
  headline: string;
  definition: string;
  asOf: string;
  source: string;
  url: string;
  disclaimer?: string;
}

export const DEFAULT_DISCLAIMER =
  'Self-declared in sworn election affidavits. A declared case is an accusation, not a conviction.';

export function shareText(spec: ShareSpec): string {
  const disclaimer = spec.disclaimer ?? DEFAULT_DISCLAIMER;
  return `${spec.headline}\n\n${spec.definition}\nData as of ${spec.asOf} · Source: ${spec.source}\n${disclaimer}\n\n${spec.url}`;
}

export function whatsappUrl(text: string): string {
  return `https://wa.me/?text=${encodeURIComponent(text)}`;
}
export function telegramUrl(text: string, url: string): string {
  return `https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(text)}`;
}
export function xUrl(text: string): string {
  return `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`;
}
