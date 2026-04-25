// pipeline/src/llm/stage3.ts
import { callOpus } from './client.ts';
import { validate } from '../dsl/validator.ts';
import { COLORS, PRIMITIVES, POSITIONS, SIZES, OFFSET_VALUES, EYE_STYLES, ACCENT_TYPES } from '../dsl/schema.ts';
import type { Stage2Output, Stage3Output } from '../storage/storage.ts';

const SCHEMA_DOC = `
DSL schema (use ONLY these enum values; never invent new ones):

- body (REQUIRED): { primitive, orientation, color }
- eye (REQUIRED): { style, position }
- tail (optional, may be null): { primitive, color, side }
- fin_top, fin_bottom (optional, may be null): { primitive, color }
- background_block (optional, may be null): { color, size, offset: [x, y] }
- accents (optional array, max 3): [{ type, color, position }]

Enums:
- primitive: ${PRIMITIVES.join(' | ')}
- color: ${COLORS.join(' | ')}
- orientation: left | right
- side (for tail): left | right (must be opposite to body.orientation)
- position: ${POSITIONS.join(' | ')}
- size: ${SIZES.join(' | ')}
- offset values: each axis from { ${OFFSET_VALUES.join(', ')} }
- eye style: ${EYE_STYLES.join(' | ')}
- accent type: ${ACCENT_TYPES.join(' | ')}

Constraints:
- Distinct colors across the whole fish: max 4
- tail.side opposite to body.orientation (or tail = null)
`;

const SYSTEM_PROMPT = `You translate a Russian fish description into structured DSL parameters that a procedural renderer will execute.

${SCHEMA_DOC}

Return STRICT JSON matching the schema. No prose, no markdown fences, no explanations. Just the JSON object with exactly these keys: body, eye, tail, fin_top, fin_bottom, background_block, accents.`;

export async function runStage3(stage2: Stage2Output): Promise<Stage3Output> {
  const baseUserPrompt = `Description:\n${stage2.description}\n\nReturn the DSL JSON.`;
  let userPrompt = baseUserPrompt;
  let lastError = '';

  for (let attempt = 0; attempt < 5; attempt++) {
    const { text } = await callOpus({
      systemPrompt: SYSTEM_PROMPT,
      userPrompt,
      temperature: 0.3,
      maxTokens: 800,
      cacheSystem: true,
    });
    let parsed: unknown;
    try { parsed = JSON.parse(text); }
    catch (e) {
      lastError = `JSON parse error: ${e}`;
      userPrompt = `${baseUserPrompt}\n\nPrevious attempt was not valid JSON. Return ONLY a JSON object.`;
      continue;
    }
    let result;
    try { result = validate(parsed); }
    catch (e) {
      lastError = `Validator: ${e}`;
      userPrompt = `${baseUserPrompt}\n\nPrevious attempt was rejected: ${e}\nFix and retry.`;
      continue;
    }
    if (result.ok) return { dsl: result.dsl };
    lastError = `Validator: ${result.error}`;
    userPrompt = `${baseUserPrompt}\n\nPrevious attempt was rejected: ${result.error}\nFix and retry.`;
  }
  throw new Error(`Stage 3 failed after 5 attempts (4 retries). Last error: ${lastError}`);
}
