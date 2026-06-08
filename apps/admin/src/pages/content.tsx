/**
 * Obsah (CMS) — content pages + blog posts (per `32-cms-content.md` MVP).
 * Tabs: Stránky / Blog. Each = list + simple editor (title/slug/HTML/status/SEO).
 */

import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, type CmsPageInput, type CmsPageItem, type CmsPostInput, type CmsPostItem, type PageBlock } from '../lib/api';

type Tab = 'pages' | 'blog' | 'homepage';

export function ContentPage() {
  const [tab, setTab] = useState<Tab>('pages');
  return (
    <div style={{ maxWidth: 880 }}>
      <h1 style={{ fontSize: '1.75rem', margin: '0 0 1rem' }}>Obsah</h1>
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem' }}>
        {(['pages', 'blog', 'homepage'] as Tab[]).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            style={{
              padding: '0.5rem 1rem',
              borderRadius: 6,
              cursor: 'pointer',
              border: tab === t ? '2px solid #0066ff' : '1px solid #ddd',
              background: tab === t ? '#eef4ff' : '#fff',
              fontWeight: tab === t ? 600 : 400,
            }}
          >
            {t === 'pages' ? 'Stránky' : t === 'blog' ? 'Blog' : 'Domovská stránka'}
          </button>
        ))}
      </div>
      {tab === 'pages' ? <PagesTab /> : tab === 'blog' ? <BlogTab /> : <HomepageTab />}
    </div>
  );
}

// ===== Homepage page-builder =================================================

const BLOCK_TYPES: { type: PageBlock['type']; label: string }[] = [
  { type: 'hero', label: 'Hero banner' },
  { type: 'rich_text', label: 'Text (HTML)' },
  { type: 'image_banner', label: 'Obrázkový banner' },
  { type: 'product_grid', label: 'Mřížka produktů' },
  { type: 'featured_category', label: 'Kategorie' },
  { type: 'newsletter', label: 'Newsletter' },
  { type: 'spacer', label: 'Mezera' },
];

let blockSeq = 0;
function newBlock(type: PageBlock['type']): PageBlock {
  blockSeq += 1;
  const id = `b${Date.now()}_${blockSeq}`;
  switch (type) {
    case 'hero': return { id, type, headline: '', subheadline: '', imageUrl: null, ctaLabel: null, ctaHref: null, align: 'center' };
    case 'rich_text': return { id, type, html: '' };
    case 'image_banner': return { id, type, imageUrl: '', href: null, alt: '' };
    case 'product_grid': return { id, type, title: '', productSlugs: [] };
    case 'featured_category': return { id, type, title: '', categorySlug: '', limit: 8 };
    case 'newsletter': return { id, type, headline: '', subheadline: '' };
    case 'spacer': return { id, type, size: 'md' };
  }
}

function HomepageTab() {
  const queryClient = useQueryClient();
  const query = useQuery({ queryKey: ['admin', 'homepage-blocks'], queryFn: () => api.getHomepageBlocks() });
  const [blocks, setBlocks] = useState<PageBlock[]>([]);
  const [addType, setAddType] = useState<PageBlock['type']>('hero');
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (query.data) setBlocks(query.data.blocks as PageBlock[]);
  }, [query.data]);

  const save = useMutation({
    mutationFn: () => api.putHomepageBlocks(blocks),
    onSuccess: () => { setSaved(true); queryClient.invalidateQueries({ queryKey: ['admin', 'homepage-blocks'] }); setTimeout(() => setSaved(false), 2000); },
  });

  function update(i: number, patch: Partial<PageBlock>) {
    setBlocks((b) => b.map((blk, idx) => (idx === i ? { ...blk, ...patch } : blk)));
  }
  function move(i: number, dir: -1 | 1) {
    setBlocks((b) => {
      const j = i + dir;
      if (j < 0 || j >= b.length) return b;
      const copy = [...b];
      [copy[i], copy[j]] = [copy[j]!, copy[i]!];
      return copy;
    });
  }

  return (
    <div>
      <p style={{ fontSize: '0.875rem', color: '#666', marginTop: 0 }}>
        Poskládejte domovskou stránku z bloků. Produkty/kategorie se na storefrontu načtou živě podle slugů.
      </p>
      {blocks.map((blk, i) => (
        <div key={blk.id} style={{ background: '#fff', border: '1px solid #e9ecef', borderRadius: 8, padding: '1rem', marginBottom: '0.75rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
            <strong style={{ fontSize: '0.875rem' }}>{BLOCK_TYPES.find((t) => t.type === blk.type)?.label ?? blk.type}</strong>
            <span style={{ display: 'flex', gap: 4 }}>
              <button type="button" onClick={() => move(i, -1)} disabled={i === 0} style={iconBtn}>↑</button>
              <button type="button" onClick={() => move(i, 1)} disabled={i === blocks.length - 1} style={iconBtn}>↓</button>
              <button type="button" onClick={() => setBlocks((b) => b.filter((_, idx) => idx !== i))} style={iconBtnDanger}>×</button>
            </span>
          </div>
          <BlockFields block={blk} onChange={(patch) => update(i, patch)} />
        </div>
      ))}

      <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', marginTop: '0.5rem' }}>
        <select value={addType} onChange={(e) => setAddType(e.target.value as PageBlock['type'])} style={fieldStyle}>
          {BLOCK_TYPES.map((t) => <option key={t.type} value={t.type}>{t.label}</option>)}
        </select>
        <button type="button" onClick={() => setBlocks((b) => [...b, newBlock(addType)])} style={addBtn}>+ Přidat blok</button>
        <span style={{ flex: 1 }} />
        <button type="button" onClick={() => save.mutate()} disabled={save.isPending} style={saveBtn}>
          {save.isPending ? 'Ukládám…' : saved ? '✓ Uloženo' : 'Uložit'}
        </button>
      </div>
    </div>
  );
}

function BlockFields({ block, onChange }: { block: PageBlock; onChange: (patch: Partial<PageBlock>) => void }) {
  const s = (k: string) => (block[k] as string) ?? '';
  if (block.type === 'hero') {
    return (
      <div style={grid2}>
        <In label="Nadpis" value={s('headline')} onChange={(v) => onChange({ headline: v })} />
        <In label="Podnadpis" value={s('subheadline')} onChange={(v) => onChange({ subheadline: v })} />
        <In label="URL obrázku" value={s('imageUrl')} onChange={(v) => onChange({ imageUrl: v })} />
        <In label="Text tlačítka" value={s('ctaLabel')} onChange={(v) => onChange({ ctaLabel: v })} />
        <In label="Odkaz tlačítka" value={s('ctaHref')} onChange={(v) => onChange({ ctaHref: v })} />
      </div>
    );
  }
  if (block.type === 'rich_text') {
    return <textarea value={s('html')} onChange={(e) => onChange({ html: e.target.value })} rows={4} style={{ ...fieldStyle, width: '100%', fontFamily: 'monospace' }} placeholder="<p>…</p>" />;
  }
  if (block.type === 'image_banner') {
    return (
      <div style={grid2}>
        <In label="URL obrázku" value={s('imageUrl')} onChange={(v) => onChange({ imageUrl: v })} />
        <In label="Odkaz" value={s('href')} onChange={(v) => onChange({ href: v })} />
        <In label="Alt text" value={s('alt')} onChange={(v) => onChange({ alt: v })} />
      </div>
    );
  }
  if (block.type === 'product_grid') {
    const slugs = ((block.productSlugs as string[]) ?? []).join(', ');
    return (
      <div style={grid2}>
        <In label="Titulek" value={s('title')} onChange={(v) => onChange({ title: v })} />
        <In label="Slugy produktů (čárkou)" value={slugs} onChange={(v) => onChange({ productSlugs: v.split(',').map((x) => x.trim()).filter(Boolean) })} />
      </div>
    );
  }
  if (block.type === 'featured_category') {
    return (
      <div style={grid2}>
        <In label="Titulek" value={s('title')} onChange={(v) => onChange({ title: v })} />
        <In label="Slug kategorie" value={s('categorySlug')} onChange={(v) => onChange({ categorySlug: v })} />
        <In label="Max. produktů" value={String((block.limit as number) ?? 8)} onChange={(v) => onChange({ limit: Number(v) || 8 })} />
      </div>
    );
  }
  if (block.type === 'newsletter') {
    return (
      <div style={grid2}>
        <In label="Nadpis" value={s('headline')} onChange={(v) => onChange({ headline: v })} />
        <In label="Podnadpis" value={s('subheadline')} onChange={(v) => onChange({ subheadline: v })} />
      </div>
    );
  }
  // spacer
  return (
    <select value={(block.size as string) ?? 'md'} onChange={(e) => onChange({ size: e.target.value })} style={fieldStyle}>
      <option value="sm">Malá</option><option value="md">Střední</option><option value="lg">Velká</option>
    </select>
  );
}

function In({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label style={{ fontSize: '0.8125rem' }}>
      <span style={{ display: 'block', marginBottom: 4, fontWeight: 500 }}>{label}</span>
      <input value={value} onChange={(e) => onChange(e.target.value)} style={{ ...fieldStyle, width: '100%', boxSizing: 'border-box' }} />
    </label>
  );
}

const grid2: React.CSSProperties = { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' };
const fieldStyle: React.CSSProperties = { padding: '0.5rem 0.625rem', border: '1px solid #ddd', borderRadius: 4, fontSize: '0.875rem' };
const iconBtn: React.CSSProperties = { padding: '0.2rem 0.5rem', background: '#f0f7ff', border: '1px solid #cce0ff', borderRadius: 4, cursor: 'pointer' };
const iconBtnDanger: React.CSSProperties = { padding: '0.2rem 0.5rem', background: '#fff0f0', border: '1px solid #ffcccc', color: '#990000', borderRadius: 4, cursor: 'pointer' };
const addBtn: React.CSSProperties = { padding: '0.45rem 0.875rem', background: '#f0f7ff', border: '1px solid #cce0ff', color: '#003d99', borderRadius: 4, fontSize: '0.8125rem', cursor: 'pointer' };
const saveBtn: React.CSSProperties = { padding: '0.5rem 1.25rem', background: '#0066ff', color: '#fff', border: 'none', borderRadius: 4, fontSize: '0.875rem', cursor: 'pointer' };

// ===== Pages =================================================================

function PagesTab() {
  const queryClient = useQueryClient();
  const query = useQuery({ queryKey: ['admin', 'cms-pages'], queryFn: () => api.listCmsPages() });
  const [editing, setEditing] = useState<CmsPageItem | 'new' | null>(null);
  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['admin', 'cms-pages'] });

  if (editing) {
    return (
      <ContentEditor
        kind="page"
        item={editing === 'new' ? null : editing}
        onDone={() => { setEditing(null); invalidate(); }}
        onCancel={() => setEditing(null)}
      />
    );
  }

  const pages = query.data?.pages ?? [];
  return (
    <ListView
      items={pages}
      label="stránku"
      onNew={() => setEditing('new')}
      onEdit={(p) => setEditing(p as CmsPageItem)}
      previewBase="stranka"
    />
  );
}

// ===== Blog ==================================================================

function BlogTab() {
  const queryClient = useQueryClient();
  const query = useQuery({ queryKey: ['admin', 'cms-posts'], queryFn: () => api.listBlogPosts() });
  const [editing, setEditing] = useState<CmsPostItem | 'new' | null>(null);
  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['admin', 'cms-posts'] });

  if (editing) {
    return (
      <ContentEditor
        kind="post"
        item={editing === 'new' ? null : editing}
        onDone={() => { setEditing(null); invalidate(); }}
        onCancel={() => setEditing(null)}
      />
    );
  }

  const posts = query.data?.posts ?? [];
  return (
    <ListView
      items={posts}
      label="článek"
      onNew={() => setEditing('new')}
      onEdit={(p) => setEditing(p as CmsPostItem)}
      previewBase="blog"
    />
  );
}

// ===== Shared list ===========================================================

function ListView({
  items,
  label,
  onNew,
  onEdit,
  previewBase,
}: {
  items: (CmsPageItem | CmsPostItem)[];
  label: string;
  onNew: () => void;
  onEdit: (i: CmsPageItem | CmsPostItem) => void;
  previewBase: string;
}) {
  void previewBase;
  return (
    <div>
      <button type="button" onClick={onNew} style={primaryBtn}>
        + Nový {label}
      </button>
      <div style={{ ...card, marginTop: '1rem' }}>
        {items.length === 0 ? (
          <p style={{ color: '#666', fontSize: '0.875rem', margin: 0 }}>Zatím nic.</p>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <tbody>
              {items.map((i) => (
                <tr key={i.id}>
                  <td style={td}>
                    <button
                      type="button"
                      onClick={() => onEdit(i)}
                      style={{ background: 'none', border: 'none', color: '#0066ff', cursor: 'pointer', padding: 0, fontSize: '0.9375rem', fontWeight: 500 }}
                    >
                      {i.title}
                    </button>
                    <span style={{ color: '#999', fontSize: '0.75rem', marginLeft: 8 }}>/{i.slug}</span>
                  </td>
                  <td style={{ ...td, textAlign: 'right' }}>
                    <span
                      style={{
                        fontSize: '0.75rem',
                        padding: '0.125rem 0.5rem',
                        borderRadius: 999,
                        background: i.status === 'published' ? '#e3f5e8' : '#f0f0f0',
                        color: i.status === 'published' ? '#1c7c34' : '#888',
                      }}
                    >
                      {i.status === 'published' ? 'Publikováno' : 'Koncept'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

// ===== Editor ================================================================

function ContentEditor({
  kind,
  item,
  onDone,
  onCancel,
}: {
  kind: 'page' | 'post';
  item: CmsPageItem | CmsPostItem | null;
  onDone: () => void;
  onCancel: () => void;
}) {
  const post = item as CmsPostItem | null;
  const [title, setTitle] = useState(item?.title ?? '');
  const [slug, setSlug] = useState(item?.slug ?? '');
  const [body, setBody] = useState(item?.body_html ?? '');
  const [status, setStatus] = useState<'draft' | 'published'>(item?.status ?? 'draft');
  const [seoDescription, setSeoDescription] = useState(item?.seo_description ?? '');
  const [excerpt, setExcerpt] = useState(post?.excerpt ?? '');
  const [coverImageUrl, setCoverImageUrl] = useState(post?.cover_image_url ?? '');
  const [error, setError] = useState<string | null>(null);

  function autoSlug(t: string) {
    if (item) return; // don't rewrite slug when editing
    setSlug(
      t.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''),
    );
  }

  const mutation = useMutation({
    mutationFn: () => {
      if (kind === 'page') {
        const body_: CmsPageInput = {
          slug, title, bodyHtml: body, status,
          ...(seoDescription && { seoDescription }),
        };
        return item ? api.updateCmsPage(item.id, body_) : api.createCmsPage(body_);
      }
      const body_: CmsPostInput = {
        slug, title, bodyHtml: body, status,
        ...(excerpt && { excerpt }),
        ...(coverImageUrl && { coverImageUrl }),
        ...(seoDescription && { seoDescription }),
      };
      return item ? api.updateBlogPost(item.id, body_) : api.createBlogPost(body_);
    },
    onSuccess: onDone,
    onError: (e) => setError((e as Error).message),
  });

  const del = useMutation({
    mutationFn: () => (kind === 'page' ? api.deleteCmsPage(item!.id) : api.deleteBlogPost(item!.id)),
    onSuccess: onDone,
  });

  return (
    <div style={card}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem' }}>
        <h2 style={{ margin: 0, fontSize: '1.125rem' }}>
          {item ? 'Upravit' : 'Nový'} {kind === 'page' ? '— stránka' : '— článek'}
        </h2>
        <button type="button" onClick={onCancel} style={ghostBtn}>Zpět na seznam</button>
      </div>

      <Field label="Název *">
        <input value={title} onChange={(e) => { setTitle(e.target.value); autoSlug(e.target.value); }} style={input} />
      </Field>
      <Field label="Slug (URL) *">
        <input value={slug} onChange={(e) => setSlug(e.target.value)} style={input} placeholder="o-nas" />
      </Field>
      {kind === 'post' && (
        <>
          <Field label="Perex (krátký úvod)">
            <input value={excerpt} onChange={(e) => setExcerpt(e.target.value)} style={input} />
          </Field>
          <Field label="URL náhledového obrázku">
            <input value={coverImageUrl} onChange={(e) => setCoverImageUrl(e.target.value)} style={input} placeholder="https://…" />
          </Field>
        </>
      )}
      <Field label="Obsah (HTML)">
        <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={12} style={{ ...input, fontFamily: 'monospace', resize: 'vertical' }} />
      </Field>
      <Field label="SEO popis">
        <input value={seoDescription} onChange={(e) => setSeoDescription(e.target.value)} style={input} />
      </Field>
      <Field label="Stav">
        <select value={status} onChange={(e) => setStatus(e.target.value as 'draft' | 'published')} style={{ ...input, width: 200 }}>
          <option value="draft">Koncept</option>
          <option value="published">Publikováno</option>
        </select>
      </Field>

      {error && <p style={{ color: '#c00', fontSize: '0.875rem' }}>{error}</p>}
      <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', marginTop: '0.5rem' }}>
        <button type="button" onClick={() => { setError(null); mutation.mutate(); }} disabled={mutation.isPending || !title || !slug} style={primaryBtn}>
          {mutation.isPending ? 'Ukládám…' : 'Uložit'}
        </button>
        {item && (
          <button
            type="button"
            onClick={() => { if (confirm('Smazat?')) del.mutate(); }}
            disabled={del.isPending}
            style={{ ...ghostBtn, color: '#c0392b', borderColor: '#e0b4b0' }}
          >
            Smazat
          </button>
        )}
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label style={{ display: 'block', marginBottom: '0.875rem' }}>
      <span style={{ display: 'block', fontSize: '0.8125rem', color: '#555', marginBottom: 4 }}>{label}</span>
      {children}
    </label>
  );
}

const card: React.CSSProperties = { background: '#fff', padding: '1.25rem', borderRadius: 8, border: '1px solid #e9ecef' };
const input: React.CSSProperties = { width: '100%', padding: '0.5rem 0.625rem', border: '1px solid #ddd', borderRadius: 4, fontSize: '0.9375rem', boxSizing: 'border-box' };
const td: React.CSSProperties = { padding: '0.625rem 0.5rem', borderBottom: '1px solid #f0f0f0' };
const primaryBtn: React.CSSProperties = { padding: '0.5rem 1rem', background: '#0066ff', color: '#fff', border: 'none', borderRadius: 6, fontSize: '0.875rem', fontWeight: 500, cursor: 'pointer' };
const ghostBtn: React.CSSProperties = { padding: '0.4rem 0.875rem', background: 'transparent', border: '1px solid #ddd', borderRadius: 4, fontSize: '0.8125rem', cursor: 'pointer' };
