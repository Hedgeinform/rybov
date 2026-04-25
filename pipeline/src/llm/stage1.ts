// pipeline/src/llm/stage1.ts
import { z } from 'zod';
import { callOpus } from './client.ts';
import type { Stage1Output } from '../storage/storage.ts';

const Stage1Schema = z.object({
  word: z.string().min(1),
  language: z.string().min(1),
  transliteration: z.string().nullable(),
  russian_meaning: z.string().min(1),
});

const SYSTEM_PROMPT = `You pick a single word in any language of the world. The word can be a noun, verb, adjective, abstract concept, or named thing. Languages span the globe — Latin scripts, Cyrillic, Devanagari, Arabic, CJK, African, Polynesian, anything you know. Avoid the words listed under AVOID below.

Return STRICT JSON only:
{
  "word": "<the word in its native script>",
  "language": "<English name of the language>",
  "transliteration": "<Latin-letter approximation, or null if word is already Latin>",
  "russian_meaning": "<a Russian word or short phrase that translates the meaning>"
}

No prose around the JSON. No markdown fences. Just the JSON object.`;

export async function runStage1(avoidWords: string[]): Promise<Stage1Output> {
  const userPrompt = avoidWords.length === 0
    ? 'Pick a word.'
    : `AVOID:\n${avoidWords.map((w) => `- ${w}`).join('\n')}\n\nPick a word.`;

  let lastError = '';
  for (let attempt = 0; attempt < 3; attempt++) {
    const { text } = await callOpus({
      systemPrompt: SYSTEM_PROMPT,
      userPrompt,
      temperature: 1.0,
      maxTokens: 300,
      cacheSystem: true,
    });
    try {
      const parsed = Stage1Schema.parse(JSON.parse(text));
      return parsed;
    } catch (e) {
      lastError = String(e);
    }
  }
  throw new Error(`Stage 1 failed after 3 attempts (2 retries). Last error: ${lastError}`);
}
