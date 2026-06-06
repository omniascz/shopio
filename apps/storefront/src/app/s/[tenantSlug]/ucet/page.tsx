'use client';

/**
 * Customer account page — per `18-customer-management.md` MVP.
 * Login / registration when anonymous; profile + order history when logged in.
 */

import { use, useEffect, useState } from 'react';
import Link from 'next/link';
import {
  customerLogin,
  customerLogout,
  customerMe,
  customerOrders,
  customerRegister,
  formatMoney,
  type CustomerOrder,
  type CustomerProfile,
} from '@/lib/api';

interface Props {
  params: Promise<{ tenantSlug: string }>;
}

const ORDER_STATUS_LABELS: Record<string, string> = {
  pending_payment: 'Čeká na platbu',
  paid: 'Zaplaceno',
  fulfilling: 'Připravujeme',
  fulfilled: 'Odesláno',
  cancelled: 'Zrušeno',
  refunded: 'Refundováno',
};

export default function AccountPage({ params }: Props) {
  const { tenantSlug } = use(params);
  const [customer, setCustomer] = useState<CustomerProfile | null>(null);
  const [orders, setOrders] = useState<CustomerOrder[]>([]);
  const [loading, setLoading] = useState(true);

  async function refresh() {
    const me = await customerMe(tenantSlug);
    setCustomer(me);
    setOrders(me ? await customerOrders(tenantSlug) : []);
    setLoading(false);
  }

  useEffect(() => {
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenantSlug]);

  if (loading) {
    return (
      <main style={pageStyle}>
        <p>Načítání…</p>
      </main>
    );
  }

  return (
    <main style={pageStyle}>
      <h1 style={{ fontSize: '1.75rem', margin: '0 0 1.5rem' }}>Můj účet</h1>
      {customer ? (
        <LoggedIn
          tenantSlug={tenantSlug}
          customer={customer}
          orders={orders}
          onLogout={() => void customerLogout(tenantSlug).then(refresh)}
        />
      ) : (
        <AuthForms tenantSlug={tenantSlug} onAuthed={() => void refresh()} />
      )}
    </main>
  );
}

function LoggedIn({
  tenantSlug,
  customer,
  orders,
  onLogout,
}: {
  tenantSlug: string;
  customer: CustomerProfile;
  orders: CustomerOrder[];
  onLogout: () => void;
}) {
  return (
    <>
      <section style={sectionStyle}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <div style={{ fontWeight: 600 }}>{customer.full_name ?? customer.email}</div>
            <div style={{ fontSize: '0.875rem', color: 'var(--sf-muted, #666)' }}>
              {customer.email}
            </div>
            {customer.default_address?.line1 && (
              <div style={{ fontSize: '0.8125rem', color: 'var(--sf-muted, #666)', marginTop: 4 }}>
                {customer.default_address.line1}, {customer.default_address.postalCode}{' '}
                {customer.default_address.city}
              </div>
            )}
          </div>
          <button type="button" onClick={onLogout} style={secondaryBtnStyle}>
            Odhlásit
          </button>
        </div>
      </section>

      <section style={sectionStyle}>
        <h2 style={{ fontSize: '1.125rem', margin: '0 0 1rem' }}>Objednávky</h2>
        {orders.length === 0 ? (
          <p style={{ color: 'var(--sf-muted, #666)', fontSize: '0.875rem' }}>
            Zatím žádné objednávky.{' '}
            <Link href={`/s/${tenantSlug}`} style={{ color: 'var(--sf-accent, #0066cc)' }}>
              Do obchodu →
            </Link>
          </p>
        ) : (
          <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
            {orders.map((o) => (
              <li
                key={o.number}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  gap: '1rem',
                  padding: '0.75rem 0',
                  borderBottom: '1px solid rgba(128,128,128,0.2)',
                }}
              >
                <div>
                  <Link
                    href={o.detail_url}
                    style={{ fontWeight: 500, color: 'var(--sf-accent, #0066cc)', textDecoration: 'none' }}
                  >
                    {o.number}
                  </Link>
                  <div style={{ fontSize: '0.8125rem', color: 'var(--sf-muted, #666)' }}>
                    {new Date(o.placed_at).toLocaleDateString('cs-CZ')} ·{' '}
                    {ORDER_STATUS_LABELS[o.status] ?? o.status}
                  </div>
                </div>
                <div style={{ fontWeight: 600 }}>{formatMoney(o.total)}</div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}

function AuthForms({ tenantSlug, onAuthed }: { tenantSlug: string; onAuthed: () => void }) {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      if (mode === 'login') {
        await customerLogin(tenantSlug, { email, password });
      } else {
        await customerRegister(tenantSlug, {
          email,
          password,
          ...(fullName && { fullName }),
        });
      }
      onAuthed();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section style={{ ...sectionStyle, maxWidth: 420 }}>
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.25rem' }}>
        <TabButton active={mode === 'login'} onClick={() => setMode('login')}>
          Přihlášení
        </TabButton>
        <TabButton active={mode === 'register'} onClick={() => setMode('register')}>
          Registrace
        </TabButton>
      </div>

      <form onSubmit={(e) => void handleSubmit(e)}>
        {mode === 'register' && (
          <label style={labelStyle}>
            <span style={labelTextStyle}>Jméno a příjmení</span>
            <input value={fullName} onChange={(e) => setFullName(e.target.value)} style={inputStyle} />
          </label>
        )}
        <label style={labelStyle}>
          <span style={labelTextStyle}>E-mail</span>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            style={inputStyle}
          />
        </label>
        <label style={labelStyle}>
          <span style={labelTextStyle}>Heslo</span>
          <input
            type="password"
            required
            minLength={mode === 'register' ? 12 : 1}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            style={inputStyle}
          />
          {mode === 'register' && (
            <span style={{ fontSize: '0.75rem', color: 'var(--sf-muted, #888)' }}>
              Min. 12 znaků
            </span>
          )}
        </label>

        {error && (
          <p style={{ color: '#c00', fontSize: '0.875rem', margin: '0 0 1rem' }}>{error}</p>
        )}

        <button type="submit" disabled={busy} style={primaryBtnStyle(busy)}>
          {busy ? 'Pracuji…' : mode === 'login' ? 'Přihlásit se' : 'Vytvořit účet'}
        </button>
      </form>
      <p style={{ marginTop: '1rem', fontSize: '0.8125rem', color: 'var(--sf-muted, #666)' }}>
        Po registraci uvidíte i dřívější objednávky zadané na stejný e-mail.
      </p>
    </section>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        flex: 1,
        padding: '0.5rem',
        borderRadius: 6,
        border: active ? '2px solid var(--sf-accent, #111)' : '1px solid rgba(128,128,128,0.35)',
        background: 'transparent',
        color: 'inherit',
        fontWeight: active ? 600 : 400,
        cursor: 'pointer',
      }}
    >
      {children}
    </button>
  );
}

const pageStyle: React.CSSProperties = {
  maxWidth: 720,
  margin: '0 auto',
  padding: '2rem',
};

const sectionStyle: React.CSSProperties = {
  padding: '1.5rem',
  border: '1px solid rgba(128,128,128,0.25)',
  borderRadius: 8,
  marginBottom: '1rem',
};

const labelStyle: React.CSSProperties = {
  display: 'block',
  marginBottom: '1rem',
  fontSize: '0.875rem',
};

const labelTextStyle: React.CSSProperties = {
  display: 'block',
  marginBottom: 4,
  fontWeight: 500,
};

const inputStyle: React.CSSProperties = {
  display: 'block',
  width: '100%',
  padding: '0.625rem 0.75rem',
  border: '1px solid rgba(128,128,128,0.4)',
  borderRadius: 4,
  fontSize: '0.9375rem',
  boxSizing: 'border-box',
  background: 'transparent',
  color: 'inherit',
};

const secondaryBtnStyle: React.CSSProperties = {
  padding: '0.5rem 0.875rem',
  background: 'transparent',
  border: '1px solid rgba(128,128,128,0.4)',
  color: 'inherit',
  borderRadius: 4,
  fontSize: '0.8125rem',
  cursor: 'pointer',
};

function primaryBtnStyle(busy: boolean): React.CSSProperties {
  return {
    width: '100%',
    padding: '0.75rem',
    background: 'var(--sf-accent, #111)',
    color: '#fff',
    border: 'none',
    borderRadius: 4,
    fontSize: '0.9375rem',
    fontWeight: 500,
    cursor: busy ? 'wait' : 'pointer',
    opacity: busy ? 0.7 : 1,
  };
}
