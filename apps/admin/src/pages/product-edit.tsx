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
import { api, type ProductDetail, type ProductVariantDetail } from '../lib/api';

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
      <VariantsPanel product={product} onSaved={invalidate} />
    </div>
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
