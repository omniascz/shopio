'use client';

/**
 * Customer account page — per `18-customer-management.md` MVP.
 * Login / registration when anonymous; profile + order history when logged in.
 */

import { use, useEffect, useState } from 'react';
import Link from 'next/link';
import { ReorderButton } from '@/components/reorder-button';
import { AddressBook } from '@/components/address-book';
import {
  customerCreateReturn,
  customerForgotPassword,
  customerResendVerification,
  customerCompany,
  customerDataExportUrl,
  customerDeleteAccount,
  customerLoyalty,
  customerSubscriptions,
  customerSubscriptionAction,
  customerLogin,
  customerLogout,
  customerMe,
  customerOrders,
  customerRegister,
  customerReturns,
  customerSaveCompany,
  formatMoney,
  getOrder,
  type CustomerCompany,
  type CustomerOrder,
  type CustomerProfile,
  type CustomerReturn,
  type OrderDetail,
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
  const [returns, setReturns] = useState<CustomerReturn[]>([]);
  const [loading, setLoading] = useState(true);

  async function refresh() {
    const me = await customerMe(tenantSlug);
    setCustomer(me);
    if (me) {
      const [o, r] = await Promise.all([customerOrders(tenantSlug), customerReturns(tenantSlug)]);
      setOrders(o);
      setReturns(r);
    } else {
      setOrders([]);
      setReturns([]);
    }
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
          returns={returns}
          onChanged={() => void refresh()}
          onLogout={() => void customerLogout(tenantSlug).then(refresh)}
        />
      ) : (
        <AuthForms tenantSlug={tenantSlug} onAuthed={() => void refresh()} />
      )}
    </main>
  );
}

const RETURN_STATUS_LABELS: Record<string, string> = {
  requested: 'Čeká na schválení',
  approved: 'Schváleno — pošlete zboží zpět',
  received: 'Zboží přijato',
  refunded: 'Refundováno',
  rejected: 'Zamítnuto',
  cancelled: 'Zrušeno',
};

function LoggedIn({
  tenantSlug,
  customer,
  orders,
  returns,
  onChanged,
  onLogout,
}: {
  tenantSlug: string;
  customer: CustomerProfile;
  orders: CustomerOrder[];
  returns: CustomerReturn[];
  onChanged: () => void;
  onLogout: () => void;
}) {
  const [verifyInfo, setVerifyInfo] = useState<string | null>(null);

  return (
    <>
      {customer.email_verified === false && (
        <div
          style={{
            background: 'rgba(255, 200, 80, 0.15)',
            border: '1px solid rgba(200, 150, 30, 0.45)',
            borderRadius: 6,
            padding: '0.625rem 1rem',
            marginBottom: '1rem',
            fontSize: '0.875rem',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: '1rem',
            flexWrap: 'wrap',
          }}
        >
          <span>✉ Váš e-mail zatím není ověřený — zkontrolujte schránku.</span>
          <button
            type="button"
            onClick={() =>
              void customerResendVerification(tenantSlug).then(setVerifyInfo).catch(() => {})
            }
            style={{ ...secondaryBtnStyle, fontSize: '0.75rem' }}
          >
            Poslat znovu
          </button>
          {verifyInfo && <span style={{ fontSize: '0.8125rem' }}>{verifyInfo}</span>}
        </div>
      )}
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

      <CompanySection tenantSlug={tenantSlug} />

      <LoyaltySection tenantSlug={tenantSlug} />

      <SubscriptionsSection tenantSlug={tenantSlug} />

      <GdprSection tenantSlug={tenantSlug} onDeleted={onLogout} />

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
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <ReorderButton tenantSlug={tenantSlug} orderNumber={o.number} />
                  <span style={{ fontWeight: 600 }}>{formatMoney(o.total)}</span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <AddressBook tenantSlug={tenantSlug} />

      <ReturnsSection
        tenantSlug={tenantSlug}
        email={customer.email}
        orders={orders}
        returns={returns}
        onChanged={onChanged}
      />
    </>
  );
}

// Subscriptions (per `24`) — recurring-order management.
function SubscriptionsSection({ tenantSlug }: { tenantSlug: string }) {
  const [subs, setSubs] = useState<Awaited<ReturnType<typeof customerSubscriptions>>>([]);
  const [busy, setBusy] = useState(false);

  async function refresh() {
    setSubs(await customerSubscriptions(tenantSlug));
  }
  useEffect(() => {
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenantSlug]);

  async function act(id: string, action: 'cancel' | 'pause' | 'resume') {
    setBusy(true);
    try {
      await customerSubscriptionAction(tenantSlug, id, action);
      await refresh();
    } finally {
      setBusy(false);
    }
  }

  const visible = subs.filter((s) => s.status !== 'cancelled');
  if (visible.length === 0) return null;

  const INTERVAL: Record<string, string> = { week: 'týden', month: 'měsíc' };
  return (
    <section style={sectionStyle}>
      <h2 style={{ fontSize: '1.125rem', margin: '0 0 1rem' }}>Pravidelné dodávky</h2>
      {visible.map((s) => (
        <div
          key={s.id}
          style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.5rem 0', borderBottom: '1px solid rgba(128,128,128,0.12)', gap: '0.75rem', flexWrap: 'wrap' }}
        >
          <div style={{ fontSize: '0.875rem' }}>
            {s.items.reduce((n, i) => n + i.quantity, 0)} ks · každý{' '}
            {s.interval_count > 1 ? `${s.interval_count}. ` : ''}
            {INTERVAL[s.interval_unit] ?? s.interval_unit}
            <span style={{ color: 'var(--sf-muted, #666)' }}>
              {' '}
              · příští: {new Date(s.next_run_at).toLocaleDateString('cs-CZ')}
              {s.status === 'paused' && ' · pozastaveno'}
            </span>
          </div>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            {s.status === 'active' ? (
              <button type="button" onClick={() => void act(s.id, 'pause')} disabled={busy} style={secondaryBtnStyle}>
                Pozastavit
              </button>
            ) : (
              <button type="button" onClick={() => void act(s.id, 'resume')} disabled={busy} style={secondaryBtnStyle}>
                Obnovit
              </button>
            )}
            <button
              type="button"
              onClick={() => void act(s.id, 'cancel')}
              disabled={busy}
              style={{ ...secondaryBtnStyle, color: '#c0392b' }}
            >
              Zrušit
            </button>
          </div>
        </div>
      ))}
    </section>
  );
}

// Loyalty (per `19`) — store-credit balance + history.
function LoyaltySection({ tenantSlug }: { tenantSlug: string }) {
  const [info, setInfo] = useState<Awaited<ReturnType<typeof customerLoyalty>>>(null);
  useEffect(() => {
    void customerLoyalty(tenantSlug).then(setInfo);
  }, [tenantSlug]);

  // Hide entirely when the customer has no credit history (program off / unused).
  if (!info || (BigInt(info.balance) === 0n && info.transactions.length === 0)) return null;
  const currency = info.transactions[0]?.currency ?? 'CZK';

  return (
    <section style={sectionStyle}>
      <h2 style={{ fontSize: '1.125rem', margin: '0 0 0.5rem' }}>Věrnostní kredit</h2>
      <div style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: '0.75rem' }}>
        {formatMoney({ amount: info.balance, currency })}
      </div>
      {info.transactions.length > 0 && (
        <ul style={{ margin: 0, padding: 0, listStyle: 'none', fontSize: '0.8125rem' }}>
          {info.transactions.slice(0, 8).map((t, i) => (
            <li key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '0.25rem 0', borderBottom: '1px solid rgba(128,128,128,0.12)' }}>
              <span style={{ color: 'var(--sf-muted, #666)' }}>
                {t.note ?? t.kind} · {new Date(t.created_at).toLocaleDateString('cs-CZ')}
              </span>
              <span style={{ color: BigInt(t.amount) < 0n ? '#c0392b' : '#1c7c34' }}>
                {BigInt(t.amount) > 0n ? '+' : ''}
                {formatMoney({ amount: t.amount, currency: t.currency })}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

// GDPR (per `30`) — data export + account erasure.
function GdprSection({ tenantSlug, onDeleted }: { tenantSlug: string; onDeleted: () => void }) {
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);

  async function doDelete() {
    setBusy(true);
    try {
      await customerDeleteAccount(tenantSlug);
      onDeleted();
    } finally {
      setBusy(false);
    }
  }

  return (
    <section style={sectionStyle}>
      <h2 style={{ fontSize: '1.125rem', margin: '0 0 0.5rem' }}>Soukromí a data</h2>
      <p style={{ fontSize: '0.8125rem', color: 'var(--sf-muted, #666)', margin: '0 0 1rem' }}>
        Máte právo na kopii svých údajů i na jejich smazání (GDPR).
      </p>
      <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'center' }}>
        <a href={customerDataExportUrl(tenantSlug)} style={{ ...secondaryBtnStyle, textDecoration: 'none' }}>
          ⬇ Stáhnout moje data
        </a>
        {!confirming ? (
          <button
            type="button"
            onClick={() => setConfirming(true)}
            style={{ ...secondaryBtnStyle, color: '#c0392b', borderColor: '#e0a0a0' }}
          >
            Smazat účet
          </button>
        ) : (
          <span style={{ display: 'inline-flex', gap: '0.5rem', alignItems: 'center' }}>
            <span style={{ fontSize: '0.8125rem' }}>Opravdu? Údaje budou anonymizovány.</span>
            <button
              type="button"
              onClick={() => void doDelete()}
              disabled={busy}
              style={{ ...secondaryBtnStyle, background: '#c0392b', color: '#fff', borderColor: '#c0392b' }}
            >
              {busy ? 'Mažu…' : 'Ano, smazat'}
            </button>
            <button type="button" onClick={() => setConfirming(false)} style={secondaryBtnStyle}>
              Zrušit
            </button>
          </span>
        )}
      </div>
    </section>
  );
}

function ReturnsSection({
  tenantSlug,
  email,
  orders,
  returns,
  onChanged,
}: {
  tenantSlug: string;
  email: string;
  orders: CustomerOrder[];
  returns: CustomerReturn[];
  onChanged: () => void;
}) {
  const [creating, setCreating] = useState(false);
  const [orderNumber, setOrderNumber] = useState('');
  const [orderDetail, setOrderDetail] = useState<OrderDetail | null>(null);
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [reason, setReason] = useState('changed_mind');
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Returnable orders = paid-side ones
  const eligible = orders.filter(
    (o) => o.payment_status === 'paid' || o.payment_status === 'refunded',
  );

  async function pickOrder(num: string) {
    setOrderNumber(num);
    setOrderDetail(null);
    setQuantities({});
    setError(null);
    if (!num) return;
    const detail = await getOrder(tenantSlug, num, email);
    setOrderDetail(detail);
  }

  async function submit() {
    setError(null);
    setBusy(true);
    try {
      await customerCreateReturn(tenantSlug, orderNumber, {
        items: Object.entries(quantities)
          .filter(([, q]) => q > 0)
          .map(([orderItemId, quantity]) => ({ orderItemId, quantity })),
        reasonCode: reason,
        ...(note && { note }),
      });
      setCreating(false);
      setOrderNumber('');
      setOrderDetail(null);
      setQuantities({});
      setNote('');
      onChanged();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const anySelected = Object.values(quantities).some((q) => q > 0);

  return (
    <section style={sectionStyle}>
      <h2 style={{ fontSize: '1.125rem', margin: '0 0 1rem' }}>Vratky</h2>

      {returns.length === 0 ? (
        <p style={{ color: 'var(--sf-muted, #666)', fontSize: '0.875rem' }}>Žádné vratky.</p>
      ) : (
        <ul style={{ listStyle: 'none', margin: '0 0 1rem', padding: 0 }}>
          {returns.map((r) => (
            <li
              key={r.number}
              style={{ padding: '0.625rem 0', borderBottom: '1px solid rgba(128,128,128,0.2)' }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <strong>{r.number}</strong>
                <span style={{ fontSize: '0.8125rem' }}>
                  {RETURN_STATUS_LABELS[r.status] ?? r.status}
                </span>
              </div>
              <div style={{ fontSize: '0.8125rem', color: 'var(--sf-muted, #666)' }}>
                {r.order_number && <>k objednávce {r.order_number} · </>}
                {r.items.map((i) => `${i.title} ×${i.quantity}`).join(', ')} ·{' '}
                {formatMoney(r.actual_refund ?? r.requested_refund)}
              </div>
            </li>
          ))}
        </ul>
      )}

      {!creating ? (
        eligible.length > 0 && (
          <button
            type="button"
            onClick={() => setCreating(true)}
            style={{ ...secondaryBtnStyle, color: 'var(--sf-accent, #0066cc)' }}
          >
            + Vrátit zboží
          </button>
        )
      ) : (
        <div style={{ borderTop: '1px solid rgba(128,128,128,0.2)', paddingTop: '1rem' }}>
          <label style={{ display: 'block', marginBottom: '0.75rem', fontSize: '0.875rem' }}>
            <span style={{ display: 'block', marginBottom: 4, fontWeight: 500 }}>Objednávka</span>
            <select
              value={orderNumber}
              onChange={(e) => void pickOrder(e.target.value)}
              style={{ ...inputStyle, maxWidth: 320 }}
            >
              <option value="">— vyberte —</option>
              {eligible.map((o) => (
                <option key={o.number} value={o.number}>
                  {o.number} · {formatMoney(o.total)}
                </option>
              ))}
            </select>
          </label>

          {orderDetail && (
            <>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
                <tbody>
                  {orderDetail.items.map((it) => (
                    <tr key={it.id}>
                      <td style={{ padding: '0.25rem 0' }}>
                        {it.product_title} — {it.variant_title}
                      </td>
                      <td style={{ textAlign: 'right', width: 120 }}>
                        <input
                          type="number"
                          min={0}
                          max={it.quantity}
                          value={quantities[it.id] ?? 0}
                          onChange={(e) =>
                            setQuantities((prev) => ({
                              ...prev,
                              [it.id]: Math.max(0, Math.min(it.quantity, Number(e.target.value))),
                            }))
                          }
                          style={{ ...inputStyle, width: 64, display: 'inline-block', padding: '0.25rem 0.375rem' }}
                        />{' '}
                        / {it.quantity}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div style={{ display: 'flex', gap: '0.5rem', margin: '0.75rem 0', flexWrap: 'wrap' }}>
                <select value={reason} onChange={(e) => setReason(e.target.value)} style={{ ...inputStyle, maxWidth: 220 }}>
                  <option value="changed_mind">Odstoupení od smlouvy (14 dní)</option>
                  <option value="damaged">Poškozené zboží</option>
                  <option value="wrong_item">Přišlo jiné zboží</option>
                  <option value="not_as_described">Neodpovídá popisu</option>
                  <option value="other">Jiný důvod</option>
                </select>
                <input
                  type="text"
                  placeholder="Poznámka (volitelné)"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  style={{ ...inputStyle, flex: 1, minWidth: 200 }}
                />
              </div>
            </>
          )}

          {error && <p style={{ color: '#c00', fontSize: '0.875rem' }}>{error}</p>}

          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button
              type="button"
              disabled={!anySelected || busy}
              onClick={() => void submit()}
              style={{
                padding: '0.5rem 1rem',
                background: 'var(--sf-accent, #111)',
                color: '#fff',
                border: 'none',
                borderRadius: 4,
                fontSize: '0.875rem',
                cursor: !anySelected || busy ? 'not-allowed' : 'pointer',
                opacity: !anySelected || busy ? 0.6 : 1,
              }}
            >
              {busy ? 'Odesílám…' : 'Odeslat žádost o vrácení'}
            </button>
            <button type="button" onClick={() => setCreating(false)} style={secondaryBtnStyle}>
              Zrušit
            </button>
          </div>
        </div>
      )}
    </section>
  );
}

function AuthForms({ tenantSlug, onAuthed }: { tenantSlug: string; onAuthed: () => void }) {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setInfo(null);
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

  async function handleForgot() {
    setError(null);
    if (!email) {
      setError('Vyplňte e-mail a klikněte znovu na „Zapomenuté heslo".');
      return;
    }
    setBusy(true);
    try {
      setInfo(await customerForgotPassword(tenantSlug, email));
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
        {info && (
          <p style={{ color: '#2e7d32', fontSize: '0.875rem', margin: '0 0 1rem' }}>{info}</p>
        )}

        <button type="submit" disabled={busy} style={primaryBtnStyle(busy)}>
          {busy ? 'Pracuji…' : mode === 'login' ? 'Přihlásit se' : 'Vytvořit účet'}
        </button>
        {mode === 'login' && (
          <button
            type="button"
            onClick={() => void handleForgot()}
            disabled={busy}
            style={{
              display: 'block',
              margin: '0.75rem auto 0',
              background: 'none',
              border: 'none',
              color: 'var(--sf-accent, #0066cc)',
              fontSize: '0.8125rem',
              cursor: 'pointer',
            }}
          >
            Zapomenuté heslo?
          </button>
        )}
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

/**
 * B2B company billing profile (per `21`). When filled, invoices are issued to
 * the company (IČO/DIČ). If the merchant has granted NET terms, "platba na
 * fakturu" appears at checkout.
 */
function CompanySection({ tenantSlug }: { tenantSlug: string }) {
  const [company, setCompany] = useState<CustomerCompany | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState('');
  const [ico, setIco] = useState('');
  const [dic, setDic] = useState('');
  const [line1, setLine1] = useState('');
  const [city, setCity] = useState('');
  const [psc, setPsc] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void customerCompany(tenantSlug).then((c) => {
      setCompany(c);
      setLoaded(true);
    });
  }, [tenantSlug]);

  function startEdit() {
    setName(company?.name ?? '');
    setIco(company?.registration_number ?? '');
    setDic(company?.vat_id ?? '');
    setLine1(company?.billing_address?.line1 ?? '');
    setCity(company?.billing_address?.city ?? '');
    setPsc(company?.billing_address?.postalCode ?? '');
    setError(null);
    setEditing(true);
  }

  async function save() {
    if (!name.trim()) {
      setError('Vyplňte název firmy.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const saved = await customerSaveCompany(tenantSlug, {
        name: name.trim(),
        ...(ico.trim() && { registrationNumber: ico.trim() }),
        ...(dic.trim() && { vatId: dic.trim() }),
        billingAddress: {
          ...(line1.trim() && { line1: line1.trim() }),
          ...(city.trim() && { city: city.trim() }),
          ...(psc.trim() && { postalCode: psc.trim() }),
          countryCode: 'CZ',
        },
      });
      setCompany(saved);
      setEditing(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Uložení selhalo.');
    } finally {
      setBusy(false);
    }
  }

  if (!loaded) return null;

  return (
    <section style={sectionStyle}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
        <h2 style={{ fontSize: '1.125rem', margin: 0 }}>Firemní údaje</h2>
        {!editing && (
          <button type="button" onClick={startEdit} style={secondaryBtnStyle}>
            {company ? 'Upravit' : 'Přidat firmu'}
          </button>
        )}
      </div>

      {!editing && !company && (
        <p style={{ color: 'var(--sf-muted, #666)', fontSize: '0.875rem', margin: 0 }}>
          Nakupujete na firmu? Vyplňte fakturační údaje (IČO/DIČ) a faktury
          vystavíme na firmu.
        </p>
      )}

      {!editing && company && (
        <div style={{ fontSize: '0.9375rem' }}>
          <div style={{ fontWeight: 600 }}>{company.name}</div>
          <div style={{ color: 'var(--sf-muted, #666)', fontSize: '0.8125rem', marginTop: 2 }}>
            {company.registration_number && `IČO: ${company.registration_number}`}
            {company.vat_id && ` · DIČ: ${company.vat_id}`}
          </div>
          {company.billing_address?.line1 && (
            <div style={{ color: 'var(--sf-muted, #666)', fontSize: '0.8125rem' }}>
              {company.billing_address.line1}, {company.billing_address.postalCode}{' '}
              {company.billing_address.city}
            </div>
          )}
          {company.net_terms_enabled && (
            <div
              style={{
                marginTop: 8,
                display: 'inline-block',
                background: 'rgba(40,160,70,0.12)',
                color: '#1c7c34',
                borderRadius: 4,
                padding: '0.25rem 0.5rem',
                fontSize: '0.75rem',
                fontWeight: 500,
              }}
            >
              ✓ Platba na fakturu povolena (splatnost {company.net_terms_days} dní)
            </div>
          )}
        </div>
      )}

      {editing && (
        <div>
          <label style={labelStyle}>
            <span style={labelTextStyle}>Název firmy *</span>
            <input style={inputStyle} value={name} onChange={(e) => setName(e.target.value)} />
          </label>
          <div style={{ display: 'flex', gap: '0.75rem' }}>
            <label style={{ ...labelStyle, flex: 1 }}>
              <span style={labelTextStyle}>IČO</span>
              <input style={inputStyle} value={ico} onChange={(e) => setIco(e.target.value)} />
            </label>
            <label style={{ ...labelStyle, flex: 1 }}>
              <span style={labelTextStyle}>DIČ</span>
              <input style={inputStyle} value={dic} onChange={(e) => setDic(e.target.value)} />
            </label>
          </div>
          <label style={labelStyle}>
            <span style={labelTextStyle}>Ulice a č.p.</span>
            <input style={inputStyle} value={line1} onChange={(e) => setLine1(e.target.value)} />
          </label>
          <div style={{ display: 'flex', gap: '0.75rem' }}>
            <label style={{ ...labelStyle, flex: 2 }}>
              <span style={labelTextStyle}>Město</span>
              <input style={inputStyle} value={city} onChange={(e) => setCity(e.target.value)} />
            </label>
            <label style={{ ...labelStyle, flex: 1 }}>
              <span style={labelTextStyle}>PSČ</span>
              <input style={inputStyle} value={psc} onChange={(e) => setPsc(e.target.value)} />
            </label>
          </div>
          {error && (
            <p style={{ color: '#c0392b', fontSize: '0.8125rem', margin: '0 0 0.75rem' }}>{error}</p>
          )}
          <div style={{ display: 'flex', gap: '0.75rem' }}>
            <button type="button" onClick={() => void save()} disabled={busy} style={primaryBtnStyle(busy)}>
              {busy ? 'Ukládám…' : 'Uložit'}
            </button>
            <button type="button" onClick={() => setEditing(false)} style={secondaryBtnStyle}>
              Zrušit
            </button>
          </div>
        </div>
      )}
    </section>
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
