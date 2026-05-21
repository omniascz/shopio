/**
 * Persona definitions. Per `36-personas-rbac.md §3, §5`.
 *
 * Each persona = bundle of permissions. Skeleton — 40+ personas to be populated.
 */

import { PERMISSIONS, type PermissionCode } from './permissions.js';

export type PersonaCode =
  | 'MERCHANT-OWNER'
  | 'MERCHANT-ADMIN'
  | 'MERCHANT-STAFF'
  | 'MERCHANT-WAREHOUSE-STAFF'
  | 'MERCHANT-CUSTOMER-SERVICE'
  | 'MERCHANT-MARKETING-MANAGER'
  | 'MERCHANT-ACCOUNTANT'
  | 'MERCHANT-DEVELOPER'
  | 'MERCHANT-SECURITY-OFFICER'
  | 'CUSTOMER-ANONYMOUS'
  | 'CUSTOMER-REGISTERED'
  | 'PLATFORM-SRE'
  | 'PLATFORM-SECURITY'
  | 'PLATFORM-SUPPORT';

export type Persona = {
  code: PersonaCode;
  displayName: string;
  description: string;
  surface: 'storefront' | 'admin' | 'platform' | 'agency' | 'marketplace' | 'partner';
  permissions: readonly PermissionCode[];
};

/** Persona registry. Will be loaded from DB at runtime; this is in-code fallback + reference. */
export const PERSONAS: Record<PersonaCode, Persona> = {
  'MERCHANT-OWNER': {
    code: 'MERCHANT-OWNER',
    displayName: 'Owner',
    description: 'Tenant root. Full access including billing.',
    surface: 'admin',
    permissions: Object.values(PERMISSIONS).filter((p) => !p.startsWith('PERM-PLATFORM-')),
  },
  'MERCHANT-ADMIN': {
    code: 'MERCHANT-ADMIN',
    displayName: 'Admin',
    description: 'Most permissions except billing + ownership transfer.',
    surface: 'admin',
    permissions: [
      PERMISSIONS.ADMIN_ACCESS,
      PERMISSIONS.PRODUCT_VIEW,
      PERMISSIONS.PRODUCT_CREATE,
      PERMISSIONS.PRODUCT_EDIT,
      PERMISSIONS.PRODUCT_DELETE,
      PERMISSIONS.PRODUCT_PUBLISH,
      PERMISSIONS.ORDER_VIEW,
      PERMISSIONS.ORDER_VIEW_FULL_PII,
      PERMISSIONS.ORDER_EDIT,
      PERMISSIONS.ORDER_CANCEL,
      PERMISSIONS.ORDER_REFUND,
      PERMISSIONS.ORDER_FULFILL,
      PERMISSIONS.CUSTOMER_VIEW,
      PERMISSIONS.CUSTOMER_VIEW_FULL_PII,
      PERMISSIONS.CUSTOMER_EDIT,
      PERMISSIONS.ADMIN_TEAM_MANAGE,
      PERMISSIONS.SECURITY_VIEW,
      PERMISSIONS.SECURITY_MANAGE,
      PERMISSIONS.AUDIT_LOG_VIEW,
    ],
  },
  'MERCHANT-STAFF': {
    code: 'MERCHANT-STAFF',
    displayName: 'Staff',
    description: 'General operations — orders, customers, basic catalog.',
    surface: 'admin',
    permissions: [
      PERMISSIONS.ADMIN_ACCESS,
      PERMISSIONS.PRODUCT_VIEW,
      PERMISSIONS.PRODUCT_EDIT,
      PERMISSIONS.ORDER_VIEW,
      PERMISSIONS.ORDER_EDIT,
      PERMISSIONS.CUSTOMER_VIEW,
      PERMISSIONS.CUSTOMER_EDIT,
    ],
  },
  'MERCHANT-WAREHOUSE-STAFF': {
    code: 'MERCHANT-WAREHOUSE-STAFF',
    displayName: 'Warehouse Staff',
    description: 'Inventory + fulfillment focused.',
    surface: 'admin',
    permissions: [
      PERMISSIONS.ADMIN_ACCESS,
      PERMISSIONS.PRODUCT_VIEW,
      PERMISSIONS.ORDER_VIEW,
      PERMISSIONS.ORDER_FULFILL,
    ],
  },
  'MERCHANT-CUSTOMER-SERVICE': {
    code: 'MERCHANT-CUSTOMER-SERVICE',
    displayName: 'Customer Service',
    description: 'Orders + customers + returns.',
    surface: 'admin',
    permissions: [
      PERMISSIONS.ADMIN_ACCESS,
      PERMISSIONS.ORDER_VIEW,
      PERMISSIONS.ORDER_VIEW_FULL_PII,
      PERMISSIONS.ORDER_EDIT,
      PERMISSIONS.ORDER_CANCEL,
      PERMISSIONS.ORDER_REFUND,
      PERMISSIONS.CUSTOMER_VIEW,
      PERMISSIONS.CUSTOMER_VIEW_FULL_PII,
      PERMISSIONS.CUSTOMER_EDIT,
    ],
  },
  'MERCHANT-MARKETING-MANAGER': {
    code: 'MERCHANT-MARKETING-MANAGER',
    displayName: 'Marketing Manager',
    description: 'Marketing + content + themes + analytics view.',
    surface: 'admin',
    permissions: [PERMISSIONS.ADMIN_ACCESS, PERMISSIONS.PRODUCT_VIEW, PERMISSIONS.CUSTOMER_VIEW],
  },
  'MERCHANT-ACCOUNTANT': {
    code: 'MERCHANT-ACCOUNTANT',
    displayName: 'Accountant',
    description: 'Finance read + reports + exports.',
    surface: 'admin',
    permissions: [PERMISSIONS.ADMIN_ACCESS, PERMISSIONS.ORDER_VIEW, PERMISSIONS.CUSTOMER_VIEW],
  },
  'MERCHANT-DEVELOPER': {
    code: 'MERCHANT-DEVELOPER',
    displayName: 'Developer',
    description: 'API tokens, webhooks, edge functions.',
    surface: 'admin',
    permissions: [PERMISSIONS.ADMIN_ACCESS, PERMISSIONS.PRODUCT_VIEW, PERMISSIONS.ORDER_VIEW],
  },
  'MERCHANT-SECURITY-OFFICER': {
    code: 'MERCHANT-SECURITY-OFFICER',
    displayName: 'Security Officer',
    description: 'Security settings + audit log + incident management.',
    surface: 'admin',
    permissions: [
      PERMISSIONS.ADMIN_ACCESS,
      PERMISSIONS.SECURITY_VIEW,
      PERMISSIONS.SECURITY_MANAGE,
      PERMISSIONS.AUDIT_LOG_VIEW,
    ],
  },
  'CUSTOMER-ANONYMOUS': {
    code: 'CUSTOMER-ANONYMOUS',
    displayName: 'Anonymous Customer',
    description: 'Browses storefront without account.',
    surface: 'storefront',
    permissions: [],
  },
  'CUSTOMER-REGISTERED': {
    code: 'CUSTOMER-REGISTERED',
    displayName: 'Registered Customer',
    description: 'Logged-in customer; self-scoped data access.',
    surface: 'storefront',
    permissions: [],
  },
  'PLATFORM-SRE': {
    code: 'PLATFORM-SRE',
    displayName: 'Platform SRE',
    description: 'On-call, incident response, capacity, deploys.',
    surface: 'platform',
    permissions: [PERMISSIONS.PLATFORM_LOGIN, PERMISSIONS.PLATFORM_PRODUCTION_ACCESS],
  },
  'PLATFORM-SECURITY': {
    code: 'PLATFORM-SECURITY',
    displayName: 'Platform Security',
    description: 'Security ops, vulnerability triage, incident management.',
    surface: 'platform',
    permissions: [PERMISSIONS.PLATFORM_LOGIN, PERMISSIONS.AUDIT_LOG_VIEW],
  },
  'PLATFORM-SUPPORT': {
    code: 'PLATFORM-SUPPORT',
    displayName: 'Platform Support',
    description: 'Customer support; reads service health.',
    surface: 'platform',
    permissions: [PERMISSIONS.PLATFORM_LOGIN],
  },
};
