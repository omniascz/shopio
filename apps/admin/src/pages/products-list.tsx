import { useRef, useState } from 'react';
import { Link } from '@tanstack/react-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api, formatMoney, productBasePrice, type ImportReport } from '../lib/api';

const STATUSES = ['', 'draft', 'active', 'archived'];

export function ProductsListPage() {
  const queryClient = useQueryClient();
  const [status, setStatus] = useState('');
  const [q, setQ] = useState('');
  const [offset, setOffset] = useState(0);
  const [importReport, setImportReport] = useState<ImportReport | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const limit = 20;

  const query = useQuery({
    queryKey: ['admin', 'products', { status, q, offset }],
    queryFn: () =>
      api.listProducts({ status: status || undefined, q: q || undefined, limit, offset }),
  });

  const total = query.data?.count ?? 0;

  async function handleImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setImportError(null);
    setImportReport(null);
    setImporting(true);
    try {
      const report = await api.importProductsCsv(file);
      setImportReport(report);
      queryClient.invalidateQueries({ queryKey: ['admin', 'products'] });
    } catch (err) {
      setImportError((err as Error).message);
    } finally {
      setImporting(false);
    }
  }

  return (
    <div>
      <header
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '1.5rem',
        }}
      >
        <h1 style={{ margin: 0, fontSize: '1.75rem' }}>Produkty</h1>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button
            type="button"
            disabled={importing}
            onClick={() => fileRef.current?.click()}
            style={{
              padding: '0.5rem 1rem',
              background: '#fff',
              color: '#0066ff',
              border: '1px solid #0066ff',
              borderRadius: 4,
              fontSize: '0.875rem',
              cursor: importing ? 'wait' : 'pointer',
            }}
          >
            {importing ? 'Importuji…' : '⬆ Import CSV'}
          </button>
          <input
            ref={fileRef}
            type="file"
            accept=".csv,text/csv"
            onChange={(e) => void handleImport(e)}
            style={{ display: 'none' }}
          />
          <Link
            to="/products/new"
            style={{
              padding: '0.5rem 1rem',
              background: '#0066ff',
              color: '#fff',
              borderRadius: 4,
              fontSize: '0.875rem',
              textDecoration: 'none',
            }}
          >
            + Nový produkt
          </Link>
        </div>
      </header>

      {importError && (
        <p style={{ color: '#c00', fontSize: '0.875rem', margin: '0 0 1rem' }}>{importError}</p>
      )}
      {importReport && (
        <div
          style={{
            background: '#f0f9f0',
            border: '1px solid #c3e6c3',
            borderRadius: 6,
            padding: '0.75rem 1rem',
            marginBottom: '1rem',
            fontSize: '0.875rem',
          }}
        >
          <strong>Import dokončen:</strong> vytvořeno {importReport.created} z{' '}
          {importReport.total_rows} řádků
          {importReport.skipped.length > 0 && <> · přeskočeno {importReport.skipped.length}</>}
          {importReport.errors.length > 0 && (
            <span style={{ color: '#a03030' }}> · chyb {importReport.errors.length}</span>
          )}
          {(importReport.skipped.length > 0 || importReport.errors.length > 0) && (
            <ul style={{ margin: '0.5rem 0 0', paddingLeft: '1.25rem', color: '#666' }}>
              {importReport.skipped.slice(0, 5).map((s) => (
                <li key={`s${s.line}`}>ř. {s.line}: {s.reason}</li>
              ))}
              {importReport.errors.slice(0, 5).map((er) => (
                <li key={`e${er.line}`} style={{ color: '#a03030' }}>
                  ř. {er.line}: {er.message}
                </li>
              ))}
            </ul>
          )}
          <div style={{ marginTop: '0.375rem', fontSize: '0.75rem', color: '#888' }}>
            Formát: sloupce title/nazev*, price/cena*, slug, sku, stock/sklad, weight_grams,
            category/kategorie, vendor, brand · oddělovač , nebo ;
          </div>
        </div>
      )}

      <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1rem' }}>
        <input
          type="search"
          placeholder="Hledat (název, slug)"
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setOffset(0);
          }}
          style={inputStyle}
        />
        <select
          value={status}
          onChange={(e) => {
            setStatus(e.target.value);
            setOffset(0);
          }}
          style={{ ...inputStyle, flex: '0 0 auto', minWidth: 160 }}
        >
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {s || 'Všechny stavy'}
            </option>
          ))}
        </select>
      </div>

      <div
        style={{
          background: '#fff',
          padding: '0.5rem',
          borderRadius: 8,
          border: '1px solid #e9ecef',
        }}
      >
        {query.isLoading && <p>Načítání…</p>}
        {query.data && query.data.products.length === 0 && (
          <p style={{ color: '#666' }}>Žádné produkty.</p>
        )}
        {query.data && query.data.products.length > 0 && (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={thStyle}>Název</th>
                <th style={thStyle}>Slug</th>
                <th style={thStyle}>Stav</th>
                <th style={{ ...thStyle, textAlign: 'right' }}>Cena</th>
                <th style={thStyle}>Publikováno</th>
              </tr>
            </thead>
            <tbody>
              {query.data.products.map((p) => (
                <tr key={p.id}>
                  <td style={tdStyle}>
                    <Link
                      to="/products/$productId"
                      params={{ productId: p.id }}
                      style={{ fontWeight: 500, color: '#0066ff', textDecoration: 'none' }}
                    >
                      {p.title}
                    </Link>
                    {p.vendor && (
                      <div style={{ fontSize: '0.8125rem', color: '#666' }}>{p.vendor}</div>
                    )}
                  </td>
                  <td
                    style={{
                      ...tdStyle,
                      fontFamily: 'monospace',
                      fontSize: '0.8125rem',
                      color: '#666',
                    }}
                  >
                    {p.slug}
                  </td>
                  <td style={tdStyle}>{p.status}</td>
                  <td style={{ ...tdStyle, textAlign: 'right' }}>
                    {formatMoney(productBasePrice(p))}
                  </td>
                  <td style={{ ...tdStyle, color: '#666', fontSize: '0.8125rem' }}>
                    {p.published_at ? new Date(p.published_at).toLocaleDateString('cs-CZ') : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <p style={{ color: '#666', fontSize: '0.8125rem', marginTop: '1rem' }}>Celkem: {total}.</p>
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  padding: '0.5rem 0.75rem',
  border: '1px solid #ddd',
  borderRadius: 4,
  fontSize: '0.875rem',
  flex: 1,
};

const thStyle: React.CSSProperties = {
  textAlign: 'left',
  padding: '0.625rem 0.75rem',
  fontSize: '0.75rem',
  textTransform: 'uppercase',
  letterSpacing: '0.04em',
  color: '#666',
  borderBottom: '1px solid #e9ecef',
};

const tdStyle: React.CSSProperties = {
  padding: '0.75rem',
  fontSize: '0.875rem',
  borderBottom: '1px solid #f0f0f0',
};
