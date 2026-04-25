const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';
export const MODEL = 'anthropic/claude-opus-4.7';

// Set from docs/notes/openrouter-verification.md findings (2026-04-25 run):
// - reasoning: confirmed NOT pass-through via OpenRouter+Bedrock (probe 2: reasoning_tokens=0)
// - caching: inconclusive (probe used <1024-token prompt, below Anthropic's cache threshold);
//   default to true since real Stage 2/3 prompts are >1024 tokens and the directive is
//   silently ignored if not honoured.
export const OPENROUTER_REASONING_SUPPORTED = false;
export const OPENROUTER_CACHING_SUPPORTED = true;
export const REASONING_EFFORT: 'high' | 'medium' | 'low' | 'minimal' = 'high';

export interface CallOptions {
  systemPrompt: string;
  userPrompt: string;
  temperature: number;
  maxTokens: number;
  cacheSystem?: boolean;
}

export interface CallResult {
  text: string;
  rawResponse: unknown;
}

export async function callOpus(opts: CallOptions): Promise<CallResult> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) throw new Error('OPENROUTER_API_KEY is not set');

  const systemContent = OPENROUTER_CACHING_SUPPORTED && opts.cacheSystem
    ? [{ type: 'text', text: opts.systemPrompt, cache_control: { type: 'ephemeral' } }]
    : opts.systemPrompt;

  const body: Record<string, unknown> = {
    model: MODEL,
    messages: [
      { role: 'system', content: systemContent },
      { role: 'user', content: opts.userPrompt },
    ],
    temperature: opts.temperature,
    max_tokens: opts.maxTokens,
  };

  if (OPENROUTER_REASONING_SUPPORTED) {
    body.reasoning = { effort: REASONING_EFFORT };
  }

  const res = await fetch(OPENROUTER_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://github.com/Hedgeinform/rybov',
      'X-Title': 'Rybov daily fish',
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errBody = await res.text();
    throw new Error(`OpenRouter ${res.status}: ${errBody}`);
  }

  const json = await res.json() as {
    choices: Array<{ message: { content: string } }>;
  };
  const text = json.choices[0]?.message?.content ?? '';
  if (!text) throw new Error('Empty completion from OpenRouter');
  return { text, rawResponse: json };
}
