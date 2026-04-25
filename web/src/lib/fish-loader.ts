import { readdir, readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const FISH_DIR = resolve(__dirname, '../../../fish');

export interface LoadedFish {
  date: string;
  record: any;
  svg: string;
}

export interface LoadedEmptyDay {
  date: string;
  reason: string;
}

export async function listAllDates(): Promise<string[]> {
  if (!existsSync(FISH_DIR)) return [];
  const files = await readdir(FISH_DIR);
  const dates = new Set<string>();
  for (const f of files) {
    const m = f.match(/^(\d{4}-\d{2}-\d{2})\.(json|empty\.json)$/);
    if (m) dates.add(m[1]);
  }
  return [...dates].sort().reverse();
}

export async function loadFish(date: string): Promise<LoadedFish | null> {
  const jsonPath = join(FISH_DIR, `${date}.json`);
  const svgPath = join(FISH_DIR, `${date}.svg`);
  if (!existsSync(jsonPath) || !existsSync(svgPath)) return null;
  const record = JSON.parse(await readFile(jsonPath, 'utf-8'));
  const svg = await readFile(svgPath, 'utf-8');
  return { date, record, svg };
}

export async function loadEmptyDay(date: string): Promise<LoadedEmptyDay | null> {
  const path = join(FISH_DIR, `${date}.empty.json`);
  if (!existsSync(path)) return null;
  const r = JSON.parse(await readFile(path, 'utf-8'));
  return { date, reason: r.reason };
}

export async function loadLatest(): Promise<{ kind: 'fish'; data: LoadedFish } | { kind: 'empty'; data: LoadedEmptyDay } | null> {
  const dates = await listAllDates();
  if (dates.length === 0) return null;
  const date = dates[0];
  const fish = await loadFish(date);
  if (fish) return { kind: 'fish', data: fish };
  const empty = await loadEmptyDay(date);
  if (empty) return { kind: 'empty', data: empty };
  return null;
}
