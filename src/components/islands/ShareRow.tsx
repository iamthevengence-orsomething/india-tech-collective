import { useId, useState } from 'react';
import { shareText, whatsappUrl, telegramUrl, xUrl, type ShareSpec } from '../../lib/share';

/**
 * Image-first share station. Every instance has a standalone card; platforms
 * that support Web Share receive the PNG itself, while every browser retains a
 * direct preview and download path.
 */
export default function ShareRow({
  spec,
  cardHref = '/brand/social-card-v2.png',
}: {
  spec: ShareSpec;
  cardHref?: string;
}) {
  const [copied, setCopied] = useState(false);
  const [imageStatus, setImageStatus] = useState('');
  const [sharingImage, setSharingImage] = useState(false);
  const statusId = useId();
  const text = shareText(spec);
  const baseName = spec.headline
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 72) || 'india-tech-collective-card';
  const downloadName = `${baseName}.png`;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      window.prompt('Copy this link:', spec.url);
    }
  };

  const downloadImage = (href: string) => {
    const anchor = document.createElement('a');
    anchor.href = href;
    anchor.download = downloadName;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
  };

  const shareImage = async () => {
    setSharingImage(true);
    setImageStatus('Preparing the image card…');
    try {
      const response = await fetch(cardHref);
      if (!response.ok) throw new Error(`Image request failed with ${response.status}`);
      const blob = await response.blob();
      const type = blob.type || 'image/png';
      const file = new File([blob], downloadName, { type });
      const payload = { files: [file], title: spec.headline, text: spec.definition };

      if (navigator.share && (!navigator.canShare || navigator.canShare(payload))) {
        await navigator.share(payload);
        setImageStatus('Image card shared.');
      } else {
        const objectUrl = URL.createObjectURL(blob);
        downloadImage(objectUrl);
        window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
        setImageStatus('Image sharing is unavailable here, so the card was downloaded.');
      }
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        setImageStatus('Image sharing cancelled.');
      } else {
        downloadImage(cardHref);
        setImageStatus('The card was downloaded instead.');
      }
    } finally {
      setSharingImage(false);
    }
  };

  return (
    <div className={`share-station${copied ? ' is-stamped' : ''}`}>
      <div className="share-station__head">
        <span>IMAGE CARD / SOURCE INCLUDED</span>
        <i aria-hidden="true">{copied ? 'TRUE COPY' : 'READY TO SHARE'}</i>
      </div>

      <div className="share-card-preview">
        <a href={cardHref} target="_blank" rel="noopener" aria-label={`Open image card for ${spec.headline} in a new tab`}>
          <img
            src={cardHref}
            alt={`Share card: ${spec.headline}`}
            width="1200"
            height="630"
            loading="lazy"
            decoding="async"
          />
        </a>
        <div className="share-card-preview__copy">
          <p className="file-label">Standalone image</p>
          <strong>{spec.headline}</strong>
          <p>Source, date, definition, and caveat are printed into the card.</p>
        </div>
      </div>

      <div className="share-row" role="group" aria-label="Share this image card and its public link">
        <button
          className="btn btn-small btn-primary"
          type="button"
          onClick={shareImage}
          disabled={sharingImage}
          aria-describedby={statusId}
        >
          {sharingImage ? 'Preparing image…' : 'Share image'}
        </button>
        <a className="btn btn-small" href={cardHref} download={downloadName}>Download PNG</a>
        <a className="btn btn-small" href={whatsappUrl(text)} target="_blank" rel="noopener" aria-label="Share the public link on WhatsApp (opens in a new tab)">WhatsApp</a>
        <a className="btn btn-small" href={telegramUrl(text, spec.url)} target="_blank" rel="noopener" aria-label="Share the public link on Telegram (opens in a new tab)">Telegram</a>
        <a className="btn btn-small" href={xUrl(text)} target="_blank" rel="noopener" aria-label="Share the public link on X (opens in a new tab)">Post on X</a>
        <button className="btn btn-small" type="button" onClick={copy}>
          {copied ? 'Stamped · copied' : 'Copy sourced link'}
        </button>
      </div>
      <p className="share-station__note">Social links carry the public URL and its image preview. “Share image” sends the PNG itself when your device supports it.</p>
      <p className="visually-hidden" id={statusId} role="status" aria-live="polite">{imageStatus}</p>
    </div>
  );
}
