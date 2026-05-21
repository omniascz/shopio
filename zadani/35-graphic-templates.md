# 35 – GRAPHIC TEMPLATES & DESIGN SYSTEM

> **Doména:** Design system reference — Shopio brand identity (logo, colors, voice), design tokens (colors / typography / spacing / shadows / radius / animations), component library reference (shadcn/ui base + Shopio extensions), layout patterns, iconography (Lucide), imagery guidelines, email design templates, storefront + admin design patterns, marketing site design, accessibility (WCAG 2.2 AA), dark mode, responsive breakpoints, animation principles, print design (invoices, receipts, ISDOC), localization considerations (RTL, longer translations, diacritics).

**Datum:** 2026-05-20
**Verze:** 1.0
**Status:** 🟡 DESIGN
**Reference:** [26-themes-storefront.md §6](26-themes-storefront.md#6-design-tokens) · [27-admin-backoffice.md §5](27-admin-backoffice.md#5-component-library) · [DEC-FE-002](01-decisions-registry.md#dec-fe-002-styling-strategy)

---

## 📑 Obsah

0. [Domain overview](#0-domain-overview)
1. [References](#1-references)
2. [Brand identity](#2-brand-identity)
3. [Design tokens — core](#3-design-tokens--core)
4. [Typography system](#4-typography-system)
5. [Color system](#5-color-system)
6. [Spacing & layout](#6-spacing--layout)
7. [Iconography](#7-iconography)
8. [Imagery guidelines](#8-imagery-guidelines)
9. [Component library reference](#9-component-library-reference)
10. [Layout patterns](#10-layout-patterns)
11. [Email design templates](#11-email-design-templates)
12. [Print design templates](#12-print-design-templates)
13. [Storefront design patterns](#13-storefront-design-patterns)
14. [Admin design patterns](#14-admin-design-patterns)
15. [Marketing site design](#15-marketing-site-design)
16. [Animation principles](#16-animation-principles)
17. [Accessibility](#17-accessibility)
18. [Localization considerations](#18-localization-considerations)
19. [Implementation checklist](#19-implementation-checklist)
20. [Open questions](#20-open-questions)

---

## 0. Domain overview

### 0.1 Co tato doména **je**

- **Centralized design language** — single source of truth pro vzhled Shopio platformy + suggested patterns pro merchant storefronty + admin
- **Brand identity** — Shopio jako značka (loga, color palette, voice, persona); použít pro marketing site, app shell, dokumentaci
- **Design tokens** — CSS variables (colors, typography, spacing, shadows, radius, motion) konzistentně napříč admin + storefront + emaily + dokumenty
- **Component visual reference** — Storybook-like documentation pro shadcn/ui base + Shopio extensions; per `27 §5`
- **Pattern library** — reusable layouts (dashboards, forms, lists, detail pages, empty states, ...)
- **Communication design** — email templates, PDF invoices, receipts (ISDOC), shipping labels
- **Iconography** — Lucide standard + occasional custom; consistent stroke width + sizing
- **Imagery guidelines** — product photography, lifestyle, marketing creative — for both Shopio brand + advisory pro merchants
- **Accessibility-first** — design tokens + components naplňují WCAG 2.2 AA mandatorně
- **Multi-language ready** — typography + layouts handle Czech diacritics, longer German translations, RTL (Fáze 3+ Arabic/Hebrew)
- **Theme-agnostic core** — tokens reusable; per-theme overrides documented (per `26 §6`)

### 0.2 Co tato doména **NENÍ**

- ❌ Implementation of components (→ `26 §5`, `27 §5`)
- ❌ Theme marketplace catalog (→ `26 §3.10`)
- ❌ Logo/brand asset files (separate brand bible repository, ne zde)
- ❌ Marketing copy / messaging strategy (out of build-spec scope)
- ❌ Detailed Figma files (link from this doc to Figma; ne component-by-component spec)
- ❌ Tenant-specific branding (→ `26-themes-storefront.md` tenant theme customization)
- ❌ Storefront theme building details (→ `26`)
- ❌ Admin UI implementation details (→ `27`)
- ❌ Print mailing/packaging design

### 0.3 Diferenciátory

1. **Tokens-first** — vše CSS variables; runtime customizable; consistency napříč 5 surfaces (storefront, admin, email, print, marketing)
2. **shadcn/ui foundation** — proven, accessible, modern; copy-paste model = ownership
3. **Czech-first typography** — fonts tested s českou diakritikou
4. **Dark mode native** — design tokens designed for both light + dark from day 1
5. **Print-ready** — invoice/receipt templates ISDOC 6.0.1 compliant + EU accessibility
6. **Email tested** — templates render correctly v top 12 email clients (Gmail, Outlook, Apple Mail, ...)
7. **Component minimalism** — < 80 components total; reuse > new component

---

## 1. References

- [DEC-FE-002](01-decisions-registry.md#dec-fe-002-styling-strategy) — Tailwind + shadcn/ui
- [26-themes-storefront.md §6](26-themes-storefront.md#6-design-tokens) — storefront design tokens
- [27-admin-backoffice.md §5](27-admin-backoffice.md#5-component-library) — admin components
- [19-marketing-seo.md](19-marketing-seo.md) — email templates marketing context
- [15-tax-compliance.md](15-tax-compliance.md) — ISDOC invoice format
- [23-i18n.md](23-i18n.md) — locale + RTL
- [33-ai-features.md](33-ai-features.md) — AI Copilot UI patterns
- Tailwind CSS 4 docs
- shadcn/ui docs
- Lucide React icons
- Radix UI primitives
- WCAG 2.2 AA standard
- Material Design 3 (reference, not adopted)
- Apple HIG (reference)
- A11y patterns (Inclusive Components, Smashing Magazine)
- ISDOC 6.0.1 specification (CZ invoice format)
- Letter standards (DIN A4, US Letter)
- Email rendering quirks (Litmus, Email on Acid testing references)

---

## 2. Brand identity

### 2.1 Logo

#### 2.1.1 Primary mark

- **Wordmark**: "Shopio" set in custom-tuned Inter SemiBold; tracking adjusted for balanced rhythm
- **Symbol**: stylized "S" within rounded square (8px radius at 64px); usable as favicon, app icon, OG default
- **Lockup**: wordmark + symbol horizontal OR symbol only

#### 2.1.2 Variants

- Light backgrounds: ink black logo (`#0A0A0A`)
- Dark backgrounds: paper white logo (`#FAFAFA`)
- Color logo (rare; only on neutral): primary blue `#0066FF` + dark text
- Monochrome white-on-color: hero placements
- Single-color: any brand-approved hue

#### 2.1.3 Clear space + min size

- Clear space: 0.5× symbol height all sides
- Min size print: 12mm width wordmark
- Min size digital: 80px width wordmark / 24px symbol

#### 2.1.4 Don'ts

- No outlines, drop shadows, gradients on logo
- No squashing / stretching
- No background pattern behind without solid color tile
- No re-coloring outside approved palette

### 2.2 Brand voice

- **Personality**: helpful expert + honest builder + EU-craftsman
- **Tone**: confident, calm, jargon-aware (skip when unnecessary)
- **Language**: Czech-first localized; English primary global
- **Avoid**: emojis (unless user-generated content surface), exclamation overuse, AI-buzzword salad ("revolutionary", "AI-powered" without specifics)

### 2.3 Brand palette (vs theme-customizable storefront palette)

Brand palette applies to:
- Marketing site (shopio.com)
- Admin shell (frame, not content)
- Default theme starting point
- Documentation
- Status page

Brand palette is a starting point for tenant themes — they override (per `26 §6.2`).

| Token | Hex | Use |
|---|---|---|
| `brand-primary` | `#0066FF` | Primary CTAs, links |
| `brand-primary-pressed` | `#0052CC` | Pressed/active CTA |
| `brand-primary-soft` | `#E5F0FF` | Background tints, alerts |
| `brand-accent` | `#FF6B35` | Highlight, badges (use sparingly) |
| `brand-ink` | `#0A0A0A` | Primary text on light |
| `brand-paper` | `#FAFAFA` | Background on light |
| `brand-ink-dark` | `#F4F4F5` | Text on dark mode |
| `brand-paper-dark` | `#0A0A0A` | Background dark |
| `brand-success` | `#10B981` | Success state |
| `brand-warning` | `#F59E0B` | Warning state |
| `brand-danger` | `#EF4444` | Error state |
| `brand-info` | `#3B82F6` | Informational |

### 2.4 Typography brand

- **Brand serif (rare)**: not used by default; reserved for editorial special
- **Brand sans**: Inter (Open Font License) — system body
- **Brand mono**: JetBrains Mono — code blocks, technical data

---

## 3. Design tokens — core

### 3.1 Token namespace

```
--shopio-{category}-{role}-{state?}
```

Examples:
- `--shopio-color-primary`
- `--shopio-color-primary-hover`
- `--shopio-spacing-md`
- `--shopio-radius-md`
- `--shopio-shadow-lg`
- `--shopio-font-size-base`
- `--shopio-motion-fast`

### 3.2 Token tiers

1. **Primitive tokens** — raw values (`--shopio-blue-500: #0066FF`)
2. **Semantic tokens** — meaningful aliases (`--shopio-color-primary: var(--shopio-blue-500)`)
3. **Component tokens** — bound to specific component (`--shopio-button-primary-bg: var(--shopio-color-primary)`)

Themes override **semantic tokens** typically; primitives stable; component tokens fine-grained adjustments.

### 3.3 Light/dark resolution

```css
:root {
  --shopio-color-bg: var(--shopio-paper);
  --shopio-color-fg: var(--shopio-ink);
}

[data-color-scheme="dark"], :root[data-color-scheme="dark"] {
  --shopio-color-bg: var(--shopio-paper-dark);
  --shopio-color-fg: var(--shopio-ink-dark);
}

@media (prefers-color-scheme: dark) {
  :root:not([data-color-scheme="light"]) {
    --shopio-color-bg: var(--shopio-paper-dark);
    --shopio-color-fg: var(--shopio-ink-dark);
  }
}
```

User toggle override > OS preference. Stored in `localStorage` + synced to user prefs (per `27`).

### 3.4 Token export formats

- **CSS variables** — primary
- **Tailwind config** — `tailwind.config.ts` exports tokens for utility classes
- **JS/TS const** — `@shopio/design-tokens` NPM package for runtime use (email templates, React Native Fáze 4+)
- **Figma variables** — synced via Tokens Studio plugin
- **JSON** — for documentation + Storybook

---

## 4. Typography system

### 4.1 Font stack

```css
--shopio-font-sans: 'Inter', 'Inter Variable', system-ui, -apple-system, 'Segoe UI', 'Roboto', 'Helvetica Neue', Arial, sans-serif;
--shopio-font-serif: 'Source Serif 4', 'Iowan Old Style', 'Apple Garamond', Baskerville, 'Times New Roman', serif;
--shopio-font-mono: 'JetBrains Mono', 'Fira Code', ui-monospace, 'SF Mono', 'Cascadia Code', Consolas, monospace;
```

- **Inter** — primary; variable font; supports CZ diacritics, EU languages, Cyrillic, basic Greek
- **Source Serif 4** — editorial; opt-in per theme (rare for storefront)
- **JetBrains Mono** — admin code blocks, API explorer, technical docs

Loaded via `next/font` (storefront) + self-hosted (admin) — no external font CDN dependencies (perf + privacy).

### 4.2 Type scale (8pt rhythm)

```css
--shopio-font-size-xs:    0.75rem;     /* 12px */
--shopio-font-size-sm:    0.875rem;    /* 14px */
--shopio-font-size-base:  1rem;        /* 16px */
--shopio-font-size-md:    1.125rem;    /* 18px */
--shopio-font-size-lg:    1.25rem;     /* 20px */
--shopio-font-size-xl:    1.5rem;      /* 24px */
--shopio-font-size-2xl:   1.875rem;    /* 30px */
--shopio-font-size-3xl:   2.25rem;     /* 36px */
--shopio-font-size-4xl:   3rem;        /* 48px */
--shopio-font-size-5xl:   3.75rem;     /* 60px */
--shopio-font-size-6xl:   4.5rem;      /* 72px */
```

### 4.3 Heading scale (semantic)

| Token | Mobile | Tablet+ | Use |
|---|---|---|---|
| `h1-hero` | 36px | 60px | Storefront hero, marketing landings |
| `h1-page` | 28px | 36px | Page title (default) |
| `h2-section` | 24px | 30px | Section header |
| `h3-block` | 20px | 24px | Block header |
| `h4-card` | 18px | 20px | Card header |
| `h5-list` | 16px | 16px | List header |
| `h6-eyebrow` | 12px (uppercase, letter-spacing 0.08em) | 14px | Small label above heading |

### 4.4 Body text

| Token | Size | Line-height | Use |
|---|---|---|---|
| `body-lead` | 18px | 1.6 | Lead paragraph |
| `body-default` | 16px | 1.5 | Body |
| `body-small` | 14px | 1.5 | Captions, helpers |
| `body-mono` | 14px | 1.45 | Code blocks |

### 4.5 Weights

- 400 — regular (body)
- 500 — medium (UI labels)
- 600 — semibold (headings default)
- 700 — bold (h1 hero only; sparingly elsewhere)

No italic by default in UI (reserved for editorial / blog).

### 4.6 Line-height + tracking

- Headings: line-height 1.15–1.3 (tighter)
- Body: 1.5 (comfortable reading)
- All caps: tracking +0.04em–+0.10em
- Numerals: tabular numerals via `font-variant-numeric: tabular-nums;` in price + data tables

### 4.7 Rendering rules

- Min font-size body: 14px (admin), 16px (storefront)
- Max line length: 72ch for prose
- Hyphenation: `hyphens: auto` only for justified text (rare; default left-align)
- Text decoration: underlines on links default ON in body prose; OFF in navigation + buttons

---

## 5. Color system

### 5.1 Primitive palette

#### Neutrals
```
gray-50:  #FAFAFA
gray-100: #F4F4F5
gray-200: #E4E4E7
gray-300: #D4D4D8
gray-400: #A1A1AA
gray-500: #71717A
gray-600: #52525B
gray-700: #3F3F46
gray-800: #27272A
gray-900: #18181B
gray-950: #09090B
```

#### Brand blues
```
blue-50:  #EFF6FF
blue-100: #DBEAFE
blue-200: #BFDBFE
blue-300: #93C5FD
blue-400: #60A5FA
blue-500: #3B82F6
blue-600: #0066FF  (brand primary)
blue-700: #0052CC
blue-800: #1E40AF
blue-900: #1E3A8A
```

#### Accent oranges
```
orange-50:  #FFF7ED
orange-500: #FF6B35  (brand accent)
orange-700: #C2410C
```

#### Semantic
```
success: emerald-500 (#10B981)
warning: amber-500   (#F59E0B)
danger:  red-500     (#EF4444)
info:    blue-500    (#3B82F6)
```

### 5.2 Semantic surface tokens

```css
/* Light mode defaults */
--shopio-color-surface-1: var(--shopio-gray-50);     /* page bg */
--shopio-color-surface-2: var(--shopio-white);       /* card bg */
--shopio-color-surface-3: var(--shopio-gray-100);    /* nested */
--shopio-color-surface-overlay: rgba(0,0,0,0.5);     /* modal scrim */

--shopio-color-fg-strong: var(--shopio-gray-900);
--shopio-color-fg-default: var(--shopio-gray-700);
--shopio-color-fg-muted: var(--shopio-gray-500);
--shopio-color-fg-on-primary: white;

--shopio-color-border-default: var(--shopio-gray-200);
--shopio-color-border-strong: var(--shopio-gray-300);
--shopio-color-border-focus: var(--shopio-blue-500);
```

### 5.3 Status colors

| Status | Fg | Bg | Border |
|---|---|---|---|
| success | `success-700` | `success-50` | `success-200` |
| warning | `warning-700` | `warning-50` | `warning-200` |
| danger | `danger-700` | `danger-50` | `danger-200` |
| info | `info-700` | `info-50` | `info-200` |
| neutral | `gray-700` | `gray-100` | `gray-200` |

Used in: badges, banners, alerts, status indicators in tables.

### 5.4 Contrast requirements (WCAG 2.2 AA)

- Body text 4.5:1 vs background minimum
- Large text (18pt+ or 14pt bold) 3:1 minimum
- UI components + graphical objects 3:1
- Focus indicators 3:1 against adjacent

Validated automatically per `30 §16.5` + `26 §RULE-THM-016`.

### 5.5 Color usage rules

- Brand primary: ≤ 1 dominant use per viewport
- Accent orange: highlights + critical CTAs only (eye-catching, scarce)
- Don't use color alone to convey meaning (icon + text + color always)
- Status colors: not for decoration

---

## 6. Spacing & layout

### 6.1 Spacing scale (4pt base, 8pt rhythm dominant)

```css
--shopio-spacing-px:  1px;
--shopio-spacing-0:   0;
--shopio-spacing-1:   4px;
--shopio-spacing-2:   8px;
--shopio-spacing-3:   12px;
--shopio-spacing-4:   16px;
--shopio-spacing-5:   20px;
--shopio-spacing-6:   24px;
--shopio-spacing-8:   32px;
--shopio-spacing-10:  40px;
--shopio-spacing-12:  48px;
--shopio-spacing-16:  64px;
--shopio-spacing-20:  80px;
--shopio-spacing-24:  96px;
--shopio-spacing-32:  128px;
--shopio-spacing-40:  160px;
--shopio-spacing-48:  192px;
```

### 6.2 Component spacing tokens

```css
--shopio-input-padding-x: var(--shopio-spacing-3);
--shopio-input-padding-y: var(--shopio-spacing-2);
--shopio-card-padding: var(--shopio-spacing-6);
--shopio-section-gap: var(--shopio-spacing-12);
--shopio-page-padding-x-mobile: var(--shopio-spacing-4);
--shopio-page-padding-x-tablet: var(--shopio-spacing-8);
--shopio-page-padding-x-desktop: var(--shopio-spacing-16);
```

### 6.3 Radius scale

```css
--shopio-radius-none: 0;
--shopio-radius-sm:   4px;
--shopio-radius-md:   8px;        /* default for buttons, inputs, cards */
--shopio-radius-lg:   12px;       /* prominent cards */
--shopio-radius-xl:   16px;       /* hero blocks */
--shopio-radius-2xl:  24px;
--shopio-radius-full: 9999px;     /* pills, avatars */
```

### 6.4 Shadow scale

```css
--shopio-shadow-xs: 0 1px 2px rgba(0,0,0,0.05);
--shopio-shadow-sm: 0 1px 3px rgba(0,0,0,0.07), 0 1px 2px rgba(0,0,0,0.04);
--shopio-shadow-md: 0 4px 6px rgba(0,0,0,0.07), 0 2px 4px rgba(0,0,0,0.06);
--shopio-shadow-lg: 0 10px 15px rgba(0,0,0,0.10), 0 4px 6px rgba(0,0,0,0.05);
--shopio-shadow-xl: 0 20px 25px rgba(0,0,0,0.10), 0 10px 10px rgba(0,0,0,0.04);
--shopio-shadow-2xl: 0 25px 50px rgba(0,0,0,0.25);
--shopio-shadow-inner: inset 0 2px 4px rgba(0,0,0,0.06);
```

Dark mode: shadows reduced (lower alpha or omitted; borders carry visual separation).

### 6.5 Breakpoints

```css
--shopio-bp-sm: 640px;     /* phones landscape, small tablets */
--shopio-bp-md: 768px;     /* tablets */
--shopio-bp-lg: 1024px;    /* small laptops */
--shopio-bp-xl: 1280px;    /* desktops */
--shopio-bp-2xl: 1536px;   /* large desktops */
```

Mobile-first: base styles for < 640px; add complexity at larger breakpoints.

### 6.6 Container widths

```css
--shopio-container-narrow: 768px;     /* prose, articles */
--shopio-container-default: 1280px;   /* most pages */
--shopio-container-wide: 1440px;      /* dashboards, data tables */
--shopio-container-full: 100%;
```

### 6.7 Grid system

12-column responsive grid via CSS Grid. Common patterns:
- 2-col: hero + image
- 3-col: card grid
- 4-col: product grid (storefront)
- 6/8/12-col: dense data layouts (admin)

```css
.grid-products {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
  gap: var(--shopio-spacing-6);
}
```

---

## 7. Iconography

### 7.1 Icon library

- **Lucide React** — primary set; ~1500 icons; consistent 1.5px stroke, 24px design grid
- **Heroicons** — fallback (compatible style)
- **Custom Shopio icons** — only when necessary (brand-specific: Shopio mark, MCP icon, EU AI Act badge, ...)

### 7.2 Sizing

```
--shopio-icon-xs: 12px   /* inline w/ small body */
--shopio-icon-sm: 16px   /* inline w/ body */
--shopio-icon-md: 20px   /* button icons, default */
--shopio-icon-lg: 24px   /* feature icons */
--shopio-icon-xl: 32px   /* hero feature icons */
--shopio-icon-2xl: 48px  /* illustration accents */
```

### 7.3 Color usage

- Default: inherit text color (`currentColor`)
- Status icons: tinted (success-green, warning-amber, danger-red)
- Decorative: brand-primary or muted-gray
- Don't multi-color in single icon (keep monochromatic)

### 7.4 Stroke width

- Default Lucide 1.5px (their default 2px feels heavy at small sizes — override globally to 1.5)
- Pair with Inter font — both have similar geometric weight

```tsx
import { Icon } from 'lucide-react';
<Icon strokeWidth={1.5} className="w-5 h-5" />
```

### 7.5 Icons + text

- Icon precedes text in buttons: gap 8px (spacing-2)
- Vertical center-align
- Icon size matches text x-height roughly (16px icon + 16px text good)
- Avoid icon-only buttons without tooltip (a11y: aria-label mandatory)

### 7.6 Custom icon guidelines

When custom icon needed:
- 24×24px artboard
- 1.5px stroke
- 2px corner radius for terminals
- No fills (outline style); fill only if Lucide convention (filled stars, hearts)
- Export SVG with `currentColor`
- Add to `@shopio/icons` package

### 7.7 Emoji policy

Per `27 §Tone and style`: avoid emojis in product UI. Acceptable in:
- User-generated content (reviews, customer messages)
- Marketing site copy (sparingly)
- Internal team comms
- Storybook component examples (visual labels)

Never in: admin labels, error messages, button text, default product/page templates.

---

## 8. Imagery guidelines

### 8.1 Product photography

For Shopio brand + recommended to merchants:

#### Style
- **Background**: neutral (pure white #FFFFFF for catalog; soft gray #F4F4F5 for lifestyle)
- **Lighting**: even, slightly diffused; minimal shadows; no harsh contrast
- **Composition**: product centered, breathing room
- **Variations**: hero (clean), lifestyle (in context), detail (close-up textures), size reference

#### Technical
- Hero: minimum 2000×2000 px (zoom-able)
- Thumbnail: 800×800 px (cropped same aspect)
- Aspect ratios: 1:1 (default), 3:4 (fashion portrait), 4:3 (lifestyle), 16:9 (video frames)
- Format: WebP primary, AVIF for modern browsers, JPEG fallback
- Compression: target < 300 KB hero, < 50 KB thumbnail
- Color space: sRGB

#### Vertical-specific
- Fashion: 3:4 portrait; lifestyle dominant
- Food: 4:3; close-up + texture + appetite appeal
- Electronics: 1:1 clean catalog + 4:3 product-in-use
- Jewelry: 1:1 macro detail + 1:1 worn shot
- Furniture: 4:3 wide showing scale + lifestyle in-room

### 8.2 Hero imagery (marketing)

- Cinematic aspect 16:9 or 21:9
- Real photography preferred over stock
- Diverse representation (people, sizes, ages, ethnicities, abilities)
- Don't use AI-generated humans for marketing (legal + ethical concerns)
- Localized: cs-CZ campaigns use Czech-context imagery (Czech towns, language overlay)

### 8.3 OG (Open Graph) images

- 1200×630 px
- Solid color OR brand-gradient background
- Logo + page-specific title + minimal supporting element
- Auto-generated at build time per page (per `19-marketing-seo.md` extended)

### 8.4 Illustration

- Use minimally (don't dilute brand)
- Style: line + soft fill; muted palette + accent
- Avoid generic "isometric SaaS" style (overused, dates fast)
- Custom illustration for: empty states, onboarding, marketing hero accents

### 8.5 Icons vs illustrations

- Icons: small, functional, communicate state/action
- Illustrations: larger, atmospheric, build engagement (empty states, onboarding)

### 8.6 Alt text guidelines

- Required for all `<img>` (per `26 §RULE-THM-016`)
- Decorative images: `alt=""` (intentionally empty)
- Product photos: descriptive (color, key feature) — auto-generated via AI Vision (per `33 §5.6`)
- Avoid "Image of...", "Photo of..." prefix (screen readers say "image" already)
- Max 125 chars practical

### 8.7 Image accessibility

- Don't put critical info in image only (text overlay outside image)
- Provide text alternative for charts (table or descriptive paragraph)
- High-contrast outlines for important elements
- Avoid rapid flashing (seizure risk; <3Hz)

---

## 9. Component library reference

Components shipped via `@shopio/ui` package + shadcn/ui copy-paste base.

### 9.1 Foundation primitives (from shadcn/ui + Radix)

| Component | Purpose |
|---|---|
| `Button` | Primary, Secondary, Outline, Ghost, Destructive, Link variants |
| `Input` | Text, number, email, password, search |
| `Textarea` | Multi-line input |
| `Select` | Dropdown selection (single) |
| `MultiSelect` | Multiple selection (custom Shopio component) |
| `Checkbox`, `Radio`, `Switch` | Toggle inputs |
| `Slider`, `Range` | Numeric range selection |
| `DatePicker`, `DateRangePicker` | Date selection |
| `ColorPicker` | Custom; color swatches + hex input |
| `FileUpload` | Drag-drop + click; preview |
| `MediaPicker` | Custom; integrated with media library |
| `Combobox` | Searchable select |
| `Dialog` (Modal) | Centered overlay |
| `Sheet` (Drawer) | Side drawer (right preferred) |
| `Popover` | Floating panel |
| `Tooltip` | Hover info |
| `DropdownMenu` | Action menu |
| `ContextMenu` | Right-click menu (rare) |
| `Tabs` | Section switching |
| `Accordion` | Collapsible sections |
| `Toast` (Sonner) | Transient notifications |
| `Banner` | Persistent notice (info/warning/error/success) |
| `Skeleton` | Loading placeholder |
| `Spinner` | Loading indicator |
| `Progress` | Determinate progress bar |
| `Avatar` | User/entity avatar |
| `Badge` | Status, tag, count badges |
| `Tag` | Removable label (input filters) |

### 9.2 Layout primitives

| Component | Purpose |
|---|---|
| `PageHeader` | Page title + breadcrumb + actions |
| `PageContent` | Constrained content area |
| `Sidebar`, `SidebarItem`, `SidebarSection` | Nav sidebar |
| `TopBar` | App-wide topbar (admin) |
| `Breadcrumb` | Hierarchy navigation |
| `EmptyState` | Hero illustration + message + CTA |
| `ErrorBoundary` | Catches React errors → fallback UI |
| `SplitLayout` | Two-column layout (sidebar + main) |
| `Card`, `CardHeader`, `CardContent`, `CardFooter` | Card container |
| `Stat` | KPI display (number + label + delta) |
| `Tile` | Larger action card with icon + text |

### 9.3 Data display

| Component | Purpose |
|---|---|
| `DataTable` | Powerful table per `27 §5.2` |
| `Timeline` | Sequential events (order timeline, audit log) |
| `KeyValue` | Definition list pattern |
| `MoneyDisplay` | Money formatting with currency (cross-ref `23`) |
| `PercentDisplay` | Percent with optional indicator (+/- color) |
| `DateDisplay` | Localized date (cross-ref `23`) |
| `RelativeTime` | "2 hours ago" style |
| `Status` | Status badge with semantic color |
| `RatingStars` | 1-5 stars (interactive or display) |
| `Diff` | Side-by-side or inline diff (for revisions) |

### 9.4 Forms

| Component | Purpose |
|---|---|
| `Form` | React Hook Form wrapper |
| `FormField` | Field with label + input + error |
| `FormError` | Error message |
| `FormHint` | Helper text |
| `FormGroup` | Group of related fields |
| `FormSection` | Section header with optional collapse |
| `FormActions` | Sticky bottom actions bar |
| `JsonEditor` | JSON schema-aware (admin) |
| `RichTextEditor` | TipTap-based WYSIWYG |
| `MarkdownEditor` | Split-view markdown |
| `CodeEditor` | Monaco lite (admin code snippets) |
| `AddressForm` | Standard address with country-aware fields |
| `TaxIdInput` | EU VAT ID validator (cross-ref `15`) |
| `PhoneInput` | International (libphonenumber) |

### 9.5 Commerce-specific

| Component | Purpose |
|---|---|
| `ProductCard` | Product grid item |
| `ProductGallery` | Image carousel + thumbnails |
| `VariantPicker` | Size/color selector |
| `PriceDisplay` | Price + compare-at + currency |
| `AddToCartButton` | With qty + state |
| `CartSummary` | Side cart drawer |
| `OrderTimeline` | Order status events |
| `CustomerCard` | Customer info card |
| `AddressBlock` | Formatted address |
| `LineItemRow` | Order/cart line item |
| `ShippingMethodPicker` | Method selection |
| `PaymentMethodPicker` | Payment options |
| `CouponInput` | Promo code |
| `ReviewSnippet` | Star + truncated body |
| `RatingDistribution` | Histogram of ratings |

### 9.6 Admin-specific

| Component | Purpose |
|---|---|
| `CommandPalette` | ⌘K search (cmdk) |
| `NotificationCenter` | Bell dropdown |
| `ResourcePicker` | Modal to pick product/customer/order |
| `BulkActionBar` | Floating action bar |
| `SavedViews` | Filter preset manager |
| `AiCopilotPanel` | Slide-out AI panel |
| `AuditLogViewer` | Filterable audit list |
| `StatusPageEditor` | Incident composition |
| `FeatureFlagToggle` | Quick toggle |

### 9.7 Component states

Every interactive component states:
- Default
- Hover (subtle bg/border shift)
- Focus (visible 2px outline, brand-primary, offset 2px)
- Active/Pressed (slightly darker)
- Disabled (50% opacity, no pointer)
- Loading (spinner replacing content)
- Error (border-danger, hint shown)
- Success (after action, brief checkmark)

---

## 10. Layout patterns

### 10.1 Dashboard pattern (admin)

```
┌──────────────────────────────────────────────────────────────────┐
│ TopBar (logo + store switcher + search + notif + user)           │
├────────┬─────────────────────────────────────────────────────────┤
│ Side   │  PageHeader (title + breadcrumb + actions)              │
│ bar    │  ────────────────────────────────────────────────────── │
│        │  Stats row (KPI cards × 4)                              │
│ Items  │  ────────────────────────────────────────────────────── │
│        │  Primary widget (chart + main data)                     │
│        │  ────────────────────────────────────────────────────── │
│        │  Secondary widgets (2-col grid)                         │
│        │                                                           │
│  AI▶   │                                                           │
└────────┴─────────────────────────────────────────────────────────┘
```

### 10.2 List pattern (admin)

```
┌──────────────────────────────────────────────────────────────────┐
│ PageHeader: Products  [Filter] [Search] [Sort] [⊕ New]            │
├──────────────────────────────────────────────────────────────────┤
│ Filter chips: status=published × Tag: summer × ✕                  │
├──────────────────────────────────────────────────────────────────┤
│ ☐ │ Image │ Title         │ SKU      │ Price   │ Stock │ Status   │
├──────────────────────────────────────────────────────────────────┤
│ ☐ │ ▢      │ Black T-Shirt │ BLT-001  │ 499 Kč  │ 42    │ ● Active │
│ ☐ │ ▢      │ ...           │ ...      │ ...     │ ...   │ ...      │
├──────────────────────────────────────────────────────────────────┤
│ Pagination: ← 1 2 3 ... 12 → · 50/page                            │
└──────────────────────────────────────────────────────────────────┘
```

When rows selected → BulkActionBar appears at bottom.

### 10.3 Detail pattern (admin)

```
┌──────────────────────────────────────────────────────────────────┐
│ ← Back  PageHeader: Edit "Black T-Shirt"  [More ▾] [Save]         │
├──────────────────────────────────────────────────────────────────┤
│ Tabs: General | Variants | Media | SEO | Advanced                 │
├────────────────────────────────────────┬─────────────────────────┤
│ Main editing area                       │ Right sidebar           │
│                                          │  - Status              │
│  Field 1: ____________                   │  - Visibility          │
│  Field 2: ____________                   │  - Categories          │
│  Field 3: ____________                   │  - Tags                │
│                                          │  - Activity            │
│  ...                                     │  - AI suggestions      │
├──────────────────────────────────────────┴─────────────────────────┤
│ Sticky footer: [Cancel] [Save draft] [Publish]                    │
└──────────────────────────────────────────────────────────────────┘
```

### 10.4 Form patterns

#### Inline labels (compact)
```
Title  [___________________________]
SKU    [___________________________]
Price  [___________________________]
```

#### Top labels (default; better mobile)
```
Title
[___________________________]

SKU
[___________________________]

Price
[___________________________]
```

#### Sectioned forms (long)
```
─── General ───
Title ...
SKU ...

─── Pricing ───
Price ...
Compare-at-price ...

─── SEO ───
...
```

### 10.5 Empty states

```
┌──────────────────────────────────────────────────────────────────┐
│                                                                    │
│                       [Illustration: 48-64px]                     │
│                                                                    │
│                    No products yet                                │
│                                                                    │
│       Create your first product to start selling.                 │
│                                                                    │
│                   [⊕ Create your first product]                   │
│                                                                    │
│           Or, import products from CSV / WooCommerce              │
│                                                                    │
└──────────────────────────────────────────────────────────────────┘
```

Empty state checklist:
- Hero illustration (not generic)
- Clear h3 title
- 1-2 sentence helper
- Primary CTA
- Secondary link (alternative action / docs)
- Friendly tone (don't shame the empty state)

### 10.6 Error states

#### Inline (form field)
```
Email
[___________________________]
⚠ Email is required
```

#### Page-level (404, 500)
```
[Illustration]
404 — Page not found
The page you're looking for doesn't exist.
[← Back home]   [🔍 Search]
```

#### Boundary error
Friendly error + reference code + reload + report bug link.

### 10.7 Loading states

- **Skeleton** for predictable content (product card grid, table rows, sidebar)
- **Spinner** for unknown duration / small areas (button submit, partial refresh)
- **Progress bar** for known long task (file upload, bulk action)
- **Optimistic** for fast mutations (no spinner; revert on error)

Avoid: blank screen >300ms, multiple spinners on same page, infinite spinner without timeout.

### 10.8 Modal vs Drawer vs Page

- **Modal**: simple decision, ≤ 5 fields, confirm-style; can be dismissed without losing important state
- **Drawer (Sheet)**: secondary task without losing main context (quick edit, view details, add note); from right side
- **Page**: primary creative/editing task (create/edit product); breadcrumb back-able
- **Inline**: small edits (rename, single field) directly in context

---

## 11. Email design templates

### 11.1 Email design principles

- **Mobile-first** — 60%+ opens on mobile
- **Single column** primary; max 600px wide
- **Web fonts fallback** — system fonts always have fallback stack
- **Image-off resilience** — content readable without images (alt text + text-based hierarchy)
- **Touch targets** — 44×44px minimum
- **Brand consistent** — same tokens as app, scoped to inline styles (email clients don't honor CSS vars)
- **Tested** — Litmus / Email on Acid before each new template ships

### 11.2 Template categories

| Category | Examples |
|---|---|
| Transactional | Order confirmation, shipping update, password reset, MFA code, refund processed, invoice |
| Account | Welcome, email verification, profile changed |
| Marketing | Promotions, newsletter, abandoned cart |
| Operational | Stock alert, low inventory, weekly digest |
| Compliance | DPA renewal, security alert |

### 11.3 Standard email anatomy

```
─────────────────────────────────────────
[Pre-header — 80 chars, summary]
─────────────────────────────────────────
[Header: Shopio logo or tenant brand logo]
─────────────────────────────────────────
[Hero block — 1-line headline + 1 paragraph]
─────────────────────────────────────────
[Body — content]
─────────────────────────────────────────
[CTA button — 1 primary, max 1 secondary]
─────────────────────────────────────────
[Footer — links: unsubscribe, privacy, contact]
[Address + GDPR + legal]
─────────────────────────────────────────
```

### 11.4 Transactional template — Order confirmation

```
Subject: Order #ORD-2026-12345 confirmed
Pre-header: Thanks for your order, Jana. Estimated delivery 23 May.

[Header: Tenant logo]

Order confirmed
Thanks for your order, Jana!

Order #ORD-2026-12345
Placed: 20 May 2026, 16:42

┌─────────────────────────────────────────┐
│ Items                                    │
├─────────────────────────────────────────┤
│ [img] Black Ceramic Bowl × 1   599 Kč   │
│ [img] Vintage Mug × 2          798 Kč   │
├─────────────────────────────────────────┤
│ Subtotal                      1,397 Kč  │
│ Shipping (Zásilkovna)            79 Kč  │
│ VAT                                 ... │
│ Total                         1,500 Kč  │
└─────────────────────────────────────────┘

Shipping to:
Jana Nováková
Václavské náměstí 1
110 00 Praha
+420 123 456 789

[Track your order]   →   [View invoice]

Need help? Reply to this email or visit our help center.

──
Acme Pottery
Karlín 123, 186 00 Praha
DIČ: CZ12345678
Privacy · Terms · Unsubscribe
```

### 11.5 Email design tokens (inline-safe)

Templates use inline styles (email clients don't honor `<style>` or CSS vars reliably).

```html
<table style="background:#FAFAFA;padding:32px 16px;font-family:Inter,Arial,sans-serif;">
  <td style="background:#FFFFFF;border-radius:8px;padding:32px;">
    <h1 style="font-size:24px;color:#0A0A0A;margin:0 0 16px 0;">Order confirmed</h1>
    <p style="font-size:16px;line-height:1.5;color:#3F3F46;">...</p>
    <a href="..." style="display:inline-block;background:#0066FF;color:#FFFFFF;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:500;">Track your order</a>
  </td>
</table>
```

Template engine: MJML → HTML compile; React Email for type-safe authoring.

### 11.6 Plain-text fallback

Every email has plain-text version:
```
Order confirmed
==============

Thanks for your order, Jana!

Order #ORD-2026-12345
Placed: 20 May 2026, 16:42

Items:
- Black Ceramic Bowl x 1   599 Kč
- Vintage Mug x 2          798 Kč

Total: 1,500 Kč

Track: https://shop.acme.com/orders/ORD-2026-12345
```

### 11.7 Dark mode email

Email dark mode unreliable (clients invert images, override colors inconsistently). Approach:
- Use semi-neutral palette (gray-100 bg, gray-900 text) — survives most inversions
- `<meta name="color-scheme" content="light dark">` declaration
- Test in Gmail, Outlook, Apple Mail dark modes
- Don't rely on dark mode; design legible light primary

### 11.8 Compliance footer mandatory

Every commercial email:
- Sender legal entity name + address
- Unsubscribe link (1-click)
- Privacy policy link
- DIČ/IČO if applicable (CZ)
- "Reason you're receiving" disclosure (per CAN-SPAM US, ePrivacy EU)

Per `19-marketing-seo.md` automation.

---

## 12. Print design templates

### 12.1 Document categories

| Doc | Format | Standard |
|---|---|---|
| Invoice | PDF A4 | ISDOC 6.0.1 + visual layout |
| Tax invoice (DPH) | PDF A4 | CZ DPH compliant |
| Order receipt | PDF A4 | Compact summary |
| Packing slip | PDF A4 | Warehouse-friendly |
| Shipping label | PDF/PNG carrier-specific size | per carrier integration (per `14`) |
| POS receipt | Thermal 80mm | ESC/POS (Fáze 3+) |
| Return slip | PDF A4 | Includes RMA code |
| Refund credit note | PDF A4 | ISDOC 6.0.1 credit note |

### 12.2 Invoice layout (A4 default)

```
┌──────────────────────────────────────────────────────────────────┐
│ [Tenant logo]                              FAKTURA — DAŇOVÝ DOKLAD │
│                                            č. 2026/05/00123       │
│                                            Datum: 20. 05. 2026    │
├────────────────────────────────┬─────────────────────────────────┤
│ Dodavatel                       │ Odběratel                       │
│ Acme Pottery s.r.o.             │ Jana Nováková                  │
│ Karlín 123                       │ Václavské nám. 1               │
│ 186 00 Praha                     │ 110 00 Praha                   │
│ IČO: 12345678                    │                                 │
│ DIČ: CZ12345678                  │                                 │
│ Plátce DPH                       │                                 │
├──────────────────────────────────────────────────────────────────┤
│ Položka              Množ.  Cena/ks  DPH%   Cena bez DPH  Vč. DPH│
├──────────────────────────────────────────────────────────────────┤
│ Black Ceramic Bowl    1     495,04   21%    495,04         599,00│
│ Vintage Mug           2     329,75   21%    659,50         798,00│
│ Doprava (Zásilkovna)  1      65,29   21%     65,29          79,00│
├──────────────────────────────────────────────────────────────────┤
│ Rekapitulace DPH                                                  │
│   Sazba 21%:         1.239,67 Kč × 21% = 260,33 Kč               │
├──────────────────────────────────────────────────────────────────┤
│ Cena bez DPH:                                          1.239,67 Kč│
│ DPH 21%:                                                  260,33 Kč│
│ CELKEM K ÚHRADĚ:                                        1.500,00 Kč│
├──────────────────────────────────────────────────────────────────┤
│ Forma úhrady: Karta (zaplaceno)                                   │
│ Variabilní symbol: 202605000123                                    │
├──────────────────────────────────────────────────────────────────┤
│ Datum vystavení: 20. 05. 2026                                     │
│ Datum zdanitelného plnění: 20. 05. 2026                           │
│ Datum splatnosti: 20. 05. 2026                                     │
└──────────────────────────────────────────────────────────────────┘

Generated electronically. Valid without signature per Act 235/2004 Sb.
```

Detail per `15-tax-compliance.md` ISDOC 6.0.1 schema.

### 12.3 Typography for print

- Body: 10–11pt (smaller than web — print readable)
- Heading: 16-20pt
- Footer: 8-9pt
- Font: Inter or Source Sans (free, embeds well in PDF)
- Color: black on white (cost-efficient B&W print)
- Margins: 20mm sides, 15mm top/bottom

### 12.4 Branding in print

- Logo top-left (40-60mm wide)
- Brand color accents minimal (single header band acceptable; avoid full bleed)
- Footer: legal info + page number "1/2"

### 12.5 PDF generation

- Server-side: Puppeteer (headless Chromium) renders HTML→PDF
- Templates in React (React-pdf alt for higher control)
- ISDOC XML embedded in PDF for machine-readable
- A11y: tagged PDF (PDF/UA-compliant Fáze 2+)
- Accessibility outline (table of contents bookmarks for long docs)

### 12.6 Localization in print

- Currency formatting per locale (`Intl.NumberFormat`)
- Date formatting per locale
- Decimal separator: comma for CZ/EU; period for US
- Translated labels (default cs-CZ; per customer locale)

### 12.7 POS receipt (Fáze 3+)

- 80mm thermal paper
- 32 character width
- Plain ASCII; QR code at bottom for review request
- ESC/POS commands per carrier

```
       ACME POTTERY
       Karlín 123, Praha
       IČO: 12345678
       DIČ: CZ12345678
================================
Receipt #2026/05/00123
20.05.2026 16:42

Black Ceramic Bowl
  1 x 599,00              599,00
Vintage Mug
  2 x 399,00              798,00
--------------------------------
Subtotal               1.397,00
VAT 21%                  291,57
--------------------------------
TOTAL                  1.500,00

Paid: Card xxxx-1234

Thank you!
[QR: review link]
================================
```

---

## 13. Storefront design patterns

### 13.1 Hero patterns

Per `26 §3.4` theme section catalog:

- **Editorial hero** — full-bleed image + minimal text overlay (Fashion, Lifestyle)
- **Split hero** — image left + text right (B2C product launch)
- **Video hero** — autoplay muted background (with reduced-motion fallback)
- **Carousel hero** — 3-5 slides max; auto-advance 7s; pause on hover
- **CTA hero** — bold headline + subhead + primary CTA + supporting badges

### 13.2 Product card patterns

```
┌─────────────────┐
│                  │
│    [Image]       │
│   (1:1 / 3:4)    │
│                  │
├─────────────────┤
│ Brand            │
│ Product title    │ 2 lines max, ellipsis
│ ★★★★☆ 4.5 (203)  │
│ 599 Kč  -10%    │ compare-at strikethrough
└─────────────────┘
```

Variants:
- **Minimal**: image + title + price only (clean grid)
- **Detailed**: above + rating + badge + variants swatches
- **Editorial**: image dominant, text overlay
- **Quick view**: hover overlays "Quick View" button → modal

### 13.3 PDP (Product Detail Page) patterns

```
┌──────────────────────────────────────────────────────────────────┐
│ Breadcrumb: Home / Pottery / Bowls / Black Ceramic Bowl           │
├──────────────────────────────────────┬───────────────────────────┤
│ [Gallery: thumbnails + main image]    │ Brand                    │
│                                        │ Product title (h1)        │
│                                        │ ★★★★☆ 4.5 (203 reviews)   │
│                                        │                          │
│                                        │ 599 Kč                   │
│                                        │                          │
│                                        │ Color: [swatch][swatch] │
│                                        │ Size: [picker]           │
│                                        │                          │
│                                        │ [Add to cart]            │
│                                        │ [♡ Wishlist]             │
│                                        │                          │
│                                        │ ★ Free shipping over 1000│
│                                        │ ★ 14-day returns         │
├──────────────────────────────────────────────────────────────────┤
│ Tabs: Description | Specs | Reviews | Care                        │
├──────────────────────────────────────────────────────────────────┤
│ You might also like (related products grid)                       │
└──────────────────────────────────────────────────────────────────┘
```

### 13.4 Cart drawer pattern

```
┌─────────────────────────┐
│ Your cart      ×        │
├─────────────────────────┤
│ [img] Black Bowl        │
│      Color: Black        │
│      1 × 599 Kč   [×]   │
│      [- 1 +]             │
├─────────────────────────┤
│ Subtotal       1,397 Kč │
│ Free shipping unlocked! │
│                          │
│ [Proceed to checkout]   │
│   Continue shopping     │
└─────────────────────────┘
```

### 13.5 Checkout pattern

Per `12-checkout.md` multi-step or accordion-style:

```
┌──────────────────────────────────────────────────────────────────┐
│ [Logo]                                  Order summary →           │
├────────────────────────────────────────────┬──────────────────────┤
│ Express checkout                            │ [Item 1]            │
│ [Apple Pay] [Google Pay] [PayPal]           │ [Item 2]            │
│       — or —                                │                      │
│                                              │ Subtotal   1,397 Kč │
│ 1. Email                                     │ Shipping     79 Kč │
│ 2. Shipping address                          │ VAT       (incl.) │
│ 3. Shipping method                           │ Total    1,500 Kč  │
│ 4. Payment                                   │                      │
│ 5. Review & place order                      │ [Discount code]    │
└────────────────────────────────────────────┴──────────────────────┘
```

### 13.6 Collection / category page

```
┌──────────────────────────────────────────────────────────────────┐
│ [Hero banner — category-themed]                                   │
├──────────────────────────────────────────────────────────────────┤
│ Breadcrumb · 248 products                                         │
├──────────────────────────────────────────────────────────────────┤
│ [Filters sidebar]              [Products grid 2-4 columns]        │
│ Categories                                                         │
│ Brand                                                              │
│ Price range                                                        │
│ Color (per profile)                                                │
│ Size                                                               │
│ ...                                                                │
├──────────────────────────────────────────────────────────────────┤
│ Pagination / Load more                                            │
└──────────────────────────────────────────────────────────────────┘
```

### 13.7 Account dashboard

```
┌──────────────────────────────────────────────────────────────────┐
│ Hi, Jana                                                          │
├──────────────────────────────────────────────────────────────────┤
│ Nav: Overview · Orders · Addresses · Payment · Preferences        │
├──────────────────────────────────────────────────────────────────┤
│ [Recent order card × 3]                                           │
│                                                                    │
│ [Wishlist preview]    [Recommended for you]                       │
└──────────────────────────────────────────────────────────────────┘
```

### 13.8 Mobile patterns

- Bottom-aligned cart button (sticky)
- Hamburger menu OR bottom nav (5-icon tray)
- Full-screen filters/cart drawers (instead of side)
- Larger touch targets (min 44×44px)
- Thumb-zone optimization for primary actions

---

## 14. Admin design patterns

Per `27-admin-backoffice.md` already covers admin UI. Key reinforcements:

### 14.1 Density

Admin denser than storefront:
- Compact tables
- Inline edits
- Multi-pane (sidebar + main + right detail panel)
- Keyboard-first patterns

### 14.2 Information hierarchy

- Page title largest
- Section headers (h2) clear separators
- Field labels above inputs (not inline) for forms
- Help text below field, secondary color

### 14.3 Action affordance

- Primary action (Save, Publish) bottom-right OR top-right
- Destructive actions separate; require confirmation
- Bulk actions floating bar (per `10.4`)

### 14.4 Status indicators

- Color + icon + text (never color alone)
- Dot indicators for compact (status badge ●)
- Full badge with text for clarity (`● Active`, `● Draft`)

### 14.5 Data tables

Per `27 §5.2`. Densest pattern:
- 12-16px row height
- Tabular numerals for prices/quantities
- Right-align numbers
- Status column with badge
- Action column sticky right

### 14.6 Form design admin

- Group related fields in `FormSection`
- Show inline validation eagerly on blur
- Auto-save indicator: "Saved · 2s ago"
- Dirty state banner: "Unsaved changes" + "Discard / Save"

### 14.7 Notification patterns

- Toast (sonner): transient, top-right, auto-dismiss 5s, action button optional
- Banner: persistent at top of page (per page)
- Inline alert: within form/section
- Modal: critical decision required

---

## 15. Marketing site design

Marketing site = separate Next.js app (shopio.com) — uses same design tokens + brand identity.

### 15.1 Marketing site sections

- Home: hero + features + social proof + pricing teaser + CTA
- Features: per-feature deep dives
- Pricing: tier comparison
- Customers: case studies + logos
- Blog: technical + business posts
- Docs: separate docs site (Mintlify or similar)
- About: team + mission
- Trust: compliance + security (per `30 §14.8`)
- Status: status.shopio.com (per `31`)

### 15.2 Marketing site style

- More expressive than app (full-bleed imagery, large hero text)
- Brand voice: confident expert + craftsperson story
- Lots of whitespace
- Real photography preferred over abstract illustrations
- Quotes from real customers (with permission)

### 15.3 Marketing components

Re-use design tokens + many app components. Additional:
- Larger hero (60-80vh)
- Animated stats counter
- Feature comparison table
- Pricing card with toggle (monthly/yearly)
- Customer logo wall
- Testimonial card carousel
- Email signup form (footer)
- Cookie consent banner (default-on for marketing site)

### 15.4 Marketing performance

- LCP < 1.2s (target, faster than app)
- Static rendering preferred (Next.js SSG)
- Image lazy-load below fold
- Font preload critical (Inter)
- < 100KB JS shipped for above-fold content

---

## 16. Animation principles

### 16.1 Motion philosophy

- **Functional**: motion communicates state change, hierarchy, causality
- **Subtle**: most users prefer minimal motion (per `prefers-reduced-motion`)
- **Fast**: < 250ms for most transitions
- **Easeful**: ease-out for entering, ease-in for exiting, ease-in-out for state changes

### 16.2 Motion tokens

```css
--shopio-motion-fast: 150ms;       /* small interactions: hover, focus */
--shopio-motion-base: 250ms;       /* default transitions */
--shopio-motion-slow: 400ms;       /* larger movements: drawer, modal */
--shopio-motion-glacial: 600ms;    /* rare; orchestrated multi-step */

--shopio-easing-standard: cubic-bezier(0.2, 0, 0.2, 1);
--shopio-easing-enter: cubic-bezier(0, 0, 0.2, 1);
--shopio-easing-exit: cubic-bezier(0.4, 0, 1, 1);
--shopio-easing-emphasized: cubic-bezier(0.2, 0, 0, 1);
```

### 16.3 Common motion patterns

| Pattern | Duration | Easing | Notes |
|---|---|---|---|
| Button hover | 150ms | standard | Color/border transitions only |
| Focus ring appearance | instant | n/a | Don't animate focus |
| Fade in (page load) | 250ms | enter | Avoid layout shift |
| Modal open | 250ms | enter | Scale 0.95→1 + opacity 0→1 |
| Modal close | 200ms | exit | Reverse |
| Drawer slide in | 300ms | enter | Slide from edge |
| Tooltip appear | 150ms | enter | Slight delay 300ms hover |
| Toast slide in | 250ms | enter | From top-right |
| Accordion expand | 300ms | standard | Height-based; can be janky |
| Skeleton pulse | 1500ms | linear (infinite) | Subtle opacity |
| Spinner rotation | 1000ms | linear (infinite) | Standard |
| Page transition | 200ms | enter | Optional; preserves cache |

### 16.4 Reduced motion

```css
@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
    scroll-behavior: auto !important;
  }
}
```

Critical: respect user preference. ~30% of users have reduced motion enabled for vestibular reasons.

### 16.5 Don'ts

- No auto-playing video with audio
- No parallax > 50px shift (vestibular)
- No infinite loops > 5 cycles (epilepsy risk; per WCAG 2.3.1)
- No motion >3Hz flash rate
- No animations blocking interaction (>500ms)

### 16.6 Performance

- Animate `transform` + `opacity` only (GPU-accelerated)
- Avoid animating `width`, `height`, `top`, `left` (reflow-causing)
- Use `will-change` sparingly (signals to browser)
- Test on mid-range mobile (Galaxy A series tier)
- Frame budget: 16.67ms per frame at 60fps

---

## 17. Accessibility

### 17.1 WCAG 2.2 AA mandatory

Reinforcement of `26 §15.2`, `27 §16.5`, `30 §RULE-SEC-016`.

### 17.2 Color contrast

- Normal text: 4.5:1 minimum
- Large text (18pt+ or 14pt bold): 3:1 minimum
- UI components + graphical objects: 3:1 minimum
- Focus indicators: 3:1 against adjacent

Validated automatically via:
- Stylelint plugin
- axe-core in CI
- Manual review for complex compositions

### 17.3 Focus management

- Visible focus on all interactive elements
- 2px outline + 2px offset, brand-primary or high-contrast
- Focus order logical (tab order matches visual)
- No focus traps (except modals; with explicit dismissal)
- Return focus on modal close to invoking element

```css
:focus-visible {
  outline: 2px solid var(--shopio-color-border-focus);
  outline-offset: 2px;
  border-radius: var(--shopio-radius-md);
}
```

### 17.4 Keyboard navigation

- Every interactive element keyboard-accessible
- ⌘K command palette + standard shortcuts (per `27 §RULE-ADM-012`)
- Skip-to-content link (visible on focus)
- Modal `Esc` dismiss
- Dropdown arrow-key nav
- Grid arrow-key nav for product grids (Fáze 2)

### 17.5 Screen reader support

- Semantic HTML (`<button>` not `<div role="button">`)
- ARIA only when necessary (semantic HTML first)
- `aria-label` for icon-only buttons
- `aria-live` for dynamic content (toasts, loading completion)
- `aria-describedby` for form hints + errors
- Heading hierarchy (h1 → h2 → h3, no skipping)
- Landmark regions (`<main>`, `<nav>`, `<aside>`, `<footer>`)
- Lists actually `<ul>`/`<ol>`

### 17.6 Forms accessibility

- Every input has `<label>` (visible or visually-hidden)
- Required fields announced (`aria-required="true"` + `*` visual)
- Errors associated via `aria-describedby` + `aria-invalid="true"`
- Group related fields with `<fieldset>` + `<legend>`
- Submit button states clear (`disabled` + `aria-busy`)
- Don't disable submit unless absolutely necessary

### 17.7 Touch targets

- Min 44×44px (WCAG 2.5.5)
- Adequate spacing between targets (8px+ recommended)
- Don't rely on hover-only interactions (mobile)

### 17.8 Motion sensitivity

- Respect `prefers-reduced-motion` (per `16.4`)
- No autoplaying carousels for critical info
- No parallax > 50px

### 17.9 Forms — Czech localization

- Inputs accept Czech diacritics (UTF-8)
- Phone input formats CZ +420
- Postcode format CZ 110 00 (or 11000)
- DIČ validator (per `15-tax-compliance.md`)

### 17.10 Testing

- axe-core CI checks
- Manual screen reader smoke tests (NVDA on Windows, VoiceOver on Mac)
- Keyboard-only navigation testing
- Touch device testing (real devices, not just emulator)
- Color-blind simulation (Chrome DevTools)
- Annual external accessibility audit

---

## 18. Localization considerations

### 18.1 Typography for multiple languages

- **Czech**: Inter handles diacritics (á č ď é ě í ň ó ř š ť ú ů ý ž). Test extended Latin glyphs.
- **German**: longer compound words — text wrap correctly; min container widths matter (e.g., "Versandkostenfrei" longer than "Free shipping")
- **Polish**: handles ąćęłńóśźż via Inter
- **Cyrillic**: Russian, Ukrainian, Bulgarian — Inter supports
- **Greek**: limited via Inter; consider fallback for full Greek
- **Arabic**, **Hebrew** (Fáze 3+ RTL): use Noto Sans Arabic / Hebrew fallback

### 18.2 Length variance

| Lang | vs English | Implication |
|---|---|---|
| Czech | +5-15% | Container widths +10% buffer |
| German | +30% | Watch button labels, navigation |
| Russian | +20% | |
| Spanish | +25% | |
| French | +20% | |
| Japanese | -30% | Compact |
| Chinese | -50% | Very compact |
| Arabic | RTL + variance | Full layout mirroring |

Design rule: don't fix-width text containers; let them flex.

### 18.3 RTL layout (Fáze 3+)

- CSS logical properties (`margin-inline-start` not `margin-left`)
- `dir="rtl"` HTML attribute
- Mirror icons that imply direction (arrows, chevrons; not all icons need mirroring — search icon doesn't flip)
- Test layouts manually
- Per `23-i18n.md`

### 18.4 Date + number formatting

- `Intl.DateTimeFormat` for dates per locale
- `Intl.NumberFormat` for numbers + currency
- Czech: comma decimal separator (1 500,00), space thousands separator
- Date format CZ: DD. MM. YYYY (with spaces)
- Currency CZ: amount Kč (suffix) — but per locale customizable

### 18.5 Pluralization

- Use ICU MessageFormat
- Czech has 4 plural forms: 0, 1, 2-4, 5+
- Don't concat strings ("3" + " " + "items" — wrong; "3 items" / "3 položky" / "3 položek")
- Use libraries: `formatjs/icu`, `vocab`

### 18.6 Sorting

- Locale-aware sort (`Intl.Collator`)
- Czech alphabetical: A B C Č D ... E F ... — `ch` is single letter
- Numbers in product titles: natural sort ("Product 2" before "Product 10")

### 18.7 Currency display

Per `23-i18n.md`:
- Symbol position per locale (`499 Kč` vs `$499`)
- Decimal places per currency (Kč 0, EUR 2, JPY 0)
- Negative numbers: `-1 500 Kč` or `(1 500 Kč)` per locale convention

### 18.8 Image-text combinations

- Avoid rendered text in images (untranslatable)
- Use CSS overlay text where possible
- If text in image needed: provide localized variants + alt

---

## 19. Implementation checklist

### Foundation
- [ ] **[S]** `@shopio/design-tokens` NPM package (CSS vars + Tailwind config + TS const + JSON export)
- [ ] **[S]** Token CSS file generated from primitives → semantic → component
- [ ] **[M]** Tailwind 4 config wired to tokens
- [ ] **[M]** shadcn/ui base components installed in admin + storefront
- [ ] **[M]** Figma variables synced via Tokens Studio
- [ ] **[S]** Dark mode toggle wired (OS preference + user override)
- [ ] **[S]** RTL stylesheet variant (Fáze 3+)

### Typography + fonts
- [ ] **[S]** Inter Variable hosted self + preloaded
- [ ] **[S]** Source Serif 4 self-hosted (rarely loaded)
- [ ] **[S]** JetBrains Mono for code
- [ ] **[S]** Typography utility classes per scale

### Components
- [ ] **[L]** Full shadcn/ui base (Button, Input, Select, Dialog, Sheet, Tooltip, DropdownMenu, Tabs, Accordion, Toast, ...)
- [ ] **[L]** Shopio-specific extensions (DataTable, CommandPalette, MediaPicker, AiCopilotPanel, BulkActionBar, ResourcePicker, ...)
- [ ] **[M]** Commerce components (ProductCard, ProductGallery, VariantPicker, CartSummary, OrderTimeline, ...)
- [ ] **[M]** Form components (RHF wrappers + AddressForm + TaxIdInput + PhoneInput)
- [ ] **[M]** Storybook docs per component
- [ ] **[M]** Accessibility annotations in Storybook (axe checks)

### Email
- [ ] **[M]** React Email + MJML pipeline
- [ ] **[L]** ~30 email template designs (order confirmation, shipping update, password reset, MFA, invoice, abandoned cart, ...) per `19-marketing-seo.md`
- [ ] **[S]** Compliance footer template
- [ ] **[S]** Plain-text fallbacks generator
- [ ] **[M]** Litmus / Email on Acid testing setup

### Print
- [ ] **[L]** Invoice PDF template (ISDOC + visual per `15-tax-compliance.md`)
- [ ] **[M]** Receipt PDF template
- [ ] **[M]** Packing slip template
- [ ] **[M]** Refund credit note template
- [ ] **[M]** Return slip template
- [ ] **[S]** POS thermal receipt (Fáze 3+)
- [ ] **[M]** PDF a11y (tagged) (Fáze 2)

### Iconography + imagery
- [ ] **[S]** Lucide React installed + standardized stroke width
- [ ] **[S]** Custom icon set (Shopio mark, MCP, AI Act badge, EU compliance icons)
- [ ] **[M]** Imagery guidelines doc (Notion or docs site)
- [ ] **[M]** Stock photography library curated (initial)

### Marketing site
- [ ] **[L]** Marketing site Next.js (separate from app)
- [ ] **[M]** Marketing-specific components
- [ ] **[M]** Trust center + compliance pages
- [ ] **[M]** Status page integration
- [ ] **[M]** Cookie consent banner

### Documentation
- [ ] **[L]** Storybook hosted (storybook.shopio.dev)
- [ ] **[M]** Design system docs site (Mintlify or similar)
- [ ] **[M]** Brand guidelines PDF (downloadable)
- [ ] **[M]** Email templates preview gallery
- [ ] **[M]** Component usage docs per pattern

### Accessibility
- [ ] **[M]** axe-core CI checks
- [ ] **[M]** Screen reader testing kit + manual QA passes
- [ ] **[M]** Annual external a11y audit
- [ ] **[S]** A11y statement page per VPAT-like

### Localization
- [ ] **[M]** Typography QA in cs-CZ, de-DE, pl-PL, ru-RU
- [ ] **[S]** RTL test pages (Fáze 3+)
- [ ] **[M]** ICU MessageFormat library integration
- [ ] **[S]** Translation memory for design copy

---

## 20. Open questions

### Q-DSY-001: Brand evolution timeline
**Otázka:** Iniciální brand identity (logo, palette) — when's the rebrand review?

**Status:** Iniciální per founder design. Formal brand audit Year 2 once product-market fit clearer. Avoid premature rebrand cost.

### Q-DSY-002: Component library OSS publication
**Otázka:** `@shopio/ui` as public OSS package OR Shopio-internal only?

**Status:** Apache 2.0 OSS aligns s core. Tenants + 3rd-party plugin devs benefit. Per `28-developer-platform.md` SDK MIT license.

### Q-DSY-003: Figma sync automation
**Otázka:** Token sync between Figma + code — manual or tooled (Tokens Studio, Figma Variables API)?

**Status:** Tokens Studio plugin MVP; Figma Variables API (release 2025) Fáze 2.

### Q-DSY-004: Variable fonts vs static
**Otázka:** Inter Variable (single file ~250KB) vs static weights (multiple smaller files)?

**Status:** Variable preferred — single network request, all weights/slants. Static fallback for old browsers (rare).

### Q-DSY-005: Custom illustrations production
**Otázka:** Hire illustrator vs stock vs AI generation?

**Status:** Hand-illustrated + custom commissioned for hero brand moments (empty states, onboarding). Stock for blog posts OK. AI-generated only with disclosure + creative review (legal + ethical).

### Q-DSY-006: Print + ESC/POS Fáze priority
**Otázka:** POS thermal receipt — when needed?

**Status:** Fáze 3+ s POS app launch. Specifications documented now for forward compatibility.

### Q-DSY-007: Email rendering edge cases
**Otázka:** Outlook 2007/2010 still relevant?

**Status:** Out of MVP support. EU enterprise sometimes; document graceful degradation. Focus on Apple Mail, Gmail, Outlook 365 web/desktop.

### Q-DSY-008: Dark mode in print + email
**Otázka:** Print invoice always B&W; email dark mode unreliable across clients.

**Status:** Print B&W mandatory. Email designed for light primary; opt-in dark via `<meta color-scheme>` but don't rely on it.

### Q-DSY-009: AI-generated design assets
**Otázka:** Merchant can use AI to generate hero images, OG images via Shopio AI?

**Status:** Per `33-ai-features.md` Fáze 3+. Watermark + disclosure mandatory per EU AI Act.

### Q-DSY-010: Design tokens vs theme tokens
**Otázka:** Tenants override theme tokens (per `26 §6`); how separate from design system primitives?

**Status:** Per `3.2` 3-tier system: primitives stable, semantic tokens theme-overridable, component tokens fine-grained. Themes override semantic + some component; can't override primitives.

### Q-DSY-011: Animation library
**Otázka:** Framer Motion vs Motion One vs CSS-only?

**Status:** CSS-only for most micro-interactions. Framer Motion for orchestrated multi-element (page transitions, drag-drop). Motion One alternative if bundle size concern.

### Q-DSY-012: Component composition vs configuration
**Otázka:** Headless composition (Radix-style flexibility) vs API-driven props (faster to use)?

**Status:** Both via shadcn/ui pattern. Components composable via slot/children; convenience APIs on common pattern wrappers.

### Q-DSY-013: Document accessibility (PDF/UA)
**Otázka:** Invoices a11y — tagged PDF mandatory?

**Status:** Recommended Fáze 2 (PDF/UA compliance for EU public sector accessibility act). MVP: well-structured + alt text + readable order.

### Q-DSY-014: Design QA process
**Otázka:** Design review gates before merge?

**Status:** Visual regression tests (Chromatic) for component changes. Design lead reviews PRs touching design system. Storybook diff in CI.

---

## 📅 Změny

| Datum | Změna |
|---|---|
| 2026-05-20 | Initial — Design system reference. Shopio brand identity (logo, color, voice), 3-tier design tokens (primitive → semantic → component), Inter + JetBrains Mono typography stack, 12-step color palette + semantic mapping, 4pt-based spacing, Lucide iconography, imagery + photography guidelines, ~80 component reference, layout patterns (dashboard / list / detail / form), email templates (transactional + marketing + plain-text fallback), print templates (invoice ISDOC 6.0.1 / receipt / POS thermal), storefront + admin + marketing design patterns, animation tokens + reduced-motion respect, WCAG 2.2 AA mandate reinforced, localization considerations (CZ + EU + RTL Fáze 3+). 14 open questions. |

---

**Konec Graphic Templates.**

➡️ Pokračovat na: [`36-personas-rbac.md`](36-personas-rbac.md)





