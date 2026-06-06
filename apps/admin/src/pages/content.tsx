/**
 * Obsah (CMS) — content pages + blog posts (per `32-cms-content.md` MVP).
 * Tabs: Stránky / Blog. Each = list + simple editor (title/slug/HTML/status/SEO).
 */

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, type CmsPageInput, type CmsPageItem, type CmsPostInput, type CmsPostItem } from '../lib/api';

type Tab = 'pages' | 'blog';

export function ContentPage() {
  const [tab, setTab] = useState<Tab>('pages');
  return (
    <div style={{ maxWidth: 880 }}>
      <h1 style={{ fontSize: '1.75rem', margin: '0 0 1rem' }}>Obsah</h1>
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem' }}>
        {(['pages', 'blog'] as Tab[]).map((t) => (
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
            {t === 'pages' ? 'Stránky' : 'Blog'}
          </button>
        ))}
      </div>
      {tab === 'pages' ? <PagesTab /> : <BlogTab />}
    </div>
  );
}

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
