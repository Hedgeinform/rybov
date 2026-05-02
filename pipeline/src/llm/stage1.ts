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

The aesthetic of this project lives in the leap from a plain word to a poetic image — Stage 2 makes that leap. Stage 1 must hand it a PLAIN word, not a pre-poeticised one. The source word lives in ANY language of the world — Slavic, Germanic, Romance, Sino-Tibetan, Semitic, Indic, Japonic, Turkic, Polynesian, anything. Russian feels familiar because the russian_meaning output is in Russian, but treat Russian as ONE option among many, NOT the default.

Mix freely across these registers (examples below span multiple language families — reach beyond them too):

- Concrete: молоток (Russian: hammer), 椅子 (Mandarin: chair), بَاب (Arabic: door), finestra (Italian: window), Schlüssel (German: key), रसोई (Hindi: kitchen), 鋏 (Japanese: scissors), llave (Spanish: key).
- Action: to fold (English), резать (Russian: to cut), hablar (Spanish: to speak), attendre (French: to wait), 修理 (Mandarin: to repair), 折る (Japanese: to fold).
- Texture/quality: smooth (English), липкий (Russian: sticky), 苦い (Japanese: bitter), chłodny (Polish: cool), 차갑다 (Korean: cold), morne (French: dreary).
- ORDINARY abstract concepts (encouraged, not forbidden): thirst (English), صبر (Arabic: patience), अधीरता (Hindi: impatience), 焦虑 (Mandarin: anxiety), ক্ষমা (Bengali: forgiveness), Geduld (German: patience), забвение (Russian: oblivion), повага (Ukrainian: respect).

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
