/** Common AI types. Per `33-ai-features.md §4`. */

export type AiModelTier =
  | 'flagship'
  | 'balanced'
  | 'fast'
  | 'specialized_embedding'
  | 'specialized_vision';

export type AiProviderCode =
  | 'anthropic'
  | 'openai'
  | 'google_gemini'
  | 'azure_openai'
  | 'local_ollama';

export type ContentPart =
  | { type: 'text'; text: string }
  | { type: 'image'; source: { kind: 'url' | 'base64'; data: string; media_type?: string } }
  | { type: 'tool_use'; id: string; name: string; input: unknown }
  | {
      type: 'tool_result';
      tool_use_id: string;
      content: string | ContentPart[];
      is_error?: boolean;
    };

export type ChatMessage = {
  role: 'user' | 'assistant' | 'tool';
  content: ContentPart[];
};

export type ChatRequest = {
  modelCode: string;
  systemPrompt?: string;
  messages: ChatMessage[];
  maxOutputTokens?: number;
  temperature?: number;
  stopSequences?: string[];
  abortSignal?: AbortSignal;
};

export type ChatResponse = {
  content: ContentPart[];
  stopReason: 'end_turn' | 'max_tokens' | 'tool_use' | 'stop_sequence' | 'aborted';
  usage: {
    inputTokens: number;
    outputTokens: number;
    cachedInputTokens?: number;
    thinkingTokens?: number;
  };
  costUsd: number;
  latencyMs: number;
};
