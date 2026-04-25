import { runDaily } from '../pipeline/daily.ts';

const result = await runDaily();
if (result.ok) {
  console.log(`OK: ${result.date} — ${result.record?.stage1.word}`);
  process.exit(0);
} else {
  console.error(`DAY FAIL: ${result.date} — ${result.empty?.failed_stage}: ${result.empty?.reason}`);
  process.exit(2); // distinct from generic failure for CI handling
}
