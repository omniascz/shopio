/**
 * Product create + edit — per `06-catalog-pim.md` + `27-admin-backoffice.md` MVP.
 *
 * /products/new       → create form (single default variant)
 * /products/$productId → edit product fields + per-variant price/stock rows
 *
 * Stock edits go through the inventory ledger server-side (adjustment
 * movements); the form shows on-hand + reserved + available.
 */

import { useEffect, useState } from 'react';
import { Link, useParams, useRouter } from '@tanstack/react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, type PageBlock, type ProductDetail, type ProductVariantDetail } from '../lib/api';
import { BlockList } from './content';

const STATUS_LABELS: Record<string, string> = {
  draft: 'Koncept',
  active: 'Aktivní (publikováno)',
  unpublished: 'Nepublikováno',
  archived: 'Archivováno',
};

function slugify(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

/** "599.00" / "599" / "599,50" → minor units string "59900". */
function toMinor(value: string): string | null {
  const normalized = value.replace(/\s/g, '').replace(',', '.');
  if (!/^\d+(\.\d{1,2})?$/.test(normalized)) return null;
  const [major, frac = ''] = normalized.split('.');
  return `${major}${frac.padEnd(2, '0')}`;
}

function toMajor(minor: string | null | undefined): string {
  if (!minor) return '';
  const n = BigInt(minor);
  return `${n / 100n}.${String(n % 100n).padStart(2, '0')}`;
}

// =============================================================================
// Create
// =============================================================================

export function ProductCreatePage() {
  const router = useRouter();
  const [title, setTitle] = useState('');
  const [slug, setSlug] = useState('');
  const [slugTouched, setSlugTouched] = useState(false);
  const [price, setPrice] = useState('');
  const [sku, setSku] = useState('');
  const [stock, setStock] = useState('0');
  const [weight, setWeight] = useState('');
  const [description, setDescription] = useState('');
  const [publish, setPublish] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const createMutation = useMutation({
    mutationFn: async () => {
      const priceMinor = toMinor(price);
      if (!priceMinor) throw new Error('Neplatná cena — použijte formát 599 nebo 599,90');
      return api.createProduct({
        title,
        slug: slug || slugify(title),
        ...(description && { descriptionHtml: description }),
        basePriceAmount: priceMinor,
        basePriceCurrency: 'CZK',
        status: publish ? 'active' : 'draft',
        variants: [
          {
            title: 'Default',
            ...(sku && { sku }),
            priceAmount: priceMinor,
            priceCurrency: 'CZK',
            stockOnHand: Number(stock) || 0,
            ...(weight && { weightGrams: Number(weight) }),
          },
        ],
      });
    },
    onSuccess: (product) => {
      router.navigate({ to: '/products/$productId', params: { productId: product.id } });
    },
    onError: (err) => setError((err as Error).message),
  });

  return (
    <div style={{ maxWidth: 720 }}>
      <Link to="/products" style={backLinkStyle}>
        ← Zpět na produkty
      </Link>
      <h1 style={{ margin: '0.75rem 0 1.5rem', fontSize: '1.75rem' }}>Nový produkt</h1>

      <section style={cardStyle}>
        <Field label="Název *">
          <input
            type="text"
            required
            autoFocus
            value={title}
            onChange={(e) => {
              setTitle(e.target.value);
              if (!slugTouched) setSlug(slugify(e.target.value));
            }}
            style={inputStyle}
          />
        </Field>
        <Field label="URL (slug)">
          <input
            type="text"
            value={slug}
            onChange={(e) => {
              setSlugTouched(true);
              setSlug(slugify(e.target.value));
            }}
            style={inputStyle}
          />
        </Field>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.75rem' }}>
          <Field label="Cena (Kč, vč. DPH) *">
            <input
              type="text"
              required
              placeholder="599,00"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              style={inputStyle}
            />
          </Field>
          <Field label="Skladem (ks)">
            <input
              type="number"
              min={0}
              value={stock}
              onChange={(e) => setStock(e.target.value)}
              style={inputStyle}
            />
          </Field>
          <Field label="Hmotnost (g)">
            <input
              type="number"
              min={0}
              value={weight}
              onChange={(e) => setWeight(e.target.value)}
              style={inputStyle}
            />
          </Field>
        </div>
        <Field label="SKU">
          <input type="text" value={sku} onChange={(e) => setSku(e.target.value)} style={inputStyle} />
        </Field>
        <Field label="Popis">
          <textarea
            rows={5}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            style={{ ...inputStyle, resize: 'vertical' }}
          />
        </Field>
        <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.875rem' }}>
          <input type="checkbox" checked={publish} onChange={(e) => setPublish(e.target.checked)} />
          Publikovat ihned na storefront
        </label>

        {error && <p style={errorStyle}>{error}</p>}

        <div style={{ marginTop: '1.25rem' }}>
          <button
            type="button"
            disabled={createMutation.isPending || !title || !price}
            onClick={() => {
              setError(null);
              createMutation.mutate();
            }}
            style={primaryBtnStyle}
          >
            {createMutation.isPending ? 'Vytvářím…' : 'Vytvořit produkt'}
          </button>
        </div>
      </section>
    </div>
  );
}

// =============================================================================
// Edit
// =============================================================================

export function ProductEditPage() {
  const { productId } = useParams({ from: '/app/products/$productId' });
  const queryClient = useQueryClient();

  const productQuery = useQuery({
    queryKey: ['admin', 'product', productId],
    queryFn: () => api.getProduct(productId),
  });

  if (productQuery.isLoading) return <p>Načítání produktu…</p>;
  if (productQuery.isError || !productQuery.data) {
    return (
      <div>
        <p style={{ color: '#c00' }}>Produkt nenalezen.</p>
        <Link to="/products" style={{ color: '#0066ff' }}>
          ← Zpět na produkty
        </Link>
      </div>
    );
  }

  const product = productQuery.data;
  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ['admin', 'product', productId] });

  return (
    <div style={{ maxWidth: 880 }}>
      <Link to="/products" style={backLinkStyle}>
        ← Zpět na produkty
      </Link>
      <header
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          margin: '0.75rem 0 1.5rem',
        }}
      >
        <h1 style={{ margin: 0, fontSize: '1.75rem' }}>{product.title}</h1>
        <span style={{ fontSize: '0.8125rem', color: '#666' }}>
          {STATUS_LABELS[product.status] ?? product.status}
        </span>
      </header>

      <ProductFieldsForm product={product} onSaved={invalidate} />
      <AttributesPanel product={product} onSaved={invalidate} />
      <MediaPanel product={product} onSaved={invalidate} />
      <VariantsPanel product={product} onSaved={invalidate} />
      <BundlePanel product={product} />
      <CategoriesPanel product={product} onSaved={invalidate} />
      <ContentBlocksPanel product={product} onSaved={invalidate} />
      <AiAssistPanel product={product} onSaved={invalidate} />
      <VendorPanel product={product} onSaved={invalidate} />
      <TranslationsPanel productId={product.id} />
    </div>
  );
}

// =============================================================================
// Content blocks (per `32`) — page-builder sections below the description
// =============================================================================

function ContentBlocksPanel({ product, onSaved }: { product: ProductDetail; onSaved: () => void }) {
  const [blocks, setBlocks] = useState<PageBlock[]>((product.content_blocks as PageBlock[]) ?? []);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setBlocks((product.content_blocks as PageBlock[]) ?? []);
  }, [product.id, product.content_blocks]);

  const saveMutation = useMutation({
    mutationFn: () => api.updateProduct(product.id, { contentBlocks: blocks }),
    onSuccess: () => { setSaved(true); setError(null); onSaved(); setTimeout(() => setSaved(false), 2000); },
    onError: (err) => setError((err as Error).message),
  });

  return (
    <section style={cardStyle}>
      <h2 style={sectionHeaderStyle}>Obsahové bloky (pod popisem)</h2>
      <p style={{ fontSize: '0.8125rem', color: '#666', margin: '0 0 0.75rem' }}>
        Poskládejte bohatý obsah, který se zobrazí na detailu produktu pod popisem — galerie, video,
        FAQ, reference, „Koupit" i znovupoužitelné sekce.
      </p>
      <BlockList blocks={blocks} onChange={setBlocks} />
      <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', marginTop: '0.75rem' }}>
        <button type="button" onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending} style={primaryBtnStyle}>
          {saveMutation.isPending ? 'Ukládám…' : saved ? '✓ Uloženo' : 'Uložit bloky'}
        </button>
        {error && <span style={{ color: '#c00', fontSize: '0.8125rem' }}>{error}</span>}
      </div>
    </section>
  );
}

// =============================================================================
// AI assistant (per `33`)
// =============================================================================

function AiAssistPanel({ product, onSaved }: { product: ProductDetail; onSaved: () => void }) {
  const [draft, setDraft] = useState('');
  const [seo, setSeo] = useState<{ seoTitle: string; metaDescription: string } | null>(null);
  const [mock, setMock] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const attrs = Object.fromEntries(product.attributes.map((a) => [a.name, a.value]));

  const genDesc = useMutation({
    mutationFn: () => api.aiProductDescription({ title: product.title, attributes: attrs }),
    onSuccess: (r) => { setDraft(r.descriptionHtml); setMock(r.mock); setError(null); },
    onError: (e) => setError((e as Error).message),
  });
  const genSeo = useMutation({
    mutationFn: () => api.aiSeo({ title: product.title, attributes: attrs, ...(product.description_html ? { descriptionHtml: product.description_html } : {}) }),
    onSuccess: (r) => { setSeo({ seoTitle: r.seoTitle, metaDescription: r.metaDescription }); setMock(r.mock); setError(null); },
    onError: (e) => setError((e as Error).message),
  });
  const applyDesc = useMutation({
    mutationFn: () => api.updateProduct(product.id, { descriptionHtml: draft }),
    onSuccess: () => { onSaved(); setDraft(''); },
  });

  return (
    <section style={cardStyle}>
      <h2 style={sectionHeaderStyle}>✨ AI asistent</h2>
      <p style={{ fontSize: '0.8125rem', color: '#666', margin: '0 0 0.75rem' }}>
        Vygeneruje návrh z názvu a parametrů produktu. {mock && '(Dev režim — bez API klíče vrací ukázku.)'}
      </p>
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.75rem' }}>
        <button type="button" onClick={() => genDesc.mutate()} disabled={genDesc.isPending} style={aiBtn}>
          {genDesc.isPending ? 'Generuji…' : 'Vygenerovat popis'}
        </button>
        <button type="button" onClick={() => genSeo.mutate()} disabled={genSeo.isPending} style={aiBtn}>
          {genSeo.isPending ? 'Generuji…' : 'Vygenerovat SEO'}
        </button>
      </div>

      {draft && (
        <div style={{ marginBottom: '0.75rem' }}>
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            rows={6}
            style={{ width: '100%', padding: '0.5rem', border: '1px solid #ddd', borderRadius: 4, fontFamily: 'monospace', fontSize: '0.8125rem', boxSizing: 'border-box' }}
          />
          <button type="button" onClick={() => applyDesc.mutate()} disabled={applyDesc.isPending} style={{ ...aiBtn, marginTop: 6 }}>
            {applyDesc.isPending ? 'Ukládám…' : 'Uložit jako popis produktu'}
          </button>
        </div>
      )}

      {seo && (
        <div style={{ fontSize: '0.875rem', background: '#f8f9ff', padding: '0.75rem', borderRadius: 6 }}>
          <div><strong>SEO titulek:</strong> {seo.seoTitle} <span style={{ color: '#999' }}>({seo.seoTitle.length}/60)</span></div>
          <div style={{ marginTop: 4 }}><strong>Meta popis:</strong> {seo.metaDescription} <span style={{ color: '#999' }}>({seo.metaDescription.length}/155)</span></div>
        </div>
      )}
      {error && <p style={{ color: '#c00', fontSize: '0.875rem' }}>{error}</p>}
    </section>
  );
}

const aiBtn: React.CSSProperties = {
  padding: '0.5rem 0.875rem',
  background: '#6b46c1',
  color: '#fff',
  border: 'none',
  borderRadius: 6,
  fontSize: '0.8125rem',
  fontWeight: 500,
  cursor: 'pointer',
};

// =============================================================================
// Marketplace vendor assignment (per `25`)
// =============================================================================

function VendorPanel({ product, onSaved }: { product: ProductDetail; onSaved: () => void }) {
  const vendorsQuery = useQuery({ queryKey: ['admin', 'vendors'], queryFn: () => api.listVendors() });
  const vendors = vendorsQuery.data?.vendors ?? [];
  const mutation = useMutation({
    mutationFn: (vendorId: string | null) => api.updateProduct(product.id, { vendorId }),
    onSuccess: onSaved,
  });

  // Hide entirely if there are no vendors (marketplace not in use).
  if (vendorsQuery.isSuccess && vendors.length === 0) return null;

  return (
    <section style={cardStyle}>
      <h2 style={sectionHeaderStyle}>Prodejce (marketplace)</h2>
      <p style={{ fontSize: '0.8125rem', color: '#666', margin: '0 0 0.75rem' }}>
        Přiřadí produkt prodejci třetí strany. Platforma si z prodeje vezme jeho provizi.
        Prázdné = vlastní produkt platformy.
      </p>
      <select
        value={product.vendor_id ?? ''}
        onChange={(e) => mutation.mutate(e.target.value || null)}
        disabled={mutation.isPending}
        style={{ padding: '0.5rem 0.625rem', border: '1px solid #ddd', borderRadius: 4, fontSize: '0.9375rem', minWidth: 280 }}
      >
        <option value="">— vlastní produkt platformy —</option>
        {vendors.map((v) => (
          <option key={v.id} value={v.id}>
            {v.display_name} ({v.commission_basis_points / 100} % provize)
          </option>
        ))}
      </select>
    </section>
  );
}

// =============================================================================
// Translations (per `23-i18n.md`)
// =============================================================================

const FIELD_LABELS: Record<string, string> = {
  title: 'Název',
  description_html: 'Popis (HTML)',
};

function TranslationsPanel({ productId }: { productId: string }) {
  const settings = useQuery({ queryKey: ['admin', 'locale-settings'], queryFn: () => api.getLocaleSettings() });
  const data = useQuery({
    queryKey: ['admin', 'translations', 'product', productId],
    queryFn: () => api.getTranslations('product', productId),
  });

  // non-default enabled locales need translation
  const others = (settings.data?.enabled_locales ?? []).filter(
    (l) => l !== settings.data?.default_locale,
  );

  return (
    <section style={cardStyle}>
      <h2 style={sectionHeaderStyle}>Překlady</h2>
      {others.length === 0 ? (
        <p style={{ fontSize: '0.8125rem', color: '#666', margin: 0 }}>
          Žádné další jazyky. Povolte je v{' '}
          <Link to="/settings" style={{ color: '#0066ff' }}>
            Nastavení → Jazyky
          </Link>
          .
        </p>
      ) : !data.data ? (
        <p style={{ fontSize: '0.875rem', color: '#666' }}>Načítání…</p>
      ) : (
        others.map((locale) => (
          <LocaleTranslationForm
            key={locale}
            productId={productId}
            locale={locale}
            fields={data.data!.fields}
            master={data.data!.master}
            current={data.data!.translations[locale] ?? {}}
          />
        ))
      )}
    </section>
  );
}

function LocaleTranslationForm({
  productId,
  locale,
  fields,
  master,
  current,
}: {
  productId: string;
  locale: string;
  fields: string[];
  master: Record<string, string | null>;
  current: Record<string, string>;
}) {
  const queryClient = useQueryClient();
  const [values, setValues] = useState<Record<string, string>>(current);
  const [saved, setSaved] = useState(false);

  const mutation = useMutation({
    mutationFn: () => api.putTranslation({ entityType: 'product', entityId: productId, locale, fields: values }),
    onSuccess: () => {
      setSaved(true);
      queryClient.invalidateQueries({ queryKey: ['admin', 'translations', 'product', productId] });
      setTimeout(() => setSaved(false), 1500);
    },
  });

  return (
    <div style={{ border: '1px solid #eee', borderRadius: 6, padding: '0.875rem', marginBottom: '0.75rem' }}>
      <div style={{ fontWeight: 600, fontSize: '0.875rem', marginBottom: '0.5rem' }}>{locale}</div>
      {fields.map((f) => (
        <label key={f} style={{ display: 'block', marginBottom: '0.625rem' }}>
          <span style={{ display: 'block', fontSize: '0.75rem', color: '#888', marginBottom: 2 }}>
            {FIELD_LABELS[f] ?? f} · originál: {master[f] || '—'}
          </span>
          {f === 'description_html' ? (
            <textarea
              value={values[f] ?? ''}
              onChange={(e) => setValues({ ...values, [f]: e.target.value })}
              rows={3}
              style={{ width: '100%', padding: '0.4rem', border: '1px solid #ddd', borderRadius: 4, boxSizing: 'border-box', fontSize: '0.875rem' }}
            />
          ) : (
            <input
              value={values[f] ?? ''}
              onChange={(e) => setValues({ ...values, [f]: e.target.value })}
              style={{ width: '100%', padding: '0.4rem', border: '1px solid #ddd', borderRadius: 4, boxSizing: 'border-box', fontSize: '0.875rem' }}
            />
          )}
        </label>
      ))}
      <button
        type="button"
        onClick={() => mutation.mutate()}
        disabled={mutation.isPending}
        style={{ padding: '0.4rem 0.875rem', background: '#0066ff', color: '#fff', border: 'none', borderRadius: 4, fontSize: '0.8125rem', cursor: 'pointer' }}
      >
        {mutation.isPending ? 'Ukládám…' : saved ? '✓ Uloženo' : 'Uložit překlad'}
      </button>
    </div>
  );
}

// =============================================================================
// Media
// =============================================================================

function AttributesPanel({ product, onSaved }: { product: ProductDetail; onSaved: () => void }) {
  const [rows, setRows] = useState<{ name: string; value: string }[]>(
    product.attributes.length ? product.attributes : [],
  );
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setRows(product.attributes);
  }, [product.id, product.attributes]);

  const saveMutation = useMutation({
    mutationFn: () =>
      api.updateProduct(product.id, {
        attributes: rows.filter((r) => r.name.trim() && r.value.trim()),
      }),
    onSuccess: onSaved,
    onError: (err) => setError((err as Error).message),
  });

  function update(i: number, key: 'name' | 'value', val: string) {
    setRows((prev) => prev.map((r, idx) => (idx === i ? { ...r, [key]: val } : r)));
  }

  return (
    <section style={cardStyle}>
      <h2 style={sectionHeaderStyle}>Parametry (specifikace)</h2>
      <p style={{ fontSize: '0.8125rem', color: '#666', margin: '0 0 0.75rem' }}>
        Zobrazí se jako tabulka na detailu produktu a slouží jako filtry v katalogu.
      </p>
      <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '0.5rem' }}>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i}>
              <td style={{ padding: '0.25rem 0.25rem 0.25rem 0', width: '40%' }}>
                <input
                  value={r.name}
                  placeholder="Materiál"
                  onChange={(e) => update(i, 'name', e.target.value)}
                  style={inputStyle}
                />
              </td>
              <td style={{ padding: '0.25rem' }}>
                <input
                  value={r.value}
                  placeholder="Kamenina"
                  onChange={(e) => update(i, 'value', e.target.value)}
                  style={inputStyle}
                />
              </td>
              <td style={{ width: 32, textAlign: 'right' }}>
                <button
                  type="button"
                  onClick={() => setRows((prev) => prev.filter((_, idx) => idx !== i))}
                  style={{ ...smallBtnStyle, background: '#fff5f5', borderColor: '#ffcccc', color: '#a03030' }}
                >
                  ✕
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <button
        type="button"
        onClick={() => setRows((prev) => [...prev, { name: '', value: '' }])}
        style={{ ...smallBtnStyle, marginRight: '0.5rem' }}
      >
        + Přidat parametr
      </button>
      {error && <p style={errorStyle}>{error}</p>}
      <div style={{ marginTop: '0.75rem' }}>
        <button
          type="button"
          disabled={saveMutation.isPending}
          onClick={() => {
            setError(null);
            saveMutation.mutate();
          }}
          style={primaryBtnStyle}
        >
          {saveMutation.isPending ? 'Ukládám…' : 'Uložit parametry'}
        </button>
        {saveMutation.isSuccess && (
          <span style={{ marginLeft: '0.75rem', color: '#2e7d32', fontSize: '0.875rem' }}>✓ Uloženo</span>
        )}
      </div>
    </section>
  );
}

function MediaPanel({ product, onSaved }: { product: ProductDetail; onSaved: () => void }) {
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setError(null);
    setUploading(true);
    try {
      await api.uploadProductMedia(product.id, file);
      onSaved();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setUploading(false);
    }
  }

  return (
    <section style={cardStyle}>
      <h2 style={sectionHeaderStyle}>Obrázky</h2>
      <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', marginBottom: '0.75rem' }}>
        {product.media.map((m) => (
          <figure key={m.id} style={{ margin: 0, width: 132 }}>
            <div
              style={{
                width: 132,
                height: 132,
                borderRadius: 6,
                overflow: 'hidden',
                border: m.is_primary ? '2px solid #0066ff' : '1px solid #e3e6ea',
                background: '#f8f9fb',
              }}
            >
              <img
                src={m.url}
                alt={m.alt ?? ''}
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              />
            </div>
            <figcaption style={{ display: 'flex', gap: '0.25rem', marginTop: '0.25rem' }}>
              {!m.is_primary && (
                <button
                  type="button"
                  title="Nastavit jako hlavní"
                  style={{ ...smallBtnStyle, flex: 1 }}
                  onClick={() =>
                    void api
                      .updateProductMedia(product.id, m.id, { isPrimary: true })
                      .then(onSaved)
                      .catch((err) => setError((err as Error).message))
                  }
                >
                  ★ Hlavní
                </button>
              )}
              {m.is_primary && (
                <span style={{ flex: 1, fontSize: '0.6875rem', color: '#0066ff', alignSelf: 'center', textAlign: 'center' }}>
                  hlavní obrázek
                </span>
              )}
              <button
                type="button"
                title="Smazat"
                style={{ ...smallBtnStyle, background: '#fff5f5', borderColor: '#ffcccc', color: '#a03030' }}
                onClick={() =>
                  void api
                    .deleteProductMedia(product.id, m.id)
                    .then(onSaved)
                    .catch((err) => setError((err as Error).message))
                }
              >
                ✕
              </button>
            </figcaption>
          </figure>
        ))}
        <label
          style={{
            width: 132,
            height: 132,
            borderRadius: 6,
            border: '2px dashed #cdd3da',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: uploading ? 'wait' : 'pointer',
            color: '#666',
            fontSize: '0.8125rem',
            textAlign: 'center',
          }}
        >
          {uploading ? 'Nahrávám…' : '+ Nahrát obrázek'}
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif,image/avif"
            onChange={(e) => void handleUpload(e)}
            disabled={uploading}
            style={{ display: 'none' }}
          />
        </label>
      </div>
      <p style={{ fontSize: '0.75rem', color: '#888', margin: 0 }}>
        JPEG/PNG/WebP/GIF/AVIF · max 5 MB · první nahraný se stane hlavním
      </p>
      {error && <p style={errorStyle}>{error}</p>}
    </section>
  );
}

// =============================================================================
// Categories
// =============================================================================

function CategoriesPanel({ product, onSaved }: { product: ProductDetail; onSaved: () => void }) {
  const queryClient = useQueryClient();
  const [selected, setSelected] = useState<Set<string>>(new Set(product.category_ids));
  const [newName, setNewName] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setSelected(new Set(product.category_ids));
  }, [product.id, product.category_ids]);

  const categoriesQuery = useQuery({
    queryKey: ['admin', 'categories'],
    queryFn: () => api.listCategories(),
  });
  const categories = categoriesQuery.data?.categories ?? [];

  const dirty =
    selected.size !== product.category_ids.length ||
    product.category_ids.some((id) => !selected.has(id));

  const saveMutation = useMutation({
    mutationFn: () => api.updateProduct(product.id, { categoryIds: [...selected] }),
    onSuccess: onSaved,
    onError: (err) => setError((err as Error).message),
  });

  const createMutation = useMutation({
    mutationFn: () => api.createCategory({ name: newName }),
    onSuccess: (cat) => {
      setNewName('');
      setSelected((prev) => new Set([...prev, cat.id]));
      queryClient.invalidateQueries({ queryKey: ['admin', 'categories'] });
    },
    onError: (err) => setError((err as Error).message),
  });

  return (
    <section style={cardStyle}>
      <h2 style={sectionHeaderStyle}>Kategorie</h2>
      {categories.length === 0 && !categoriesQuery.isLoading && (
        <p style={{ color: '#666', fontSize: '0.875rem' }}>Zatím žádné kategorie — vytvořte první níže.</p>
      )}
      <div style={{ display: 'flex', gap: '0.5rem 1rem', flexWrap: 'wrap', marginBottom: '0.75rem' }}>
        {categories.map((c) => (
          <label key={c.id} style={{ fontSize: '0.875rem', display: 'flex', gap: '0.375rem', alignItems: 'center' }}>
            <input
              type="checkbox"
              checked={selected.has(c.id)}
              onChange={(e) =>
                setSelected((prev) => {
                  const next = new Set(prev);
                  if (e.target.checked) next.add(c.id);
                  else next.delete(c.id);
                  return next;
                })
              }
            />
            {' '.repeat((c.depth ?? 0) * 2)}
            {c.name}
          </label>
        ))}
      </div>
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.75rem' }}>
        <input
          type="text"
          placeholder="Nová kategorie…"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          style={{ ...inputStyle, maxWidth: 260 }}
        />
        <button
          type="button"
          disabled={!newName || createMutation.isPending}
          onClick={() => {
            setError(null);
            createMutation.mutate();
          }}
          style={smallBtnStyle}
        >
          Vytvořit
        </button>
      </div>
      {error && <p style={errorStyle}>{error}</p>}
      <button
        type="button"
        disabled={!dirty || saveMutation.isPending}
        onClick={() => {
          setError(null);
          saveMutation.mutate();
        }}
        style={{ ...primaryBtnStyle, opacity: !dirty || saveMutation.isPending ? 0.6 : 1 }}
      >
        {saveMutation.isPending ? 'Ukládám…' : 'Uložit kategorie'}
      </button>
    </section>
  );
}

function ProductFieldsForm({
  product,
  onSaved,
}: {
  product: ProductDetail;
  onSaved: () => void;
}) {
  const [title, setTitle] = useState(product.title);
  const [slug, setSlug] = useState(product.slug);
  const [status, setStatus] = useState(product.status);
  const [vendor, setVendor] = useState(product.vendor ?? '');
  const [brand, setBrand] = useState(product.brand_name ?? '');
  const [description, setDescription] = useState(product.description_html ?? '');
  const [error, setError] = useState<string | null>(null);

  // Refresh local state when the query refetches a different product
  useEffect(() => {
    setTitle(product.title);
    setSlug(product.slug);
    setStatus(product.status);
    setVendor(product.vendor ?? '');
    setBrand(product.brand_name ?? '');
    setDescription(product.description_html ?? '');
  }, [product.id, product.title, product.slug, product.status, product.vendor, product.brand_name, product.description_html]);

  const saveMutation = useMutation({
    mutationFn: () =>
      api.updateProduct(product.id, {
        title,
        slug,
        status,
        vendor: vendor || null,
        brandName: brand || null,
        descriptionHtml: description,
      }),
    onSuccess: onSaved,
    onError: (err) => setError((err as Error).message),
  });

  return (
    <section style={cardStyle}>
      <h2 style={sectionHeaderStyle}>Základní údaje</h2>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
        <Field label="Název">
          <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} style={inputStyle} />
        </Field>
        <Field label="URL (slug)">
          <input
            type="text"
            value={slug}
            onChange={(e) => setSlug(slugify(e.target.value))}
            style={inputStyle}
          />
        </Field>
        <Field label="Stav">
          <select value={status} onChange={(e) => setStatus(e.target.value)} style={inputStyle}>
            {Object.entries(STATUS_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Výrobce / dodavatel">
          <input type="text" value={vendor} onChange={(e) => setVendor(e.target.value)} style={inputStyle} />
        </Field>
        <Field label="Značka">
          <input type="text" value={brand} onChange={(e) => setBrand(e.target.value)} style={inputStyle} />
        </Field>
      </div>
      <Field label="Popis">
        <textarea
          rows={5}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          style={{ ...inputStyle, resize: 'vertical' }}
        />
      </Field>

      {error && <p style={errorStyle}>{error}</p>}

      <button
        type="button"
        disabled={saveMutation.isPending}
        onClick={() => {
          setError(null);
          saveMutation.mutate();
        }}
        style={primaryBtnStyle}
      >
        {saveMutation.isPending ? 'Ukládám…' : 'Uložit změny'}
      </button>
      {saveMutation.isSuccess && (
        <span style={{ marginLeft: '0.75rem', color: '#2e7d32', fontSize: '0.875rem' }}>✓ Uloženo</span>
      )}
    </section>
  );
}

function VariantsPanel({ product, onSaved }: { product: ProductDetail; onSaved: () => void }) {
  const [adding, setAdding] = useState(false);
  const [title, setTitle] = useState('');
  const [sku, setSku] = useState('');
  const [price, setPrice] = useState('');
  const [stock, setStock] = useState('0');
  const [error, setError] = useState<string | null>(null);

  const addMutation = useMutation({
    mutationFn: async () => {
      const priceMinor = toMinor(price);
      if (!priceMinor) throw new Error('Neplatná cena');
      return api.addVariant(product.id, {
        title,
        ...(sku && { sku }),
        priceAmount: priceMinor,
        priceCurrency: product.base_price_currency ?? 'CZK',
        stockOnHand: Number(stock) || 0,
      });
    },
    onSuccess: () => {
      setAdding(false);
      setTitle('');
      setSku('');
      setPrice('');
      setStock('0');
      onSaved();
    },
    onError: (err) => setError((err as Error).message),
  });

  return (
    <section style={cardStyle}>
      <h2 style={sectionHeaderStyle}>Varianty, ceny a sklad</h2>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr>
            <th style={thStyle}>Varianta</th>
            <th style={thStyle}>SKU</th>
            <th style={{ ...thStyle, textAlign: 'right' }}>Cena (Kč)</th>
            <th style={{ ...thStyle, textAlign: 'right' }}>Skladem</th>
            <th style={{ ...thStyle, textAlign: 'right' }}>Rezervováno</th>
            <th style={{ ...thStyle, textAlign: 'right' }}>K prodeji</th>
            <th style={thStyle} />
          </tr>
        </thead>
        <tbody>
          {product.variants.map((v) => (
            <VariantRow key={v.id} productId={product.id} variant={v} onSaved={onSaved} />
          ))}
        </tbody>
      </table>

      {!adding ? (
        <button type="button" style={{ ...smallBtnStyle, marginTop: '0.75rem' }} onClick={() => setAdding(true)}>
          + Přidat variantu
        </button>
      ) : (
        <div style={{ marginTop: '0.75rem', display: 'flex', gap: '0.5rem', alignItems: 'flex-end', flexWrap: 'wrap' }}>
          <Field label="Název (např. Velikost L)">
            <input value={title} onChange={(e) => setTitle(e.target.value)} style={{ ...inputStyle, width: 180 }} />
          </Field>
          <Field label="SKU">
            <input value={sku} onChange={(e) => setSku(e.target.value)} style={{ ...inputStyle, width: 120 }} />
          </Field>
          <Field label="Cena (Kč)">
            <input value={price} onChange={(e) => setPrice(e.target.value)} placeholder="599,00" style={{ ...inputStyle, width: 100 }} />
          </Field>
          <Field label="Skladem">
            <input type="number" min={0} value={stock} onChange={(e) => setStock(e.target.value)} style={{ ...inputStyle, width: 80 }} />
          </Field>
          <button
            type="button"
            disabled={!title || !price || addMutation.isPending}
            onClick={() => {
              setError(null);
              addMutation.mutate();
            }}
            style={{ ...primaryBtnStyle, marginBottom: '0.875rem' }}
          >
            {addMutation.isPending ? 'Přidávám…' : 'Přidat'}
          </button>
          <button type="button" onClick={() => setAdding(false)} style={{ ...smallBtnStyle, marginBottom: '0.875rem' }}>
            Zrušit
          </button>
        </div>
      )}
      {error && <p style={errorStyle}>{error}</p>}
    </section>
  );
}

function VariantRow({
  productId,
  variant,
  onSaved,
}: {
  productId: string;
  variant: ProductVariantDetail;
  onSaved: () => void;
}) {
  const [price, setPrice] = useState(toMajor(variant.price_amount));
  const [stock, setStock] = useState(String(variant.stock_on_hand));
  const [sku, setSku] = useState(variant.sku ?? '');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setPrice(toMajor(variant.price_amount));
    setStock(String(variant.stock_on_hand));
    setSku(variant.sku ?? '');
  }, [variant.id, variant.price_amount, variant.stock_on_hand, variant.sku]);

  const dirty =
    price !== toMajor(variant.price_amount) ||
    stock !== String(variant.stock_on_hand) ||
    sku !== (variant.sku ?? '');

  const saveMutation = useMutation({
    mutationFn: async () => {
      const priceMinor = toMinor(price);
      if (!priceMinor) throw new Error('Neplatná cena');
      return api.updateVariant(productId, variant.id, {
        priceAmount: priceMinor,
        sku: sku || null,
        ...(stock !== String(variant.stock_on_hand) && {
          stockOnHand: Number(stock),
          stockNote: 'Ruční úprava z administrace',
        }),
      });
    },
    onSuccess: onSaved,
    onError: (err) => setError((err as Error).message),
  });

  return (
    <>
      <tr>
        <td style={tdStyle}>{variant.title}</td>
        <td style={tdStyle}>
          <input type="text" value={sku} onChange={(e) => setSku(e.target.value)} style={{ ...inputStyle, width: 110, padding: '0.375rem 0.5rem' }} />
        </td>
        <td style={{ ...tdStyle, textAlign: 'right' }}>
          <input
            type="text"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            style={{ ...inputStyle, width: 90, padding: '0.375rem 0.5rem', textAlign: 'right' }}
          />
        </td>
        <td style={{ ...tdStyle, textAlign: 'right' }}>
          <input
            type="number"
            min={0}
            value={stock}
            onChange={(e) => setStock(e.target.value)}
            style={{ ...inputStyle, width: 70, padding: '0.375rem 0.5rem', textAlign: 'right' }}
          />
        </td>
        <td style={{ ...tdStyle, textAlign: 'right', color: '#666' }}>{variant.stock_reserved}</td>
        <td style={{ ...tdStyle, textAlign: 'right', fontWeight: 600 }}>{variant.stock_available}</td>
        <td style={{ ...tdStyle, textAlign: 'right' }}>
          <button
            type="button"
            disabled={!dirty || saveMutation.isPending}
            onClick={() => {
              setError(null);
              saveMutation.mutate();
            }}
            style={{
              ...smallBtnStyle,
              opacity: !dirty || saveMutation.isPending ? 0.5 : 1,
            }}
          >
            {saveMutation.isPending ? '…' : 'Uložit'}
          </button>
        </td>
      </tr>
      {error && (
        <tr>
          <td colSpan={7} style={{ ...tdStyle, color: '#c00', fontSize: '0.8125rem' }}>
            {error}
          </td>
        </tr>
      )}
    </>
  );
}

// =============================================================================
// Shared bits
// =============================================================================

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label style={{ display: 'block', marginBottom: '0.875rem', fontSize: '0.875rem' }}>
      <span style={{ display: 'block', marginBottom: 4, fontWeight: 500 }}>{label}</span>
      {children}
    </label>
  );
}

// =============================================================================
// Bundle composition (per `06` §3.5) — make this product a bundle of others
// =============================================================================

function BundlePanel({ product }: { product: ProductDetail }) {
  const queryClient = useQueryClient();
  const itemsQuery = useQuery({
    queryKey: ['admin', 'bundle-items', product.id],
    queryFn: () => api.listBundleItems(product.id),
  });
  const items = itemsQuery.data?.bundle_items ?? [];
  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['admin', 'bundle-items', product.id] });

  // Pick a child variant: choose another product, then one of its variants.
  const productsQuery = useQuery({ queryKey: ['admin', 'products', 'all'], queryFn: () => api.listProducts() });
  const products = (productsQuery.data?.products ?? []).filter((p) => p.id !== product.id);
  const [pickProduct, setPickProduct] = useState('');
  const [qty, setQty] = useState('1');
  const [error, setError] = useState<string | null>(null);
  const detailQuery = useQuery({
    queryKey: ['admin', 'product', pickProduct],
    queryFn: () => api.getProduct(pickProduct),
    enabled: Boolean(pickProduct),
  });
  const [pickVariant, setPickVariant] = useState('');

  const add = useMutation({
    mutationFn: () => {
      if (!pickVariant) throw new Error('Vyberte variantu');
      return api.addBundleItem(product.id, { childVariantId: pickVariant, quantity: Number(qty) || 1 });
    },
    onSuccess: () => { setPickProduct(''); setPickVariant(''); setQty('1'); invalidate(); },
    onError: (e) => {
      const code = (e as { code?: string }).code;
      setError(
        code === 'BUNDLE_CYCLE'
          ? 'Tato varianta by vytvořila cyklus.'
          : code === 'DUPLICATE_ITEM'
            ? 'Varianta už je v bundlu.'
            : code === 'SELF_REFERENCE'
              ? 'Bundle nemůže obsahovat vlastní variantu.'
              : (e as Error).message,
      );
    },
  });
  const remove = useMutation({
    mutationFn: (itemId: string) => api.deleteBundleItem(product.id, itemId),
    onSuccess: invalidate,
  });

  return (
    <section style={cardStyle}>
      <h2 style={sectionHeaderStyle}>Sada / bundle</h2>
      <p style={{ fontSize: '0.8125rem', color: '#666', marginTop: 0 }}>
        Přidáním komponent se z produktu stane bundle. Bundle má vlastní cenu (nastavte ji výše); zde
        jen určujete, co obsahuje. Dostupnost se počítá z dětí.
      </p>

      {items.length > 0 && (
        <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '0.75rem' }}>
          <thead>
            <tr>
              <th style={thStyle}>Produkt</th>
              <th style={thStyle}>Varianta</th>
              <th style={{ ...thStyle, textAlign: 'right' }}>Počet</th>
              <th style={{ ...thStyle, textAlign: 'right' }}>Skladem</th>
              <th style={thStyle} />
            </tr>
          </thead>
          <tbody>
            {items.map((it) => (
              <tr key={it.id}>
                <td style={tdStyle}>{it.title}</td>
                <td style={tdStyle}>{it.variant_title}</td>
                <td style={{ ...tdStyle, textAlign: 'right' }}>{it.quantity}×</td>
                <td style={{ ...tdStyle, textAlign: 'right' }}>{it.available_units}</td>
                <td style={{ ...tdStyle, textAlign: 'right' }}>
                  <button type="button" onClick={() => remove.mutate(it.id)} style={smallBtnStyle}>Odebrat</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-end', flexWrap: 'wrap' }}>
        <label style={{ fontSize: '0.8125rem' }}>
          <span style={{ display: 'block', marginBottom: 4, fontWeight: 500 }}>Produkt</span>
          <select value={pickProduct} onChange={(e) => { setPickProduct(e.target.value); setPickVariant(''); }} style={{ ...inputStyle, width: 200 }}>
            <option value="">— vyberte —</option>
            {products.map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}
          </select>
        </label>
        <label style={{ fontSize: '0.8125rem' }}>
          <span style={{ display: 'block', marginBottom: 4, fontWeight: 500 }}>Varianta</span>
          <select value={pickVariant} onChange={(e) => setPickVariant(e.target.value)} disabled={!pickProduct} style={{ ...inputStyle, width: 180 }}>
            <option value="">— vyberte —</option>
            {(detailQuery.data?.variants ?? []).map((v) => <option key={v.id} value={v.id}>{v.title}{v.sku ? ` (${v.sku})` : ''}</option>)}
          </select>
        </label>
        <label style={{ fontSize: '0.8125rem' }}>
          <span style={{ display: 'block', marginBottom: 4, fontWeight: 500 }}>Počet</span>
          <input value={qty} onChange={(e) => setQty(e.target.value)} type="number" min="1" style={{ ...inputStyle, width: 70 }} />
        </label>
        <button type="button" disabled={!pickVariant || add.isPending} onClick={() => { setError(null); add.mutate(); }} style={primaryBtnStyle}>
          Přidat
        </button>
      </div>
      {error && <p style={errorStyle}>{error}</p>}
    </section>
  );
}

const cardStyle: React.CSSProperties = {
  background: '#fff',
  padding: '1.25rem',
  borderRadius: 8,
  border: '1px solid #e9ecef',
  marginBottom: '1rem',
};

const sectionHeaderStyle: React.CSSProperties = {
  margin: '0 0 1rem',
  fontSize: '1rem',
  fontWeight: 600,
};

const backLinkStyle: React.CSSProperties = {
  color: '#666',
  fontSize: '0.875rem',
  textDecoration: 'none',
};

const inputStyle: React.CSSProperties = {
  display: 'block',
  width: '100%',
  padding: '0.5rem 0.625rem',
  border: '1px solid #ddd',
  borderRadius: 4,
  fontSize: '0.875rem',
  boxSizing: 'border-box',
};

const thStyle: React.CSSProperties = {
  textAlign: 'left',
  padding: '0.5rem',
  fontSize: '0.75rem',
  textTransform: 'uppercase',
  letterSpacing: '0.04em',
  color: '#666',
  borderBottom: '1px solid #e9ecef',
};

const tdStyle: React.CSSProperties = {
  padding: '0.5rem',
  fontSize: '0.875rem',
  borderBottom: '1px solid #f0f0f0',
};

const errorStyle: React.CSSProperties = {
  color: '#c00',
  fontSize: '0.875rem',
  margin: '0.5rem 0',
};

const primaryBtnStyle: React.CSSProperties = {
  padding: '0.625rem 1.25rem',
  background: '#0066ff',
  color: '#fff',
  border: 'none',
  borderRadius: 4,
  fontSize: '0.875rem',
  fontWeight: 500,
  cursor: 'pointer',
};

const smallBtnStyle: React.CSSProperties = {
  padding: '0.375rem 0.75rem',
  background: '#f0f7ff',
  border: '1px solid #cce0ff',
  color: '#003d99',
  borderRadius: 4,
  fontSize: '0.75rem',
  cursor: 'pointer',
};
