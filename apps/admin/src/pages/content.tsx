/**
 * Obsah (CMS) — content pages + blog posts (per `32-cms-content.md` MVP).
 * Tabs: Stránky / Blog. Each = list + simple editor (title/slug/HTML/status/SEO).
 */

import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, type CmsPageInput, type CmsPageItem, type CmsPostInput, type CmsPostItem, type PageBlock, type ReusableSection } from '../lib/api';
import { MediaPicker } from '../components/media-picker';
import { RichTextEditor } from '../components/rich-text-editor';

type Tab = 'pages' | 'blog' | 'homepage' | 'sections';

const TAB_LABELS: Record<Tab, string> = {
  pages: 'Stránky',
  blog: 'Blog',
  homepage: 'Domovská stránka',
  sections: 'Sekce',
};

export function ContentPage() {
  const [tab, setTab] = useState<Tab>('pages');
  return (
    <div style={{ maxWidth: 880 }}>
      <h1 style={{ fontSize: '1.75rem', margin: '0 0 1rem' }}>Obsah</h1>
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem' }}>
        {(['pages', 'blog', 'homepage', 'sections'] as Tab[]).map((t) => (
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
            {TAB_LABELS[t]}
          </button>
        ))}
      </div>
      {tab === 'pages' ? <PagesTab /> : tab === 'blog' ? <BlogTab /> : tab === 'homepage' ? <HomepageTab /> : <SectionsTab />}
    </div>
  );
}

// ===== Homepage page-builder =================================================

const BLOCK_TYPES: { type: PageBlock['type']; label: string }[] = [
  { type: 'hero', label: 'Hero banner' },
  { type: 'heading', label: 'Nadpis' },
  { type: 'rich_text', label: 'Text (HTML)' },
  { type: 'button', label: 'Tlačítko (odkaz)' },
  { type: 'buy_button', label: 'Koupit produkt' },
  { type: 'image_banner', label: 'Obrázkový banner' },
  { type: 'gallery', label: 'Galerie obrázků' },
  { type: 'video', label: 'Video' },
  { type: 'product_grid', label: 'Mřížka produktů' },
  { type: 'featured_category', label: 'Kategorie' },
  { type: 'faq', label: 'FAQ (často kladené dotazy)' },
  { type: 'testimonial', label: 'Reference / citace' },
  { type: 'columns', label: 'Sloupce' },
  { type: 'section_ref', label: 'Znovupoužitelná sekce' },
  { type: 'newsletter', label: 'Newsletter' },
  { type: 'spacer', label: 'Mezera' },
];

let blockSeq = 0;
function newBlock(type: PageBlock['type']): PageBlock {
  blockSeq += 1;
  const id = `b${Date.now()}_${blockSeq}`;
  switch (type) {
    case 'hero': return { id, type, headline: '', subheadline: '', imageUrl: null, ctaLabel: null, ctaHref: null, align: 'center' };
    case 'heading': return { id, type, text: '', level: 'h2', align: 'center' };
    case 'rich_text': return { id, type, html: '' };
    case 'button': return { id, type, label: '', href: '#', variant: 'primary', align: 'center' };
    case 'buy_button': return { id, type, productSlug: '', label: 'Do košíku', showPrice: true, align: 'center' };
    case 'image_banner': return { id, type, imageUrl: '', href: null, alt: '' };
    case 'gallery': return { id, type, columns: 3, images: [] };
    case 'video': return { id, type, provider: 'youtube', url: '', caption: '' };
    case 'product_grid': return { id, type, title: '', productSlugs: [] };
    case 'featured_category': return { id, type, title: '', categorySlug: '', limit: 8 };
    case 'faq': return { id, type, title: '', items: [] };
    case 'testimonial': return { id, type, quote: '', author: '', imageUrl: null };
    case 'columns': return { id, type, columns: 2, gap: 'md', children: [] };
    case 'section_ref': return { id, type, sectionKey: '' };
    case 'newsletter': return { id, type, headline: '', subheadline: '' };
    case 'spacer': return { id, type, size: 'md' };
  }
}

function HomepageTab() {
  const queryClient = useQueryClient();
  const query = useQuery({ queryKey: ['admin', 'homepage-blocks'], queryFn: () => api.getHomepageBlocks() });
  const [blocks, setBlocks] = useState<PageBlock[]>([]);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (query.data) setBlocks(query.data.blocks as PageBlock[]);
  }, [query.data]);

  const save = useMutation({
    mutationFn: () => api.putHomepageBlocks(blocks),
    onSuccess: () => { setSaved(true); queryClient.invalidateQueries({ queryKey: ['admin', 'homepage-blocks'] }); setTimeout(() => setSaved(false), 2000); },
  });

  return (
    <div>
      <p style={{ fontSize: '0.875rem', color: '#666', marginTop: 0 }}>
        Poskládejte domovskou stránku z bloků. Produkty/kategorie se na storefrontu načtou živě podle slugů.
      </p>
      <BlockList blocks={blocks} onChange={setBlocks} />
      <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', marginTop: '0.75rem' }}>
        <span style={{ flex: 1 }} />
        <button type="button" onClick={() => save.mutate()} disabled={save.isPending} style={saveBtn}>
          {save.isPending ? 'Ukládám…' : saved ? '✓ Uloženo' : 'Uložit'}
        </button>
      </div>
    </div>
  );
}

// ===== Reusable sections library (per `32` §4.6) =============================

function slugify(t: string): string {
  return t.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

function SectionsTab() {
  const queryClient = useQueryClient();
  const query = useQuery({ queryKey: ['admin', 'reusable-sections'], queryFn: () => api.getReusableSections() });
  const [sections, setSections] = useState<ReusableSection[]>([]);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (query.data) setSections(query.data.sections as ReusableSection[]);
  }, [query.data]);

  const save = useMutation({
    mutationFn: () => api.putReusableSections(sections),
    onSuccess: () => {
      setError(null);
      setSaved(true);
      queryClient.invalidateQueries({ queryKey: ['admin', 'reusable-sections'] });
      setTimeout(() => setSaved(false), 2000);
    },
    onError: (e) => setError((e as Error).message),
  });

  function update(i: number, patch: Partial<ReusableSection>) {
    setSections((s) => s.map((sec, idx) => (idx === i ? { ...sec, ...patch } : sec)));
  }
  function addSection() {
    const n = sections.length + 1;
    setSections((s) => [...s, { key: `sekce-${n}`, name: `Sekce ${n}`, blocks: [] }]);
  }

  return (
    <div>
      <p style={{ fontSize: '0.875rem', color: '#666', marginTop: 0 }}>
        Vytvořte sekci jednou a vložte ji blokem „Znovupoužitelná sekce" na libovolnou stránku či
        domovskou stránku. Úprava sekce se propíše všude, kde je použita.
      </p>
      {sections.map((sec, i) => (
        <div key={i} style={{ background: '#fff', border: '1px solid #e9ecef', borderRadius: 8, padding: '1rem', marginBottom: '1rem' }}>
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-end', marginBottom: '0.75rem' }}>
            <In label="Název sekce" value={sec.name} onChange={(v) => update(i, { name: v, ...(sec.key === '' && { key: slugify(v) }) })} />
            <In label="Klíč (URL identifikátor)" value={sec.key} onChange={(v) => update(i, { key: slugify(v) })} />
            <button
              type="button"
              onClick={() => setSections((s) => s.filter((_, idx) => idx !== i))}
              style={iconBtnDanger}
            >
              Smazat sekci
            </button>
          </div>
          <BlockList blocks={sec.blocks} onChange={(next) => update(i, { blocks: next })} noRef />
        </div>
      ))}
      <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', marginTop: '0.5rem' }}>
        <button type="button" onClick={addSection} style={addBtn}>+ Nová sekce</button>
        <span style={{ flex: 1 }} />
        {error && <span style={{ color: '#c00', fontSize: '0.8125rem' }}>{error}</span>}
        <button type="button" onClick={() => save.mutate()} disabled={save.isPending} style={saveBtn}>
          {save.isPending ? 'Ukládám…' : saved ? '✓ Uloženo' : 'Uložit sekce'}
        </button>
      </div>
    </div>
  );
}

/**
 * Controlled block-list editor (per `32` §4.8). Reused by the homepage builder
 * and the CMS/landing-page editor. Supports nested `columns` children one level
 * deep. Reorder by drag-and-drop (grab the ⠿ handle) or the ↑/↓ buttons
 * (keyboard/accessible fallback).
 */
export function BlockList({
  blocks,
  onChange,
  nested,
  noRef,
}: {
  blocks: PageBlock[];
  onChange: (blocks: PageBlock[]) => void;
  nested?: boolean;
  /** Hide `section_ref` from the palette (used when editing a section itself,
   * so sections can't reference other sections). */
  noRef?: boolean;
}) {
  const [addType, setAddType] = useState<PageBlock['type']>(nested ? 'heading' : 'hero');
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [overIndex, setOverIndex] = useState<number | null>(null);
  // Nested (columns children) can't hold layout/reference blocks; noRef hides
  // just the reference block (section editor).
  const addable = BLOCK_TYPES.filter((t) => {
    if (nested && (t.type === 'columns' || t.type === 'section_ref')) return false;
    if (noRef && t.type === 'section_ref') return false;
    return true;
  });

  function update(i: number, patch: Partial<PageBlock>) {
    onChange(blocks.map((blk, idx) => (idx === i ? { ...blk, ...patch } : blk)));
  }
  function move(i: number, dir: -1 | 1) {
    const j = i + dir;
    if (j < 0 || j >= blocks.length) return;
    const copy = [...blocks];
    [copy[i], copy[j]] = [copy[j]!, copy[i]!];
    onChange(copy);
  }
  /** Move block from `from` to before position `to` (drag-drop reorder). */
  function reorder(from: number, to: number) {
    if (from === to) return;
    const copy = [...blocks];
    const [moved] = copy.splice(from, 1);
    copy.splice(from < to ? to - 1 : to, 0, moved!);
    onChange(copy);
  }

  return (
    <div>
      {blocks.map((blk, i) => (
        <div
          key={blk.id}
          onDragOver={(e) => {
            if (dragIndex === null) return;
            e.preventDefault();
            if (overIndex !== i) setOverIndex(i);
          }}
          onDrop={(e) => {
            if (dragIndex === null) return;
            e.preventDefault();
            reorder(dragIndex, i > dragIndex ? i + 1 : i);
            setDragIndex(null);
            setOverIndex(null);
          }}
          style={{
            background: '#fff',
            border: overIndex === i && dragIndex !== null ? '2px solid #0066ff' : '1px solid #e9ecef',
            borderRadius: 8,
            padding: '1rem',
            marginBottom: '0.75rem',
            opacity: dragIndex === i ? 0.4 : 1,
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
            <strong style={{ fontSize: '0.875rem', display: 'flex', alignItems: 'center', gap: 6 }}>
              <span
                draggable
                onDragStart={() => setDragIndex(i)}
                onDragEnd={() => { setDragIndex(null); setOverIndex(null); }}
                title="Přetáhněte pro změnu pořadí"
                style={{ cursor: 'grab', color: '#aab', fontSize: '1rem', userSelect: 'none' }}
              >
                ⠿
              </span>
              {BLOCK_TYPES.find((t) => t.type === blk.type)?.label ?? blk.type}
            </strong>
            <span style={{ display: 'flex', gap: 4 }}>
              <button type="button" onClick={() => move(i, -1)} disabled={i === 0} style={iconBtn}>↑</button>
              <button type="button" onClick={() => move(i, 1)} disabled={i === blocks.length - 1} style={iconBtn}>↓</button>
              <button type="button" onClick={() => onChange(blocks.filter((_, idx) => idx !== i))} style={iconBtnDanger}>×</button>
            </span>
          </div>
          <BlockFields block={blk} onChange={(patch) => update(i, patch)} />
        </div>
      ))}
      <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', marginTop: '0.5rem' }}>
        <select value={addType} onChange={(e) => setAddType(e.target.value as PageBlock['type'])} style={fieldStyle}>
          {addable.map((t) => <option key={t.type} value={t.type}>{t.label}</option>)}
        </select>
        <button type="button" onClick={() => onChange([...blocks, newBlock(addType)])} style={addBtn}>+ Přidat blok</button>
      </div>
    </div>
  );
}

function BlockFields({ block, onChange }: { block: PageBlock; onChange: (patch: Partial<PageBlock>) => void }) {
  const s = (k: string) => (block[k] as string) ?? '';
  // Available reusable sections for the section_ref picker (cached/shared).
  const sectionsQuery = useQuery({
    queryKey: ['admin', 'reusable-sections'],
    queryFn: () => api.getReusableSections(),
  });
  if (block.type === 'hero') {
    return (
      <div style={grid2}>
        <In label="Nadpis" value={s('headline')} onChange={(v) => onChange({ headline: v })} />
        <In label="Podnadpis" value={s('subheadline')} onChange={(v) => onChange({ subheadline: v })} />
        <MediaPicker label="Obrázek pozadí" value={s('imageUrl')} onChange={(v) => onChange({ imageUrl: v || null })} />
        <In label="Text tlačítka" value={s('ctaLabel')} onChange={(v) => onChange({ ctaLabel: v })} />
        <In label="Odkaz tlačítka" value={s('ctaHref')} onChange={(v) => onChange({ ctaHref: v })} />
      </div>
    );
  }
  if (block.type === 'rich_text') {
    return <RichTextEditor value={s('html')} onChange={(html) => onChange({ html })} minHeight={120} />;
  }
  if (block.type === 'image_banner') {
    return (
      <div style={{ display: 'grid', gap: '0.5rem' }}>
        <MediaPicker label="Obrázek" value={s('imageUrl')} onChange={(v) => onChange({ imageUrl: v })} />
        <div style={grid2}>
          <In label="Odkaz" value={s('href')} onChange={(v) => onChange({ href: v })} />
          <In label="Alt text" value={s('alt')} onChange={(v) => onChange({ alt: v })} />
        </div>
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
  if (block.type === 'heading') {
    return (
      <div style={grid2}>
        <In label="Text nadpisu" value={s('text')} onChange={(v) => onChange({ text: v })} />
        <label style={{ fontSize: '0.8125rem' }}>
          <span style={{ display: 'block', marginBottom: 4, fontWeight: 500 }}>Úroveň</span>
          <select value={(block.level as string) ?? 'h2'} onChange={(e) => onChange({ level: e.target.value })} style={{ ...fieldStyle, width: '100%' }}>
            <option value="h2">Velký (H2)</option>
            <option value="h3">Menší (H3)</option>
          </select>
        </label>
      </div>
    );
  }
  if (block.type === 'button') {
    return (
      <div style={grid2}>
        <In label="Text tlačítka" value={s('label')} onChange={(v) => onChange({ label: v })} />
        <In label="Odkaz (URL)" value={s('href')} onChange={(v) => onChange({ href: v })} />
        <label style={{ fontSize: '0.8125rem' }}>
          <span style={{ display: 'block', marginBottom: 4, fontWeight: 500 }}>Styl</span>
          <select value={(block.variant as string) ?? 'primary'} onChange={(e) => onChange({ variant: e.target.value })} style={{ ...fieldStyle, width: '100%' }}>
            <option value="primary">Plné</option>
            <option value="outline">Obrys</option>
          </select>
        </label>
      </div>
    );
  }
  if (block.type === 'buy_button') {
    return (
      <div style={grid2}>
        <In label="Slug produktu" value={s('productSlug')} onChange={(v) => onChange({ productSlug: v })} />
        <In label="Text tlačítka" value={s('label')} onChange={(v) => onChange({ label: v })} />
        <label style={{ fontSize: '0.8125rem', display: 'flex', alignItems: 'center', gap: 6, marginTop: 22 }}>
          <input type="checkbox" checked={(block.showPrice as boolean) ?? true} onChange={(e) => onChange({ showPrice: e.target.checked })} />
          Zobrazit cenu
        </label>
      </div>
    );
  }
  if (block.type === 'video') {
    return (
      <div style={grid2}>
        <label style={{ fontSize: '0.8125rem' }}>
          <span style={{ display: 'block', marginBottom: 4, fontWeight: 500 }}>Zdroj</span>
          <select value={(block.provider as string) ?? 'youtube'} onChange={(e) => onChange({ provider: e.target.value })} style={{ ...fieldStyle, width: '100%' }}>
            <option value="youtube">YouTube</option>
            <option value="vimeo">Vimeo</option>
            <option value="file">Přímý soubor (MP4)</option>
          </select>
        </label>
        <In label="URL videa" value={s('url')} onChange={(v) => onChange({ url: v })} />
        <In label="Popisek (volitelné)" value={s('caption')} onChange={(v) => onChange({ caption: v })} />
      </div>
    );
  }
  if (block.type === 'gallery') {
    const images = (block.images as { url: string; alt?: string; href?: string | null }[]) ?? [];
    return (
      <div>
        <label style={{ fontSize: '0.8125rem' }}>
          <span style={{ display: 'block', marginBottom: 4, fontWeight: 500 }}>Počet sloupců</span>
          <select value={String((block.columns as number) ?? 3)} onChange={(e) => onChange({ columns: Number(e.target.value) })} style={fieldStyle}>
            {[2, 3, 4].map((n) => <option key={n} value={n}>{n}</option>)}
          </select>
        </label>
        <RepeatList
          items={images}
          empty={{ url: '', alt: '', href: null }}
          onChange={(next) => onChange({ images: next })}
          render={(img, upd) => (
            <div style={{ display: 'grid', gap: '0.4rem' }}>
              <MediaPicker label="Obrázek" value={img.url ?? ''} onChange={(v) => upd({ url: v })} />
              <In label="Alt text" value={img.alt ?? ''} onChange={(v) => upd({ alt: v })} />
            </div>
          )}
        />
      </div>
    );
  }
  if (block.type === 'faq') {
    const items = (block.items as { q: string; a: string }[]) ?? [];
    return (
      <div>
        <In label="Titulek (volitelné)" value={s('title')} onChange={(v) => onChange({ title: v })} />
        <RepeatList
          items={items}
          empty={{ q: '', a: '' }}
          onChange={(next) => onChange({ items: next })}
          render={(it, upd) => (
            <div style={{ display: 'grid', gap: '0.5rem' }}>
              <In label="Otázka" value={it.q ?? ''} onChange={(v) => upd({ q: v })} />
              <label style={{ fontSize: '0.8125rem' }}>
                <span style={{ display: 'block', marginBottom: 4, fontWeight: 500 }}>Odpověď</span>
                <textarea value={it.a ?? ''} onChange={(e) => upd({ a: e.target.value })} rows={2} style={{ ...fieldStyle, width: '100%', boxSizing: 'border-box' }} />
              </label>
            </div>
          )}
        />
      </div>
    );
  }
  if (block.type === 'testimonial') {
    return (
      <div style={{ display: 'grid', gap: '0.5rem' }}>
        <label style={{ fontSize: '0.8125rem' }}>
          <span style={{ display: 'block', marginBottom: 4, fontWeight: 500 }}>Citace</span>
          <textarea value={s('quote')} onChange={(e) => onChange({ quote: e.target.value })} rows={2} style={{ ...fieldStyle, width: '100%', boxSizing: 'border-box' }} />
        </label>
        <div style={grid2}>
          <In label="Autor" value={s('author')} onChange={(v) => onChange({ author: v })} />
          <MediaPicker label="Foto autora (volitelné)" value={s('imageUrl')} onChange={(v) => onChange({ imageUrl: v || null })} />
        </div>
      </div>
    );
  }
  if (block.type === 'columns') {
    const children = (block.children as PageBlock[]) ?? [];
    return (
      <div>
        <label style={{ fontSize: '0.8125rem' }}>
          <span style={{ display: 'block', marginBottom: 4, fontWeight: 500 }}>Počet sloupců</span>
          <select value={String((block.columns as number) ?? 2)} onChange={(e) => onChange({ columns: Number(e.target.value) })} style={fieldStyle}>
            {[2, 3].map((n) => <option key={n} value={n}>{n}</option>)}
          </select>
        </label>
        <div style={{ marginTop: '0.5rem', paddingLeft: '0.75rem', borderLeft: '2px solid #e0e7ff' }}>
          <BlockList blocks={children} onChange={(next) => onChange({ children: next })} nested />
        </div>
      </div>
    );
  }
  if (block.type === 'section_ref') {
    const sections = sectionsQuery.data?.sections ?? [];
    return (
      <label style={{ fontSize: '0.8125rem' }}>
        <span style={{ display: 'block', marginBottom: 4, fontWeight: 500 }}>Vyberte sekci</span>
        {sections.length === 0 ? (
          <p style={{ color: '#888', fontSize: '0.8125rem', margin: 0 }}>
            Zatím žádné sekce — vytvořte je v záložce „Sekce".
          </p>
        ) : (
          <select value={s('sectionKey')} onChange={(e) => onChange({ sectionKey: e.target.value })} style={{ ...fieldStyle, width: '100%' }}>
            <option value="">— vyberte —</option>
            {sections.map((sec) => (
              <option key={sec.key} value={sec.key}>{sec.name || sec.key}</option>
            ))}
          </select>
        )}
      </label>
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

/** Generic add/remove list editor for repeatable block sub-items (gallery
 * images, FAQ Q&A). Each row is rendered by `render` and patched in place. */
function RepeatList<T extends Record<string, unknown>>({
  items,
  empty,
  onChange,
  render,
}: {
  items: T[];
  empty: T;
  onChange: (next: T[]) => void;
  render: (item: T, update: (patch: Partial<T>) => void) => React.ReactNode;
}) {
  return (
    <div style={{ display: 'grid', gap: '0.5rem', marginTop: '0.5rem' }}>
      {items.map((it, i) => (
        <div key={i} style={{ position: 'relative', border: '1px solid #eee', borderRadius: 6, padding: '0.6rem 2rem 0.6rem 0.6rem' }}>
          {render(it, (patch) => onChange(items.map((x, idx) => (idx === i ? { ...x, ...patch } : x))))}
          <button
            type="button"
            onClick={() => onChange(items.filter((_, idx) => idx !== i))}
            style={{ ...iconBtnDanger, position: 'absolute', top: 6, right: 6 }}
          >
            ×
          </button>
        </div>
      ))}
      <button type="button" onClick={() => onChange([...items, { ...empty }])} style={addBtn}>+ Přidat položku</button>
    </div>
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
  const page = item as CmsPageItem | null;
  const [title, setTitle] = useState(item?.title ?? '');
  const [slug, setSlug] = useState(item?.slug ?? '');
  const [body, setBody] = useState(item?.body_html ?? '');
  const [blocks, setBlocks] = useState<PageBlock[]>((page?.blocks as PageBlock[]) ?? []);
  // Pages can be authored as blocks (landing pages) or raw HTML. Default to the
  // mode the existing content already uses.
  const [pageMode, setPageMode] = useState<'blocks' | 'html'>(
    (page?.blocks?.length ?? 0) > 0 ? 'blocks' : 'html',
  );
  const [status, setStatus] = useState<'draft' | 'published'>(item?.status ?? 'draft');
  const [seoDescription, setSeoDescription] = useState(item?.seo_description ?? '');
  const [excerpt, setExcerpt] = useState(post?.excerpt ?? '');
  const [coverImageUrl, setCoverImageUrl] = useState(post?.cover_image_url ?? '');
  const [error, setError] = useState<string | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const useBlocks = kind === 'page' && pageMode === 'blocks';

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
          // Blocks take precedence on the storefront when non-empty; sending []
          // in HTML mode lets the merchant switch back to raw HTML.
          blocks: useBlocks ? blocks : [],
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
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          {kind === 'page' && item && (
            <button type="button" onClick={() => setHistoryOpen((v) => !v)} style={ghostBtn}>
              🕘 Historie
            </button>
          )}
          <button type="button" onClick={onCancel} style={ghostBtn}>Zpět na seznam</button>
        </div>
      </div>
      {kind === 'page' && item && historyOpen && (
        <PageHistory pageId={item.id} onRestored={onDone} onClose={() => setHistoryOpen(false)} />
      )}

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
          <Field label="Náhledový obrázek">
            <MediaPicker label="" value={coverImageUrl} onChange={setCoverImageUrl} />
          </Field>
        </>
      )}
      {kind === 'page' && (
        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.875rem' }}>
          {(['blocks', 'html'] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setPageMode(m)}
              style={{
                padding: '0.35rem 0.85rem',
                borderRadius: 6,
                cursor: 'pointer',
                fontSize: '0.8125rem',
                border: pageMode === m ? '2px solid #0066ff' : '1px solid #ddd',
                background: pageMode === m ? '#eef4ff' : '#fff',
                fontWeight: pageMode === m ? 600 : 400,
              }}
            >
              {m === 'blocks' ? '🧱 Bloky (page builder)' : '</> HTML'}
            </button>
          ))}
        </div>
      )}
      {useBlocks ? (
        <Field label="Obsah stránky (bloky)">
          <p style={{ fontSize: '0.8125rem', color: '#666', margin: '0 0 0.75rem' }}>
            Poskládejte stránku z bloků. Produkty/kategorie/„Koupit" se na storefrontu načtou živě podle slugů.
          </p>
          <BlockList blocks={blocks} onChange={setBlocks} />
        </Field>
      ) : (
        <Field label="Obsah">
          <RichTextEditor value={body} onChange={setBody} minHeight={240} />
        </Field>
      )}
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

// ===== Page version history (per `32` §5.7) ==================================

function PageHistory({ pageId, onRestored, onClose }: { pageId: string; onRestored: () => void; onClose: () => void }) {
  const query = useQuery({ queryKey: ['admin', 'page-revisions', pageId], queryFn: () => api.getPageRevisions(pageId) });
  const restore = useMutation({
    mutationFn: (index: number) => api.restorePageRevision(pageId, index),
    onSuccess: onRestored,
  });
  const revs = query.data?.revisions ?? [];

  return (
    <div style={{ background: '#f7f8fa', border: '1px solid #e0e7ff', borderRadius: 8, padding: '0.875rem', marginBottom: '1rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
        <strong style={{ fontSize: '0.9rem' }}>Historie verzí</strong>
        <button type="button" onClick={onClose} style={ghostBtn}>Zavřít</button>
      </div>
      {query.isLoading ? (
        <p style={{ fontSize: '0.8125rem', color: '#666', margin: 0 }}>Načítám…</p>
      ) : revs.length === 0 ? (
        <p style={{ fontSize: '0.8125rem', color: '#888', margin: 0 }}>
          Zatím žádné uložené verze. Vytvoří se automaticky při každé úpravě obsahu.
        </p>
      ) : (
        <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
          {revs.map((r) => (
            <li key={r.index} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.5rem', fontSize: '0.8125rem', background: '#fff', border: '1px solid #eee', borderRadius: 6, padding: '0.4rem 0.6rem' }}>
              <span>
                {new Date(r.at).toLocaleString('cs-CZ')} · {r.title}{' '}
                <span style={{ color: '#999' }}>({r.block_count} bloků)</span>
              </span>
              <button
                type="button"
                disabled={restore.isPending}
                onClick={() => { if (confirm('Obnovit tuto verzi? Aktuální obsah se nejdřív uloží do historie.')) restore.mutate(r.index); }}
                style={addBtn}
              >
                Obnovit
              </button>
            </li>
          ))}
        </ul>
      )}
      {restore.isError && <p style={{ color: '#c00', fontSize: '0.75rem', margin: '0.5rem 0 0' }}>Obnovení selhalo.</p>}
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
