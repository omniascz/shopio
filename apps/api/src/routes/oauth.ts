/**
 * OAuth 2.0 apps + app marketplace (per `28-developer-platform.md`).
 *
 * Developer side (admin-authenticated):
 *   POST   /admin/oauth/apps                 — register an app (secret shown once)
 *   GET    /admin/oauth/apps                 — apps I registered
 *   DELETE /admin/oauth/apps/{pubId}
 *
 * Marketplace + install (admin-authenticated, per tenant):
 *   GET    /admin/apps                       — available apps to install
 *   GET    /admin/apps/installed             — apps this tenant has authorized
 *   DELETE /admin/apps/installed/{pubId}     — uninstall (revoke grant + tokens)
 *
 * Authorization-Code flow:
 *   GET    /oauth/authorize  (admin)         — consent metadata (app + scopes)
 *   POST   /oauth/authorize  (admin)         — approve → returns redirect w/ code
 *   POST   /oauth/token      (public)        — code→tokens, refresh→access
 */

import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { and, desc, eq } from 'drizzle-orm';
import { schema, withTenant } from '@shopio/db';
import { PERMISSIONS, generatePubId } from '@shopio/authz';
import { requirePermission } from '../plugins/auth-middleware';
import { getRlsDb } from '../db';
import type { AppDb } from '../db';
import type { ShopioConfig } from '../config';
import {
  ACCESS_TOKEN_TTL_SEC,
  ALL_SCOPES,
  AUTH_CODE_TTL_SEC,
  REFRESH_TOKEN_TTL_SEC,
  SCOPE_CATALOG,
  generateAccessToken,
  generateAuthCode,
  generateClientId,
  generateClientSecret,
  generateRefreshToken,
  hashToken,
  isValidScope,
  resolveClient,
  serializeApp,
} from '../lib/oauth';

interface PluginOptions {
  config: ShopioConfig;
  db: AppDb;
}

const guard = { preHandler: [requirePermission(PERMISSIONS.ADMIN_FULL)] };

const RegisterAppBody = z.object({
  name: z.string().min(1).max(120),
  description: z.string().max(500).nullable().optional(),
  redirectUris: z.array(z.string().url()).min(1).max(10),
  scopes: z.array(z.string()).min(1).max(ALL_SCOPES.length),
  iconUrl: z.string().url().nullable().optional(),
  websiteUrl: z.string().url().nullable().optional(),
});

export async function registerOAuthRoutes(app: FastifyInstance, opts: PluginOptions): Promise<void> {
  const { db, config } = opts;
  const rlsDb = getRlsDb(config);

  // ===== Scope catalog (for consent UIs) =====================================
  app.get('/api/2026-05-20/oauth/scopes', async (_req, reply) => {
    return reply.send({
      data: {
        scopes: Object.entries(SCOPE_CATALOG).map(([scope, v]) => ({ scope, label: v.label })),
      },
    });
  });

  // ===== Developer: app registration (global apps) ===========================
  app.post('/api/2026-05-20/admin/oauth/apps', guard, async (req, reply) => {
    const parsed = RegisterAppBody.safeParse(req.body);
    if (!parsed.success) return validationErr(reply, parsed.error);
    const i = parsed.data;
    const bad = i.scopes.find((s) => !isValidScope(s));
    if (bad) {
      return reply.code(422).send({ error: { code: 'UNKNOWN_SCOPE', message: `Neznámý scope: ${bad}` } });
    }
    const clientId = generateClientId();
    const secret = generateClientSecret();
    const [row] = await db
      .insert(schema.oauthApps)
      .values({
        pubId: generatePubId('oac'),
        name: i.name,
        description: i.description ?? null,
        clientId,
        clientSecretHash: secret.hash,
        clientSecretHint: secret.hint,
        redirectUris: i.redirectUris,
        scopes: i.scopes,
        iconUrl: i.iconUrl ?? null,
        websiteUrl: i.websiteUrl ?? null,
        ownerUserId: req.auth!.userId ?? null,
      })
      .returning();
    return reply.code(201).send({
      data: {
        ...serializeApp(row!, true),
        // The client secret is shown ONCE here.
        client_secret: secret.raw,
      },
    });
  });

  app.get('/api/2026-05-20/admin/oauth/apps', guard, async (req, reply) => {
    const ownerId = req.auth!.userId;
    const rows = await db
      .select()
      .from(schema.oauthApps)
      .where(eq(schema.oauthApps.ownerUserId, ownerId))
      .orderBy(desc(schema.oauthApps.createdAt));
    return reply.send({ data: { apps: rows.map((r) => serializeApp(r, true)) } });
  });

  app.delete<{ Params: { pubId: string } }>(
    '/api/2026-05-20/admin/oauth/apps/:pubId',
    guard,
    async (req, reply) => {
      const [row] = await db
        .delete(schema.oauthApps)
        .where(
          and(
            eq(schema.oauthApps.pubId, req.params.pubId),
            eq(schema.oauthApps.ownerUserId, req.auth!.userId),
          ),
        )
        .returning({ id: schema.oauthApps.id });
      if (!row) return notFound(reply, 'APP_NOT_FOUND');
      return reply.code(204).send();
    },
  );

  // ===== Marketplace: available apps ========================================
  app.get('/api/2026-05-20/admin/apps', guard, async (_req, reply) => {
    const rows = await db
      .select()
      .from(schema.oauthApps)
      .where(eq(schema.oauthApps.status, 'active'))
      .orderBy(desc(schema.oauthApps.createdAt))
      .limit(200);
    return reply.send({ data: { apps: rows.map((r) => serializeApp(r)) } });
  });

  // ===== Installed apps (per tenant) ========================================
  app.get('/api/2026-05-20/admin/apps/installed', guard, async (req, reply) => {
    const tenantId = req.auth!.tenantId;
    if (!tenantId) return noTenant(reply);
    const rows = await withTenant(rlsDb, tenantId, (tx) =>
      tx
        .select({
          pubId: schema.oauthAuthorizations.pubId,
          scopes: schema.oauthAuthorizations.scopes,
          createdAt: schema.oauthAuthorizations.createdAt,
          appName: schema.oauthApps.name,
          appPubId: schema.oauthApps.pubId,
          iconUrl: schema.oauthApps.iconUrl,
        })
        .from(schema.oauthAuthorizations)
        .innerJoin(schema.oauthApps, eq(schema.oauthApps.id, schema.oauthAuthorizations.appId))
        .where(
          and(
            eq(schema.oauthAuthorizations.tenantId, tenantId),
            eq(schema.oauthAuthorizations.status, 'active'),
          ),
        )
        .orderBy(desc(schema.oauthAuthorizations.createdAt)),
    );
    return reply.send({
      data: {
        installed: rows.map((r) => ({
          id: r.pubId,
          app_id: r.appPubId,
          name: r.appName,
          icon_url: r.iconUrl,
          scopes: r.scopes,
          installed_at: r.createdAt,
        })),
      },
    });
  });

  app.delete<{ Params: { pubId: string } }>(
    '/api/2026-05-20/admin/apps/installed/:pubId',
    guard,
    async (req, reply) => {
      const tenantId = req.auth!.tenantId;
      if (!tenantId) return noTenant(reply);
      const ok = await withTenant(rlsDb, tenantId, async (tx) => {
        const [authz] = await tx
          .update(schema.oauthAuthorizations)
          .set({ status: 'revoked', revokedAt: new Date() })
          .where(
            and(
              eq(schema.oauthAuthorizations.tenantId, tenantId),
              eq(schema.oauthAuthorizations.pubId, req.params.pubId),
              eq(schema.oauthAuthorizations.status, 'active'),
            ),
          )
          .returning({ id: schema.oauthAuthorizations.id });
        if (!authz) return false;
        // Revoke all tokens issued under this authorization.
        await tx
          .update(schema.oauthTokens)
          .set({ revokedAt: new Date() })
          .where(eq(schema.oauthTokens.authorizationId, authz.id));
        return true;
      });
      if (!ok) return notFound(reply, 'INSTALL_NOT_FOUND');
      return reply.code(204).send();
    },
  );

  // ===== Authorization-Code flow ============================================
  // GET /oauth/authorize — the merchant admin is authenticated (JWT); returns
  // the app + requested scopes so the admin SPA can render a consent screen.
  const AuthorizeQuery = z.object({
    client_id: z.string(),
    redirect_uri: z.string().url(),
    scope: z.string(), // space-separated
    state: z.string().max(500).optional(),
    code_challenge: z.string().max(200).optional(),
  });

  app.get('/api/2026-05-20/oauth/authorize', guard, async (req, reply) => {
    const parsed = AuthorizeQuery.safeParse(req.query);
    if (!parsed.success) return validationErr(reply, parsed.error);
    const checked = await validateAuthorizeRequest(db, parsed.data);
    if ('error' in checked) {
      return reply.code(checked.code).send({ error: { code: checked.error, message: checked.message } });
    }
    return reply.send({
      data: {
        app: serializeApp(checked.app),
        requested_scopes: checked.scopes.map((s) => ({ scope: s, label: SCOPE_CATALOG[s]?.label ?? s })),
        redirect_uri: parsed.data.redirect_uri,
        state: parsed.data.state ?? null,
      },
    });
  });

  // POST /oauth/authorize — the admin approves; we persist the install + mint a
  // single-use authorization code bound to the app + tenant + scopes + redirect.
  app.post('/api/2026-05-20/oauth/authorize', guard, async (req, reply) => {
    const tenantId = req.auth!.tenantId;
    if (!tenantId) return noTenant(reply);
    const parsed = AuthorizeQuery.safeParse(req.body);
    if (!parsed.success) return validationErr(reply, parsed.error);
    const checked = await validateAuthorizeRequest(db, parsed.data);
    if ('error' in checked) {
      return reply.code(checked.code).send({ error: { code: checked.error, message: checked.message } });
    }

    const code = generateAuthCode();
    const redirect = await withTenant(rlsDb, tenantId, async (tx) => {
      // Upsert the install record (one active authorization per tenant+app).
      const [existing] = await tx
        .select({ id: schema.oauthAuthorizations.id })
        .from(schema.oauthAuthorizations)
        .where(
          and(
            eq(schema.oauthAuthorizations.tenantId, tenantId),
            eq(schema.oauthAuthorizations.appId, checked.app.id),
            eq(schema.oauthAuthorizations.status, 'active'),
          ),
        )
        .limit(1);
      let authorizationId: string;
      if (existing) {
        await tx
          .update(schema.oauthAuthorizations)
          .set({ scopes: checked.scopes })
          .where(eq(schema.oauthAuthorizations.id, existing.id));
        authorizationId = existing.id;
      } else {
        const [created] = await tx
          .insert(schema.oauthAuthorizations)
          .values({
            tenantId,
            pubId: generatePubId('oai'),
            appId: checked.app.id,
            scopes: checked.scopes,
            createdByUserId: req.auth!.userId ?? null,
          })
          .returning({ id: schema.oauthAuthorizations.id });
        authorizationId = created!.id;
      }
      await tx.insert(schema.oauthAuthCodes).values({
        tenantId,
        codeHash: code.hash,
        appId: checked.app.id,
        authorizationId,
        scopes: checked.scopes,
        redirectUri: parsed.data.redirect_uri,
        codeChallenge: parsed.data.code_challenge ?? null,
        userId: req.auth!.userId ?? null,
        expiresAt: new Date(Date.now() + AUTH_CODE_TTL_SEC * 1000),
      });
      const u = new URL(parsed.data.redirect_uri);
      u.searchParams.set('code', code.raw);
      if (parsed.data.state) u.searchParams.set('state', parsed.data.state);
      return u.toString();
    });

    return reply.send({ data: { redirect_to: redirect } });
  });

  // POST /oauth/token — public token endpoint. Client auth via client_id+secret.
  app.post('/api/2026-05-20/oauth/token', async (req, reply) => {
    const body = (req.body ?? {}) as Record<string, unknown>;
    const grantType = String(body.grant_type ?? '');
    const clientId = String(body.client_id ?? '');
    const clientSecret = String(body.client_secret ?? '');
    const app2 = await resolveClient(db, clientId, clientSecret);
    if (!app2) {
      return reply.code(401).send({ error: 'invalid_client', error_description: 'Bad client credentials' });
    }

    if (grantType === 'authorization_code') {
      const codeRaw = String(body.code ?? '');
      const redirectUri = String(body.redirect_uri ?? '');
      const [codeRow] = await db
        .select()
        .from(schema.oauthAuthCodes)
        .where(eq(schema.oauthAuthCodes.codeHash, hashToken(codeRaw)))
        .limit(1);
      if (
        !codeRow ||
        codeRow.appId !== app2.id ||
        codeRow.usedAt ||
        codeRow.expiresAt.getTime() <= Date.now() ||
        codeRow.redirectUri !== redirectUri
      ) {
        return reply.code(400).send({ error: 'invalid_grant', error_description: 'Bad or expired code' });
      }
      // Consume the code + issue tokens (in the code's tenant scope).
      const tokens = await withTenant(rlsDb, codeRow.tenantId, async (tx) => {
        await tx
          .update(schema.oauthAuthCodes)
          .set({ usedAt: new Date() })
          .where(eq(schema.oauthAuthCodes.id, codeRow.id));
        return issueTokenPair(tx, codeRow.tenantId, app2.id, codeRow.authorizationId, codeRow.scopes);
      });
      return reply.send(tokens);
    }

    if (grantType === 'refresh_token') {
      const refreshRaw = String(body.refresh_token ?? '');
      const [tok] = await db
        .select()
        .from(schema.oauthTokens)
        .where(eq(schema.oauthTokens.refreshTokenHash, hashToken(refreshRaw)))
        .limit(1);
      if (
        !tok ||
        tok.appId !== app2.id ||
        tok.revokedAt ||
        tok.refreshExpiresAt.getTime() <= Date.now()
      ) {
        return reply.code(400).send({ error: 'invalid_grant', error_description: 'Bad or expired refresh token' });
      }
      const tokens = await withTenant(rlsDb, tok.tenantId, async (tx) => {
        // Rotate: revoke the old token, issue a fresh pair.
        await tx
          .update(schema.oauthTokens)
          .set({ revokedAt: new Date() })
          .where(eq(schema.oauthTokens.id, tok.id));
        return issueTokenPair(tx, tok.tenantId, app2.id, tok.authorizationId, tok.scopes);
      });
      return reply.send(tokens);
    }

    return reply.code(400).send({ error: 'unsupported_grant_type' });
  });
}

/** Validate a client_id + redirect_uri + scope request against the app. */
async function validateAuthorizeRequest(
  db: AppDb,
  q: { client_id: string; redirect_uri: string; scope: string },
): Promise<
  | { app: typeof schema.oauthApps.$inferSelect; scopes: string[] }
  | { error: string; message: string; code: number }
> {
  const [app] = await db
    .select()
    .from(schema.oauthApps)
    .where(and(eq(schema.oauthApps.clientId, q.client_id), eq(schema.oauthApps.status, 'active')))
    .limit(1);
  if (!app) return { error: 'INVALID_CLIENT', message: 'Neznámá aplikace', code: 404 };
  if (!app.redirectUris.includes(q.redirect_uri)) {
    return { error: 'INVALID_REDIRECT_URI', message: 'redirect_uri neodpovídá registraci', code: 400 };
  }
  const requested = q.scope.split(/\s+/).filter(Boolean);
  if (requested.length === 0) {
    return { error: 'INVALID_SCOPE', message: 'Chybí scope', code: 400 };
  }
  for (const s of requested) {
    if (!isValidScope(s)) return { error: 'INVALID_SCOPE', message: `Neznámý scope: ${s}`, code: 400 };
    if (!app.scopes.includes(s)) {
      return { error: 'INVALID_SCOPE', message: `Aplikace nemá povolen scope: ${s}`, code: 400 };
    }
  }
  return { app, scopes: requested };
}

/** Mint an access+refresh token pair under an authorization. Returns the OAuth
 *  token response body (raw tokens shown once). */
async function issueTokenPair(
  tx: Parameters<Parameters<ReturnType<typeof getRlsDb>['transaction']>[0]>[0],
  tenantId: string,
  appId: string,
  authorizationId: string,
  scopes: string[],
): Promise<Record<string, unknown>> {
  const access = generateAccessToken();
  const refresh = generateRefreshToken();
  await tx.insert(schema.oauthTokens).values({
    tenantId,
    appId,
    authorizationId,
    accessTokenHash: access.hash,
    refreshTokenHash: refresh.hash,
    scopes,
    accessExpiresAt: new Date(Date.now() + ACCESS_TOKEN_TTL_SEC * 1000),
    refreshExpiresAt: new Date(Date.now() + REFRESH_TOKEN_TTL_SEC * 1000),
  });
  return {
    access_token: access.raw,
    refresh_token: refresh.raw,
    token_type: 'Bearer',
    expires_in: ACCESS_TOKEN_TTL_SEC,
    scope: scopes.join(' '),
  };
}

function noTenant(reply: any) {
  return reply.code(400).send({ error: { code: 'NO_ACTIVE_TENANT', message: 'Select a tenant first' } });
}
function notFound(reply: any, code: string) {
  return reply.code(404).send({ error: { code, message: 'Not found' } });
}
function validationErr(reply: any, error: z.ZodError) {
  return reply.code(422).send({
    error: { code: 'VALIDATION_FAILED', message: 'Invalid input', field_errors: error.flatten().fieldErrors },
  });
}
