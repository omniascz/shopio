/**
 * Content extras — glossary + poll (Shoptet "Slovník pojmů" + "Anketa").
 * DB-backed: runs only with RUN_DB_TESTS=1.
 */

import { describe, expect, it, beforeAll, afterAll } from 'vitest';
import type { FastifyInstance } from 'fastify';

const enabled = process.env.RUN_DB_TESTS === '1';

describe.runIf(enabled)('content extras', () => {
  let app: FastifyInstance;
  const ts = Date.now();
  const H = (t: string) => ({ authorization: `Bearer ${t}` });
  let token = '';
  let slug = '';
  let pollPubId = '';

  beforeAll(async () => {
    process.env.LOG_LEVEL = 'fatal';
    const { buildServer } = await import('./server');
    app = await buildServer();
    const email = `ce-${ts}@example.com`;
    await app.inject({ method: 'POST', url: '/api/2026-05-20/auth/signup', payload: { email, password: 'CeHeslo2026!' } });
    token = (await app.inject({ method: 'POST', url: '/api/2026-05-20/auth/login', payload: { email, password: 'CeHeslo2026!' } })).json().data.access_token;
    slug = `ce-${ts}`;
    const ct = await app.inject({ method: 'POST', url: '/api/2026-05-20/tenants', headers: H(token), payload: { displayName: `CE ${ts}`, slug, countryCode: 'CZ' } });
    token = (await app.inject({ method: 'POST', url: '/api/2026-05-20/auth/switch-tenant', headers: H(token), payload: { tenantId: ct.json().data.tenant.id } })).json().data.access_token;
  }, 60_000);

  afterAll(async () => {
    await app?.close();
  });

  it('admin creates a glossary term, storefront lists it', async () => {
    const create = await app.inject({
      method: 'POST',
      url: '/api/2026-05-20/admin/glossary',
      headers: H(token),
      payload: { term: 'Kamenina', slug: 'kamenina', definitionHtml: '<p>Druh keramiky.</p>' },
    });
    expect(create.statusCode).toBe(201);
    const sf = await app.inject({ method: 'GET', url: `/api/2026-05-20/storefront/${slug}/glossary` });
    expect(sf.statusCode).toBe(200);
    expect(sf.json().data.terms.some((t: any) => t.slug === 'kamenina')).toBe(true);
  });

  it('admin creates a poll, storefront returns it as active', async () => {
    const create = await app.inject({
      method: 'POST',
      url: '/api/2026-05-20/admin/polls',
      headers: H(token),
      payload: { question: 'Oblíbená barva?', options: [{ key: 'cerna', label: 'Černá' }, { key: 'bila', label: 'Bílá' }] },
    });
    expect(create.statusCode).toBe(201);
    pollPubId = create.json().data.id;
    const sf = await app.inject({ method: 'GET', url: `/api/2026-05-20/storefront/${slug}/poll` });
    expect(sf.statusCode).toBe(200);
    expect(sf.json().data.poll.question).toBe('Oblíbená barva?');
    expect(sf.json().data.poll.options.length).toBe(2);
  });

  it('voting increments the chosen option', async () => {
    const vote = await app.inject({
      method: 'POST',
      url: `/api/2026-05-20/storefront/${slug}/polls/${pollPubId}/vote`,
      payload: { key: 'cerna' },
    });
    expect(vote.statusCode).toBe(200);
    const black = vote.json().data.options.find((o: any) => o.key === 'cerna');
    expect(black.votes).toBe(1);
  });

  it('voting for an unknown option is rejected', async () => {
    const vote = await app.inject({
      method: 'POST',
      url: `/api/2026-05-20/storefront/${slug}/polls/${pollPubId}/vote`,
      payload: { key: 'neexistuje' },
    });
    expect(vote.statusCode).toBe(422);
  });
});
