import { Link, useParams } from '@tanstack/react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, formatMoney } from '../lib/api';
import { StatusBadge } from './dashboard';

const STATUS_TRANSITIONS: Record<string, string[]> = {
  pending_payment: ['paid', 'partially_paid', 'cancelled'],
  partially_paid: ['paid', 'cancelled'],
  paid: ['fulfilling', 'fulfilled', 'refunded', 'cancelled'],
  fulfilling: ['fulfilled', 'cancelled', 'refunded'],
  fulfilled: ['refunded'],
  cancelled: [],
  refunded: [],
};

export function OrderDetailPage() {
  const { orderId } = useParams({ from: '/app/orders/$orderId' });
  const queryClient = useQueryClient();

  const orderQuery = useQuery({
    queryKey: ['admin', 'order', orderId],
    queryFn: () => api.getOrder(orderId),
  });

  const updateMutation = useMutation({
    mutationFn: (body: { status?: string; paymentStatus?: string }) =>
      api.updateOrderStatus(orderId, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'order', orderId] });
      queryClient.invalidateQueries({ queryKey: ['admin', 'orders'] });
    },
  });

  if (orderQuery.isLoading) return <p>Načítání objednávky…</p>;
  if (orderQuery.isError || !orderQuery.data) {
    return (
      <div>
        <p style={{ color: '#c00' }}>Objednávka nenalezena.</p>
        <Link to="/orders" style={{ color: '#0066ff' }}>
          ← Zpět na seznam
        </Link>
      </div>
    );
  }

  const order = orderQuery.data;
  const allowed = STATUS_TRANSITIONS[order.status] ?? [];

  return (
    <div>
      <Link to="/orders" style={{ color: '#666', fontSize: '0.875rem', textDecoration: 'none' }}>
        ← Zpět na seznam
      </Link>

      <header
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          margin: '0.75rem 0 2rem',
        }}
      >
        <div>
          <h1 style={{ margin: '0 0 0.5rem', fontSize: '1.75rem' }}>{order.number}</h1>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <StatusBadge status={order.status} />
            <span style={{ fontSize: '0.8125rem', color: '#666', alignSelf: 'center' }}>
              Platba: {order.payment_status} ({order.payment_method ?? '—'})
            </span>
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: '0.8125rem', color: '#666' }}>Celkem</div>
          <div style={{ fontSize: '1.5rem', fontWeight: 600 }}>
            {formatMoney(order.totals.total)}
          </div>
        </div>
      </header>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: '1.5rem' }}>
        <div>
          <section style={cardStyle}>
            <h2 style={sectionHeaderStyle}>Položky</h2>
            <table style={tableStyle}>
              <thead>
                <tr>
                  <th style={thStyle}>Produkt</th>
                  <th style={thStyle}>SKU</th>
                  <th style={{ ...thStyle, textAlign: 'right' }}>Ks</th>
                  <th style={{ ...thStyle, textAlign: 'right' }}>Cena</th>
                  <th style={{ ...thStyle, textAlign: 'right' }}>Celkem</th>
                </tr>
              </thead>
              <tbody>
                {order.items.map((it) => (
                  <tr key={it.id}>
                    <td style={tdStyle}>
                      <div style={{ fontWeight: 500 }}>{it.product_title}</div>
                      <div style={{ fontSize: '0.8125rem', color: '#666' }}>{it.variant_title}</div>
                    </td>
                    <td style={{ ...tdStyle, color: '#666' }}>{it.sku ?? '—'}</td>
                    <td style={{ ...tdStyle, textAlign: 'right' }}>{it.quantity}</td>
                    <td style={{ ...tdStyle, textAlign: 'right' }}>{formatMoney(it.unit_price)}</td>
                    <td style={{ ...tdStyle, textAlign: 'right', fontWeight: 500 }}>
                      {formatMoney(it.line_total)}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td colSpan={4} style={{ ...tdStyle, textAlign: 'right', color: '#666' }}>
                    Mezisoučet
                  </td>
                  <td style={{ ...tdStyle, textAlign: 'right' }}>
                    {formatMoney(order.totals.subtotal)}
                  </td>
                </tr>
                <tr>
                  <td colSpan={4} style={{ ...tdStyle, textAlign: 'right', color: '#666' }}>
                    Doprava
                  </td>
                  <td style={{ ...tdStyle, textAlign: 'right' }}>
                    {formatMoney(order.totals.shipping)}
                  </td>
                </tr>
                <tr>
                  <td colSpan={4} style={{ ...tdStyle, textAlign: 'right', color: '#666' }}>
                    Daň
                  </td>
                  <td style={{ ...tdStyle, textAlign: 'right' }}>{formatMoney(order.totals.tax)}</td>
                </tr>
                <tr style={{ borderTop: '2px solid #111' }}>
                  <td
                    colSpan={4}
                    style={{ ...tdStyle, textAlign: 'right', fontWeight: 600 }}
                  >
                    Celkem
                  </td>
                  <td style={{ ...tdStyle, textAlign: 'right', fontWeight: 600 }}>
                    {formatMoney(order.totals.total)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </section>

          <section style={cardStyle}>
            <h2 style={sectionHeaderStyle}>Doručovací adresa</h2>
            <address style={{ fontStyle: 'normal', lineHeight: 1.6, fontSize: '0.9375rem' }}>
              {order.customer.name && <div>{order.customer.name}</div>}
              <div>{order.shipping_address.line1}</div>
              {order.shipping_address.line2 && <div>{order.shipping_address.line2}</div>}
              <div>
                {order.shipping_address.postalCode} {order.shipping_address.city}
              </div>
              <div>{order.shipping_address.countryCode}</div>
            </address>
          </section>

          {order.customer_note && (
            <section style={cardStyle}>
              <h2 style={sectionHeaderStyle}>Poznámka zákazníka</h2>
              <p style={{ margin: 0, whiteSpace: 'pre-wrap' }}>{order.customer_note}</p>
            </section>
          )}
        </div>

        <aside>
          <section style={cardStyle}>
            <h2 style={sectionHeaderStyle}>Akce</h2>
            {allowed.length === 0 ? (
              <p style={{ color: '#666', fontSize: '0.875rem' }}>
                V tomto stavu nejsou dostupné žádné přechody.
              </p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {allowed.map((s) => (
                  <button
                    key={s}
                    type="button"
                    disabled={updateMutation.isPending}
                    onClick={() => updateMutation.mutate({ status: s })}
                    style={actionBtn(s)}
                  >
                    Přesunout do: <strong>{s}</strong>
                  </button>
                ))}
              </div>
            )}
            {updateMutation.isError && (
              <p style={{ color: '#c00', fontSize: '0.875rem', margin: '0.75rem 0 0' }}>
                {(updateMutation.error as Error).message}
              </p>
            )}
          </section>

          <section style={cardStyle}>
            <h2 style={sectionHeaderStyle}>Zákazník</h2>
            <dl style={{ fontSize: '0.875rem', margin: 0 }}>
              <dt style={dtStyle}>E-mail</dt>
              <dd style={ddStyle}>{order.customer.email}</dd>
              {order.customer.name && (
                <>
                  <dt style={dtStyle}>Jméno</dt>
                  <dd style={ddStyle}>{order.customer.name}</dd>
                </>
              )}
              {order.customer.phone && (
                <>
                  <dt style={dtStyle}>Telefon</dt>
                  <dd style={ddStyle}>{order.customer.phone}</dd>
                </>
              )}
            </dl>
          </section>

          <section style={cardStyle}>
            <h2 style={sectionHeaderStyle}>Časová osa</h2>
            <dl style={{ fontSize: '0.8125rem', margin: 0 }}>
              <dt style={dtStyle}>Vytvořeno</dt>
              <dd style={ddStyle}>{new Date(order.placed_at).toLocaleString('cs-CZ')}</dd>
              {order.paid_at && (
                <>
                  <dt style={dtStyle}>Zaplaceno</dt>
                  <dd style={ddStyle}>{new Date(order.paid_at).toLocaleString('cs-CZ')}</dd>
                </>
              )}
              {order.fulfilled_at && (
                <>
                  <dt style={dtStyle}>Vyřízeno</dt>
                  <dd style={ddStyle}>{new Date(order.fulfilled_at).toLocaleString('cs-CZ')}</dd>
                </>
              )}
              {order.cancelled_at && (
                <>
                  <dt style={dtStyle}>Stornováno</dt>
                  <dd style={ddStyle}>{new Date(order.cancelled_at).toLocaleString('cs-CZ')}</dd>
                </>
              )}
            </dl>
          </section>
        </aside>
      </div>
    </div>
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

const tableStyle: React.CSSProperties = { width: '100%', borderCollapse: 'collapse' };

const thStyle: React.CSSProperties = {
  textAlign: 'left',
  padding: '0.5rem 0.5rem',
  fontSize: '0.75rem',
  textTransform: 'uppercase',
  letterSpacing: '0.04em',
  color: '#666',
  borderBottom: '1px solid #e9ecef',
};

const tdStyle: React.CSSProperties = {
  padding: '0.625rem 0.5rem',
  fontSize: '0.875rem',
  borderBottom: '1px solid #f0f0f0',
};

const dtStyle: React.CSSProperties = { fontWeight: 500, marginTop: '0.5rem', color: '#666' };
const ddStyle: React.CSSProperties = { margin: 0 };

function actionBtn(s: string): React.CSSProperties {
  const isDestructive = s === 'cancelled' || s === 'refunded';
  return {
    padding: '0.5rem 0.75rem',
    background: isDestructive ? '#fff5f5' : '#f0f7ff',
    border: `1px solid ${isDestructive ? '#ffcccc' : '#cce0ff'}`,
    color: isDestructive ? '#a03030' : '#003d99',
    borderRadius: 4,
    fontSize: '0.8125rem',
    textAlign: 'left',
    cursor: 'pointer',
  };
}
