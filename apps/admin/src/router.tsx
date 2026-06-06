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
import { SignupPage } from './pages/signup';
import { OnboardingPage } from './pages/onboarding';
import { DashboardPage } from './pages/dashboard';
import { OrdersListPage } from './pages/orders-list';
import { OrderDetailPage } from './pages/order-detail';
import { ProductsListPage } from './pages/products-list';
import { ProductCreatePage, ProductEditPage } from './pages/product-edit';
import { SettingsPage } from './pages/settings';
import { ReturnsListPage } from './pages/returns-list';
import { CouponsListPage } from './pages/coupons-list';
import { CompaniesListPage } from './pages/companies-list';
import { ChannelsListPage } from './pages/channels-list';
import { ManualOrderPage } from './pages/manual-order';
import { ContentPage } from './pages/content';
import { VendorsListPage } from './pages/vendors-list';
import { DevelopersPage } from './pages/developers';
import { AnalyticsPage } from './pages/analytics';
import { useAuth } from './lib/auth-store';

function requireAuth() {
  const user = useAuth.getState().user;
  if (!user) {
    throw redirect({ to: '/login' });
  }
}

/** App routes additionally need an active tenant — otherwise → onboarding. */
function requireTenant() {
  const user = useAuth.getState().user;
  if (!user) {
    throw redirect({ to: '/login' });
  }
  if (!user.tenant_id) {
    throw redirect({ to: '/onboarding' });
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

const signupRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/signup',
  component: SignupPage,
});

const onboardingRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/onboarding',
  beforeLoad: requireAuth,
  component: OnboardingPage,
});

const appLayoutRoute = createRoute({
  getParentRoute: () => rootRoute,
  id: 'app',
  beforeLoad: requireTenant,
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

const manualOrderRoute = createRoute({
  getParentRoute: () => appLayoutRoute,
  path: '/orders/manual',
  component: ManualOrderPage,
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

const productCreateRoute = createRoute({
  getParentRoute: () => appLayoutRoute,
  path: '/products/new',
  component: ProductCreatePage,
});

const productEditRoute = createRoute({
  getParentRoute: () => appLayoutRoute,
  path: '/products/$productId',
  component: ProductEditPage,
});

const settingsRoute = createRoute({
  getParentRoute: () => appLayoutRoute,
  path: '/settings',
  component: SettingsPage,
});

const returnsListRoute = createRoute({
  getParentRoute: () => appLayoutRoute,
  path: '/returns',
  component: ReturnsListPage,
});

const couponsListRoute = createRoute({
  getParentRoute: () => appLayoutRoute,
  path: '/coupons',
  component: CouponsListPage,
});

const analyticsRoute = createRoute({
  getParentRoute: () => appLayoutRoute,
  path: '/analytics',
  component: AnalyticsPage,
});

const companiesRoute = createRoute({
  getParentRoute: () => appLayoutRoute,
  path: '/companies',
  component: CompaniesListPage,
});

const channelsRoute = createRoute({
  getParentRoute: () => appLayoutRoute,
  path: '/channels',
  component: ChannelsListPage,
});

const contentRoute = createRoute({
  getParentRoute: () => appLayoutRoute,
  path: '/content',
  component: ContentPage,
});

const vendorsRoute = createRoute({
  getParentRoute: () => appLayoutRoute,
  path: '/vendors',
  component: VendorsListPage,
});

const developersRoute = createRoute({
  getParentRoute: () => appLayoutRoute,
  path: '/developers',
  component: DevelopersPage,
});

const routeTree = rootRoute.addChildren([
  loginRoute,
  signupRoute,
  onboardingRoute,
  appLayoutRoute.addChildren([
    dashboardRoute,
    ordersListRoute,
    manualOrderRoute,
    orderDetailRoute,
    productsListRoute,
    productCreateRoute,
    productEditRoute,
    settingsRoute,
    returnsListRoute,
    couponsListRoute,
    analyticsRoute,
    companiesRoute,
    channelsRoute,
    contentRoute,
    vendorsRoute,
    developersRoute,
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
