/**
 * AI features (per `33-ai-features.md` MVP) — admin content assists via Claude.
 *
 * Two text tasks: generate a product description and SEO metadata. Uses a plain
 * fetch to the Anthropic Messages API (no SDK dependency). When no API key is
 * configured the helpers return a DETERMINISTIC MOCK (flagged `mock: true`), so
 * the admin "Generate" actions are fully usable in dev/CI — mirroring the
 * Stripe `isStripeEnabled` mock convention.
 *
 * Deferred (per `33`): RAG/embeddings/semantic search, chatbot, recommendations,
 * vision/alt-text, usage metering/budgets/quotas, streaming, conversation
 * history, provider abstraction, moderation.
 */

import type { ShopioConfig } from '../config';

/** Cheap copy tier (per `33 §4.3` fast/balanced) — one-line change to upgrade. */
const MODEL = 'claude-haiku-4-5';
const ANTHROPIC_URL = 'https://api.anthropic.com/v1/messages';
const ANTHROPIC_VERSION = '2023-06-01';

export function isAiEnabled(config: ShopioConfig): boolean {
  return Boolean(config.ANTHROPIC_API_KEY);
}

export class AiError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly httpStatus: number = 502,
  ) {
    super(message);
  }
}

interface CallResult {
  text: string;
  tokens: { input: number; output: number };
}

/** One non-streaming Claude call. Throws AiError on transport/API failure. */
async function callClaude(
  config: ShopioConfig,
  opts: { system: string; user: string; maxTokens: number },
): Promise<CallResult> {
  let res: Response;
  try {
    res = await fetch(ANTHROPIC_URL, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': config.ANTHROPIC_API_KEY!,
        'anthropic-version': ANTHROPIC_VERSION,
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: opts.maxTokens,
        system: opts.system,
        messages: [{ role: 'user', content: opts.user }],
      }),
    });
  } catch (err) {
    throw new AiError('AI_UNREACHABLE', `AI provider unreachable: ${(err as Error).message}`);
  }
  if (res.status === 429) throw new AiError('AI_RATE_LIMITED', 'AI provider rate limit', 429);
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new AiError('AI_PROVIDER_ERROR', `AI provider error ${res.status}: ${body.slice(0, 300)}`);
  }
  const json = (await res.json()) as {
    content?: { type: string; text?: string }[];
    usage?: { input_tokens?: number; output_tokens?: number };
  };
  const text = (json.content ?? [])
    .filter((b) => b.type === 'text' && typeof b.text === 'string')
    .map((b) => b.text!)
    .join('')
    .trim();
  return {
    text,
    tokens: { input: json.usage?.input_tokens ?? 0, output: json.usage?.output_tokens ?? 0 },
  };
}

// =============================================================================
// Product description
// =============================================================================

export interface ProductCopyInput {
  title: string;
  attributes?: Record<string, string>;
  tone?: string;
  lengthWords?: number;
  keywords?: string[];
  locale: string;
}

export async function generateProductDescription(
  config: ShopioConfig,
  input: ProductCopyInput,
): Promise<{ descriptionHtml: string; model: string; tokens: { input: number; output: number }; mock: boolean }> {
  const attrs = Object.entries(input.attributes ?? {}).filter(([k, v]) => k && v);
  const lengthWords = clamp(input.lengthWords ?? 120, 40, 300);

  if (!isAiEnabled(config)) {
    const html =
      `<p>${escapeHtml(input.title)}${input.tone ? ` — ${escapeHtml(input.tone)}` : ''}.</p>` +
      (attrs.length
        ? `<ul>${attrs.map(([k, v]) => `<li><strong>${escapeHtml(k)}:</strong> ${escapeHtml(v)}</li>`).join('')}</ul>`
        : '');
    return { descriptionHtml: html, model: 'mock', tokens: { input: 0, output: 0 }, mock: true };
  }

  const system =
    `You are an e-commerce copywriter for a Czech-first lifestyle store. ` +
    `Write a product description as clean semantic HTML using only <p>, <ul>, <li>, <strong>. ` +
    `No <html>/<head>/<script>, no markdown. Do not invent specs, certifications, or claims ` +
    `not present in the provided attributes. Write in ${input.locale}. Match the requested tone. ` +
    `Respond with the HTML only — no preamble.`;
  const user =
    `Title: ${input.title}\n` +
    (attrs.length ? `Attributes:\n${attrs.map(([k, v]) => `- ${k}: ${v}`).join('\n')}\n` : '') +
    `Tone: ${input.tone ?? 'neutral'}\n` +
    `Target length: ~${lengthWords} words\n` +
    (input.keywords?.length ? `Keywords to weave in naturally: ${input.keywords.join(', ')}\n` : '');

  const { text, tokens } = await callClaude(config, { system, user, maxTokens: 1024 });
  return { descriptionHtml: sanitize(text), model: MODEL, tokens, mock: false };
}

// =============================================================================
// SEO metadata
// =============================================================================

export interface SeoInput {
  title: string;
  descriptionHtml?: string;
  attributes?: Record<string, string>;
  keywords?: string[];
  locale: string;
}

export async function generateSeo(
  config: ShopioConfig,
  input: SeoInput,
): Promise<{ seoTitle: string; metaDescription: string; model: string; tokens: { input: number; output: number }; mock: boolean }> {
  if (!isAiEnabled(config)) {
    const seoTitle = input.title.slice(0, 60);
    const meta = `${input.title}${input.keywords?.length ? ` – ${input.keywords.join(', ')}` : ''}`.slice(0, 155);
    return { seoTitle, metaDescription: meta, model: 'mock', tokens: { input: 0, output: 0 }, mock: true };
  }

  const plain = (input.descriptionHtml ?? '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 1000);
  const attrs = Object.entries(input.attributes ?? {}).filter(([k, v]) => k && v);
  const system =
    `You generate SEO metadata for e-commerce product pages in ${input.locale}. ` +
    `Return ONLY a JSON object {"seoTitle": string, "metaDescription": string}. ` +
    `seoTitle ≤ 60 chars and includes the product name; metaDescription ≤ 155 chars, ` +
    `compelling, includes a primary keyword. Base everything strictly on the provided ` +
    `product data — invent nothing. No markdown, no code fences.`;
  const user =
    `Title: ${input.title}\n` +
    (plain ? `Description: ${plain}\n` : '') +
    (attrs.length ? `Attributes: ${attrs.map(([k, v]) => `${k}=${v}`).join(', ')}\n` : '') +
    (input.keywords?.length ? `Keywords: ${input.keywords.join(', ')}\n` : '');

  const { text, tokens } = await callClaude(config, { system, user, maxTokens: 256 });
  let seoTitle = input.title.slice(0, 60);
  let metaDescription = '';
  try {
    const parsed = JSON.parse(stripFences(text)) as { seoTitle?: string; metaDescription?: string };
    if (parsed.seoTitle) seoTitle = parsed.seoTitle.slice(0, 60);
    if (parsed.metaDescription) metaDescription = parsed.metaDescription.slice(0, 155);
  } catch {
    throw new AiError('AI_BAD_OUTPUT', 'AI returned unparseable SEO output');
  }
  return { seoTitle, metaDescription, model: MODEL, tokens, mock: false };
}

// =============================================================================
// Translation (fills the `23-i18n` "AI auto-translation" deferral)
// =============================================================================

export interface TranslateInput {
  /** field → source text, e.g. { title: '…', description_html: '<p>…</p>' } */
  fields: Record<string, string>;
  sourceLocale: string;
  targetLocale: string;
}

export async function translateFields(
  config: ShopioConfig,
  input: TranslateInput,
): Promise<{ translations: Record<string, string>; model: string; tokens: { input: number; output: number }; mock: boolean }> {
  const entries = Object.entries(input.fields).filter(([k, v]) => k && v);

  if (!isAiEnabled(config)) {
    const lang = languageTag(input.targetLocale);
    const out: Record<string, string> = {};
    for (const [k, v] of entries) out[k] = `[${lang}] ${v}`;
    return { translations: out, model: 'mock', tokens: { input: 0, output: 0 }, mock: true };
  }

  const system =
    `You are a professional e-commerce translator. Translate the given product/category ` +
    `field values from ${input.sourceLocale} to ${input.targetLocale}. Preserve any HTML ` +
    `tags exactly — translate only the human-readable text between them. Do NOT translate ` +
    `brand names, SKUs, or units of measure. Return ONLY a JSON object mapping each field ` +
    `name to its translated value. No markdown, no code fences.`;
  const user = entries.map(([k, v]) => `${k}:\n${v}`).join('\n\n');

  const { text, tokens } = await callClaude(config, { system, user, maxTokens: 2048 });
  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(stripFences(text)) as Record<string, unknown>;
  } catch {
    throw new AiError('AI_BAD_OUTPUT', 'AI returned unparseable translation output');
  }
  const out: Record<string, string> = {};
  for (const [k] of entries) {
    const v = parsed[k];
    if (typeof v === 'string') out[k] = k.endsWith('_html') ? sanitize(v) : v.trim();
  }
  return { translations: out, model: MODEL, tokens, mock: false };
}

// =============================================================================
// Category suggestion (auto-categorisation)
// =============================================================================

export interface CategorizeInput {
  title: string;
  attributes?: Record<string, string>;
  /** Candidate categories to choose from — id is opaque (pub_id in practice). */
  categories: { id: string; name: string; path?: string }[];
}

export async function suggestCategory(
  config: ShopioConfig,
  input: CategorizeInput,
): Promise<{ categoryId: string | null; model: string; tokens: { input: number; output: number }; mock: boolean }> {
  if (input.categories.length === 0) {
    return { categoryId: null, model: isAiEnabled(config) ? MODEL : 'mock', tokens: { input: 0, output: 0 }, mock: !isAiEnabled(config) };
  }

  if (!isAiEnabled(config)) {
    // Deterministic: category whose name/path words most overlap the product text.
    const hay = `${input.title} ${Object.values(input.attributes ?? {}).join(' ')}`.toLowerCase();
    let best = input.categories[0]!;
    let bestScore = -1;
    for (const c of input.categories) {
      const words = `${c.name} ${c.path ?? ''}`.toLowerCase().split(/[^\p{L}\p{N}]+/u).filter((w) => w.length > 2);
      const score = words.reduce((s, w) => s + (hay.includes(w) ? 1 : 0), 0);
      if (score > bestScore) {
        bestScore = score;
        best = c;
      }
    }
    return { categoryId: bestScore > 0 ? best.id : null, model: 'mock', tokens: { input: 0, output: 0 }, mock: true };
  }

  const list = input.categories
    .map((c) => `- [${c.id}] ${c.name}${c.path ? ` (${c.path})` : ''}`)
    .join('\n');
  const attrs = Object.entries(input.attributes ?? {}).filter(([k, v]) => k && v);
  const system =
    `You are an e-commerce merchandiser. Choose the single best-fitting category for the ` +
    `product from the provided list. Return ONLY a JSON object {"categoryId": string|null} ` +
    `using one of the EXACT ids shown in brackets, or null if none fit. No markdown.`;
  const user =
    `Product: ${input.title}\n` +
    (attrs.length ? `Attributes: ${attrs.map(([k, v]) => `${k}=${v}`).join(', ')}\n` : '') +
    `Categories:\n${list}`;

  const { text, tokens } = await callClaude(config, { system, user, maxTokens: 128 });
  let categoryId: string | null = null;
  try {
    const parsed = JSON.parse(stripFences(text)) as { categoryId?: string | null };
    if (parsed.categoryId && input.categories.some((c) => c.id === parsed.categoryId)) {
      categoryId = parsed.categoryId;
    }
  } catch {
    throw new AiError('AI_BAD_OUTPUT', 'AI returned unparseable category output');
  }
  return { categoryId, model: MODEL, tokens, mock: false };
}

// =============================================================================
// Bullet points (Amazon-style key features)
// =============================================================================

export interface BulletsInput {
  title: string;
  attributes?: Record<string, string>;
  keywords?: string[];
  locale: string;
  count?: number;
}

export async function generateBulletPoints(
  config: ShopioConfig,
  input: BulletsInput,
): Promise<{ bullets: string[]; model: string; tokens: { input: number; output: number }; mock: boolean }> {
  const count = clamp(input.count ?? 5, 3, 7);
  const attrs = Object.entries(input.attributes ?? {}).filter(([k, v]) => k && v);

  if (!isAiEnabled(config)) {
    const bullets = attrs.slice(0, count).map(([k, v]) => `${k}: ${v}`);
    if (bullets.length === 0) bullets.push(input.title);
    return { bullets, model: 'mock', tokens: { input: 0, output: 0 }, mock: true };
  }

  const system =
    `You write Amazon-style product bullet points in ${input.locale}. Produce exactly ` +
    `${count} concise, benefit-led bullets. Base them strictly on the provided data — ` +
    `invent no specs or claims. Return ONLY a JSON array of strings. No markdown.`;
  const user =
    `Title: ${input.title}\n` +
    (attrs.length ? `Attributes:\n${attrs.map(([k, v]) => `- ${k}: ${v}`).join('\n')}\n` : '') +
    (input.keywords?.length ? `Keywords: ${input.keywords.join(', ')}\n` : '');

  const { text, tokens } = await callClaude(config, { system, user, maxTokens: 512 });
  let bullets: string[] = [];
  try {
    const parsed = JSON.parse(stripFences(text));
    if (Array.isArray(parsed)) bullets = parsed.filter((x) => typeof x === 'string').slice(0, count);
  } catch {
    throw new AiError('AI_BAD_OUTPUT', 'AI returned unparseable bullet output');
  }
  return { bullets, model: MODEL, tokens, mock: false };
}

// =============================================================================
// Image alt text (accessibility + SEO; text-based, vision deferred)
// =============================================================================

export interface AltTextInput {
  title: string;
  attributes?: Record<string, string>;
  locale: string;
}

export async function generateAltText(
  config: ShopioConfig,
  input: AltTextInput,
): Promise<{ altText: string; model: string; tokens: { input: number; output: number }; mock: boolean }> {
  if (!isAiEnabled(config)) {
    const firstAttr = Object.entries(input.attributes ?? {}).find(([k, v]) => k && v);
    const alt = firstAttr ? `${input.title} – ${firstAttr[1]}` : input.title;
    return { altText: alt.slice(0, 125), model: 'mock', tokens: { input: 0, output: 0 }, mock: true };
  }

  const attrs = Object.entries(input.attributes ?? {}).filter(([k, v]) => k && v);
  const system =
    `You write concise image alt text (max 125 characters) for an e-commerce product image ` +
    `in ${input.locale}. Describe the product plainly for accessibility and SEO. No "image ` +
    `of" / "photo of" prefix. Return ONLY the alt text — no quotes, no markdown.`;
  const user =
    `Product: ${input.title}\n` +
    (attrs.length ? `Attributes: ${attrs.map(([k, v]) => `${k}=${v}`).join(', ')}` : '');

  const { text, tokens } = await callClaude(config, { system, user, maxTokens: 96 });
  return { altText: text.replace(/^["']|["']$/g, '').trim().slice(0, 125), model: MODEL, tokens, mock: false };
}

// =============================================================================
// Helpers
// =============================================================================

/** Upper-case language subtag for mock labels — 'de-DE' → 'DE'. */
function languageTag(locale: string): string {
  return (locale.split('-')[1] ?? locale.split('-')[0] ?? locale).toUpperCase();
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, Math.round(n)));
}
function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}
function stripFences(s: string): string {
  return s.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
}
/** Minimal HTML guard for AI output (same spirit as the CMS sanitizer). */
function sanitize(html: string): string {
  return html
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/\son\w+\s*=\s*"[^"]*"/gi, '')
    .replace(/\son\w+\s*=\s*'[^']*'/gi, '')
    .replace(/javascript:/gi, '')
    .trim();
}
