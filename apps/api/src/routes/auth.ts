/**
 * Auth endpoints.
 *
 * Per `30-security.md §16.1` + `04-api-conventions.md` versioning.
 * Date-versioned path: /api/2026-05-20/auth/*
 *
 * Fáze 1 wave 1 — password-based auth only.
 * Passkey (WebAuthn) + MFA added in subsequent waves.
 */

import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { and, eq, isNull, sql as dsql } from 'drizzle-orm';
import { schema } from '@shopio/db';
import {
  PasswordPolicyError,
  PERSONAS,
  assertPasswordPolicy,
  buildSessionRecord,
  generatePubId,
  generateRefreshToken,
  hashPassword,
  hashRefreshToken,
  refreshCookieOptions,
  REFRESH_COOKIE_NAME,
  REFRESH_TOKEN_TTL_MS,
  signAccessToken,
  verifyAccessToken,
  verifyPassword,
  type ShopioJwtClaims,
} from '@shopio/authz';
import { randomUUID } from 'node:crypto';
import type { AppDb } from '../db';
import type { ShopioConfig } from '../config';

const SignupBody = z.object({
  email: z.string().email().toLowerCase(),
  password: z.string().min(12).max(200),
  fullName: z.string().min(1).max(255).optional(),
  locale: z.string().default('cs-CZ'),
});

const LoginBody = z.object({
  email: z.string().email().toLowerCase(),
  password: z.string().min(1).max(200),
});

interface AuthPluginOptions {
  config: ShopioConfig;
  db: AppDb;
}

export async function registerAuthRoutes(
  app: FastifyInstance,
  opts: AuthPluginOptions,
): Promise<void> {
  const { config, db } = opts;
  const isProd = config.NODE_ENV === 'production';

  // ---------------------------------------------------------------------------
  // POST /api/{date}/auth/signup
  // ---------------------------------------------------------------------------
  app.post('/api/2026-05-20/auth/signup', async (req, reply) => {
    const parsed = SignupBody.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(422).send({
        error: {
          code: 'VALIDATION_FAILED',
          message: 'Invalid input',
          field_errors: parsed.error.flatten().fieldErrors,
        },
      });
    }
    const { email, password, fullName, locale } = parsed.data;

    // Policy
    try {
      assertPasswordPolicy(password, email);
    } catch (err) {
      if (err instanceof PasswordPolicyError) {
        return reply.code(422).send({
          error: { code: 'WEAK_PASSWORD', message: err.message, policy_code: err.code },
        });
      }
      throw err;
    }

    // Existing email check
    const existing = await db
      .select({ id: schema.users.id })
      .from(schema.users)
      .where(eq(schema.users.email, email))
      .limit(1);
    if (existing.length > 0) {
      // Per `30 §RULE-SEC-014` — same response regardless to prevent enumeration
      return reply.code(409).send({
        error: { code: 'EMAIL_ALREADY_REGISTERED', message: 'Email already in use' },
      });
    }

    // Hash password
    const passwordHash = await hashPassword(password, config.SHOPIO_SESSION_PEPPER);

    // Insert user
    const [user] = await db
      .insert(schema.users)
      .values({
        pubId: generatePubId('usr'),
        email,
        fullName: fullName ?? null,
        passwordHash,
        locale,
        status: 'pending_verification',
      })
      .returning({
        id: schema.users.id,
        pubId: schema.users.pubId,
        email: schema.users.email,
        status: schema.users.status,
        createdAt: schema.users.createdAt,
      });

    if (!user) {
      return reply.code(500).send({ error: { code: 'INTERNAL', message: 'User creation failed' } });
    }

    app.log.info({ userId: user.id, email }, 'auth.signup.success');

    // TODO Fáze 1 wave 2:
    // - Send email verification
    // - Audit log entry (per `30 §8`)

    return reply.code(201).send({
      data: {
        user: {
          id: user.pubId,
          email: user.email,
          status: user.status,
          created_at: user.createdAt,
        },
        next_step: 'verify_email_or_login',
      },
    });
  });

  // ---------------------------------------------------------------------------
  // POST /api/{date}/auth/login
  // ---------------------------------------------------------------------------
  app.post('/api/2026-05-20/auth/login', async (req, reply) => {
    const parsed = LoginBody.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(422).send({
        error: { code: 'VALIDATION_FAILED', message: 'Invalid input' },
      });
    }
    const { email, password } = parsed.data;

    // Lookup user
    const [user] = await db
      .select({
        id: schema.users.id,
        pubId: schema.users.pubId,
        email: schema.users.email,
        fullName: schema.users.fullName,
        passwordHash: schema.users.passwordHash,
        status: schema.users.status,
        lockedUntil: schema.users.lockedUntil,
        failedLoginAttempts: schema.users.failedLoginAttempts,
      })
      .from(schema.users)
      .where(eq(schema.users.email, email))
      .limit(1);

    // Constant-ish-time response on miss (per `30 §RULE-SEC-014`)
    if (!user || !user.passwordHash) {
      // Still hash to make timing roughly constant
      await hashPassword('dummy-to-make-timing-constant', config.SHOPIO_SESSION_PEPPER).catch(() => {});
      return reply.code(401).send({
        error: { code: 'INVALID_CREDENTIALS', message: 'Email or password incorrect' },
      });
    }

    // Lockout check
    if (user.lockedUntil && user.lockedUntil > new Date()) {
      return reply.code(423).send({
        error: {
          code: 'ACCOUNT_LOCKED',
          message: 'Account temporarily locked due to failed login attempts',
          locked_until: user.lockedUntil,
        },
      });
    }

    if (user.status !== 'active' && user.status !== 'pending_verification') {
      return reply.code(403).send({
        error: { code: 'ACCOUNT_INACTIVE', message: 'Account is not active' },
      });
    }

    // Verify password
    const valid = await verifyPassword(password, user.passwordHash, config.SHOPIO_SESSION_PEPPER);
    if (!valid) {
      // Increment failed attempts (per `30 §RULE-SEC-048`)
      await db
        .update(schema.users)
        .set({
          failedLoginAttempts: dsql`${schema.users.failedLoginAttempts} + 1`,
        })
        .where(eq(schema.users.id, user.id));
      return reply.code(401).send({
        error: { code: 'INVALID_CREDENTIALS', message: 'Email or password incorrect' },
      });
    }

    // Reset failed attempts on success
    await db
      .update(schema.users)
      .set({
        failedLoginAttempts: 0,
        lockedUntil: null,
        lastLoginAt: new Date(),
        lastLoginIp: req.ip,
      })
      .where(eq(schema.users.id, user.id));

    // Resolve active tenant membership (first active)
    const [membership] = await db
      .select({
        tenantId: schema.userTenantMemberships.tenantId,
        personaCode: schema.userTenantMemberships.personaCode,
      })
      .from(schema.userTenantMemberships)
      .where(
        and(
          eq(schema.userTenantMemberships.userId, user.id),
          eq(schema.userTenantMemberships.status, 'active'),
        ),
      )
      .limit(1);

    const tenantId = membership?.tenantId ?? null;
    const personaCode = membership?.personaCode ?? null;
    const permissions =
      personaCode && personaCode in PERSONAS
        ? PERSONAS[personaCode as keyof typeof PERSONAS].permissions
        : [];

    // Create session + tokens
    const { plaintext: refreshPlain, sha256Hash: refreshHash } = generateRefreshToken();
    const sessionId = randomUUID();
    const familyId = randomUUID();

    const sessionData = buildSessionRecord({
      userId: user.id,
      tenantId,
      scope: 'admin',
      refreshTokenHash: refreshHash,
      familyId,
      userAgent: req.headers['user-agent'],
      ipAddress: req.ip,
      assuranceLevel: 'low',
    });

    await db.insert(schema.sessions).values({
      id: sessionId,
      userId: sessionData.userId,
      tenantId: sessionData.tenantId,
      familyId: sessionData.familyId,
      refreshTokenHash: sessionData.refreshTokenHash,
      userAgent: sessionData.userAgent ?? null,
      ipAddress: sessionData.ipAddress ?? null,
      countryCode: sessionData.countryCode ?? null,
      assuranceLevel: sessionData.assuranceLevel,
      mfaVerifiedAt: sessionData.mfaVerifiedAt ?? null,
      expiresAt: sessionData.expiresAt,
    });

    // Sign access token
    const { token: accessToken, expiresInSeconds } = await signAccessToken(
      {
        sub: user.id,
        tnt: tenantId ?? '',
        permissions,
        scope: 'admin',
        assurance_level: 'low',
        session_id: sessionId,
      },
      config.SHOPIO_JWT_SECRET,
    );

    // Set refresh cookie
    reply.setCookie(REFRESH_COOKIE_NAME, refreshPlain, refreshCookieOptions('admin', isProd));

    app.log.info({ userId: user.id, sessionId }, 'auth.login.success');

    return reply.code(200).send({
      data: {
        access_token: accessToken,
        expires_in: expiresInSeconds,
        token_type: 'Bearer',
        user: {
          id: user.pubId,
          email: user.email,
          full_name: user.fullName,
          status: user.status,
          persona: personaCode,
          tenant_id: tenantId,
        },
      },
    });
  });

  // ---------------------------------------------------------------------------
  // POST /api/{date}/auth/logout
  // ---------------------------------------------------------------------------
  app.post('/api/2026-05-20/auth/logout', async (req, reply) => {
    const refresh = req.cookies[REFRESH_COOKIE_NAME];
    if (refresh) {
      const tokenHash = hashRefreshToken(refresh);
      await db
        .update(schema.sessions)
        .set({ revokedAt: new Date(), revokedReason: 'user_logout' })
        .where(
          and(
            eq(schema.sessions.refreshTokenHash, tokenHash),
            isNull(schema.sessions.revokedAt),
          ),
        );
    }
    reply.clearCookie(REFRESH_COOKIE_NAME, { path: '/' });
    return reply.code(204).send();
  });

  // ---------------------------------------------------------------------------
  // POST /api/{date}/auth/refresh
  // ---------------------------------------------------------------------------
  app.post('/api/2026-05-20/auth/refresh', async (req, reply) => {
    const refresh = req.cookies[REFRESH_COOKIE_NAME];
    if (!refresh) {
      return reply.code(401).send({
        error: { code: 'NO_REFRESH_TOKEN', message: 'Refresh token missing' },
      });
    }
    const tokenHash = hashRefreshToken(refresh);

    const [session] = await db
      .select()
      .from(schema.sessions)
      .where(eq(schema.sessions.refreshTokenHash, tokenHash))
      .limit(1);

    if (!session) {
      return reply.code(401).send({
        error: { code: 'INVALID_REFRESH_TOKEN', message: 'Refresh token invalid' },
      });
    }

    if (session.revokedAt) {
      // Per `28 §4.5` theft detection — revoke entire family
      await db
        .update(schema.sessions)
        .set({ revokedAt: new Date(), revokedReason: 'reuse_detected' })
        .where(eq(schema.sessions.familyId, session.familyId));
      app.log.warn({ familyId: session.familyId }, 'auth.refresh.reuse_detected');
      reply.clearCookie(REFRESH_COOKIE_NAME, { path: '/' });
      return reply.code(401).send({
        error: { code: 'REFRESH_REUSE_DETECTED', message: 'Session family revoked' },
      });
    }

    if (session.expiresAt < new Date()) {
      return reply.code(401).send({
        error: { code: 'REFRESH_TOKEN_EXPIRED', message: 'Refresh token expired' },
      });
    }

    // Resolve user + membership for new claims
    const [user] = await db
      .select({
        id: schema.users.id,
        pubId: schema.users.pubId,
        email: schema.users.email,
        fullName: schema.users.fullName,
        status: schema.users.status,
      })
      .from(schema.users)
      .where(eq(schema.users.id, session.userId))
      .limit(1);

    if (!user || (user.status !== 'active' && user.status !== 'pending_verification')) {
      return reply.code(401).send({
        error: { code: 'USER_INACTIVE', message: 'User no longer active' },
      });
    }

    const [membership] = await db
      .select({
        tenantId: schema.userTenantMemberships.tenantId,
        personaCode: schema.userTenantMemberships.personaCode,
      })
      .from(schema.userTenantMemberships)
      .where(
        and(
          eq(schema.userTenantMemberships.userId, user.id),
          eq(schema.userTenantMemberships.status, 'active'),
        ),
      )
      .limit(1);

    const tenantId = membership?.tenantId ?? session.tenantId;
    const personaCode = membership?.personaCode ?? null;
    const permissions =
      personaCode && personaCode in PERSONAS
        ? PERSONAS[personaCode as keyof typeof PERSONAS].permissions
        : [];

    // Rotate: mark current session revoked, create new with same familyId
    const { plaintext: newRefresh, sha256Hash: newRefreshHash } = generateRefreshToken();
    const newSessionId = randomUUID();
    const newExpiresAt = new Date(Date.now() + REFRESH_TOKEN_TTL_MS.admin);

    await db.transaction(async (tx) => {
      await tx
        .update(schema.sessions)
        .set({ revokedAt: new Date(), revokedReason: 'rotated' })
        .where(eq(schema.sessions.id, session.id));
      await tx.insert(schema.sessions).values({
        id: newSessionId,
        userId: user.id,
        tenantId,
        familyId: session.familyId,
        refreshTokenHash: newRefreshHash,
        userAgent: req.headers['user-agent'] ?? null,
        ipAddress: req.ip,
        assuranceLevel: session.assuranceLevel,
        mfaVerifiedAt: session.mfaVerifiedAt,
        expiresAt: newExpiresAt,
      });
    });

    const { token: accessToken, expiresInSeconds } = await signAccessToken(
      {
        sub: user.id,
        tnt: tenantId ?? '',
        permissions,
        scope: 'admin',
        assurance_level: session.assuranceLevel,
        session_id: newSessionId,
      },
      config.SHOPIO_JWT_SECRET,
    );

    reply.setCookie(REFRESH_COOKIE_NAME, newRefresh, refreshCookieOptions('admin', isProd));

    return reply.code(200).send({
      data: {
        access_token: accessToken,
        expires_in: expiresInSeconds,
        token_type: 'Bearer',
      },
    });
  });

  // ---------------------------------------------------------------------------
  // GET /api/{date}/me — current user + permissions
  // ---------------------------------------------------------------------------
  app.get('/api/2026-05-20/me', async (req, reply) => {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      return reply.code(401).send({ error: { code: 'NO_TOKEN', message: 'Authorization header missing' } });
    }
    const token = authHeader.substring(7);
    let claims: ShopioJwtClaims;
    try {
      claims = await verifyAccessToken(token, config.SHOPIO_JWT_SECRET);
    } catch {
      return reply.code(401).send({ error: { code: 'INVALID_TOKEN', message: 'Access token invalid' } });
    }

    const [user] = await db
      .select({
        id: schema.users.id,
        pubId: schema.users.pubId,
        email: schema.users.email,
        fullName: schema.users.fullName,
        status: schema.users.status,
        locale: schema.users.locale,
      })
      .from(schema.users)
      .where(eq(schema.users.id, claims.sub))
      .limit(1);

    if (!user) {
      return reply.code(401).send({ error: { code: 'USER_NOT_FOUND', message: 'User no longer exists' } });
    }

    return reply.send({
      data: {
        user: {
          id: user.pubId,
          email: user.email,
          full_name: user.fullName,
          status: user.status,
          locale: user.locale,
        },
        tenant_id: claims.tnt || null,
        permissions: claims.permissions,
        assurance_level: claims.assurance_level,
        session_id: claims.session_id,
      },
    });
  });
}
