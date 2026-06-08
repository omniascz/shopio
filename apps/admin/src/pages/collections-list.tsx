/**
 * Dynamic collections admin (P3) — rule-based product groups + live preview.
 */

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, type CollectionItem } from '../lib/api';

function slugify(v: string): string {
  return v.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

export function CollectionsListPage() {
  const qc = useQueryClient();
  const [creating, setCreating] = useState(false);
  const [previewId, setPreviewId] = useState<string | null>(null);
  const query = useQuery({ queryKey: ['admin', 'collections'], queryFn: () => api.listCollections() });
  const cols = query.data?.collections ?? [];
  const refresh = () => qc.invalidateQueries({ queryKey: ['admin', 'collections'] });
  const del = useMutation({ mutationFn: (id: string) => api.deleteCollection(id), onSuccess: refresh });

  return (
    <div>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <h1 style={{ margin: 0, fontSize: '1.75rem' }}>Dynamické kolekce</h1>
        {!creating && <button type="button" onClick={() => setCreating(true)} style={primaryBtn}>+ Nová kolekce</button>}
      </header>
      <p style={{ color: '#666', fontSize: '0.875rem', marginTop: 0 }}>
        Skupiny produktů podle pravidel (cena, sklad, sleva, značka) — udržují se samy aktuální.
      </p>
      {creating && <CreateForm onDone={() => { setCreating(false); refresh(); }} onCancel={() => setCreating(false)} />}

      <div style={card}>
        {cols.length === 0 ? <p style={{ padding: '0.5rem', color: '#666' }}>Zatím žádné kolekce.</p> : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead><tr><th style={th}>Název</th><th style={th}>Slug</th><th style={th}>Pravidla</th><th style={th}>Stav</th><th style={th} /></tr></thead>
            <tbody>
              {cols.map((c) => (
                <tr key={c.id} style={{ opacity: c.is_active ? 1 : 0.5 }}>
                  <td style={td}>{c.name}</td>
                  <td style={{ ...td, fontFamily: 'monospace', fontSize: '0.8125rem' }}>{c.slug}</td>
                  <td style={{ ...td, fontSize: '0.8125rem', color: '#666' }}>{describeRules(c.rules)}</td>
                  <td style={td}>{c.is_active ? '✓' : 'vyp.'}</td>
                  <td style={{ ...td, textAlign: 'right', whiteSpace: 'nowrap' }}>
                    <button type="button" onClick={() => setPreviewId(previewId === c.id ? null : c.id)} style={smallBtn}>Náhled</button>{' '}
                    <button type="button" onClick={() => { if (confirm('Smazat?')) del.mutate(c.id); }} style={dangerBtn}>Smazat</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      {previewId && <Preview id={previewId} />}
    </div>
  );
}

function describeRules(r: CollectionItem['rules']): string {
  const parts: string[] = [];
  if (r.onSaleOnly) parts.push('v akci');
  if (r.inStockOnly) parts.push('skladem');
  if (r.minPrice != null) parts.push(`od ${(r.minPrice / 100).toFixed(0)} Kč`);
  if (r.maxPrice != null) parts.push(`do ${(r.maxPrice / 100).toFixed(0)} Kč`);
  if (r.brand) parts.push(`značka ${r.brand}`);
  return parts.join(', ') || 'vše';
}

function Preview({ id }: { id: string }) {
  const q = useQuery({ queryKey: ['admin', 'collection-preview', id], queryFn: () => api.previewCollection(id) });
  const products = q.data?.products ?? [];
  return (
    <div style={{ ...card, marginTop: '1rem', padding: '1rem' }}>
      <h3 style={{ margin: '0 0 0.5rem', fontSize: '0.9375rem' }}>Náhled ({products.length} produktů)</h3>
      {q.isLoading ? <p>Načítání…</p> : products.length === 0 ? <p style={{ color: '#666' }}>Žádné produkty neodpovídají.</p> : (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
          {products.map((p) => (
            <span key={p.id} style={{ fontSize: '0.8125rem', border: '1px solid #e9ecef', borderRadius: 4, padding: '0.25rem 0.5rem' }}>
              {p.title}{p.base_price ? ` — ${(Number(p.base_price.amount) / 100).toFixed(0)} ${p.base_price.currency}` : ''}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

function CreateForm({ onDone, onCancel }: { onDone: () => void; onCancel: () => void }) {
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [onSale, setOnSale] = useState(false);
  const [inStock, setInStock] = useState(false);
  const [minP, setMinP] = useState('');
  const [maxP, setMaxP] = useState('');
  const [brand, setBrand] = useState('');
  const [sort, setSort] = useState('newest');
  const [error, setError] = useState<string | null>(null);

  const create = useMutation({
    mutationFn: () => {
      const rules: Record<string, unknown> = { sort };
      if (onSale) rules.onSaleOnly = true;
      if (inStock) rules.inStockOnly = true;
      if (minP) rules.minPrice = Math.round(Number(minP.replace(',', '.')) * 100);
      if (maxP) rules.maxPrice = Math.round(Number(maxP.replace(',', '.')) * 100);
      if (brand) rules.brand = brand;
      return api.createCollection({ name, slug: slug || slugify(name), rules });
    },
    onSuccess: onDone,
    onError: (e) => setError((e as { code?: string }).code === 'SLUG_TAKEN' ? 'Slug už existuje' : (e as Error).message),
  });

  return (
    <div style={{ ...card, padding: '1.25rem', marginBottom: '1rem' }}>
      <h2 style={{ margin: '0 0 1rem', fontSize: '1rem' }}>Nová kolekce</h2>
      <div style={grid3}>
        <Field label="Název"><input value={name} onChange={(e) => { setName(e.target.value); if (!slug) setSlug(slugify(e.target.value)); }} style={input} /></Field>
        <Field label="Slug"><input value={slug} onChange={(e) => setSlug(e.target.value)} placeholder="vyprodej" style={input} /></Field>
        <Field label="Řazení">
          <select value={sort} onChange={(e) => setSort(e.target.value)} style={input}>
            <option value="newest">Nejnovější</option><option value="price_asc">Cena ↑</option><option value="price_desc">Cena ↓</option>
          </select>
        </Field>
        <Field label="Min. cena (Kč)"><input value={minP} onChange={(e) => setMinP(e.target.value)} style={input} /></Field>
        <Field label="Max. cena (Kč)"><input value={maxP} onChange={(e) => setMaxP(e.target.value)} style={input} /></Field>
        <Field label="Značka"><input value={brand} onChange={(e) => setBrand(e.target.value)} style={input} /></Field>
      </div>
      <div style={{ display: 'flex', gap: '1rem', marginTop: '0.5rem', fontSize: '0.8125rem' }}>
        <label><input type="checkbox" checked={onSale} onChange={(e) => setOnSale(e.target.checked)} /> Jen v akci</label>
        <label><input type="checkbox" checked={inStock} onChange={(e) => setInStock(e.target.checked)} /> Jen skladem</label>
      </div>
      {error && <p style={{ color: '#c00', fontSize: '0.875rem' }}>{error}</p>}
      <div style={{ marginTop: '0.75rem', display: 'flex', gap: '0.5rem' }}>
        <button type="button" disabled={!name || create.isPending} onClick={() => { setError(null); create.mutate(); }} style={primaryBtn}>Vytvořit</button>
        <button type="button" onClick={onCancel} style={smallBtn}>Zrušit</button>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label style={{ display: 'block', fontSize: '0.8125rem' }}><span style={{ display: 'block', marginBottom: 4, fontWeight: 500 }}>{label}</span>{children}</label>;
}
const card: React.CSSProperties = { background: '#fff', padding: '0.5rem', borderRadius: 8, border: '1px solid #e9ecef' };
const grid3: React.CSSProperties = { display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.75rem' };
const th: React.CSSProperties = { textAlign: 'left', padding: '0.625rem 0.75rem', fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.04em', color: '#666', borderBottom: '1px solid #e9ecef' };
const td: React.CSSProperties = { padding: '0.75rem', fontSize: '0.875rem', borderBottom: '1px solid #f0f0f0' };
const input: React.CSSProperties = { display: 'block', width: '100%', padding: '0.5rem 0.625rem', border: '1px solid #ddd', borderRadius: 4, fontSize: '0.875rem', boxSizing: 'border-box' };
const primaryBtn: React.CSSProperties = { padding: '0.5rem 1rem', background: '#0066ff', color: '#fff', border: 'none', borderRadius: 4, fontSize: '0.875rem', cursor: 'pointer' };
const smallBtn: React.CSSProperties = { padding: '0.375rem 0.75rem', background: '#f0f7ff', border: '1px solid #cce0ff', color: '#003d99', borderRadius: 4, fontSize: '0.75rem', cursor: 'pointer' };
const dangerBtn: React.CSSProperties = { padding: '0.375rem 0.75rem', background: '#fff0f0', border: '1px solid #ffcccc', color: '#990000', borderRadius: 4, fontSize: '0.75rem', cursor: 'pointer' };
