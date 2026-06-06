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
// Helpers
// =============================================================================

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
