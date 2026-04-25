// pipeline/src/llm/stage2.ts
import { callOpus } from './client.ts';
import type { Stage1Output, Stage2Output } from '../storage/storage.ts';

const SYSTEM_PROMPT = `You receive a single word with its meaning. Imagine a fish that comes to mind from this word. Describe the fish in 1 to 3 short sentences in Russian.

Hard constraints:
- Describe ONLY the visual (shape, color, posture, presence/absence of features). NOT what the fish "means" or "represents" or "symbolizes".
- Do NOT use the words: символизирует, означает, представляет, потому что, поэтому, как будто, как если бы, метафора, аллегория, symbolizes, represents, means, because, therefore, as if, metaphor, allegory.
- Do NOT explain the connection between the word and the fish. Just describe the fish.
- Maximum 3 sentences.

Return ONLY the description text. No prose label, no JSON, no quotes.`;

const FORBIDDEN_PATTERNS = [
  /символизи/i, /означа/i, /представля/i,
  /потому что/i, /поэтому/i, /как будто/i, /как если бы/i,
  /метафор/i, /аллегор/i,
  /\bsymboliz/i, /\brepresent/i, /\bmeans?\b/i,
  /\bbecause\b/i, /\btherefore\b/i, /\bas if\b/i,
  /\bmetaphor/i, /\ballegor/i,
];

function violatesGuardrails(text: string): boolean {
  return FORBIDDEN_PATTERNS.some((re) => re.test(text));
}

export async function runStage2(stage1: Stage1Output): Promise<Stage2Output> {
  const userPrompt = `Word: ${stage1.word}\nLanguage: ${stage1.language}\nMeaning (Russian): ${stage1.russian_meaning}`;

  let lastError = '';
  for (let attempt = 0; attempt < 3; attempt++) {
    const tightening = attempt === 0 ? '' : '\n\nReminder: visual description only. No symbolism.';
    const { text } = await callOpus({
      systemPrompt: SYSTEM_PROMPT + tightening,
      userPrompt,
      temperature: 0.9,
      maxTokens: 400,
      cacheSystem: attempt === 0,
    });
    const trimmed = text.trim();
    if (violatesGuardrails(trimmed)) {
      lastError = `Guardrail violation: "${trimmed.slice(0, 80)}..."`;
      continue;
    }
    const sentences = trimmed.split(/[.!?]\s+/).filter(Boolean).length;
    if (sentences > 3) {
      lastError = `Too many sentences (${sentences} > 3)`;
      continue;
    }
    return { description: trimmed };
  }
  throw new Error(`Stage 2 failed after 3 attempts (2 retries). Last error: ${lastError}`);
}
