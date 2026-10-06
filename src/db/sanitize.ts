/**
 * Universal Regex matching all Unicode and Telegram emoji categories:
 * - Country/Regional flags (e.g. 🇮🇷, 🇺🇸)
 * - Number/Symbol keycaps (e.g. 1️⃣, #️⃣)
 * - Pictographs & Symbols (e.g. 😂, ❤️, ☕, ⚡, 🫠, 🫡)
 * - Skin tone modifiers (e.g. 👍🏻, 👍🏽, 👍🏿)
 * - Complex ZWJ compound sequences (e.g. 👨👩👧👦, 🤦♂️, 👩💻, 🏳️🌈)
 *
 * NOTE: global flag. Never call .test()/.exec() on it (stateful lastIndex);
 * use String.prototype.match / replace only.
 */
export const TELEGRAM_EMOJI_REGEX =
  /(?:[\u{1F1E6}-\u{1F1FF}]{2}|[0-9#*]\uFE0F?\u20E3|(?:\p{Extended_Pictographic}|\p{So}|\p{Sk})(?:\uFE0F|\uFE0E)?(?:[\u{1F3FB}-\u{1F3FF}])?(?:\u200D(?:\p{Extended_Pictographic}|\p{So}|\p{Sk})(?:\uFE0F|\uFE0E)?(?:[\u{1F3FB}-\u{1F3FF}])?)*)/gu;

export const LIMITS = {
  TITLE_MAX: 60,
  TAGS_MAX: 10,
  TAG_MAX_LEN: 30,
  TEXT_MAX: 200,
} as const;

const DEFAULT_TITLE = 'گیف فارسی';
const HASHTAG = /#[^\s#]+/gu;
const TRAILING_PUNCT = /[.,،!؟?;؛]+$/u;
const WORD_SPLIT = /[\s,،;؛.!؟?]+/u;

/**
 * Normalizes Persian characters, replacing Arabic kaf/yeh and trimming extra whitespace.
 * Preserves Zero-Width Joiner (\u200D) which is required for emoji sequences.
 * Collapses ALL whitespace (including newlines): use for single-line queries only.
 */
export function normalizePersianText(text: string): string {
  if (!text) return '';
  return text
    .replace(/\u064A/g, '\u06CC') // Arabic Yeh -> Persian Yeh
    .replace(/\u0649/g, '\u06CC') // Arabic Alef Maksura -> Persian Yeh
    .replace(/\u0643/g, '\u06A9') // Arabic Kaf -> Persian Kaf
    .replace(/[\u200B\uFEFF]/g, '\u200C') // Standardize zero-width spaces to ZWNJ (keeps ZWJ for emojis)
    .replace(/\s+/g, ' ')
    .trim();
}

/** Same character normalization as normalizePersianText, but keeps line breaks. */
export function normalizeKeepLines(text: string): string {
  if (!text) return '';
  return text
    .replace(/\r\n?/g, '\n')
    .replace(/\u064A/g, '\u06CC')
    .replace(/\u0649/g, '\u06CC')
    .replace(/\u0643/g, '\u06A9')
    .replace(/[\u200B\uFEFF]/g, '\u200C')
    .split('\n')
    .map((line) => line.replace(/[^\S\n]+/g, ' ').trim())
    .filter((line) => line.length > 0)
    .join('\n');
}

/**
 * Extracts all unique Telegram emoji and sticker sequences from text.
 */
export function extractEmojis(text: string): string[] {
  if (!text) return [];
  const matches = text.match(TELEGRAM_EMOJI_REGEX) || [];
  return Array.from(new Set(matches.map((m) => m.trim()).filter(Boolean)));
}

/**
 * Sanitizes user input for safe SQLite FTS5 MATCH queries.
 * Strips emojis and special operators to prevent SQLite query syntax errors.
 */
export function sanitizeFtsQuery(query: string): string {
  const normalized = normalizePersianText(query);
  if (!normalized) return '';

  // Remove emojis before passing to FTS to avoid tokenizer issues
  const withoutEmojis = normalized.replace(TELEGRAM_EMOJI_REGEX, ' ');

  // Remove FTS5 special characters: * " ' - + : ^ ( ) { } [ ] ~
  const cleaned = withoutEmojis.replace(/[*"'`~^:+\-(){}[\]\\/]/g, ' ');

  // Split into tokens, filter out empty strings and FTS boolean keywords
  const tokens = cleaned
    .split(/\s+/)
    .filter((token) => token.length > 0)
    .filter((token) => !['AND', 'OR', 'NOT', 'NEAR'].includes(token.toUpperCase()));

  if (tokens.length === 0) return '';

  // Format as prefix match for each token: "token1"* AND "token2"*
  return tokens.map((token) => `"${token}"*`).join(' AND ');
}

/**
 * Tags: hashtags from every line, emojis from every line,
 * plain words from the lines after the first. Deduplicated, order preserved.
 */
function collectTags(text: string, lines: string[]): string[] {
  const found: string[] = [];
  for (const h of text.match(HASHTAG) ?? []) {
    found.push(h.slice(1).replace(TRAILING_PUNCT, ''));
  }
  found.push(...extractEmojis(text));
  for (const line of lines.slice(1)) {
    const rest = line.replace(HASHTAG, ' ').replace(TELEGRAM_EMOJI_REGEX, ' ');
    for (const word of rest.split(WORD_SPLIT)) {
      if (word.length >= 2) found.push(word);
    }
  }
  return Array.from(new Set(found.filter((t) => t.length > 0)));
}

export type SubmissionParseError =
  | 'no_title'
  | 'title_too_long'
  | 'no_tags'
  | 'too_many_tags'
  | 'tag_too_long'
  | 'too_long';

export type SubmissionParseResult =
  | { ok: true; title: string; tags: string[]; caption: string }
  | { ok: false; error: SubmissionParseError };

/**
 * Parses user-submitted "title + tags" text. Strict: rejects instead of truncating.
 */
export function parseSubmissionInput(raw: string): SubmissionParseResult {
  const text = normalizeKeepLines(raw);
  if (!text) return { ok: false, error: 'no_title' };
  if (text.length > LIMITS.TEXT_MAX) return { ok: false, error: 'too_long' };

  const lines = text.split('\n');
  const title = lines[0].replace(HASHTAG, ' ').replace(/\s+/g, ' ').trim();
  if (!title) return { ok: false, error: 'no_title' };
  if (title.length > LIMITS.TITLE_MAX) return { ok: false, error: 'title_too_long' };

  const tags = collectTags(text, lines);
  if (tags.length === 0) return { ok: false, error: 'no_tags' };
  if (tags.length > LIMITS.TAGS_MAX) return { ok: false, error: 'too_many_tags' };
  if (tags.some((t) => t.length > LIMITS.TAG_MAX_LEN)) return { ok: false, error: 'tag_too_long' };

  return { ok: true, title, tags, caption: text };
}

/**
 * Parses channel post caption (admin-written: truncates instead of rejecting).
 */
export function parseCaptionMetadata(caption?: string): {
  title: string;
  tags: string;
  cleanCaption: string;
} {
  const text = caption ? normalizeKeepLines(caption) : '';
  if (!text) {
    return { title: DEFAULT_TITLE, tags: '', cleanCaption: '' };
  }

  const lines = text.split('\n');
  const rawTitle = lines[0].replace(HASHTAG, ' ').replace(/\s+/g, ' ').trim() || DEFAULT_TITLE;
  const title = rawTitle.length > LIMITS.TITLE_MAX ? `${rawTitle.slice(0, 57)}...` : rawTitle;

  return {
    title,
    tags: collectTags(text, lines).join(' '),
    cleanCaption: text,
  };
}
