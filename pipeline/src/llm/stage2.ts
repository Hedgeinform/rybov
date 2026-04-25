// pipeline/src/llm/stage2.ts
import { callOpus } from './client.ts';
import type { Stage1Output, Stage2Output } from '../storage/storage.ts';

const SYSTEM_PROMPT = `You receive a single word with its meaning. Produce ONE sealed poetic image of a fish in Russian — typically a single sentence. The bar is poetic compression, NEVER description. The fish's existence and its act collapse into one line a reader pauses on.

<exemplar canonical="true">
Word: сезон дождей
Output: Рыба, плывущая против течения собственных слёз.
</exemplar>

<exemplar editable="user-vet">
Word: тишина
Output: Рыба, забывшая, как открывать рот.
</exemplar>

<exemplar editable="user-vet">
Word: пепел
Output: Рыба, чешуя которой сходит, как страницы старой газеты.
</exemplar>

Notice across the exemplars: ONE clause. No colour, no silhouette, no fins-as-features. Action lives in a participle or relative clause. A figurative element is grounded as if literal (tears as a current, newsprint as scales). The leap from word to fish is silent — NEVER named.

MUST:
- Output Russian prose only. Bare text. No labels, no JSON, no quotes, no preface.
- Compress to ONE sentence whenever the image holds. 2-3 sentences are the absolute ceiling, reserved for the rare case where a single line cannot land it.
- Use figurative language INSIDE the image. Currents of tears, bodies of smoke, scales of paper — welcome.

NEVER:
- Enumerate features. NO «серебристая чешуя», NO «острые плавники», NO «широкий глаз», NO «длинное тело», NO «синий бок». Feature lists are the anti-pattern.
- Name the leap. NEVER use: символизирует, означает, представляет, потому что, поэтому, метафора, аллегория, symbolizes, represents, means, because, therefore, metaphor, allegory.
- Add anything before or after the image — no preface, no closing, no explanation of the choice.`;

const FORBIDDEN_PATTERNS = [
  /символизи/i, /означа/i, /представля/i,
  /потому что/i, /поэтому/i,
  /метафор/i, /аллегор/i,
  /\bsymboliz/i, /\brepresent/i, /\bmeans?\b/i,
  /\bbecause\b/i, /\btherefore\b/i,
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
