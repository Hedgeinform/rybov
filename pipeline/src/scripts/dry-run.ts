import { runDaily } from '../pipeline/daily.ts';
import { todayUtc } from '../shared/dates.ts';

const dateArg = process.argv[2];
const date = dateArg ?? todayUtc();
const result = await runDaily({ date, dryRun: true });
console.log(JSON.stringify(result, null, 2));
process.exit(result.ok ? 0 : 1);
