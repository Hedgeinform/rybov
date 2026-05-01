import { readFish } from '../storage/storage.ts';
import { FISH_DIR } from '../storage/paths.ts';
import { svgToPng } from '../delivery/png.ts';
import { postFishToTelegram, buildCaption } from '../delivery/telegram.ts';
import { todayUtc } from '../shared/dates.ts';

const date = process.argv[2] ?? todayUtc();

const siteUrl = process.env.RYBOV_SITE_URL;
const basePath = process.env.RYBOV_BASE_PATH;
if (!siteUrl) {
  console.error('RYBOV_SITE_URL must be set');
  process.exit(1);
}
const baseUrl = basePath
  ? `${siteUrl}${basePath.replace(/\/$/, '')}`
  : siteUrl.replace(/\/$/, '');

const botToken = process.env.TELEGRAM_BOT_TOKEN;
const channelId = process.env.TELEGRAM_CHANNEL_ID;
if (!botToken || !channelId) {
  console.error('TELEGRAM_BOT_TOKEN and TELEGRAM_CHANNEL_ID must be set');
  process.exit(1);
}

const result = await readFish(FISH_DIR, date);
if (!result) {
  console.log(`No fish for ${date} (likely empty-day); skipping TG post.`);
  process.exit(0);
}

const png = await svgToPng(result.svg);
const caption = buildCaption({
  date,
  word: result.record.stage1.word,
  language: result.record.stage1.language,
  transliteration: result.record.stage1.transliteration,
  meaning: result.record.stage1.russian_meaning,
  description: result.record.stage2.description,
  permalinkUrl: `${baseUrl}/${date}`,
});

await postFishToTelegram({ botToken, channelId, caption, imagePng: png });
console.log(`Posted ${date} to ${channelId}`);
