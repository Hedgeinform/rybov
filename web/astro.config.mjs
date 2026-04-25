import { defineConfig } from 'astro/config';

const RYBOV_BASE = process.env.RYBOV_BASE_PATH ?? '/';

export default defineConfig({
  site: process.env.RYBOV_SITE_URL ?? 'https://hedgeinform.example',
  base: RYBOV_BASE,
  trailingSlash: 'never',
  output: 'static',
  build: {
    format: 'file',
  },
});
