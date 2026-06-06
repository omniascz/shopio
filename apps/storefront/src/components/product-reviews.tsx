'use client';

/**
 * Reviews section on the PDP — list + 'write a review' form (logged-in only,
 * verified-purchase badge). Server passes the initial list; the form posts
 * and refreshes via router.
 */

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { customerCreateReview, customerMe, type ProductReview } from '@/lib/api';
import { Stars } from './stars';

export function ProductReviews({
  tenantSlug,
  productSlug,
  rating,
  reviews,
}: {
  tenantSlug: string;
  productSlug: string;
  rating: { average: number | null; count: number };
  reviews: ProductReview[];
}) {
  const router = useRouter();
  const [writing, setWriting] = useState(false);
  const [score, setScore] = useState(5);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function openForm() {
    setError(null);
    const me = await customerMe(tenantSlug);
    if (!me) {
      router.push(`/s/${tenantSlug}/ucet`);
      return;
    }
    setWriting(true);
  }

  async function submit() {
    setError(null);
    setBusy(true);
    try {
      await customerCreateReview(tenantSlug, productSlug, {
        rating: score,
        ...(title && { title }),
        ...(body && { body }),
      });
      setWriting(false);
      setTitle('');
      setBody('');
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section style={{ marginTop: '3rem' }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '1rem',
          flexWrap: 'wrap',
          marginBottom: '1rem',
        }}
      >
        <h2 style={{ fontSize: '1.25rem', margin: 0 }}>
          Recenze{rating.count > 0 && ` (${rating.count})`}
        </h2>
        {rating.count > 0 && rating.average !== null && (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
            <Stars value={rating.average} size={20} />
            <strong style={{ fontSize: '1.125rem' }}>{rating.average.toFixed(1)}</strong>
            <span style={{ color: 'var(--sf-muted, #666)' }}>/ 5</span>
          </span>
        )}
      </div>

      {!writing && (
        <button
          type="button"
          onClick={() => void openForm()}
          style={{
            padding: '0.5rem 1rem',
            background: 'transparent',
            border: '1px solid var(--sf-accent, #111)',
            color: 'var(--sf-accent, #111)',
            borderRadius: 6,
            fontSize: '0.875rem',
            cursor: 'pointer',
            marginBottom: '1.5rem',
          }}
        >
          ✍ Napsat recenzi
        </button>
      )}

      {writing && (
        <div
          style={{
            border: '1px solid rgba(128,128,128,0.3)',
            borderRadius: 8,
            padding: '1rem',
            marginBottom: '1.5rem',
          }}
        >
          <div style={{ display: 'flex', gap: 4, marginBottom: '0.75rem' }}>
            {[1, 2, 3, 4, 5].map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => setScore(n)}
                aria-label={`${n} hvězd`}
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: 28,
                  lineHeight: 1,
                  color: n <= score ? '#f5a623' : 'rgba(128,128,128,0.35)',
                  padding: 0,
                }}
              >
                ★
              </button>
            ))}
          </div>
          <input
            type="text"
            placeholder="Shrnutí (volitelné)"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            style={inputStyle}
          />
          <textarea
            placeholder="Vaše zkušenost s produktem…"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={4}
            style={{ ...inputStyle, resize: 'vertical' }}
          />
          {error && <p style={{ color: '#c00', fontSize: '0.875rem', margin: '0 0 0.5rem' }}>{error}</p>}
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button
              type="button"
              disabled={busy}
              onClick={() => void submit()}
              style={{
                padding: '0.5rem 1rem',
                background: 'var(--sf-accent, #111)',
                color: '#fff',
                border: 'none',
                borderRadius: 6,
                fontSize: '0.875rem',
                cursor: busy ? 'wait' : 'pointer',
                opacity: busy ? 0.7 : 1,
              }}
            >
              {busy ? 'Odesílám…' : 'Odeslat recenzi'}
            </button>
            <button
              type="button"
              onClick={() => setWriting(false)}
              style={{
                padding: '0.5rem 1rem',
                background: 'transparent',
                border: '1px solid rgba(128,128,128,0.4)',
                color: 'inherit',
                borderRadius: 6,
                fontSize: '0.875rem',
                cursor: 'pointer',
              }}
            >
              Zrušit
            </button>
          </div>
        </div>
      )}

      {reviews.length === 0 ? (
        <p style={{ color: 'var(--sf-muted, #666)', fontSize: '0.9375rem' }}>
          Zatím bez recenzí. Buďte první!{' '}
          <Link href={`/s/${tenantSlug}/ucet`} style={{ color: 'var(--sf-accent, #0066cc)' }}>
            Přihlaste se
          </Link>{' '}
          a podělte se o zkušenost.
        </p>
      ) : (
        <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {reviews.map((r) => (
            <li
              key={r.id}
              style={{ borderBottom: '1px solid rgba(128,128,128,0.2)', paddingBottom: '1rem' }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                <Stars value={r.rating} size={15} />
                <strong style={{ fontSize: '0.9375rem' }}>{r.author}</strong>
                {r.verified_purchase && (
                  <span
                    style={{
                      fontSize: '0.6875rem',
                      color: '#2e7d32',
                      background: 'rgba(46,125,50,0.12)',
                      padding: '1px 6px',
                      borderRadius: 999,
                    }}
                  >
                    ✓ ověřený nákup
                  </span>
                )}
                <span style={{ marginLeft: 'auto', fontSize: '0.75rem', color: 'var(--sf-muted, #888)' }}>
                  {new Date(r.created_at).toLocaleDateString('cs-CZ')}
                </span>
              </div>
              {r.title && <div style={{ fontWeight: 600, fontSize: '0.9375rem' }}>{r.title}</div>}
              {r.body && (
                <p style={{ margin: '0.25rem 0 0', fontSize: '0.9375rem', lineHeight: 1.5 }}>{r.body}</p>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

const inputStyle: React.CSSProperties = {
  display: 'block',
  width: '100%',
  padding: '0.5rem 0.75rem',
  marginBottom: '0.5rem',
  border: '1px solid rgba(128,128,128,0.4)',
  borderRadius: 6,
  fontSize: '0.9375rem',
  boxSizing: 'border-box',
  background: 'transparent',
  color: 'inherit',
};
