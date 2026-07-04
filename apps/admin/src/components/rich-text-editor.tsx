/**
 * Lightweight WYSIWYG editor for rich_text blocks + CMS page HTML (per `32`
 * §4.8) — a contentEditable surface with a formatting toolbar so non-technical
 * merchants don't hand-write HTML. Output is HTML, sanitized server-side on save
 * (script/handlers stripped in page-blocks / cms-admin).
 *
 * Uses document.execCommand — deprecated but universally supported and
 * dependency-free; a Tiptap/ProseMirror upgrade is Fáze 2. The editor is
 * uncontrolled after mount (initial HTML seeded once) to keep the caret stable;
 * changes flow out via onChange.
 */

import { useEffect, useRef } from 'react';

type Cmd = { label: string; title: string; run: () => void };

export function RichTextEditor({
  value,
  onChange,
  minHeight = 160,
}: {
  value: string;
  onChange: (html: string) => void;
  minHeight?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);

  // Seed the initial HTML once (or when the incoming value diverges while the
  // editor isn't focused — e.g. switching to a different block).
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (document.activeElement !== el && el.innerHTML !== value) {
      el.innerHTML = value ?? '';
    }
  }, [value]);

  function exec(command: string, arg?: string) {
    ref.current?.focus();
    document.execCommand(command, false, arg);
    if (ref.current) onChange(ref.current.innerHTML);
  }

  const commands: Cmd[] = [
    { label: 'B', title: 'Tučně', run: () => exec('bold') },
    { label: 'I', title: 'Kurzíva', run: () => exec('italic') },
    { label: 'H2', title: 'Nadpis', run: () => exec('formatBlock', 'h2') },
    { label: 'H3', title: 'Podnadpis', run: () => exec('formatBlock', 'h3') },
    { label: '¶', title: 'Odstavec', run: () => exec('formatBlock', 'p') },
    { label: '• Seznam', title: 'Odrážky', run: () => exec('insertUnorderedList') },
    { label: '1. Seznam', title: 'Číslovaný seznam', run: () => exec('insertOrderedList') },
    {
      label: '🔗 Odkaz',
      title: 'Vložit odkaz',
      run: () => {
        const url = window.prompt('Adresa odkazu (URL):', 'https://');
        if (url) exec('createLink', url);
      },
    },
    { label: '⨯ Formát', title: 'Odstranit formátování', run: () => exec('removeFormat') },
  ];

  return (
    <div style={{ border: '1px solid #ddd', borderRadius: 6, overflow: 'hidden' }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 2, padding: '0.35rem', background: '#f7f8fa', borderBottom: '1px solid #eee' }}>
        {commands.map((c) => (
          <button
            key={c.label}
            type="button"
            title={c.title}
            onMouseDown={(e) => e.preventDefault() /* keep selection */}
            onClick={c.run}
            style={{
              padding: '0.25rem 0.5rem',
              background: '#fff',
              border: '1px solid #dde',
              borderRadius: 4,
              fontSize: '0.75rem',
              cursor: 'pointer',
              fontWeight: c.label === 'B' ? 700 : 400,
              fontStyle: c.label === 'I' ? 'italic' : 'normal',
            }}
          >
            {c.label}
          </button>
        ))}
      </div>
      <div
        ref={ref}
        contentEditable
        suppressContentEditableWarning
        onInput={(e) => onChange((e.target as HTMLDivElement).innerHTML)}
        style={{
          minHeight,
          padding: '0.75rem',
          fontSize: '0.9375rem',
          lineHeight: 1.6,
          outline: 'none',
        }}
      />
    </div>
  );
}
