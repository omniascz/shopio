/**
 * Ruční (telefonická) objednávka — per `22-multistore-channels.md` MVP.
 *
 * Staff search products, add variant lines, fill the customer + address, and
 * place an order attributed to the 'manual' channel — same tax/numbering/stock
 * path as the web checkout. Optionally mark it paid (cash/transfer received) →
 * invoice is issued.
 */

import { useState } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { api, formatMoney, type ProductVariantDetail } from '../lib/api';

interface Line {
  variantId: string;
  productTitle: string;
  variantTitle: string;
  priceAmount: string;
  currency: string;
  quantity: number;
}

export function ManualOrderPage() {
  const navigate = useNavigate();
  const [lines, setLines] = useState<Line[]>([]);
  const [search, setSearch] = useState('');
  const [customer, setCustomer] = useState({ email: '', name: '', phone: '' });
  const [addr, setAddr] = useState({ line1: '', city: '', postalCode: '', countryCode: 'CZ' });
  const [shipping, setShipping] = useState({ amount: '', label: 'Doprava' });
  const [note, setNote] = useState('');
  const [markPaid, setMarkPaid] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const productQuery = useQuery({
    queryKey: ['admin', 'products', 'search', search],
    queryFn: () => api.listProducts({ q: search || undefined, status: 'active', limit: 8 }),
    enabled: search.length >= 2,
  });

  function addVariant(productTitle: string, v: ProductVariantDetail) {
    setLines((prev) => {
      const existing = prev.find((l) => l.variantId === v.id);
      if (existing) {
        return prev.map((l) => (l.variantId === v.id ? { ...l, quantity: l.quantity + 1 } : l));
      }
      return [
        ...prev,
        {
          variantId: v.id,
          productTitle,
          variantTitle: v.title,
          priceAmount: v.price_amount,
          currency: v.price_currency,
          quantity: 1,
        },
      ];
    });
  }

  function setQty(variantId: string, qty: number) {
    if (qty <= 0) {
      setLines((prev) => prev.filter((l) => l.variantId !== variantId));
    } else {
      setLines((prev) => prev.map((l) => (l.variantId === variantId ? { ...l, quantity: qty } : l)));
    }
  }

  const currency = lines[0]?.currency ?? 'CZK';
  const goodsTotal = lines.reduce((s, l) => s + Number(l.priceAmount) * l.quantity, 0);
  const shippingMinor = shipping.amount ? Math.round(Number(shipping.amount.replace(',', '.')) * 100) : 0;
  const grandTotal = goodsTotal + shippingMinor;

  const canSubmit =
    lines.length > 0 &&
    customer.email.trim() &&
    customer.name.trim() &&
    addr.line1.trim() &&
    addr.city.trim() &&
    addr.postalCode.trim();

  async function submit() {
    if (!canSubmit) return;
    setBusy(true);
    setError(null);
    try {
      const res = await api.createManualOrder({
        customerEmail: customer.email.trim(),
        customerName: customer.name.trim(),
        ...(customer.phone.trim() && { customerPhone: customer.phone.trim() }),
        shippingAddress: {
          line1: addr.line1.trim(),
          city: addr.city.trim(),
          postalCode: addr.postalCode.trim(),
          countryCode: addr.countryCode.trim().toUpperCase(),
        },
        items: lines.map((l) => ({ variantId: l.variantId, quantity: l.quantity })),
        ...(shippingMinor > 0 && { shippingAmount: String(shippingMinor), shippingLabel: shipping.label }),
        ...(note.trim() && { customerNote: note.trim() }),
        markPaid,
      });
      navigate({ to: '/orders/$orderId', params: { orderId: res.order.id } });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Objednávku se nepodařilo vytvořit');
      setBusy(false);
    }
  }

  return (
    <div style={{ maxWidth: 820 }}>
      <h1 style={{ fontSize: '1.75rem', margin: '0 0 1.5rem' }}>Nová ruční objednávka</h1>

      <section style={card}>
        <h2 style={h2}>Položky</h2>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Hledat produkt (min. 2 znaky)…"
          style={input}
        />
        {productQuery.data && search.length >= 2 && (
          <div style={{ marginTop: '0.75rem' }}>
            {productQuery.data.products.length === 0 && (
              <p style={{ color: '#999', fontSize: '0.875rem' }}>Nic nenalezeno.</p>
            )}
            {productQuery.data.products.map((p) => (
              <ProductPick key={p.id} productId={p.id} title={p.title} onAdd={addVariant} />
            ))}
          </div>
        )}

        {lines.length > 0 && (
          <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '1rem' }}>
            <tbody>
              {lines.map((l) => (
                <tr key={l.variantId}>
                  <td style={{ ...td, width: '100%' }}>
                    {l.productTitle}
                    <span style={{ color: '#999', fontSize: '0.8125rem' }}> — {l.variantTitle}</span>
                  </td>
                  <td style={td}>
                    <input
                      type="number"
                      min={0}
                      value={l.quantity}
                      onChange={(e) => setQty(l.variantId, Number(e.target.value))}
                      style={{ width: 56, padding: '0.25rem', textAlign: 'right', border: '1px solid #ddd', borderRadius: 4 }}
                    />
                  </td>
                  <td style={{ ...td, textAlign: 'right', whiteSpace: 'nowrap' }}>
                    {formatMoney({ amount: String(Number(l.priceAmount) * l.quantity), currency: l.currency })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section style={card}>
        <h2 style={h2}>Zákazník</h2>
        <div style={grid2}>
          <Field label="E-mail *">
            <input style={input} value={customer.email} onChange={(e) => setCustomer({ ...customer, email: e.target.value })} />
          </Field>
          <Field label="Jméno *">
            <input style={input} value={customer.name} onChange={(e) => setCustomer({ ...customer, name: e.target.value })} />
          </Field>
        </div>
        <Field label="Telefon">
          <input style={input} value={customer.phone} onChange={(e) => setCustomer({ ...customer, phone: e.target.value })} />
        </Field>
      </section>

      <section style={card}>
        <h2 style={h2}>Doručovací adresa</h2>
        <Field label="Ulice a č.p. *">
          <input style={input} value={addr.line1} onChange={(e) => setAddr({ ...addr, line1: e.target.value })} />
        </Field>
        <div style={grid3}>
          <Field label="Město *">
            <input style={input} value={addr.city} onChange={(e) => setAddr({ ...addr, city: e.target.value })} />
          </Field>
          <Field label="PSČ *">
            <input style={input} value={addr.postalCode} onChange={(e) => setAddr({ ...addr, postalCode: e.target.value })} />
          </Field>
          <Field label="Země">
            <input style={input} value={addr.countryCode} onChange={(e) => setAddr({ ...addr, countryCode: e.target.value })} />
          </Field>
        </div>
      </section>

      <section style={card}>
        <h2 style={h2}>Doprava a platba</h2>
        <div style={grid2}>
          <Field label="Cena dopravy (vč. DPH)">
            <input style={input} value={shipping.amount} onChange={(e) => setShipping({ ...shipping, amount: e.target.value })} placeholder="0" />
          </Field>
          <Field label="Popis dopravy">
            <input style={input} value={shipping.label} onChange={(e) => setShipping({ ...shipping, label: e.target.value })} />
          </Field>
        </div>
        <Field label="Poznámka">
          <input style={input} value={note} onChange={(e) => setNote(e.target.value)} />
        </Field>
        <label style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: '0.5rem', fontSize: '0.9375rem' }}>
          <input type="checkbox" checked={markPaid} onChange={(e) => setMarkPaid(e.target.checked)} />
          Označit jako zaplaceno (vystaví fakturu)
        </label>
      </section>

      <div style={{ ...card, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ fontSize: '1.125rem', fontWeight: 600 }}>
          Celkem: {formatMoney({ amount: String(grandTotal), currency })}
        </div>
        <button
          type="button"
          onClick={() => void submit()}
          disabled={!canSubmit || busy}
          style={{
            padding: '0.75rem 1.5rem',
            background: !canSubmit || busy ? '#aaa' : '#0066ff',
            color: '#fff',
            border: 'none',
            borderRadius: 6,
            fontSize: '0.9375rem',
            fontWeight: 500,
            cursor: !canSubmit || busy ? 'not-allowed' : 'pointer',
          }}
        >
          {busy ? 'Vytvářím…' : 'Vytvořit objednávku'}
        </button>
      </div>
      {error && <p style={{ color: '#c00', fontSize: '0.875rem' }}>{error}</p>}
    </div>
  );
}

function ProductPick({
  productId,
  title,
  onAdd,
}: {
  productId: string;
  title: string;
  onAdd: (productTitle: string, v: ProductVariantDetail) => void;
}) {
  const detail = useQuery({
    queryKey: ['admin', 'product', productId],
    queryFn: () => api.getProduct(productId),
  });
  return (
    <div style={{ padding: '0.5rem 0', borderBottom: '1px solid #f0f0f0' }}>
      <div style={{ fontWeight: 500, fontSize: '0.875rem', marginBottom: 4 }}>{title}</div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        {(detail.data?.variants ?? []).map((v) => (
          <button
            key={v.id}
            type="button"
            onClick={() => onAdd(title, v)}
            style={{
              padding: '0.25rem 0.625rem',
              border: '1px solid #0066ff',
              color: '#0066ff',
              background: '#fff',
              borderRadius: 999,
              fontSize: '0.8125rem',
              cursor: 'pointer',
            }}
          >
            + {v.title} ({formatMoney({ amount: v.price_amount, currency: v.price_currency })})
          </button>
        ))}
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label style={{ display: 'block', marginBottom: '0.875rem' }}>
      <span style={{ display: 'block', fontSize: '0.8125rem', color: '#555', marginBottom: 4 }}>{label}</span>
      {children}
    </label>
  );
}

const card: React.CSSProperties = {
  background: '#fff',
  padding: '1.25rem',
  borderRadius: 8,
  border: '1px solid #e9ecef',
  marginBottom: '1rem',
};
const h2: React.CSSProperties = { margin: '0 0 1rem', fontSize: '1rem' };
const input: React.CSSProperties = {
  width: '100%',
  padding: '0.5rem 0.625rem',
  border: '1px solid #ddd',
  borderRadius: 4,
  fontSize: '0.9375rem',
  boxSizing: 'border-box',
};
const td: React.CSSProperties = { padding: '0.5rem', fontSize: '0.875rem', borderBottom: '1px solid #f0f0f0' };
const grid2: React.CSSProperties = { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' };
const grid3: React.CSSProperties = { display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: '0.75rem' };
