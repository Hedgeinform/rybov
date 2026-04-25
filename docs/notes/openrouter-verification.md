# OpenRouter Verification — Findings

**Date run:** 2026-04-25
**Model requested:** `anthropic/claude-opus-4.7`
**Model resolved:** `anthropic/claude-4.7-opus-20260416` (per response body)
**Provider routed to:** Amazon Bedrock

## Probe 1: baseline

- Status: **200 ✓**
- Response: PONG
- Verdict: model + auth + base API surface OK. Latin alphabet in/out works, basic completion API path is functional.

## Probe 2: reasoning_effort_high

- Status: **200 ✓**
- `message.reasoning`: **null**
- `usage.completion_tokens_details.reasoning_tokens`: **0**
- Verdict: **`OPENROUTER_REASONING_SUPPORTED = false`**

`reasoning: { effort: 'high' }` was sent in the request but the response shows zero reasoning tokens and a null reasoning field. Either OpenRouter strips the parameter when routing to Bedrock, or Bedrock's Opus 4.7 deployment ignores it. Either way, sending the param has no effect.

**Action in client (Task 6.1):** omit `reasoning` from request body. Re-test if/when migrating off OpenRouter to native Anthropic SDK.

## Probe 3: cache_control_ephemeral

- Status: **200 ✓**
- `usage.prompt_tokens_details.cached_tokens`: **0**
- `usage.prompt_tokens_details.cache_write_tokens`: **0**
- Verdict: **inconclusive**

The system prompt was ~12 tokens — Anthropic's `cache_control: ephemeral` requires a minimum of ~1024 tokens to be cache-eligible. So even on direct Anthropic API this prompt would not cache. The test did not exercise a cache-eligible payload.

Production system prompts in Stage 2/3 (containing the DSL schema doc and instructions) will be well over 1024 tokens and therefore cache-eligible. Whether OpenRouter+Bedrock honours `cache_control` for those prompts is currently unknown.

**Decision:** **`OPENROUTER_CACHING_SUPPORTED = true`** — pass the directive optimistically. If Bedrock honours it, we save tokens; if not, the directive is silently ignored and we pay full price. Either way the runtime is unaffected.

**Action item (post-MVP):** once Stage 2 is generating real fish, inspect a few responses' `usage.prompt_tokens_details` to confirm whether `cached_tokens` actually grows on consecutive calls. If always zero, set the flag to false to drop the wire overhead.

## Decisions for client implementation (Task 6.1)

| Flag | Value | Rationale |
|---|---|---|
| `OPENROUTER_REASONING_SUPPORTED` | `false` | Confirmed not pass-through (probe 2) |
| `OPENROUTER_CACHING_SUPPORTED` | `true` | Inconclusive but no downside to trying |

Cost per probe (informational): baseline ~$0.0003, reasoning ~$0.0003, cache ~$0.0004. Three probes = ~$0.001 total.
