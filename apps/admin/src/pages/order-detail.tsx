import { useState } from 'react';
import { Link, useParams } from '@tanstack/react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  api,
  formatMoney,
  type OrderDetail,
  type ReturnDetail,
  type ShipmentDetail,
} from '../lib/api';
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
                  <td style={{ ...tdStyle, textAlign: 'right' }}>
                    {formatMoney(order.totals.tax)}
                  </td>
                </tr>
                <tr style={{ borderTop: '2px solid #111' }}>
                  <td colSpan={4} style={{ ...tdStyle, textAlign: 'right', fontWeight: 600 }}>
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

          <ShipmentsPanel orderId={orderId} order={order} />

          <ReturnsPanel orderId={orderId} order={order} />
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

          <InvoicesPanel orderId={orderId} orderStatus={order.payment_status} />

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

const SHIPMENT_STATUS_LABELS: Record<string, string> = {
  pending: 'Čeká na štítek',
  label_generated: 'Štítek vygenerován',
  handed_over: 'Předáno dopravci',
  delivered: 'Doručeno',
  cancelled: 'Zrušeno',
};

function ShipmentsPanel({ orderId, order }: { orderId: string; order: OrderDetail }) {
  const queryClient = useQueryClient();
  const [creating, setCreating] = useState(false);
  const [quantities, setQuantities] = useState<Record<string, number>>({});

  const shipmentsQuery = useQuery({
    queryKey: ['admin', 'order', orderId, 'shipments'],
    queryFn: () => api.listOrderShipments(orderId),
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['admin', 'order', orderId] });
    queryClient.invalidateQueries({ queryKey: ['admin', 'orders'] });
  };

  const createMutation = useMutation({
    mutationFn: () =>
      api.createShipment(orderId, {
        items: Object.entries(quantities)
          .filter(([, q]) => q > 0)
          .map(([orderItemId, quantity]) => ({ orderItemId, quantity })),
      }),
    onSuccess: () => {
      setCreating(false);
      setQuantities({});
      invalidate();
    },
  });

  const labelMutation = useMutation({
    mutationFn: (id: string) => api.generateShipmentLabel(id),
    onSuccess: invalidate,
  });

  const transitionMutation = useMutation({
    mutationFn: ({ id, action }: { id: string; action: 'handed-over' | 'delivered' | 'cancel' }) =>
      api.transitionShipment(id, action),
    onSuccess: invalidate,
  });

  const shipments = shipmentsQuery.data?.shipments ?? [];
  const canCreate = order.status === 'paid' || order.status === 'fulfilling';
  const anySelected = Object.values(quantities).some((q) => q > 0);
  const busy =
    createMutation.isPending || labelMutation.isPending || transitionMutation.isPending;
  const error = createMutation.error ?? labelMutation.error ?? transitionMutation.error;

  return (
    <section style={cardStyle}>
      <h2 style={sectionHeaderStyle}>Zásilky</h2>

      {shipmentsQuery.isLoading ? (
        <p style={{ color: '#666', fontSize: '0.875rem' }}>Načítání…</p>
      ) : shipments.length === 0 ? (
        <p style={{ color: '#666', fontSize: '0.875rem' }}>Žádné zásilky.</p>
      ) : (
        shipments.map((shp: ShipmentDetail) => (
          <div
            key={shp.id}
            style={{
              border: '1px solid #e9ecef',
              borderRadius: 6,
              padding: '0.75rem',
              marginBottom: '0.75rem',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <strong style={{ fontSize: '0.9375rem' }}>{shp.number}</strong>
              <span style={{ fontSize: '0.8125rem', color: '#444' }}>
                {SHIPMENT_STATUS_LABELS[shp.status] ?? shp.status}
              </span>
            </div>
            <ul style={{ margin: '0.5rem 0', paddingLeft: '1.25rem', fontSize: '0.8125rem' }}>
              {shp.items.map((it) => (
                <li key={it.id}>
                  {it.title} × {it.quantity}
                </li>
              ))}
            </ul>
            <div style={{ fontSize: '0.8125rem', color: '#666' }}>
              {shp.carrier_code} • {(shp.weight_grams / 1000).toFixed(2)} kg
              {shp.pickup_point?.name && <> • {shp.pickup_point.name}</>}
              {shp.tracking_number && (
                <>
                  {' '}
                  •{' '}
                  {shp.tracking_url ? (
                    <a href={shp.tracking_url} target="_blank" rel="noreferrer">
                      {shp.tracking_number}
                    </a>
                  ) : (
                    shp.tracking_number
                  )}
                  {shp.label_provider === 'mock' && ' (mock)'}
                </>
              )}
            </div>
            <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem', flexWrap: 'wrap' }}>
              {shp.status === 'pending' && (
                <button
                  type="button"
                  style={downloadBtn}
                  disabled={busy}
                  onClick={() => labelMutation.mutate(shp.id)}
                >
                  {labelMutation.isPending ? 'Generuji…' : 'Vygenerovat štítek'}
                </button>
              )}
              {shp.has_label && (
                <button
                  type="button"
                  style={downloadBtn}
                  onClick={() => void api.downloadShipmentLabel(shp.id)}
                >
                  Štítek PDF
                </button>
              )}
              {shp.status === 'label_generated' && (
                <button
                  type="button"
                  style={downloadBtn}
                  disabled={busy}
                  onClick={() => transitionMutation.mutate({ id: shp.id, action: 'handed-over' })}
                >
                  Předáno dopravci
                </button>
              )}
              {shp.status === 'handed_over' && (
                <button
                  type="button"
                  style={downloadBtn}
                  disabled={busy}
                  onClick={() => transitionMutation.mutate({ id: shp.id, action: 'delivered' })}
                >
                  Označit doručeno
                </button>
              )}
              {(shp.status === 'pending' || shp.status === 'label_generated') && (
                <button
                  type="button"
                  style={dangerBtn}
                  disabled={busy}
                  onClick={() => transitionMutation.mutate({ id: shp.id, action: 'cancel' })}
                >
                  Zrušit
                </button>
              )}
            </div>
          </div>
        ))
      )}

      {error && (
        <p style={{ color: '#c00', fontSize: '0.8125rem' }}>{(error as Error).message}</p>
      )}

      {canCreate && !creating && (
        <button type="button" style={downloadBtn} onClick={() => setCreating(true)}>
          + Nová zásilka
        </button>
      )}

      {creating && (
        <div style={{ marginTop: '0.75rem', borderTop: '1px solid #eee', paddingTop: '0.75rem' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
            <tbody>
              {order.items.map((it) => (
                <tr key={it.id}>
                  <td style={{ padding: '0.25rem 0' }}>
                    {it.product_title} — {it.variant_title}
                  </td>
                  <td style={{ textAlign: 'right', width: 110 }}>
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
                      style={{ width: 56, padding: '0.25rem' }}
                    />{' '}
                    / {it.quantity}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
            <button
              type="button"
              style={downloadBtn}
              disabled={!anySelected || createMutation.isPending}
              onClick={() => createMutation.mutate()}
            >
              Vytvořit zásilku
            </button>
            <button type="button" style={dangerBtn} onClick={() => setCreating(false)}>
              Zrušit
            </button>
          </div>
        </div>
      )}
    </section>
  );
}

const RETURN_STATUS_LABELS: Record<string, string> = {
  requested: 'Požadováno',
  approved: 'Schváleno',
  received: 'Přijato',
  refunded: 'Refundováno',
  rejected: 'Zamítnuto',
  cancelled: 'Zrušeno',
};

function ReturnsPanel({ orderId, order }: { orderId: string; order: OrderDetail }) {
  const queryClient = useQueryClient();
  const [creating, setCreating] = useState(false);
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [reasonCode, setReasonCode] = useState('other');
  const [refundShipping, setRefundShipping] = useState(false);
  const [restock, setRestock] = useState(true);

  const returnsQuery = useQuery({
    queryKey: ['admin', 'order', orderId, 'returns'],
    queryFn: () => api.listOrderReturns(orderId),
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['admin', 'order', orderId] });
  };

  const createMutation = useMutation({
    mutationFn: () =>
      api.createReturn(orderId, {
        items: Object.entries(quantities)
          .filter(([, q]) => q > 0)
          .map(([orderItemId, quantity]) => ({ orderItemId, quantity })),
        reasonCode,
      }),
    onSuccess: () => {
      setCreating(false);
      setQuantities({});
      invalidate();
    },
  });

  const transitionMutation = useMutation({
    mutationFn: ({ id, action }: { id: string; action: 'approve' | 'reject' | 'receive' | 'cancel' }) =>
      api.transitionReturn(id, action),
    onSuccess: invalidate,
  });

  const refundMutation = useMutation({
    mutationFn: (id: string) => api.refundReturn(id, { refundShipping, restock }),
    onSuccess: invalidate,
  });

  const returns = returnsQuery.data?.returns ?? [];
  const canCreate = order.payment_status === 'paid' || order.payment_status === 'refunded';
  const anySelected = Object.values(quantities).some((q) => q > 0);
  const busy = createMutation.isPending || transitionMutation.isPending || refundMutation.isPending;

  return (
    <section style={cardStyle}>
      <h2 style={sectionHeaderStyle}>Vratky a refundace</h2>

      {returnsQuery.isLoading ? (
        <p style={{ color: '#666', fontSize: '0.875rem' }}>Načítání…</p>
      ) : returns.length === 0 ? (
        <p style={{ color: '#666', fontSize: '0.875rem' }}>Žádné vratky.</p>
      ) : (
        returns.map((ret: ReturnDetail) => (
          <div
            key={ret.id}
            style={{
              border: '1px solid #e9ecef',
              borderRadius: 6,
              padding: '0.75rem',
              marginBottom: '0.75rem',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <strong style={{ fontSize: '0.9375rem' }}>{ret.number}</strong>
              <span style={{ fontSize: '0.8125rem', color: '#444' }}>
                {RETURN_STATUS_LABELS[ret.status] ?? ret.status}
              </span>
            </div>
            <ul style={{ margin: '0.5rem 0', paddingLeft: '1.25rem', fontSize: '0.8125rem' }}>
              {ret.items.map((it) => (
                <li key={it.id}>
                  {it.title} × {it.quantity} — {formatMoney(it.line_gross)}
                  {it.restocked && ' · naskladněno zpět'}
                </li>
              ))}
            </ul>
            <div style={{ fontSize: '0.8125rem', color: '#666' }}>
              Požadovaný refund: {formatMoney(ret.requested_refund)}
              {ret.actual_refund && (
                <>
                  {' '}
                  • Refundováno: <strong>{formatMoney(ret.actual_refund)}</strong> (
                  {ret.refund_method})
                </>
              )}
            </div>
            <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem', flexWrap: 'wrap' }}>
              {ret.status === 'requested' && (
                <>
                  <button
                    type="button"
                    style={downloadBtn}
                    disabled={busy}
                    onClick={() => transitionMutation.mutate({ id: ret.id, action: 'approve' })}
                  >
                    Schválit
                  </button>
                  <button
                    type="button"
                    style={dangerBtn}
                    disabled={busy}
                    onClick={() => transitionMutation.mutate({ id: ret.id, action: 'reject' })}
                  >
                    Zamítnout
                  </button>
                </>
              )}
              {ret.status === 'approved' && (
                <button
                  type="button"
                  style={downloadBtn}
                  disabled={busy}
                  onClick={() => transitionMutation.mutate({ id: ret.id, action: 'receive' })}
                >
                  Označit přijato
                </button>
              )}
              {ret.status === 'received' && (
                <>
                  <label style={{ fontSize: '0.8125rem', display: 'flex', gap: '0.25rem', alignItems: 'center' }}>
                    <input
                      type="checkbox"
                      checked={refundShipping}
                      onChange={(e) => setRefundShipping(e.target.checked)}
                    />
                    vrátit i dopravu
                  </label>
                  <label style={{ fontSize: '0.8125rem', display: 'flex', gap: '0.25rem', alignItems: 'center' }}>
                    <input
                      type="checkbox"
                      checked={restock}
                      onChange={(e) => setRestock(e.target.checked)}
                    />
                    naskladnit zpět
                  </label>
                  <button
                    type="button"
                    style={dangerBtn}
                    disabled={busy}
                    onClick={() => refundMutation.mutate(ret.id)}
                  >
                    {refundMutation.isPending ? 'Refunduji…' : 'Refundovat'}
                  </button>
                </>
              )}
            </div>
          </div>
        ))
      )}

      {(transitionMutation.isError || refundMutation.isError || createMutation.isError) && (
        <p style={{ color: '#c00', fontSize: '0.8125rem' }}>
          {((transitionMutation.error ?? refundMutation.error ?? createMutation.error) as Error)
            ?.message}
        </p>
      )}

      {canCreate && !creating && (
        <button type="button" style={downloadBtn} onClick={() => setCreating(true)}>
          + Nová vratka
        </button>
      )}

      {creating && (
        <div style={{ marginTop: '0.75rem', borderTop: '1px solid #eee', paddingTop: '0.75rem' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
            <tbody>
              {order.items.map((it) => (
                <tr key={it.id}>
                  <td style={{ padding: '0.25rem 0' }}>
                    {it.product_title} — {it.variant_title}
                  </td>
                  <td style={{ textAlign: 'right', width: 110 }}>
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
                      style={{ width: 56, padding: '0.25rem' }}
                    />{' '}
                    / {it.quantity}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem', alignItems: 'center' }}>
            <select
              value={reasonCode}
              onChange={(e) => setReasonCode(e.target.value)}
              style={{ padding: '0.25rem', fontSize: '0.8125rem' }}
            >
              <option value="changed_mind">Odstoupení od smlouvy</option>
              <option value="damaged">Poškozené zboží</option>
              <option value="wrong_item">Špatné zboží</option>
              <option value="not_as_described">Neodpovídá popisu</option>
              <option value="other">Jiný důvod</option>
            </select>
            <button
              type="button"
              style={downloadBtn}
              disabled={!anySelected || createMutation.isPending}
              onClick={() => createMutation.mutate()}
            >
              Vytvořit vratku
            </button>
            <button type="button" style={dangerBtn} onClick={() => setCreating(false)}>
              Zrušit
            </button>
          </div>
        </div>
      )}
    </section>
  );
}

const dangerBtn: React.CSSProperties = {
  padding: '0.25rem 0.625rem',
  background: '#fff5f5',
  border: '1px solid #ffcccc',
  color: '#a03030',
  borderRadius: 4,
  fontSize: '0.75rem',
  cursor: 'pointer',
};

function InvoicesPanel({ orderId, orderStatus }: { orderId: string; orderStatus: string }) {
  const queryClient = useQueryClient();
  const invoicesQuery = useQuery({
    queryKey: ['admin', 'order', orderId, 'invoices'],
    queryFn: () => api.listOrderInvoices(orderId),
  });

  const issueMutation = useMutation({
    mutationFn: () => api.issueInvoice(orderId),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ['admin', 'order', orderId, 'invoices'] }),
  });

  const invoices = invoicesQuery.data?.invoices ?? [];
  const hasRegular = invoices.some((i) => i.kind === 'invoice' && !i.is_void);

  return (
    <section style={cardStyle}>
      <h2 style={sectionHeaderStyle}>Faktury</h2>
      {invoicesQuery.isLoading ? (
        <p style={{ color: '#666', fontSize: '0.875rem' }}>Načítání…</p>
      ) : invoices.length === 0 ? (
        <p style={{ color: '#666', fontSize: '0.875rem' }}>Zatím žádná faktura.</p>
      ) : (
        <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
          {invoices.map((inv) => (
            <li key={inv.id} style={{ marginBottom: '0.75rem' }}>
              <div style={{ fontSize: '0.875rem', fontWeight: 500 }}>
                {inv.kind === 'credit_note' ? 'Dobropis' : 'Faktura'} {inv.number}
                {inv.is_void && <span style={{ color: '#c00' }}> (stornováno)</span>}
              </div>
              <div style={{ fontSize: '0.8125rem', color: '#666' }}>
                {new Date(inv.issued_at).toLocaleDateString('cs-CZ')} • {formatMoney(inv.total)}
              </div>
              <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.25rem' }}>
                <button
                  type="button"
                  style={downloadBtn}
                  onClick={() => void api.downloadInvoiceFile(inv.id, 'pdf')}
                >
                  PDF
                </button>
                <button
                  type="button"
                  style={downloadBtn}
                  onClick={() => void api.downloadInvoiceFile(inv.id, 'xml')}
                >
                  ISDOC
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
      {!hasRegular && orderStatus === 'paid' && (
        <button
          type="button"
          disabled={issueMutation.isPending}
          onClick={() => issueMutation.mutate()}
          style={{ ...downloadBtn, marginTop: '0.5rem' }}
        >
          {issueMutation.isPending ? 'Vystavuji…' : 'Vystavit fakturu'}
        </button>
      )}
      {issueMutation.isError && (
        <p style={{ color: '#c00', fontSize: '0.8125rem', margin: '0.5rem 0 0' }}>
          {(issueMutation.error as Error).message}
        </p>
      )}
    </section>
  );
}

const downloadBtn: React.CSSProperties = {
  padding: '0.25rem 0.625rem',
  background: '#f0f7ff',
  border: '1px solid #cce0ff',
  color: '#003d99',
  borderRadius: 4,
  fontSize: '0.75rem',
  cursor: 'pointer',
};

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
