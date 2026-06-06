'use client';

import { use, useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useCart } from '@/lib/cart-context';
import {
  checkout,
  customerMe,
  fetchPickupPoints,
  fetchShippingRates,
  formatMoney,
  formatVatRate,
  type CustomerProfile,
  type Money,
  type PickupPoint,
  type ShippingOption,
} from '@/lib/api';

interface Props {
  params: Promise<{ tenantSlug: string }>;
}

// --- Packeta widget (loaded only when an API key is configured) -------------
interface PacketaPoint {
  id: number | string;
  name: string;
  street?: string;
  city?: string;
  zip?: string;
  country?: string;
}
interface PacketaWidgetApi {
  Widget: {
    pick: (
      apiKey: string,
      callback: (point: PacketaPoint | null) => void,
      options?: Record<string, unknown>,
    ) => void;
  };
}
declare global {
  interface Window {
    Packeta?: PacketaWidgetApi;
  }
}

function loadPacketaWidget(): Promise<PacketaWidgetApi> {
  if (window.Packeta) return Promise.resolve(window.Packeta);
  return new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = 'https://widget.packeta.com/v6/www/js/library.js';
    s.async = true;
    s.onload = () => (window.Packeta ? resolve(window.Packeta) : reject(new Error('Packeta load')));
    s.onerror = () => reject(new Error('Packeta script failed'));
    document.head.appendChild(s);
  });
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
  const [customer, setCustomer] = useState<CustomerProfile | null>(null);

  // Logged-in customer → prefill contact + saved address (per `18`).
  // Only fills fields the user hasn't typed into yet.
  useEffect(() => {
    let cancelled = false;
    void customerMe(tenantSlug).then((me) => {
      if (cancelled || !me) return;
      setCustomer(me);
      const addr = me.default_address ?? {};
      setForm((prev) => ({
        ...prev,
        customerEmail: prev.customerEmail || me.email,
        customerName: prev.customerName || (me.full_name ?? ''),
        customerPhone: prev.customerPhone || (me.phone ?? ''),
        line1: prev.line1 || (addr.line1 ?? ''),
        line2: prev.line2 || (addr.line2 ?? ''),
        city: prev.city || (addr.city ?? ''),
        postalCode: prev.postalCode || (addr.postalCode ?? ''),
        countryCode: prev.countryCode === 'CZ' ? (addr.countryCode ?? 'CZ') : prev.countryCode,
      }));
    });
    return () => {
      cancelled = true;
    };
  }, [tenantSlug]);

  // Shipping
  const [options, setOptions] = useState<ShippingOption[]>([]);
  const [packetaKey, setPacketaKey] = useState<string | null>(null);
  const [selectedRateId, setSelectedRateId] = useState<string | null>(null);
  const [pickup, setPickup] = useState<PickupPoint | null>(null);
  // Fallback picker
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerQuery, setPickerQuery] = useState('');
  const [pickerResults, setPickerResults] = useState<PickupPoint[]>([]);

  const country = form.countryCode.trim().toUpperCase();

  // Load shipping rates for the ship-to country.
  useEffect(() => {
    if (country.length !== 2) return;
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetchShippingRates(tenantSlug, country);
        if (cancelled) return;
        setOptions(res.options);
        setPacketaKey(res.pickup_widget?.api_key ?? null);
        // Auto-select the first (highest-priority) option.
        setSelectedRateId((prev) =>
          prev && res.options.some((o) => o.rate_id === prev)
            ? prev
            : (res.options[0]?.rate_id ?? null),
        );
      } catch {
        if (!cancelled) setOptions([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [tenantSlug, country]);

  const selectedOption = options.find((o) => o.rate_id === selectedRateId) ?? null;

  // Reset chosen pickup point when switching methods.
  useEffect(() => {
    setPickup(null);
    setPickerOpen(false);
  }, [selectedRateId]);

  const openPacketaWidget = useCallback(async () => {
    if (!packetaKey) return;
    try {
      const Packeta = await loadPacketaWidget();
      Packeta.Widget.pick(
        packetaKey,
        (point) => {
          if (!point) return;
          setPickup({
            external_id: String(point.id),
            name: point.name,
            street: point.street ?? null,
            city: point.city ?? '',
            postal_code: point.zip ?? '',
            country_code: (point.country ?? country).toUpperCase(),
          });
        },
        { language: 'cs', country: country.toLowerCase() },
      );
    } catch {
      setPickerOpen(true); // fall back to the seeded picker on widget failure
    }
  }, [packetaKey, country]);

  async function runPickerSearch(q: string) {
    setPickerQuery(q);
    const carrier = selectedOption?.carrier_code ?? 'zasilkovna';
    const points = await fetchPickupPoints(tenantSlug, { carrier, q, country });
    setPickerResults(points);
  }

  function update<K extends keyof typeof form>(key: K, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  const needsPickup = Boolean(selectedOption?.requires_pickup_point);
  const canSubmit = Boolean(selectedOption) && (!needsPickup || pickup);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!cart || cart.items.length === 0) return;
    if (!canSubmit) {
      setError(needsPickup ? 'Vyberte prosím výdejní místo.' : 'Vyberte způsob dopravy.');
      return;
    }
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
          countryCode: country,
        },
        ...(form.customerNote.trim() && { customerNote: form.customerNote.trim() }),
        ...(selectedOption && { shippingRateId: selectedOption.rate_id }),
        ...(pickup && {
          pickupPoint: {
            carrierCode: selectedOption?.carrier_code ?? 'zasilkovna',
            externalId: pickup.external_id,
            name: pickup.name,
            ...(pickup.street && { street: pickup.street }),
            city: pickup.city,
            postalCode: pickup.postal_code,
            countryCode: pickup.country_code,
          },
        }),
      });

      if (result.payment_url) {
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

  const goodsGross = BigInt(cart.subtotal.amount);
  const shippingGross = selectedOption ? BigInt(selectedOption.amount) : 0n;
  const totalMoney: Money = {
    amount: (goodsGross + shippingGross).toString(),
    currency: cart.currency,
  };

  return (
    <main style={pageStyle}>
      <Link
        href={`/s/${tenantSlug}`}
        style={{ fontSize: '0.875rem', color: '#666', textDecoration: 'none' }}
      >
        ← Zpět do obchodu
      </Link>
      <h1 style={{ margin: '1rem 0 2rem' }}>Pokladna</h1>

      {customer && (
        <p
          style={{
            margin: '-1rem 0 1.5rem',
            fontSize: '0.875rem',
            color: 'var(--sf-muted, #666)',
          }}
        >
          ✓ Nakupujete jako <strong>{customer.full_name ?? customer.email}</strong> — údaje jsme
          předvyplnili.
        </p>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 380px', gap: '3rem' }}>
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

          <h2 style={{ fontSize: '1.125rem', margin: '1.5rem 0 0.5rem' }}>Doprava</h2>
          {options.length === 0 && (
            <p style={{ fontSize: '0.875rem', color: '#666', margin: 0 }}>
              Pro zadanou zemi není dostupná žádná doprava.
            </p>
          )}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {options.map((opt) => (
              <ShippingMethodRow
                key={opt.rate_id}
                option={opt}
                selected={opt.rate_id === selectedRateId}
                currency={cart.currency}
                onSelect={() => setSelectedRateId(opt.rate_id)}
              />
            ))}
          </div>

          {needsPickup && (
            <div
              style={{
                border: '1px solid #ddd',
                borderRadius: 6,
                padding: '0.875rem',
                background: '#fafafa',
              }}
            >
              {pickup ? (
                <div style={{ fontSize: '0.875rem' }}>
                  <strong>✓ Výdejní místo:</strong> {pickup.name}
                  {pickup.city && `, ${pickup.city}`}
                  <button
                    type="button"
                    onClick={() => setPickup(null)}
                    style={{
                      marginLeft: '0.5rem',
                      background: 'none',
                      border: 'none',
                      color: '#0066cc',
                      cursor: 'pointer',
                      fontSize: '0.8125rem',
                    }}
                  >
                    Změnit
                  </button>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                    {packetaKey && (
                      <button type="button" onClick={() => void openPacketaWidget()} style={pickBtn}>
                        Vybrat na mapě (Zásilkovna)
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => {
                        setPickerOpen((v) => !v);
                        if (pickerResults.length === 0) void runPickerSearch('');
                      }}
                      style={{ ...pickBtn, background: '#fff', color: '#111', border: '1px solid #111' }}
                    >
                      {packetaKey ? 'Hledat v seznamu' : 'Vybrat výdejní místo'}
                    </button>
                  </div>
                  {pickerOpen && (
                    <div>
                      <input
                        type="text"
                        placeholder="Hledat dle města, názvu nebo PSČ…"
                        value={pickerQuery}
                        onChange={(e) => void runPickerSearch(e.target.value)}
                        style={inputStyle}
                      />
                      <ul
                        style={{
                          listStyle: 'none',
                          padding: 0,
                          margin: '0.5rem 0 0',
                          maxHeight: 200,
                          overflowY: 'auto',
                        }}
                      >
                        {pickerResults.map((p) => (
                          <li key={p.external_id}>
                            <button
                              type="button"
                              onClick={() => {
                                setPickup(p);
                                setPickerOpen(false);
                              }}
                              style={{
                                display: 'block',
                                width: '100%',
                                textAlign: 'left',
                                padding: '0.5rem',
                                border: '1px solid #eee',
                                borderRadius: 4,
                                background: '#fff',
                                cursor: 'pointer',
                                marginBottom: 4,
                                fontSize: '0.8125rem',
                              }}
                            >
                              <strong>{p.name}</strong>
                              <br />
                              <span style={{ color: '#666' }}>
                                {p.street && `${p.street}, `}
                                {p.postal_code} {p.city}
                              </span>
                            </button>
                          </li>
                        ))}
                        {pickerResults.length === 0 && (
                          <li style={{ fontSize: '0.8125rem', color: '#666', padding: '0.5rem' }}>
                            Žádné výdejní místo nenalezeno.
                          </li>
                        )}
                      </ul>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

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
            disabled={submitting || !canSubmit}
            style={{
              marginTop: '1rem',
              padding: '1rem',
              background: 'var(--sf-accent, #111)',
              color: '#fff',
              border: 'none',
              borderRadius: 4,
              fontSize: '1rem',
              fontWeight: 500,
              cursor: submitting || !canSubmit ? 'not-allowed' : 'pointer',
              opacity: submitting || !canSubmit ? 0.6 : 1,
            }}
          >
            {submitting ? 'Odesílám…' : `Odeslat objednávku — ${formatMoney(totalMoney)}`}
          </button>
          <p style={{ fontSize: '0.75rem', color: '#666', margin: 0 }}>
            MVP režim: platba je mock (status pending_payment). Brzy: Stripe a další.
          </p>
        </form>

        <aside
          style={{ background: '#f8f8f8', padding: '1.5rem', borderRadius: 8, height: 'fit-content' }}
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
          <SummaryRow label={`Mezisoučet${cart.tax_included ? ' (vč. DPH)' : ''}`} value={formatMoney(cart.subtotal)} />
          <SummaryRow
            label="Doprava"
            value={
              !selectedOption
                ? '—'
                : shippingGross === 0n
                  ? 'Zdarma'
                  : formatMoney({ amount: selectedOption.amount, currency: cart.currency })
            }
          />
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              fontWeight: 600,
              fontSize: '1rem',
              paddingTop: '0.5rem',
              marginTop: '0.25rem',
              borderTop: '1px solid #ddd',
            }}
          >
            <span>Celkem{cart.tax_included ? ' (vč. DPH)' : ''}</span>
            <span>{formatMoney(totalMoney)}</span>
          </div>
          {cart.tax_breakdown.map((b) => (
            <div
              key={b.rate_basis_points}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                fontSize: '0.75rem',
                color: '#666',
                marginTop: '0.25rem',
              }}
            >
              <span>z toho DPH {formatVatRate(b.rate_basis_points)} (zboží)</span>
              <span>{formatMoney({ amount: b.tax_amount, currency: cart.currency })}</span>
            </div>
          ))}
        </aside>
      </div>
    </main>
  );
}

function ShippingMethodRow({
  option,
  selected,
  currency,
  onSelect,
}: {
  option: ShippingOption;
  selected: boolean;
  currency: string;
  onSelect: () => void;
}) {
  return (
    <label
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: '0.625rem',
        padding: '0.75rem',
        border: `1px solid ${selected ? '#111' : '#ddd'}`,
        borderRadius: 6,
        cursor: 'pointer',
        background: selected ? '#fafafa' : '#fff',
      }}
    >
      <input
        type="radio"
        name="shipping"
        checked={selected}
        onChange={onSelect}
        style={{ marginTop: 3 }}
      />
      <span style={{ flex: 1 }}>
        <span style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 500 }}>
          <span>{option.display_name}</span>
          <span>
            {option.free ? 'Zdarma' : formatMoney({ amount: option.amount, currency })}
          </span>
        </span>
        {option.description && (
          <span style={{ display: 'block', fontSize: '0.75rem', color: '#666', marginTop: 2 }}>
            {option.description}
          </span>
        )}
        {option.estimated_days_min !== null && (
          <span style={{ display: 'block', fontSize: '0.75rem', color: '#888', marginTop: 2 }}>
            Doručení {option.estimated_days_min}–{option.estimated_days_max ?? option.estimated_days_min}{' '}
            prac. dní
          </span>
        )}
      </span>
    </label>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        fontSize: '0.875rem',
        padding: '0.25rem 0',
      }}
    >
      <span>{label}</span>
      <span>{value}</span>
    </div>
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

const pickBtn: React.CSSProperties = {
  padding: '0.5rem 0.875rem',
  background: 'var(--sf-accent, #111)',
  color: '#fff',
  border: 'none',
  borderRadius: 4,
  fontSize: '0.8125rem',
  cursor: 'pointer',
};
