const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';
const MODEL = 'anthropic/claude-opus-4.7';

interface Probe {
  name: string;
  body: Record<string, unknown>;
}

const probes: Probe[] = [
  {
    name: 'baseline',
    body: {
      model: MODEL,
      messages: [{ role: 'user', content: 'Reply with the single word: PONG.' }],
      max_tokens: 20,
    },
  },
  {
    name: 'reasoning_effort_high',
    body: {
      model: MODEL,
      messages: [{ role: 'user', content: 'Reply with the single word: PONG.' }],
      max_tokens: 20,
      reasoning: { effort: 'high' },
    },
  },
  {
    name: 'cache_control_ephemeral',
    body: {
      model: MODEL,
      messages: [
        {
          role: 'system',
          content: [
            {
              type: 'text',
              text: 'You are PONG-bot. Always reply with the single word: PONG.',
              cache_control: { type: 'ephemeral' },
            },
          ],
        },
        { role: 'user', content: 'Hi.' },
      ],
      max_tokens: 20,
    },
  },
];

async function run(): Promise<void> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) throw new Error('OPENROUTER_API_KEY is not set');

  for (const probe of probes) {
    process.stdout.write(`\n=== probe: ${probe.name} ===\n`);
    const res = await fetch(OPENROUTER_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://github.com/Hedgeinform/rybov',
        'X-Title': 'Rybov verification',
      },
      body: JSON.stringify(probe.body),
    });
    const text = await res.text();
    process.stdout.write(`status: ${res.status}\n`);
    process.stdout.write(`body: ${text}\n`);
  }
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
