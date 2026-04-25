import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { existsSync } from 'node:fs';
import type { FishRecord } from './storage.ts';

export async function getRecentWords(dir: string, limit: number): Promise<string[]> {
  if (!existsSync(dir)) return [];
  const files = await readdir(dir);
  const fishFiles = files
    .filter((f) => /^\d{4}-\d{2}-\d{2}\.json$/.test(f))
    .sort()
    .reverse()
    .slice(0, limit);
  const words: string[] = [];
  for (const f of fishFiles) {
    const record = JSON.parse(await readFile(join(dir, f), 'utf-8')) as FishRecord;
    words.push(record.stage1.word);
  }
  return words;
}
