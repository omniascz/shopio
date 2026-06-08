import { Link, Outlet, useRouter } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../lib/auth-store';
import { api } from '../lib/api';

export function AppShell() {
  const { user, logout } = useAuth();
  const router = useRouter();
  const platform = useQuery({
    queryKey: ['platform', 'me'],
    queryFn: () => api.platformMe(),
    retry: false,
  });

  async function handleLogout() {
    await logout();
    router.navigate({ to: '/login' });
  }

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#f8f9fa' }}>
      <aside
        style={{
          width: 240,
          background: '#111',
          color: '#fff',
          padding: '1.5rem 0',
          flexShrink: 0,
        }}
      >
        <div style={{ padding: '0 1.5rem', marginBottom: '2rem' }}>
          <div style={{ fontSize: '1.25rem', fontWeight: 700 }}>Shopio Admin</div>
          <div style={{ fontSize: '0.75rem', color: '#888', marginTop: 4 }}>
            {user?.persona ?? '—'}
          </div>
        </div>

        <nav style={{ display: 'flex', flexDirection: 'column' }}>
          <NavLink to="/">Přehled</NavLink>
          <NavLink to="/analytics">Statistiky</NavLink>
          <NavLink to="/orders">Objednávky</NavLink>
          <NavLink to="/returns">Vratky</NavLink>
          <NavLink to="/products">Produkty</NavLink>
          <NavLink to="/coupons">Slevy</NavLink>
          <NavLink to="/promotions">Akce a BOGO</NavLink>
          <NavLink to="/gift-cards">Dárkové karty</NavLink>
          <NavLink to="/collections">Kolekce</NavLink>
          <NavLink to="/newsletter">Newsletter</NavLink>
          <NavLink to="/flows">Automatizace</NavLink>
          <NavLink to="/currencies">Měny</NavLink>
          <NavLink to="/companies">Firmy (B2B)</NavLink>
          <NavLink to="/channels">Kanály</NavLink>
          <NavLink to="/content">Obsah</NavLink>
          <NavLink to="/vendors">Prodejci</NavLink>
          <NavLink to="/developers">Vývojáři</NavLink>
          <NavLink to="/apps">Aplikace</NavLink>
          <NavLink to="/payments">Platby</NavLink>
          <NavLink to="/plan">Plán</NavLink>
          <NavLink to="/settings">Nastavení</NavLink>
          {platform.data?.is_platform_admin && (
            <>
              <div style={{ borderTop: '1px solid #333', margin: '0.75rem 1.5rem' }} />
              <NavLink to="/platform">⚙ Platforma</NavLink>
            </>
          )}
        </nav>

        <div
          style={{
            position: 'absolute',
            bottom: 16,
            left: 0,
            right: 0,
            padding: '0 1.5rem',
            width: 240,
          }}
        >
          <div style={{ fontSize: '0.75rem', color: '#888', marginBottom: 4 }}>{user?.email}</div>
          <button
            onClick={() => void handleLogout()}
            style={{
              background: 'transparent',
              color: '#ddd',
              border: '1px solid #444',
              padding: '0.5rem 0.75rem',
              borderRadius: 4,
              fontSize: '0.8125rem',
              cursor: 'pointer',
              width: '100%',
            }}
          >
            Odhlásit
          </button>
        </div>
      </aside>

      <main style={{ flex: 1, padding: '2rem', overflowX: 'auto' }}>
        <Outlet />
      </main>
    </div>
  );
}

function NavLink({ to, children }: { to: string; children: React.ReactNode }) {
  return (
    <Link
      to={to}
      activeOptions={{ exact: to === '/' }}
      style={{
        padding: '0.75rem 1.5rem',
        color: '#ddd',
        textDecoration: 'none',
        fontSize: '0.9375rem',
      }}
      activeProps={{
        style: {
          background: '#222',
          color: '#fff',
          borderLeft: '3px solid #0066ff',
          paddingLeft: 'calc(1.5rem - 3px)',
        },
      }}
    >
      {children}
    </Link>
  );
}
