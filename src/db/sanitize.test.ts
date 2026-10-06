import { describe, it, expect } from 'vitest';
import { parseSubmissionInput, parseCaptionMetadata } from './sanitize';

describe('parseSubmissionInput', () => {
  it('uses line 1 as title and later lines as tags', () => {
    const r = parseSubmissionInput('گربه خندان\nfunny cat 😂 #cat');
    expect(r).toEqual({
      ok: true,
      title: 'گربه خندان',
      tags: ['cat', '😂', 'funny'],
      caption: 'گربه خندان\nfunny cat 😂 #cat',
    });
  });

  it('rejects empty input and title-only input', () => {
    expect(parseSubmissionInput('')).toEqual({ ok: false, error: 'no_title' });
    expect(parseSubmissionInput('   \n  ')).toEqual({ ok: false, error: 'no_title' });
    expect(parseSubmissionInput('Hello')).toEqual({ ok: false, error: 'no_tags' });
  });

  it('enforces limits', () => {
    expect(parseSubmissionInput('a'.repeat(61) + '\n#x')).toEqual({ ok: false, error: 'title_too_long' });
    const eleven = Array.from({ length: 11 }, (_, i) => `#t${i}`).join(' ');
    expect(parseSubmissionInput('t\n' + eleven)).toEqual({ ok: false, error: 'too_many_tags' });
    expect(parseSubmissionInput('t\n#' + 'a'.repeat(31))).toEqual({ ok: false, error: 'tag_too_long' });
    expect(parseSubmissionInput('x'.repeat(201))).toEqual({ ok: false, error: 'too_long' });
  });

  it('accepts plain words, keeps underscores, dedups', () => {
    const r = parseSubmissionInput('title\nfunny #big_cat funny');
    expect(r.ok && r.tags).toEqual(['big_cat', 'funny']);
  });

  it('accepts an emoji-only tag line', () => {
    const r = parseSubmissionInput('title\n😂🔥');
    expect(r.ok && r.tags).toEqual(['😂', '🔥']);
  });

  it('normalizes Arabic yeh/kaf and keeps ZWNJ', () => {
    const r = parseSubmissionInput('عل\u064A \u0643تاب\n#x');
    expect(r.ok && r.title).toBe('عل\u06CC \u06A9تاب');
    const z = parseSubmissionInput('می\u200Cخواهم\n#x');
    expect(z.ok && z.title).toContain('\u200C');
  });

  it('has no regex state leak between calls', () => {
    const a = parseSubmissionInput('t\n😂 😂 x1');
    const b = parseSubmissionInput('t\n😂 😂 x1');
    expect(a).toEqual(b);
  });
});

describe('parseCaptionMetadata', () => {
  it('parses a channel-style caption', () => {
    const r = parseCaptionMetadata('My title\n#a #b 😂');
    expect(r.title).toBe('My title');
    expect(r.tags).toBe('a b 😂');
  });

  it('truncates long titles and defaults empty ones', () => {
    expect(parseCaptionMetadata('x'.repeat(70)).title).toBe('x'.repeat(57) + '...');
    expect(parseCaptionMetadata(undefined).title).toBe('گیف فارسی');
  });

  it('is stable across repeated emoji calls', () => {
    const a = parseCaptionMetadata('t\n😂 😂');
    const b = parseCaptionMetadata('t\n😂 😂');
    expect(a).toEqual(b);
  });
});
