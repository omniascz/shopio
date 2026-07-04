/**
 * Media picker for the page builder / CMS (per `32` §4.8) — replaces raw image
 * URL text fields. Merchant can upload a file (→ object storage, returns URL)
 * or paste an existing URL. Shows a thumbnail preview.
 */

import { useRef, useState } from 'react';
import { api } from '../lib/api';

export function MediaPicker({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (url: string) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setBusy(true);
    setErr(null);
    try {
      const { url } = await api.uploadMedia(file);
      onChange(url);
    } catch (e2) {
      setErr(e2 instanceof Error ? e2.message : 'Nahrání selhalo');
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  }

  return (
    <label style={{ fontSize: '0.8125rem', display: 'block' }}>
      <span style={{ display: 'block', marginBottom: 4, fontWeight: 500 }}>{label}</span>
      <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
        {value ? (
          <img
            src={value}
            alt=""
            style={{ width: 44, height: 44, objectFit: 'cover', borderRadius: 4, border: '1px solid #ddd', flex: '0 0 auto' }}
          />
        ) : (
          <div style={{ width: 44, height: 44, borderRadius: 4, border: '1px dashed #ccc', flex: '0 0 auto' }} />
        )}
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="URL obrázku nebo nahrajte…"
          style={{ flex: 1, minWidth: 0, padding: '0.5rem 0.625rem', border: '1px solid #ddd', borderRadius: 4, fontSize: '0.875rem' }}
        />
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={busy}
          style={{ padding: '0.45rem 0.75rem', background: '#f0f7ff', border: '1px solid #cce0ff', color: '#003d99', borderRadius: 4, fontSize: '0.8125rem', cursor: 'pointer', whiteSpace: 'nowrap' }}
        >
          {busy ? 'Nahrávám…' : '⬆ Nahrát'}
        </button>
        {value && (
          <button
            type="button"
            onClick={() => onChange('')}
            style={{ padding: '0.45rem 0.6rem', background: '#fff0f0', border: '1px solid #ffcccc', color: '#990000', borderRadius: 4, cursor: 'pointer' }}
          >
            ×
          </button>
        )}
        <input ref={inputRef} type="file" accept="image/*" onChange={handleFile} style={{ display: 'none' }} />
      </div>
      {err && <span style={{ color: '#c00', fontSize: '0.75rem' }}>{err}</span>}
    </label>
  );
}
