import { tmpdir } from 'node:os';
import { runStage1 } from '../llm/stage1.ts';
import { runStage2 } from '../llm/stage2.ts';
import { runStage3 } from '../llm/stage3.ts';
import { render } from '../renderer/renderer.ts';
import { computeSignature } from '../dsl/signature.ts';
import { writeFish, writeEmptyDay, type FishRecord, type EmptyDayRecord } from '../storage/storage.ts';
import { getRecentWords } from '../storage/antirepeat.ts';
import { FISH_DIR } from '../storage/paths.ts';
import { RENDERER_VERSION } from '../renderer/version.ts';
import { MODEL } from '../llm/client.ts';
import { todayUtc } from '../shared/dates.ts';

export interface DailyResult {
  ok: boolean;
  date: string;
  record?: FishRecord;
  empty?: EmptyDayRecord;
}

export async function runDaily(opts?: { date?: string; dryRun?: boolean }): Promise<DailyResult> {
  const date = opts?.date ?? todayUtc();
  const dryRun = opts?.dryRun ?? false;
  const targetDir = dryRun ? `${tmpdir()}/rybov-dry-${Date.now()}` : FISH_DIR;

  const recordEmpty = (failed_stage: EmptyDayRecord['failed_stage'], reason: string): EmptyDayRecord => ({
    date, reason, failed_stage, model_version: MODEL, renderer_version: RENDERER_VERSION,
  });

  // Stage 1
  const recentWords = await getRecentWords(FISH_DIR, 30);
  let stage1;
  try { stage1 = await runStage1(recentWords); }
  catch (e) {
    const empty = recordEmpty('stage1', String(e));
    if (!dryRun) await writeEmptyDay(targetDir, empty);
    return { ok: false, date, empty };
  }

  // Stage 2
  let stage2;
  try { stage2 = await runStage2(stage1); }
  catch (e) {
    const empty = recordEmpty('stage2', String(e));
    if (!dryRun) await writeEmptyDay(targetDir, empty);
    return { ok: false, date, empty };
  }

  // Stage 3
  let stage3;
  try { stage3 = await runStage3(stage2); }
  catch (e) {
    const empty = recordEmpty('stage3', String(e));
    if (!dryRun) await writeEmptyDay(targetDir, empty);
    return { ok: false, date, empty };
  }

  // Render
  let svg: string;
  try { svg = render(stage3.dsl); }
  catch (e) {
    const empty = recordEmpty('render', String(e));
    if (!dryRun) await writeEmptyDay(targetDir, empty);
    return { ok: false, date, empty };
  }

  // Compose record
  const record: FishRecord = {
    date,
    stage1, stage2, stage3,
    signature: computeSignature(stage3.dsl),
    renderer_version: RENDERER_VERSION,
    model_version: MODEL,
  };

  // Storage
  try { await writeFish(targetDir, record, svg); }
  catch (e) {
    const empty = recordEmpty('storage', String(e));
    if (!dryRun) await writeEmptyDay(targetDir, empty);
    return { ok: false, date, empty };
  }

  return { ok: true, date, record };
}
