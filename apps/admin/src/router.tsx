/**
 * TanStack Router config — code-based (per `27-admin.md §4`).
 * MVP routes: /login, /, /orders, /orders/:id, /products
 */

import {
  createRootRoute,
  createRoute,
  createRouter,
  Outlet,
  redirect,
  RouterProvider,
} from '@tanstack/react-router';
import { AppShell } from './components/app-shell';
import { LoginPage } from './pages/login';
import { DashboardPage } from './pages/dashboard';
import { OrdersListPage } from './pages/orders-list';
import { OrderDetailPage } from './pages/order-detail';
import { ProductsListPage } from './pages/products-list';
import { useAuth } from './lib/auth-store';

function requireAuth() {
  const user = useAuth.getState().user;
  if (!user) {
    throw redirect({ to: '/login' });
  }
}

const rootRoute = createRootRoute({
  component: () => <Outlet />,
});

const loginRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/login',
  component: LoginPage,
});

const appLayoutRoute = createRoute({
  getParentRoute: () => rootRoute,
  id: 'app',
  beforeLoad: requireAuth,
  component: AppShell,
});

const dashboardRoute = createRoute({
  getParentRoute: () => appLayoutRoute,
  path: '/',
  component: DashboardPage,
});

const ordersListRoute = createRoute({
  getParentRoute: () => appLayoutRoute,
  path: '/orders',
  component: OrdersListPage,
});

const orderDetailRoute = createRoute({
  getParentRoute: () => appLayoutRoute,
  path: '/orders/$orderId',
  component: OrderDetailPage,
});

const productsListRoute = createRoute({
  getParentRoute: () => appLayoutRoute,
  path: '/products',
  component: ProductsListPage,
});

const routeTree = rootRoute.addChildren([
  loginRoute,
  appLayoutRoute.addChildren([
    dashboardRoute,
    ordersListRoute,
    orderDetailRoute,
    productsListRoute,
  ]),
]);

export const router = createRouter({ routeTree });

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router;
  }
}

export function AppRouter() {
  return <RouterProvider router={router} />;
}
