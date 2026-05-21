/**
 * @shopio/ai-core — AI core library.
 *
 * Per `33-ai-features.md`. Implements:
 * - Provider abstraction (Anthropic primary + OpenAI fallback + BYOK)
 * - Use case orchestration
 * - Guardrails (PII scrubbing, prompt injection, hallucination detection)
 * - RAG infrastructure
 * - Cost tracking + budget enforcement
 */

export * from './providers/index.js';
export * from './types.js';
