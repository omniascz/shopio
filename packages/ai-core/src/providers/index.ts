import type { ChatRequest, ChatResponse } from '../types.js';

/** AI provider adapter interface. Per `33-ai-features.md §4.1`. */
export interface AiProvider {
  readonly code: string;

  chat(req: ChatRequest): Promise<ChatResponse>;
  chatStream(req: ChatRequest): AsyncIterable<ChatStreamChunk>;
}

export type ChatStreamChunk =
  | { type: 'token'; text: string }
  | { type: 'tool_use'; name: string; input: unknown }
  | { type: 'message_complete'; response: ChatResponse }
  | { type: 'error'; error: Error };

// Implementations to be added:
// export { AnthropicProvider } from './anthropic.js';
// export { OpenAiProvider } from './openai.js';
