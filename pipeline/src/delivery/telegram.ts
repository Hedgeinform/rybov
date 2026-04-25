const TG_API = 'https://api.telegram.org';

export interface TgPostInput {
  botToken: string;
  channelId: string;
  caption: string;
  imagePng: Buffer;
}

export async function postFishToTelegram(input: TgPostInput): Promise<void> {
  const url = `${TG_API}/bot${input.botToken}/sendPhoto`;
  const form = new FormData();
  form.append('chat_id', input.channelId);
  form.append('caption', input.caption);
  form.append('parse_mode', 'HTML');
  form.append('photo', new Blob([input.imagePng], { type: 'image/png' }), 'fish.png');

  const res = await fetch(url, { method: 'POST', body: form });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Telegram sendPhoto ${res.status}: ${body}`);
  }
}

export function buildCaption(args: {
  date: string;
  word: string;
  language: string;
  meaning: string;
  description: string;
  permalinkUrl: string;
}): string {
  const { date, word, language, meaning, description, permalinkUrl } = args;
  const esc = (s: string) =>
    s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  return [
    `<b>FIG. ${esc(date)}</b>`,
    '',
    `<b>Слово</b>: ${esc(word)} (${esc(language.toLowerCase())}: ${esc(meaning)})`,
    `<b>Рыба</b>: ${esc(description)}`,
    '',
    `<a href="${esc(permalinkUrl)}">${esc(permalinkUrl)}</a>`,
  ].join('\n');
}
