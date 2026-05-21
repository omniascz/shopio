# Shopio Brand Guidelines

> Quick reference. Full spec: [`zadani/35-graphic-templates.md`](../zadani/35-graphic-templates.md).

**Verze:** 0.1 (DRAFT — pre-Fáze 1)
**Last updated:** 2026-05-21

---

## 🎯 Brand essence

**Mission:** EU-first e-commerce platform that's open by default, AI-native by design, and built for the long haul.

**Personality:** Helpful expert + honest builder + EU craftsman.

**Tone:**

- Confident but calm
- Jargon-aware (skip when unnecessary)
- Czech-first localized; English primary global
- **Avoid:** emojis in product UI, exclamation overuse, AI-buzzword salad

---

## 🟦 Color palette

### Primary brand

| Token                   | Hex       | Use                            |
| ----------------------- | --------- | ------------------------------ |
| `brand-primary`         | `#0066FF` | Primary CTAs, links            |
| `brand-primary-pressed` | `#0052CC` | Pressed/active state           |
| `brand-primary-soft`    | `#E5F0FF` | Background tints               |
| `brand-accent`          | `#FF6B35` | Highlights, badges (sparingly) |

### Neutrals

| Token              | Hex       | Use                   |
| ------------------ | --------- | --------------------- |
| `brand-ink`        | `#0A0A0A` | Primary text on light |
| `brand-paper`      | `#FAFAFA` | Background on light   |
| `brand-ink-dark`   | `#F4F4F5` | Text on dark mode     |
| `brand-paper-dark` | `#0A0A0A` | Background dark       |

### Semantic

| Token     | Hex       | Use           |
| --------- | --------- | ------------- |
| `success` | `#10B981` | Success state |
| `warning` | `#F59E0B` | Warning state |
| `danger`  | `#EF4444` | Error state   |
| `info`    | `#3B82F6` | Informational |

### Contrast requirements

- Body text: ≥ 4.5:1 vs background (WCAG 2.2 AA)
- Large text (18pt+): ≥ 3:1
- UI components: ≥ 3:1
- Focus indicators: ≥ 3:1 against adjacent

---

## ✏️ Typography

### Font stack

```css
--brand-font-sans: 'Inter', 'Inter Variable', system-ui, -apple-system, sans-serif;
--brand-font-serif: 'Source Serif 4', 'Iowan Old Style', serif; /* editorial only */
--brand-font-mono: 'JetBrains Mono', 'Fira Code', monospace;
```

### Weights

- **400** — Regular (body)
- **500** — Medium (UI labels)
- **600** — Semibold (headings default)
- **700** — Bold (hero h1 only; sparingly)

### Type scale

8pt rhythm, mobile-first:

| Token        | Mobile | Desktop |
| ------------ | ------ | ------- |
| h1-hero      | 36px   | 60px    |
| h1-page      | 28px   | 36px    |
| h2-section   | 24px   | 30px    |
| h3-block     | 20px   | 24px    |
| body-lead    | 18px   | 18px    |
| body-default | 16px   | 16px    |
| body-small   | 14px   | 14px    |

---

## 🖼️ Logo

### Status

**TODO Fáze 0 týden 2-4:**

- [ ] Final wordmark design (Inter SemiBold + custom tuning)
- [ ] Symbol design ("S" within rounded square, 8px radius @ 64px)
- [ ] Variants: light bg / dark bg / single-color / monochrome
- [ ] Favicon (16/32/48/64/128/192/512px)
- [ ] App icon (PNG + SVG)
- [ ] OG default image (1200×630px)
- [ ] Marketing site hero
- [ ] Letterhead + invoice template logo

### Specs (per `35 §2.1`)

- **Wordmark**: "Shopio" set in Inter SemiBold (custom-tuned tracking)
- **Symbol**: stylized "S" within rounded square (8px radius at 64px display)
- **Lockup**: wordmark + symbol horizontal, OR symbol only

### Clear space

- 0.5× symbol height all sides
- Never crop, distort, recolor outside palette
- Never add drop shadows / outlines / gradients

### Min size

- Print: 12mm wordmark width
- Digital: 80px wordmark width / 24px symbol

### Tooling recommendations

- **Figma** primary (vector design)
- Export: SVG (master), PNG (raster: 64/128/256/512/1024px)
- Optimize SVGs via SVGO
- Subset variable fonts via fonttools

---

## 🎨 Visual style

### Photography

Per `35 §8`:

- **Product**: neutral background (white #FFFFFF or soft gray #F4F4F5)
- **Lifestyle**: real photography (no AI-generated humans for marketing)
- **Aspect ratios**: 1:1 default, 3:4 fashion, 4:3 lifestyle, 16:9 hero
- **Format**: WebP primary, AVIF modern, JPEG fallback
- **Compression target**: hero < 300KB, thumbnail < 50KB

### Illustration

- Minimal usage (don't dilute brand)
- Style: line + soft fill, muted palette + accent
- Avoid generic "isometric SaaS" overused style
- Custom: empty states, onboarding, marketing hero accents

### Iconography

- **Lucide React** primary (1500+ icons, 1.5px stroke)
- Override default 2px stroke → 1.5px globally (matches Inter weight)
- Sizing: 12/16/20/24/32/48px tokens
- `currentColor` everywhere (inherit text color)

---

## ✍️ Voice & tone examples

### Headlines

✅ "EU-first commerce. Open by default. AI-native by design."
❌ "Revolutionary AI-powered e-commerce platform that disrupts!" (buzzword salad)

### Error messages

✅ "Card declined. Try a different one or contact your bank."
❌ "ERROR_CODE_403: Payment processing failed"

### Marketing copy

✅ "We host MCP servers per tenant. Your AI agents just work."
❌ "Industry-leading AI agent integration capabilities!" (vague + hype)

### Customer service replies

✅ Direct, friendly, jargon-free. Always sign off with name (not "Shopio Team").

### Czech vs English voice

- Czech: slightly more formal but warm. Vy/vás (not ty/tebe).
- English: direct, conversational US/UK-neutral.
- Both: never patronizing, never "growth-hacker"-y.

---

## 📐 Layout principles

Per `35 §6`:

- 4pt-based spacing scale
- Container widths: narrow 768px / default 1280px / wide 1440px / full
- Responsive breakpoints: 640/768/1024/1280/1536
- Mobile-first: base styles < 640px

---

## 🔧 Implementation

Brand tokens live in:

- **Code:** [`packages/ui/src/tokens/index.ts`](../packages/ui/src/tokens/index.ts) + [`packages/ui/src/styles/globals.css`](../packages/ui/src/styles/globals.css)
- **Figma:** [Tokens Studio plugin](https://tokens.studio/) sync (Fáze 0 setup TODO)
- **Tailwind:** `tailwind.config.ts` reads from tokens

Single source of truth: TypeScript constants → all other formats generated.

---

## 📁 Brand asset directory

Once final:

```
brand/
├── README.md           ← you are here
├── logo/
│   ├── wordmark.svg
│   ├── symbol.svg
│   ├── lockup.svg
│   └── variants/
│       ├── light.svg
│       ├── dark.svg
│       └── mono.svg
├── favicon/
│   ├── favicon.svg
│   ├── favicon.ico
│   └── apple-touch-icon.png
├── og-images/
│   ├── default-og.png    (1200x630)
│   └── twitter-card.png
├── press/
│   ├── press-kit.pdf
│   └── product-screenshots/
└── fonts/
    ├── Inter-Variable.woff2
    └── JetBrainsMono.woff2
```

---

## TODO Fáze 0 brand work

- [ ] Logo design (founder or hired designer; budget €500-2000)
- [ ] Figma project setup s Tokens Studio sync
- [ ] Brand asset directory populated
- [ ] Marketing site mockup
- [ ] Email template designs (transactional + marketing)
- [ ] Pitch deck template (pro design partner outreach)
- [ ] Social media profiles setup (LinkedIn, X, GitHub, Mastodon optional)

---

**DRAFT — vyžaduje:**

- [ ] Final logo design
- [ ] Trademark registrace
- [ ] Photography style audit po prvních fotkách
- [ ] Customer feedback během Fáze 1 design partner program
