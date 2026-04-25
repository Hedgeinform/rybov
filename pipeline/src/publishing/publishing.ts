import { readFish, readEmptyDay, type FishRecord } from '../storage/storage.ts';

export interface SiteConfig { baseUrl: string; /* no trailing slash */ }

export interface CanonicalFish {
  date: string;
  record: FishRecord;
  svg: string;
  permalinkUrl: string;
  altText: string;
  ogMeta: {
    title: string;
    description: string;
    image: string; // absolute URL to SVG (or PNG when generated)
  };
  // Note: prev/next navigation links are intentionally out of MVP scope.
  // The archive page (Task 8.4) provides browsing; per-fish prev/next can
  // be added later by extending getCanonicalFish to take an ordered date list.
}

export interface CanonicalEmptyDay {
  date: string;
  reason: string;
  permalinkUrl: string;
}

export async function getCanonicalFish(
  dir: string,
  date: string,
  cfg: SiteConfig,
): Promise<CanonicalFish | null> {
  const r = await readFish(dir, date);
  if (!r) return null;
  const { record, svg } = r;
  const permalinkUrl = `${cfg.baseUrl}/${date}`;
  const word = record.stage1.word;
  const description = record.stage2.description;
  return {
    date,
    record,
    svg,
    permalinkUrl,
    altText: `Concept fish for ${date}, generated from the word "${word}".`,
    ogMeta: {
      title: `${date} · ${word} — Rybov`,
      description: description.slice(0, 200),
      image: `${permalinkUrl}.svg`,
    },
  };
}

export async function getCanonicalEmptyDay(
  dir: string,
  date: string,
  cfg: SiteConfig,
): Promise<CanonicalEmptyDay | null> {
  const r = await readEmptyDay(dir, date);
  if (!r) return null;
  return { date, reason: r.reason, permalinkUrl: `${cfg.baseUrl}/${date}` };
}
