import { writeFile, readFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import type { DSL } from '../dsl/schema.ts';
import type { Signature } from '../dsl/signature.ts';

export interface Stage1Output {
  word: string;
  language: string;
  transliteration: string | null;
  russian_meaning: string;
}

export interface Stage2Output { description: string; }

export interface Stage3Output { dsl: DSL; }

export interface FishRecord {
  date: string;
  stage1: Stage1Output;
  stage2: Stage2Output;
  stage3: Stage3Output;
  signature: Signature;
  renderer_version: string;
  model_version: string;
}

export interface EmptyDayRecord {
  date: string;
  reason: string;
  failed_stage: 'stage1' | 'stage2' | 'stage3' | 'render' | 'storage';
  model_version: string;
  renderer_version: string;
}

export async function writeFish(dir: string, record: FishRecord, svg: string): Promise<void> {
  await mkdir(dir, { recursive: true });
  await writeFile(join(dir, `${record.date}.json`), JSON.stringify(record, null, 2), 'utf-8');
  await writeFile(join(dir, `${record.date}.svg`), svg, 'utf-8');
}

export async function readFish(dir: string, date: string): Promise<{ record: FishRecord; svg: string } | null> {
  const jsonPath = join(dir, `${date}.json`);
  const svgPath = join(dir, `${date}.svg`);
  if (!existsSync(jsonPath) || !existsSync(svgPath)) return null;
  const record = JSON.parse(await readFile(jsonPath, 'utf-8')) as FishRecord;
  const svg = await readFile(svgPath, 'utf-8');
  return { record, svg };
}

export async function writeEmptyDay(dir: string, record: EmptyDayRecord): Promise<void> {
  await mkdir(dir, { recursive: true });
  await writeFile(join(dir, `${record.date}.empty.json`), JSON.stringify(record, null, 2), 'utf-8');
}

export async function readEmptyDay(dir: string, date: string): Promise<EmptyDayRecord | null> {
  const path = join(dir, `${date}.empty.json`);
  if (!existsSync(path)) return null;
  return JSON.parse(await readFile(path, 'utf-8')) as EmptyDayRecord;
}
