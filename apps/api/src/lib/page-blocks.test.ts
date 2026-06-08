/**
 * Tests for the page-builder block model (per `32`). Validation + the
 * db-free resolution paths (sanitize, passthrough). Product/category expansion
 * is covered by the app.inject smoke.
 */

import { describe, expect, it } from 'vitest';
import { BlocksSchema, resolveBlocks } from './page-blocks';

// resolveBlocks only touches the db for product_grid/featured_category; the
// blocks below never reach it, so a throwing stub proves that.
const noDb = new Proxy({}, { get() { throw new Error('db should not be touched'); } }) as never;

describe('BlocksSchema', () => {
  it('accepts a valid mixed block list', () => {
    const r = BlocksSchema.safeParse([
      { id: 'a', type: 'hero', headline: 'Hi', align: 'left' },
      { id: 'b', type: 'spacer', size: 'lg' },
      { id: 'c', type: 'product_grid', title: 'New', productSlugs: ['x', 'y'] },
    ]);
    expect(r.success).toBe(true);
  });

  it('rejects an unknown block type', () => {
    const r = BlocksSchema.safeParse([{ id: 'a', type: 'carousel' }]);
    expect(r.success).toBe(false);
  });

  it('applies defaults', () => {
    const r = BlocksSchema.parse([{ id: 'a', type: 'hero' }]);
    expect(r[0]).toMatchObject({ align: 'center', headline: '', imageUrl: null });
  });
});

describe('resolveBlocks (db-free paths)', () => {
  it('sanitizes rich_text html', async () => {
    const out = await resolveBlocks(noDb, 't1', [
      { id: 'a', type: 'rich_text', html: '<p>Hi</p><script>alert(1)</script><b onclick="x()">y</b>' },
    ]);
    expect(out[0].html).toBe('<p>Hi</p><b>y</b>');
  });

  it('passes hero/spacer/newsletter through', async () => {
    const out = await resolveBlocks(noDb, 't1', [
      { id: 'a', type: 'hero', headline: 'H' },
      { id: 'b', type: 'spacer', size: 'sm' },
      { id: 'c', type: 'newsletter', headline: 'Sub' },
    ]);
    expect(out).toHaveLength(3);
    expect(out[0].type).toBe('hero');
  });

  it('returns [] for invalid input', async () => {
    expect(await resolveBlocks(noDb, 't1', { not: 'an array' })).toEqual([]);
    expect(await resolveBlocks(noDb, 't1', [{ id: 'a', type: 'bogus' }])).toEqual([]);
  });

  it('empty product_grid needs no db', async () => {
    const out = await resolveBlocks(noDb, 't1', [
      { id: 'a', type: 'product_grid', productSlugs: [] },
    ]);
    expect(out[0].products).toEqual([]);
  });
});
