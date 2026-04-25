// pipeline/src/llm/stage3.ts
import { callOpus } from './client.ts';
import { validate } from '../dsl/validator.ts';
import {
  COLORS, PRIMITIVES, POSITIONS, SIZES, OFFSET_VALUES, EYE_STYLES, ACCENT_TYPES,
  HEAD_PRIMITIVES, TAIL_PRIMITIVES, FIN_TILTS,
} from '../dsl/schema.ts';
import type { Stage2Output, Stage3Output } from '../storage/storage.ts';

const SCHEMA_DOC = `
Schema fields (use ONLY listed enum values; NEVER invent new ones):

- body (REQUIRED): { primitive, orientation, color }
- head (optional, may be null): { primitive, color } — separate element jutting from the front of body
- eye (REQUIRED): { style, position }
- tail (optional, may be null): { primitive, color, side }
- fin_top, fin_bottom (optional, may be null): { primitive: "triangle" (locked), color, tilt }
- background_block (optional, may be null): { color, size, offset: [x, y] }
- accents (optional array, max 3): [{ type, color, position }]

Enums:
- body.primitive: ${PRIMITIVES.join(' | ')}
- head.primitive: ${HEAD_PRIMITIVES.join(' | ')}
- tail.primitive: ${TAIL_PRIMITIVES.join(' | ')}
- fin tilt: ${FIN_TILTS.join(' | ')}
- color: ${COLORS.join(' | ')}
- orientation: left | right
- tail.side: left | right (must be opposite to body.orientation)
- position: ${POSITIONS.join(' | ')}
- size: ${SIZES.join(' | ')}
- offset values: each axis from { ${OFFSET_VALUES.join(', ')} }
- eye.style: ${EYE_STYLES.join(' | ')}
- accent.type: ${ACCENT_TYPES.join(' | ')}
`;

const SYSTEM_PROMPT = `You assemble a constructivist poster glyph from a closed set of geometric primitives. The glyph's pretext is a fish, but the artifact is a printer's mark in the lineage of Rodchenko and Stenberg — geometry composed for resonance with a one-line poetic image, NEVER an anatomical depiction.

You receive a single Russian sentence — the image. Your output is STRICT JSON matching the schema below. No prose, no markdown fences, no explanations. Exactly these top-level keys: body, head, eye, tail, fin_top, fin_bottom, background_block, accents. Optional fields use null when absent, NEVER omit a key.

PRIMITIVE SELECTION — the central craft. Two non-negotiable disciplines.

DISCIPLINE 1 — Body primitive. Each option carries a distinct semantic charge:

- triangle — sharp, directional, predatory, cutting, decisive motion
- rectangle — arrested, blocked, formal, frozen, refusing to move
- semicircle — round, contained, settled, a dome of stillness
- composite_two_triangles — split, contrasting, two forces meeting, fracture
- semicircle_with_triangle — half-soft / half-cutting, transition, fragmenting
- ellipse — for literal liquidity, dissolution, melting, vapor, weightless suspension ONLY

The ellipse trap. Almost every image describes motion — плывёт, дрейфует, скользит, плавает, плавающий, уплывающая. Motion verbs DO NOT license ellipse. Motion is universal in this work; treating motion as fluidity is the bias to avoid. Ellipse is licensed ONLY when the image's primary quality is the substance itself dissolving, melting, vaporizing, suspending — not when something simply moves through space.

Decision procedure — walk this list in order BEFORE composing JSON. Pick the first option whose semantic resonance with the image is true. Stop there. The list runs from the most specific semantic signature to the most general; do not skip ahead to broader options without ruling out the narrower ones first.

1. composite_two_triangles — does the image split into contrasting forces, two opposing motions, fracture?
2. semicircle_with_triangle — does it transition, peel, fragment, sit half-and-half between states?
3. semicircle — is the image domed, contained, settled, a quiet stillness?
4. rectangle — is anything arrested, blocked, frozen, refusing, formally held?
5. triangle — does the image carry sharp, directional, cutting, predatory energy that does NOT match any of the four signatures above?
6. ellipse — only after ALL five above are walked and felt semantically wrong, AND the image describes literal liquid / vapor / dissolution / weightlessness.

DISCIPLINE 2 — Head element. A distinct head is the standard composition.

Use a non-null head whenever the image grants the fish ANY face-related quality — gaze, mouth, listening, refusal, expression, prayer, hunger, mute, eye action, looking, watching, sleeping. Use head = null ONLY for unified silhouettes: melted, headless, dissolved, abstract trace, peeling-into-fragments. When in doubt, prefer a head.

Head-shape contrast. PREFER a head primitive that does NOT mirror the body primitive — geometric contrast strengthens the composition. Specifically: when body is triangle, prefer circle or oval head; when body is rectangle, prefer circle or oval head; when body is semicircle, prefer triangle head. Mirror the body shape (triangle body + triangle head, etc.) ONLY when the image specifically calls for unified angularity — a predatory single-mass strike, a monolithic shape with no internal contrast. Default is contrast.

Apply the same resonance logic to tail choice, fin tilt, accents, background_block colour and size — each is a compositional decision, never a default.

<exemplar>
Image: Рыба, плывущая против течения собственных слёз.
Resonance: split between flow and counter-flow — two opposing motions. Head: yes (the fish actively pushes against).
Output:
{
  "body": { "primitive": "composite_two_triangles", "orientation": "right", "color": "blue" },
  "head": { "primitive": "oval", "color": "blue" },
  "eye": { "style": "dot", "position": "head_top" },
  "tail": { "primitive": "fork", "color": "accent_cyan", "side": "left" },
  "fin_top": { "primitive": "triangle", "color": "blue", "tilt": "tilted_backward" },
  "fin_bottom": null,
  "background_block": { "color": "accent_cyan", "size": "large", "offset": [0, 15] },
  "accents": [{ "type": "horizontal_line", "color": "white", "position": "midline" }]
}
</exemplar>

<exemplar>
Image: Рыба, забывшая, как открывать рот.
Resonance: arrested, blocked, refusing to open — formal frozen geometry. Mouth implies head.
Output:
{
  "body": { "primitive": "rectangle", "orientation": "right", "color": "black" },
  "head": { "primitive": "circle", "color": "accent_ochre" },
  "eye": { "style": "square", "position": "head_center" },
  "tail": { "primitive": "rectangle", "color": "black", "side": "left" },
  "fin_top": null,
  "fin_bottom": null,
  "background_block": { "color": "yellow", "size": "medium", "offset": [-15, 0] },
  "accents": []
}
</exemplar>

<exemplar>
Image: Рыба, чешуя которой сходит, как страницы старой газеты.
Resonance: composite, fragmenting, peeling. Dissolution into pieces — unified silhouette without distinct head.
Output:
{
  "body": { "primitive": "semicircle_with_triangle", "orientation": "left", "color": "accent_ochre" },
  "head": null,
  "eye": { "style": "circle", "position": "front_center" },
  "tail": { "primitive": "arrow", "color": "white", "side": "right" },
  "fin_top": { "primitive": "triangle", "color": "black", "tilt": "perpendicular" },
  "fin_bottom": { "primitive": "triangle", "color": "black", "tilt": "perpendicular" },
  "background_block": null,
  "accents": [
    { "type": "horizontal_band", "color": "white", "position": "midline" },
    { "type": "small_square", "color": "black", "position": "low" }
  ]
}
</exemplar>

<exemplar>
Image: Рыба, вспарывающая воду одним взмахом.
Resonance: sharp, directional, a single decisive cut. Predatory action — head present.
Output:
{
  "body": { "primitive": "triangle", "orientation": "right", "color": "red" },
  "head": { "primitive": "triangle", "color": "red" },
  "eye": { "style": "dot", "position": "head_center" },
  "tail": { "primitive": "triangle", "color": "red", "side": "left" },
  "fin_top": { "primitive": "triangle", "color": "black", "tilt": "tilted_forward" },
  "fin_bottom": null,
  "background_block": { "color": "yellow", "size": "small", "offset": [15, -15] },
  "accents": []
}
</exemplar>

<exemplar>
Image: Рыба, спящая под камнем уже век.
Resonance: settled, domed, the long stillness of sleep. Sleeping implies a face — head present.
Output:
{
  "body": { "primitive": "semicircle", "orientation": "right", "color": "accent_deep_red" },
  "head": { "primitive": "oval", "color": "accent_deep_red" },
  "eye": { "style": "dot", "position": "head_center" },
  "tail": null,
  "fin_top": null,
  "fin_bottom": null,
  "background_block": { "color": "black", "size": "large", "offset": [0, 0] },
  "accents": [{ "type": "horizontal_line", "color": "accent_ochre", "position": "low" }]
}
</exemplar>

${SCHEMA_DOC}

CONSTRAINTS (validator will reject violations — produce a clean glyph the first time):
- Use ONLY enum values listed in the schema. NEVER invent new ones.
- ≤4 distinct colors across the whole glyph (body + head + tail + fins + background_block + all accents combined).
- tail.side MUST be opposite to body.orientation, or tail = null.
- eye.position rule: when head IS NOT null → eye.position MUST be one of head_top | head_center | head_bottom. When head IS null → eye.position MUST be one of front_top | front_center | front_low | midline | low | tail_side.
- All optional fields use null when absent. NEVER omit a key from the top-level object.

Return the JSON object only.`;

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
