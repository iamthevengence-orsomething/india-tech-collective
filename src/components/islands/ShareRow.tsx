import { useState } from 'react';
import { shareText, whatsappUrl, telegramUrl, xUrl, type ShareSpec } from '../../lib/share';

/** Share buttons. The text always carries definition + as-of + source + disclaimer + link. */
export default function ShareRow({ spec, cardHref }: { spec: ShareSpec; cardHref?: string }) {
  const [copied, setCopied] = useState(false);
  const text = shareText(spec);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      window.prompt('Copy this link:', spec.url);
    }
  };

  return (
    <div className="share-row" role="group" aria-label="Share this view">
      <a className="btn btn-small" href={whatsappUrl(text)} target="_blank" rel="noopener">WhatsApp</a>
      <a className="btn btn-small" href={telegramUrl(text, spec.url)} target="_blank" rel="noopener">Telegram</a>
      <a className="btn btn-small" href={xUrl(text)} target="_blank" rel="noopener">Post on X</a>
      <button className="btn btn-small" type="button" onClick={copy} aria-live="polite">
        {copied ? 'Copied ✓' : 'Copy link'}
      </button>
      {cardHref && (
        <a className="btn btn-small" href={cardHref} download>
          Download share card
        </a>
      )}
    </div>
  );
}
