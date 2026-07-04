'use client';

/**
 * Promotional pop-up modal (per `32`) — newsletter capture / promo, configured
 * in admin (tenant.settings.homepage.popup). Shows after `delay_seconds`;
 * `frequency: 'once'` remembers dismissal in localStorage keyed by a content
 * hash so editing the popup re-shows it. Renders nothing when disabled/empty.
 */

import { useEffect, useState } from 'react';
import type { StorefrontPopup } from '@/lib/api';

/** Tiny stable hash of the popup content → localStorage key (re-show on edit). */
function contentKey(p: StorefrontPopup): string {
  const raw = `${p.heading ?? ''}|${p.text ?? ''}|${p.cta_url ?? ''}|${p.image_url ?? ''}`;
  let h = 0;
  for (let i = 0; i < raw.length; i++) h = (h * 31 + raw.charCodeAt(i)) | 0;
  return `shopio_popup_${h}`;
}

export function PromoPopup({ popup, tenantSlug }: { popup: StorefrontPopup; tenantSlug: string }) {
  const [open, setOpen] = useState(false);
  const enabled = popup.enabled && (popup.heading || popup.text || popup.image_url);
  const key = enabled ? `${contentKey(popup)}_${tenantSlug}` : '';

  useEffect(() => {
    if (!enabled) return;
    if (popup.frequency !== 'always') {
      try {
        if (localStorage.getItem(key) === 'dismissed') return;
      } catch {
        /* private mode — just show it */
      }
    }
    const t = setTimeout(() => setOpen(true), Math.max(0, (popup.delay_seconds ?? 0) * 1000));
    return () => clearTimeout(t);
  }, [enabled, key, popup.delay_seconds, popup.frequency]);

  if (!enabled || !open) return null;

  function dismiss() {
    setOpen(false);
    if (popup.frequency !== 'always') {
      try {
        localStorage.setItem(key, 'dismissed');
      } catch {
        /* ignore */
      }
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      onClick={dismiss}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 100,
        padding: '1rem',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          position: 'relative',
          background: 'var(--sf-bg, #fff)',
          color: 'var(--sf-text, #111)',
          borderRadius: 'var(--sf-radius, 8px)',
          maxWidth: 440,
          width: '100%',
          overflow: 'hidden',
          boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
        }}
      >
        <button
          type="button"
          onClick={dismiss}
          aria-label="Zavřít"
          style={{
            position: 'absolute',
            top: 8,
            right: 8,
            width: 32,
            height: 32,
            borderRadius: '50%',
            border: 'none',
            background: 'rgba(0,0,0,0.15)',
            color: '#fff',
            cursor: 'pointer',
            fontSize: '1.1rem',
            lineHeight: 1,
          }}
        >
          ×
        </button>
        {popup.image_url && (
          <img src={popup.image_url} alt="" style={{ width: '100%', maxHeight: 200, objectFit: 'cover', display: 'block' }} />
        )}
        <div style={{ padding: '1.5rem', textAlign: 'center' }}>
          {popup.heading && <h2 style={{ margin: '0 0 0.5rem', fontFamily: 'var(--sf-font-heading)', fontSize: '1.4rem' }}>{popup.heading}</h2>}
          {popup.text && <p style={{ margin: '0 0 1rem', color: 'var(--sf-muted, #555)', lineHeight: 1.5 }}>{popup.text}</p>}
          {popup.cta_text && popup.cta_url && (
            <a
              href={popup.cta_url}
              onClick={dismiss}
              style={{
                display: 'inline-block',
                padding: '0.7rem 1.75rem',
                background: 'var(--sf-accent, #111)',
                color: '#fff',
                borderRadius: 'var(--sf-radius, 6px)',
                textDecoration: 'none',
                fontWeight: 500,
              }}
            >
              {popup.cta_text}
            </a>
          )}
        </div>
      </div>
    </div>
  );
}
