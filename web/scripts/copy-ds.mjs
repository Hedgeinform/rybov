import { mkdir, copyFile, cp } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SRC = resolve(__dirname, '../../design-system/arkadiy-ds');
const DST = resolve(__dirname, '../public/arkadiy-ds');

await mkdir(DST, { recursive: true });
await copyFile(`${SRC}/tokens.css`, `${DST}/tokens.css`);
await copyFile(`${SRC}/typography.css`, `${DST}/typography.css`);

// fonts/ MUST be copied alongside CSS — typography.css uses relative
// `url('fonts/...')` paths in @font-face declarations. Without this,
// the browser 404s on every woff2 and falls back to system-ui.
await cp(`${SRC}/fonts`, `${DST}/fonts`, { recursive: true });

console.log('Copied arkadiy-ds tokens.css + typography.css + fonts/ to web/public/arkadiy-ds/');
