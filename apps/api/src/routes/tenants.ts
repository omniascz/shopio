/**
 * Tenant + membership management endpoints.
 *
 * Per `36-personas-rbac.md §14` + `30-security.md`.
 *
 * Endpoints:
 *   POST  /api/{date}/tenants                         — create tenant + auto-assign current user as OWNER
 *   GET   /api/{date}/me/tenants                      — list current user's tenant memberships
 *   POST  /api/{date}/auth/switch-tenant              — re-issue JWT with tenant context
 *   GET   /api/{date}/tenants/{id}/members            — list team
 *   POST  /api/{date}/tenants/{id}/members:invite     — create membership (MVP: instant active, no email yet)
 */

import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { and, eq, inArray } from 'drizzle-orm';
import { schema } from '@shopio/db';
import {
  PERMISSIONS,
  PERSONAS,
  can,
  generatePubId,
  signAccessToken,
  type PermissionCode,
  type PersonaCode,
} from '@shopio/authz';
import { requireAuth } from '../plugins/auth-middleware';
import type { AppDb } from '../db';
import type { ShopioConfig } from '../config';

const CreateTenantBody = z.object({
  displayName: z.string().min(1).max(255),
  slug: z
    .string()
    .min(2)
    .max(63)
    .regex(/^[a-z0-9-]+$/, 'lowercase alphanumeric + hyphens only')
    .optional(),
  countryCode: z.string().length(2).default('CZ'),
  defaultLocale: z.string().default('cs-CZ'),
  defaultCurrency: z.string().length(3).default('CZK'),
  timezone: z.string().default('Europe/Prague'),
});

const SwitchTenantBody = z.object({
  tenantId: z.string().min(1), // pub_id "tnt_..." or UUID
});

const InviteMemberBody = z.object({
  email: z.string().email().toLowerCase(),
  personaCode: z.string().min(1),
});

interface TenantPluginOptions {
  config: ShopioConfig;
  db: AppDb;
}

// Allow only sensible merchant personas to be assigned via invite
const ASSIGNABLE_PERSONAS: readonly PersonaCode[] = [
  'MERCHANT-ADMIN',
  'MERCHANT-STAFF',
  'MERCHANT-WAREHOUSE-STAFF',
  'MERCHANT-CUSTOMER-SERVICE',
  'MERCHANT-MARKETING-MANAGER',
  'MERCHANT-ACCOUNTANT',
  'MERCHANT-DEVELOPER',
  'MERCHANT-SECURITY-OFFICER',
];

export async function registerTenantRoutes(
  app: FastifyInstance,
  opts: TenantPluginOptions,
): Promise<void> {
  const { config, db } = opts;

  // ---------------------------------------------------------------------------
  // POST /api/{date}/tenants — create tenant, current user becomes OWNER
  // ---------------------------------------------------------------------------
  app.post(
    '/api/2026-05-20/tenants',
    { preHandler: requireAuth },
    async (req, reply) => {
      const parsed = CreateTenantBody.safeParse(req.body);
      if (!parsed.success) {
        return reply.code(422).send({
          error: {
            code: 'VALIDATION_FAILED',
            message: 'Invalid input',
            field_errors: parsed.error.flatten().fieldErrors,
          },
        });
      }
      const auth = req.auth!;
      const input = parsed.data;

      const slug = input.slug ?? slugify(input.displayName);

      // Uniqueness check
      const [existing] = await db
        .select({ id: schema.tenants.id })
        .from(schema.tenants)
        .where(eq(schema.tenants.slug, slug))
        .limit(1);
      if (existing) {
        return reply.code(409).send({
          error: { code: 'SLUG_TAKEN', message: `Slug "${slug}" already taken; choose another` },
        });
      }

      const result = await db.transaction(async (tx) => {
        const [tenant] = await tx
          .insert(schema.tenants)
          .values({
            pubId: generatePubId('tnt'),
            slug,
            displayName: input.displayName,
            countryCode: input.countryCode,
            defaultLocale: input.defaultLocale,
            defaultCurrency: input.defaultCurrency,
            timezone: input.timezone,
            status: 'active', // MVP: skip provisioning workflow; goes live immediately
          })
          .returning();

        if (!tenant) throw new Error('Tenant creation failed');

        // Auto-assign current user as OWNER (per `36 §RULE-RBAC-005`)
        const [membership] = await tx
          .insert(schema.userTenantMemberships)
          .values({
            tenantId: tenant.id,
            userId: auth.userId,
            personaCode: 'MERCHANT-OWNER',
            status: 'active',
            acceptedAt: new Date(),
            assignedByUserId: auth.userId,
          })
          .returning();

        return { tenant, membership };
      });

      app.log.info(
        { tenantId: result.tenant.id, ownerId: auth.userId },
        'tenants.create.success',
      );

      return reply.code(201).send({
        data: {
          tenant: {
            id: result.tenant.pubId,
            slug: result.tenant.slug,
            display_name: result.tenant.displayName,
            country_code: result.tenant.countryCode,
            default_locale: result.tenant.defaultLocale,
            default_currency: result.tenant.defaultCurrency,
            plan_tier: result.tenant.planTier,
            status: result.tenant.status,
            created_at: result.tenant.createdAt,
          },
          your_persona: 'MERCHANT-OWNER',
          next_step:
            'Switch to this tenant via POST /auth/switch-tenant with tenantId, then complete onboarding',
        },
      });
    },
  );

  // ---------------------------------------------------------------------------
  // GET /api/{date}/me/tenants — list current user's memberships
  // ---------------------------------------------------------------------------
  app.get(
    '/api/2026-05-20/me/tenants',
    { preHandler: requireAuth },
    async (req, reply) => {
      const auth = req.auth!;

      const rows = await db
        .select({
          membershipId: schema.userTenantMemberships.id,
          personaCode: schema.userTenantMemberships.personaCode,
          status: schema.userTenantMemberships.status,
          acceptedAt: schema.userTenantMemberships.acceptedAt,
          tenantId: schema.tenants.id,
          tenantPubId: schema.tenants.pubId,
          tenantSlug: schema.tenants.slug,
          tenantDisplayName: schema.tenants.displayName,
          tenantStatus: schema.tenants.status,
          tenantPlanTier: schema.tenants.planTier,
        })
        .from(schema.userTenantMemberships)
        .innerJoin(
          schema.tenants,
          eq(schema.userTenantMemberships.tenantId, schema.tenants.id),
        )
        .where(eq(schema.userTenantMemberships.userId, auth.userId));

      return reply.send({
        data: {
          memberships: rows.map((r) => ({
            membership_id: r.membershipId,
            persona: r.personaCode,
            status: r.status,
            accepted_at: r.acceptedAt,
            tenant: {
              id: r.tenantPubId,
              slug: r.tenantSlug,
              display_name: r.tenantDisplayName,
              status: r.tenantStatus,
              plan_tier: r.tenantPlanTier,
            },
          })),
          current_tenant_id: auth.tenantId || null,
        },
      });
    },
  );

  // ---------------------------------------------------------------------------
  // POST /api/{date}/auth/switch-tenant — re-issue JWT with new tenant context
  // ---------------------------------------------------------------------------
  app.post(
    '/api/2026-05-20/auth/switch-tenant',
    { preHandler: requireAuth },
    async (req, reply) => {
      const parsed = SwitchTenantBody.safeParse(req.body);
      if (!parsed.success) {
        return reply.code(422).send({
          error: { code: 'VALIDATION_FAILED', message: 'tenantId required' },
        });
      }
      const auth = req.auth!;
      const tenantRef = parsed.data.tenantId;

      // Accept either pub_id or UUID
      const [tenant] = await db
        .select({ id: schema.tenants.id, pubId: schema.tenants.pubId, displayName: schema.tenants.displayName })
        .from(schema.tenants)
        .where(tenantRef.startsWith('tnt_') ? eq(schema.tenants.pubId, tenantRef) : eq(schema.tenants.id, tenantRef))
        .limit(1);

      if (!tenant) {
        return reply.code(404).send({
          error: { code: 'TENANT_NOT_FOUND', message: 'Tenant does not exist' },
        });
      }

      // Verify membership
      const [membership] = await db
        .select({
          personaCode: schema.userTenantMemberships.personaCode,
          status: schema.userTenantMemberships.status,
        })
        .from(schema.userTenantMemberships)
        .where(
          and(
            eq(schema.userTenantMemberships.userId, auth.userId),
            eq(schema.userTenantMemberships.tenantId, tenant.id),
          ),
        )
        .limit(1);

      if (!membership || membership.status !== 'active') {
        return reply.code(403).send({
          error: { code: 'NOT_A_MEMBER', message: 'You are not a member of this tenant' },
        });
      }

      const personaCode = membership.personaCode;
      const permissions: readonly PermissionCode[] =
        personaCode && personaCode in PERSONAS
          ? PERSONAS[personaCode as PersonaCode].permissions
          : [];

      const { token: accessToken, expiresInSeconds } = await signAccessToken(
        {
          sub: auth.userId,
          tnt: tenant.id,
          permissions,
          scope: 'admin',
          assurance_level: auth.assuranceLevel,
          session_id: auth.sessionId,
        },
        config.SHOPIO_JWT_SECRET,
      );

      return reply.send({
        data: {
          access_token: accessToken,
          expires_in: expiresInSeconds,
          token_type: 'Bearer',
          tenant: {
            id: tenant.pubId,
            display_name: tenant.displayName,
          },
          persona: personaCode,
        },
      });
    },
  );

  // ---------------------------------------------------------------------------
  // GET /api/{date}/tenants/{tenantPubId}/members — list team
  // ---------------------------------------------------------------------------
  app.get<{ Params: { tenantPubId: string } }>(
    '/api/2026-05-20/tenants/:tenantPubId/members',
    { preHandler: requireAuth },
    async (req, reply) => {
      const auth = req.auth!;
      const { tenantPubId } = req.params;

      // Resolve tenant + verify membership
      const verify = await verifyTenantAccess(db, auth.userId, tenantPubId);
      if (!verify) {
        return reply.code(404).send({
          error: { code: 'TENANT_NOT_FOUND_OR_NOT_MEMBER', message: 'Tenant not found or you have no access' },
        });
      }

      // Members listing requires admin-tier permission
      if (!can(auth, PERMISSIONS.ADMIN_TEAM_MANAGE) && !can(auth, PERMISSIONS.ADMIN_FULL)) {
        return reply.code(403).send({
          error: {
            code: 'PERMISSION_DENIED',
            message: 'PERM-ADMIN-TEAM-MANAGE required',
          },
        });
      }

      const members = await db
        .select({
          membershipId: schema.userTenantMemberships.id,
          personaCode: schema.userTenantMemberships.personaCode,
          status: schema.userTenantMemberships.status,
          acceptedAt: schema.userTenantMemberships.acceptedAt,
          invitedAt: schema.userTenantMemberships.invitedAt,
          userId: schema.users.id,
          userPubId: schema.users.pubId,
          userEmail: schema.users.email,
          userFullName: schema.users.fullName,
        })
        .from(schema.userTenantMemberships)
        .innerJoin(schema.users, eq(schema.userTenantMemberships.userId, schema.users.id))
        .where(eq(schema.userTenantMemberships.tenantId, verify.tenantId));

      return reply.send({
        data: {
          members: members.map((m) => ({
            membership_id: m.membershipId,
            user: {
              id: m.userPubId,
              email: m.userEmail,
              full_name: m.userFullName,
            },
            persona: m.personaCode,
            status: m.status,
            accepted_at: m.acceptedAt,
            invited_at: m.invitedAt,
          })),
          count: members.length,
        },
      });
    },
  );

  // ---------------------------------------------------------------------------
  // POST /api/{date}/tenants/{tenantPubId}/members:invite
  // MVP simplification: instant active membership (no email flow yet)
  // ---------------------------------------------------------------------------
  app.post<{ Params: { tenantPubId: string } }>(
    '/api/2026-05-20/tenants/:tenantPubId/members:invite',
    { preHandler: requireAuth },
    async (req, reply) => {
      const auth = req.auth!;
      const { tenantPubId } = req.params;

      const parsed = InviteMemberBody.safeParse(req.body);
      if (!parsed.success) {
        return reply.code(422).send({
          error: {
            code: 'VALIDATION_FAILED',
            message: 'Invalid input',
            field_errors: parsed.error.flatten().fieldErrors,
          },
        });
      }
      const { email, personaCode } = parsed.data;

      // Verify caller can manage team
      const verify = await verifyTenantAccess(db, auth.userId, tenantPubId);
      if (!verify) {
        return reply.code(404).send({
          error: { code: 'TENANT_NOT_FOUND_OR_NOT_MEMBER', message: 'Tenant not found or no access' },
        });
      }
      if (!can(auth, PERMISSIONS.ADMIN_TEAM_MANAGE) && !can(auth, PERMISSIONS.ADMIN_FULL)) {
        return reply.code(403).send({
          error: { code: 'PERMISSION_DENIED', message: 'PERM-ADMIN-TEAM-MANAGE required' },
        });
      }

      // Validate persona
      if (!ASSIGNABLE_PERSONAS.includes(personaCode as PersonaCode)) {
        return reply.code(422).send({
          error: {
            code: 'INVALID_PERSONA',
            message: 'Persona not assignable via invite',
            allowed: ASSIGNABLE_PERSONAS,
          },
        });
      }

      // Look up invited user (MVP: must already exist)
      const [invited] = await db
        .select({ id: schema.users.id, pubId: schema.users.pubId, email: schema.users.email })
        .from(schema.users)
        .where(eq(schema.users.email, email))
        .limit(1);

      if (!invited) {
        return reply.code(404).send({
          error: {
            code: 'USER_NOT_FOUND',
            message: 'User with that email does not exist. MVP: invite flow only supports existing users.',
            todo: 'Email-based invite flow Fáze 1 wave 2',
          },
        });
      }

      // Check existing membership
      const [existing] = await db
        .select({ id: schema.userTenantMemberships.id, status: schema.userTenantMemberships.status })
        .from(schema.userTenantMemberships)
        .where(
          and(
            eq(schema.userTenantMemberships.tenantId, verify.tenantId),
            eq(schema.userTenantMemberships.userId, invited.id),
          ),
        )
        .limit(1);

      if (existing) {
        return reply.code(409).send({
          error: {
            code: 'ALREADY_MEMBER',
            message: 'User is already a member of this tenant',
            current_status: existing.status,
          },
        });
      }

      const [membership] = await db
        .insert(schema.userTenantMemberships)
        .values({
          tenantId: verify.tenantId,
          userId: invited.id,
          personaCode,
          status: 'active', // MVP: skip pending_acceptance
          acceptedAt: new Date(),
          invitedAt: new Date(),
          assignedByUserId: auth.userId,
        })
        .returning();

      app.log.info(
        { tenantId: verify.tenantId, invitedUserId: invited.id, persona: personaCode },
        'tenants.invite.success',
      );

      return reply.code(201).send({
        data: {
          membership_id: membership!.id,
          user: { id: invited.pubId, email: invited.email },
          persona: personaCode,
          status: 'active',
        },
      });
    },
  );
}

/**
 * Resolves a tenant pub_id to UUID and verifies the user has an ACTIVE membership.
 * Returns tenant UUID + membership info, or null.
 */
async function verifyTenantAccess(
  db: AppDb,
  userId: string,
  tenantPubId: string,
): Promise<{ tenantId: string; personaCode: string | null } | null> {
  const [row] = await db
    .select({
      tenantId: schema.tenants.id,
      personaCode: schema.userTenantMemberships.personaCode,
      membershipStatus: schema.userTenantMemberships.status,
    })
    .from(schema.tenants)
    .innerJoin(
      schema.userTenantMemberships,
      and(
        eq(schema.userTenantMemberships.tenantId, schema.tenants.id),
        eq(schema.userTenantMemberships.userId, userId),
      ),
    )
    .where(eq(schema.tenants.pubId, tenantPubId))
    .limit(1);

  if (!row || row.membershipStatus !== 'active') return null;
  return { tenantId: row.tenantId, personaCode: row.personaCode };
}

/**
 * Minimal slug helper. Production version per `05-naming-conventions.md` —
 * Fáze 1 wave 2: extract to shared package, handle Czech diacritics, conflicts, etc.
 */
function slugify(input: string): string {
  return input
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // strip diacritics
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .substring(0, 63);
}
