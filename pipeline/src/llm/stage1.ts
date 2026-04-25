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

const SYSTEM_PROMPT = `You pick a single word in any language of the world. The word can be a noun, verb, adjective, abstract concept, or named thing. Languages span the globe — Latin scripts, Cyrillic, Devanagari, Arabic, CJK, African, Polynesian, anything you know.

TROPE GUARD. Your training has saturated the trope of «untranslatable poetic foreign words» — that vocabulary collapses temperature regardless of nominal sampling. NEVER pick from this trope set, its near-cognates, or its cross-language equivalents wearing another language's clothes:

saudade, sehnsucht, hygge, ikigai, lagom, schadenfreude, fernweh, weltschmerz, dor, toska (тоска), gigil, mamihlapinatapai, tsundoku, wabi-sabi (侘寂), mono no aware (物の哀れ), komorebi (木漏れ日), 漏れる (and other near-komorebi cognates), gemütlichkeit, cwtch, sobremesa, sisu, dolce far niente, friluftsliv, kintsugi, oikos, kairos, сумерки and twilight-equivalents.

The aesthetic of this project lives in the leap from a plain word to a poetic image — Stage 2 makes that leap. Stage 1 must hand it a PLAIN word, not a pre-poeticised one. Mix freely across these registers:

- Concrete: tools, foods, weather, body parts, household objects, professions, animals, colours, materials.
- Action: verbs of mundane motion or work (резать, складывать, ждать, чинить, хлопать, гасить).
- Texture/quality adjectives: липкий, шершавый, тёплый, тусклый.
- ORDINARY abstract concepts in any language — these are encouraged, not forbidden: жажда, вина, забвение, упрямство, надежда, скука, любопытство, обещание, зависть, терпение, привычка, спешка, разрешение, обман, доверие, тщеславие, выбор, отказ.

What is forbidden is NOT abstraction — it is the specific «untranslatable foreign poetry» trope listed above. An ordinary abstract noun is fine. The trope-set and its cognates are not.

Also avoid any word listed under AVOID in the user message below (these are recent picks).

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
