/**
 * Tests for the page-builder block model (per `32`). Validation + the
 * db-free resolution paths (sanitize, passthrough, video embed, columns
 * recursion). Product/category/buy_button expansion is covered by the
 * app.inject smoke (they touch the db).
 */

import { describe, expect, it } from 'vitest';
import { BlocksSchema, SectionBlocksSchema, resolveBlocks, toEmbedUrl } from './page-blocks';

// resolveBlocks only touches the db for product_grid/featured_category/buy_button;
// the blocks below never reach it, so a throwing stub proves that.
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

  it('accepts the new PageFlow-parity blocks', () => {
    const r = BlocksSchema.safeParse([
      { id: 'h', type: 'heading', text: 'Nadpis', level: 'h3' },
      { id: 'bt', type: 'button', label: 'Klik', href: '/akce' },
      { id: 'bb', type: 'buy_button', productSlug: 'hrnek' },
      { id: 'g', type: 'gallery', columns: 3, images: [{ url: 'https://x/1.jpg' }] },
      { id: 'v', type: 'video', provider: 'youtube', url: 'https://youtu.be/abcdef' },
      { id: 'f', type: 'faq', items: [{ q: 'Otázka?', a: 'Odpověď.' }] },
      { id: 't', type: 'testimonial', quote: 'Super', author: 'Jana' },
    ]);
    expect(r.success).toBe(true);
  });

  it('accepts a columns block with leaf children', () => {
    const r = BlocksSchema.safeParse([
      {
        id: 'col',
        type: 'columns',
        columns: 2,
        children: [
          { id: 'c1', type: 'heading', text: 'Levý' },
          { id: 'c2', type: 'rich_text', html: '<p>Pravý</p>' },
        ],
      },
    ]);
    expect(r.success).toBe(true);
  });

  it('rejects nested columns (one level deep only)', () => {
    const r = BlocksSchema.safeParse([
      {
        id: 'col',
        type: 'columns',
        children: [{ id: 'inner', type: 'columns', children: [] }],
      },
    ]);
    expect(r.success).toBe(false);
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

describe('toEmbedUrl', () => {
  it('normalizes YouTube watch/short/embed URLs', () => {
    expect(toEmbedUrl('youtube', 'https://www.youtube.com/watch?v=dQw4w9WgXcQ')).toBe(
      'https://www.youtube.com/embed/dQw4w9WgXcQ',
    );
    expect(toEmbedUrl('youtube', 'https://youtu.be/dQw4w9WgXcQ')).toBe(
      'https://www.youtube.com/embed/dQw4w9WgXcQ',
    );
    expect(toEmbedUrl('youtube', 'https://youtube.com/shorts/dQw4w9WgXcQ')).toBe(
      'https://www.youtube.com/embed/dQw4w9WgXcQ',
    );
  });

  it('normalizes Vimeo URLs', () => {
    expect(toEmbedUrl('vimeo', 'https://vimeo.com/123456789')).toBe(
      'https://player.vimeo.com/video/123456789',
    );
  });

  it('passes file URLs through unchanged', () => {
    expect(toEmbedUrl('file', 'https://cdn/x.mp4')).toBe('https://cdn/x.mp4');
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

  it('computes video embedUrl', async () => {
    const out = await resolveBlocks(noDb, 't1', [
      { id: 'v', type: 'video', provider: 'youtube', url: 'https://youtu.be/abcdef1' },
    ]);
    expect(out[0].embedUrl).toBe('https://www.youtube.com/embed/abcdef1');
  });

  it('resolves columns children (db-free leaves)', async () => {
    const out = await resolveBlocks(noDb, 't1', [
      {
        id: 'col',
        type: 'columns',
        columns: 2,
        children: [
          { id: 'c1', type: 'heading', text: 'Levý' },
          { id: 'c2', type: 'rich_text', html: '<p>x</p><script>bad()</script>' },
        ],
      },
    ]);
    expect(out[0].type).toBe('columns');
    const children = out[0].children as Array<Record<string, unknown>>;
    expect(children).toHaveLength(2);
    expect(children[1].html).toBe('<p>x</p>');
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

describe('section_ref (reusable sections)', () => {
  const library = [
    {
      key: 'usp',
      name: 'Výhody',
      blocks: [
        { id: 's1', type: 'heading', text: 'Doprava zdarma' },
        { id: 's2', type: 'rich_text', html: '<p>Nad 1500 Kč</p><script>x()</script>' },
      ],
    },
  ];

  it('dereferences a section_ref into resolved children', async () => {
    const out = await resolveBlocks(noDb, 't1', [{ id: 'r', type: 'section_ref', sectionKey: 'usp' }], library);
    expect(out).toHaveLength(1);
    expect(out[0].type).toBe('section_ref');
    const children = out[0].children as Array<Record<string, unknown>>;
    expect(children).toHaveLength(2);
    expect(children[0]).toMatchObject({ type: 'heading', text: 'Doprava zdarma' });
    expect(children[1].html).toBe('<p>Nad 1500 Kč</p>'); // sanitized
  });

  it('drops a section_ref pointing at an unknown key', async () => {
    const out = await resolveBlocks(noDb, 't1', [{ id: 'r', type: 'section_ref', sectionKey: 'nope' }], library);
    expect(out).toEqual([]);
  });

  it('rejects section_ref stored inside a reusable section (no recursion)', () => {
    const r = SectionBlocksSchema.safeParse([{ id: 'x', type: 'section_ref', sectionKey: 'usp' }]);
    expect(r.success).toBe(false);
  });
});
