import { describe, expect, it } from 'vitest';
import { buildCaption } from '../../src/delivery/telegram.ts';

describe('buildCaption', () => {
  const base = {
    date: '2026-04-25',
    word: 'мост',
    language: 'Russian',
    transliteration: 'most',
    meaning: 'мост',
    description: 'Рыба-мост между двумя берегами одного течения.',
    permalinkUrl: 'https://hedgeinform.example/rybov_show/2026-04-25',
  };

  it('emits the FIG header with the date', () => {
    expect(buildCaption(base)).toContain('<b>FIG. 2026-04-25</b>');
  });

  it('escapes HTML-special chars in description', () => {
    const cap = buildCaption({ ...base, description: 'Рыба, & < > чешуя.' });
    expect(cap).toContain('&amp;');
    expect(cap).toContain('&lt;');
    expect(cap).toContain('&gt;');
    expect(cap).not.toContain('< ');
    expect(cap).not.toContain('> чешуя');
  });

  it('puts the permalink as the last line as an <a> tag', () => {
    const cap = buildCaption(base);
    const lines = cap.split('\n');
    expect(lines.at(-1)).toBe(`<a href="${base.permalinkUrl}">${base.permalinkUrl}</a>`);
  });

  it('lowercases language label', () => {
    const cap = buildCaption({ ...base, language: 'Russian' });
    expect(cap).toContain('(russian,');
  });

  it('includes transliteration when present', () => {
    const cap = buildCaption({
      ...base,
      word: 'छाया',
      language: 'Hindi',
      transliteration: 'chhaya',
      meaning: 'тень',
    });
    expect(cap).toContain('छाया (hindi, chhaya: тень)');
  });

  it('omits transliteration when null (Latin-script word)', () => {
    const cap = buildCaption({
      ...base,
      word: 'saudade',
      language: 'Portuguese',
      transliteration: null,
      meaning: 'светлая тоска',
    });
    expect(cap).toContain('saudade (portuguese: светлая тоска)');
    expect(cap).not.toContain(', null:');
  });
});
