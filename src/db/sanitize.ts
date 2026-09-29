/**
 * Universal Regex matching all Unicode and Telegram emoji categories:
 * - Country/Regional flags (e.g. 🇮🇷, 🇺🇸)
 * - Number/Symbol keycaps (e.g. 1️⃣, #️⃣)
 * - Pictographs & Symbols (e.g. 😂, ❤️, ☕, ⚡, 🫠, 🫡)
 * - Skin tone modifiers (e.g. 👍🏻, 👍🏽, 👍🏿)
 * - Complex ZWJ compound sequences (e.g. 👨👩👧👦, 🤦♂️, 👩💻, 🏳️🌈)
 */
export const TELEGRAM_EMOJI_REGEX =
  /(?:[\u{1F1E6}-\u{1F1FF}]{2}|[0-9#*]\uFE0F?\u20E3|(?:\p{Extended_Pictographic}|\p{So}|\p{Sk})(?:\uFE0F|\uFE0E)?(?:[\u{1F3FB}-\u{1F3FF}])?(?:\u200D(?:\p{Extended_Pictographic}|\p{So}|\p{Sk})(?:\uFE0F|\uFE0E)?(?:[\u{1F3FB}-\u{1F3FF}])?)*)/gu;

/**
 * Normalizes Persian characters, replacing Arabic kaf/yeh and trimming extra whitespace.
 * Preserves Zero-Width Joiner (\u200D) which is required for emoji sequences.
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
 * Parses channel post caption to extract title and searchable tags.
 */
export function parseCaptionMetadata(caption?: string): {
  title: string;
  tags: string;
  cleanCaption: string;
} {
  if (!caption || !caption.trim()) {
    return {
      title: 'گیف فارسی',
      tags: '',
      cleanCaption: '',
    };
  }

  const normalized = normalizePersianText(caption);
  const lines = normalized.split('\n').map((l) => l.trim()).filter(Boolean);

  // Extract hashtags (including tags with emojis)
  const hashtags = (normalized.match(/#[^\s#]+/gu) || []).map((h) =>
    h.replace(/^#/, '')
  );

  // First line is used as the title (truncated to 60 chars)
  const rawTitle = lines[0]?.replace(/#[^\s#]+/gu, '').trim() || 'گیف فارسی';
  const title = rawTitle.length > 60 ? `${rawTitle.slice(0, 57)}...` : rawTitle || 'گیف فارسی';

  // Extract all emojis in the caption
  const emojis = extractEmojis(normalized);

  // Words and hashtags combined into tags
  const words = normalized
    .replace(/#[^\s#]+/gu, '')
    .split(/[\s,،._-]+/)
    .filter((w) => w.length > 1 || TELEGRAM_EMOJI_REGEX.test(w));

  const uniqueTags = Array.from(new Set([...hashtags, ...words, ...emojis])).join(' ');

  return {
    title,
    tags: uniqueTags,
    cleanCaption: normalized,
  };
}
