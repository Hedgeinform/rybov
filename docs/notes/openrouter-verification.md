# OpenRouter Verification — Findings

**Date run:** YYYY-MM-DD
**Model:** `anthropic/claude-opus-4.7`

## Probe 1: baseline
- Status: 200 ✓ / fail
- Response: PONG / other
- Verdict: model + auth + base API surface OK

## Probe 2: reasoning_effort_high
- Status: ...
- Response includes `reasoning_details` field? YES / NO
- Token usage shows reasoning tokens? YES / NO
- Verdict: `OPENROUTER_REASONING_SUPPORTED = true | false`

## Probe 3: cache_control_ephemeral
- Status: ...
- Response usage shows `prompt_tokens_details.cached_tokens` (or analogous)? YES / NO
- Run probe 2× to test cache hit on second call
- Verdict: `OPENROUTER_CACHING_SUPPORTED = true | false`

## Decisions for client implementation (Task 6.1)

Based on the above:
- Reasoning effort: pass / omit
- Cache control: pass / omit
