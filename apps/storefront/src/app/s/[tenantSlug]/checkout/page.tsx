'use client';

import { use, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useCart } from '@/lib/cart-context';
import { checkout, formatMoney } from '@/lib/api';

interface Props {
  params: Promise<{ tenantSlug: string }>;
}

export default function CheckoutPage({ params }: Props) {
  const { tenantSlug } = use(params);
  const { cart, loading } = useCart();
  const router = useRouter();

  const [form, setForm] = useState({
    customerEmail: '',
    customerName: '',
    customerPhone: '',
    line1: '',
    line2: '',
    city: '',
    postalCode: '',
    countryCode: 'CZ',
    customerNote: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function update<K extends keyof typeof form>(key: K, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!cart || cart.items.length === 0) return;
    setSubmitting(true);
    setError(null);
    try {
      const result = await checkout(tenantSlug, {
        customerEmail: form.customerEmail.trim().toLowerCase(),
        customerName: form.customerName.trim(),
        ...(form.customerPhone.trim() && { customerPhone: form.customerPhone.trim() }),
        shippingAddress: {
          line1: form.line1.trim(),
          ...(form.line2.trim() && { line2: form.line2.trim() }),
          city: form.city.trim(),
          postalCode: form.postalCode.trim(),
          countryCode: form.countryCode.trim().toUpperCase(),
        },
        ...(form.customerNote.trim() && { customerNote: form.customerNote.trim() }),
      });

      if (result.payment_url) {
        // Stripe (or other provider) — redirect to hosted checkout
        window.location.href = result.payment_url;
        return;
      }
      const dest = `/s/${tenantSlug}/orders/${result.order.number}?email=${encodeURIComponent(result.order.customer_email)}`;
      router.push(dest);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Objednávku se nepodařilo odeslat');
      setSubmitting(false);
    }
  }

  if (loading && !cart) {
    return (
      <main style={pageStyle}>
        <p>Načítání…</p>
      </main>
    );
  }

  if (!cart || cart.items.length === 0) {
    return (
      <main style={pageStyle}>
        <h1 style={{ marginTop: 0 }}>Pokladna</h1>
        <p>Váš košík je prázdný.</p>
        <Link href={`/s/${tenantSlug}`} style={{ color: '#0066cc' }}>
          ← Zpět do obchodu
        </Link>
      </main>
    );
  }

  return (
    <main style={pageStyle}>
      <Link
        href={`/s/${tenantSlug}`}
        style={{ fontSize: '0.875rem', color: '#666', textDecoration: 'none' }}
      >
        ← Zpět do obchodu
      </Link>
      <h1 style={{ margin: '1rem 0 2rem' }}>Pokladna</h1>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 380px',
          gap: '3rem',
        }}
      >
        <form
          onSubmit={handleSubmit}
          style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}
        >
          <h2 style={{ fontSize: '1.125rem', margin: '0 0 0.5rem' }}>Kontaktní údaje</h2>
          <Field label="E-mail" required>
            <input
              type="email"
              required
              value={form.customerEmail}
              onChange={(e) => update('customerEmail', e.target.value)}
              style={inputStyle}
            />
          </Field>
          <Field label="Jméno a příjmení" required>
            <input
              type="text"
              required
              value={form.customerName}
              onChange={(e) => update('customerName', e.target.value)}
              style={inputStyle}
            />
          </Field>
          <Field label="Telefon (volitelné)">
            <input
              type="tel"
              value={form.customerPhone}
              onChange={(e) => update('customerPhone', e.target.value)}
              style={inputStyle}
            />
          </Field>

          <h2 style={{ fontSize: '1.125rem', margin: '1.5rem 0 0.5rem' }}>Doručovací adresa</h2>
          <Field label="Ulice a č.p." required>
            <input
              type="text"
              required
              value={form.line1}
              onChange={(e) => update('line1', e.target.value)}
              style={inputStyle}
            />
          </Field>
          <Field label="Doplněk adresy (volitelné)">
            <input
              type="text"
              value={form.line2}
              onChange={(e) => update('line2', e.target.value)}
              style={inputStyle}
            />
          </Field>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <Field label="Město" required>
              <input
                type="text"
                required
                value={form.city}
                onChange={(e) => update('city', e.target.value)}
                style={inputStyle}
              />
            </Field>
            <Field label="PSČ" required>
              <input
                type="text"
                required
                value={form.postalCode}
                onChange={(e) => update('postalCode', e.target.value)}
                style={inputStyle}
              />
            </Field>
          </div>
          <Field label="Země (ISO kód)" required>
            <input
              type="text"
              required
              maxLength={2}
              value={form.countryCode}
              onChange={(e) => update('countryCode', e.target.value.toUpperCase())}
              style={{ ...inputStyle, textTransform: 'uppercase' }}
            />
          </Field>

          <Field label="Poznámka k objednávce (volitelné)">
            <textarea
              value={form.customerNote}
              onChange={(e) => update('customerNote', e.target.value)}
              rows={3}
              style={{ ...inputStyle, resize: 'vertical' }}
            />
          </Field>

          {error && <p style={{ color: '#c00', fontSize: '0.875rem', margin: 0 }}>{error}</p>}

          <button
            type="submit"
            disabled={submitting}
            style={{
              marginTop: '1rem',
              padding: '1rem',
              background: '#111',
              color: '#fff',
              border: 'none',
              borderRadius: 4,
              fontSize: '1rem',
              fontWeight: 500,
              cursor: submitting ? 'wait' : 'pointer',
              opacity: submitting ? 0.7 : 1,
            }}
          >
            {submitting ? 'Odesílám…' : `Odeslat objednávku — ${formatMoney(cart.subtotal)}`}
          </button>
          <p style={{ fontSize: '0.75rem', color: '#666', margin: 0 }}>
            MVP režim: platba je mock (status pending_payment). Brzy: Stripe a další.
          </p>
        </form>

        <aside
          style={{
            background: '#f8f8f8',
            padding: '1.5rem',
            borderRadius: 8,
            height: 'fit-content',
          }}
        >
          <h2 style={{ fontSize: '1rem', margin: '0 0 1rem' }}>Shrnutí objednávky</h2>
          <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 1rem' }}>
            {cart.items.map((it) => (
              <li
                key={it.id}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  fontSize: '0.875rem',
                  padding: '0.5rem 0',
                  borderBottom: '1px solid #eee',
                }}
              >
                <span style={{ flex: 1 }}>
                  {it.title}
                  <span style={{ color: '#666' }}> × {it.quantity}</span>
                </span>
                <span style={{ fontWeight: 500 }}>{formatMoney(it.line_total)}</span>
              </li>
            ))}
          </ul>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              fontWeight: 600,
              fontSize: '1rem',
              paddingTop: '0.5rem',
            }}
          >
            <span>Celkem</span>
            <span>{formatMoney(cart.subtotal)}</span>
          </div>
        </aside>
      </div>
    </main>
  );
}

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label style={{ display: 'block', fontSize: '0.875rem' }}>
      <span style={{ display: 'block', marginBottom: 4, fontWeight: 500 }}>
        {label} {required && <span style={{ color: '#c00' }}>*</span>}
      </span>
      {children}
    </label>
  );
}

const pageStyle: React.CSSProperties = {
  maxWidth: 1080,
  margin: '0 auto',
  padding: '2rem',
};

const inputStyle: React.CSSProperties = {
  display: 'block',
  width: '100%',
  padding: '0.625rem 0.75rem',
  border: '1px solid #ddd',
  borderRadius: 4,
  fontSize: '0.9375rem',
  fontFamily: 'inherit',
  boxSizing: 'border-box',
};
