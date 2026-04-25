import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
// pipeline/src/storage/paths.ts → repo root: ../../../
export const REPO_ROOT = resolve(__dirname, '../../..');
export const FISH_DIR = join(REPO_ROOT, 'fish');

export function fishJsonPath(date: string): string { return join(FISH_DIR, `${date}.json`); }
export function fishSvgPath(date: string): string { return join(FISH_DIR, `${date}.svg`); }
export function emptyDayPath(date: string): string { return join(FISH_DIR, `${date}.empty.json`); }
