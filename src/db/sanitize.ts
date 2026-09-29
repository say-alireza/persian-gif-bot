/**
 * Normalizes Persian characters, replacing Arabic kaf/yeh and trimming extra whitespace.
 */
export function normalizePersianText(text: string): string {
  if (!text) return '';
  return text
    .replace(/\u064A/g, '\u06CC') // Arabic Yeh -> Persian Yeh
    .replace(/\u0649/g, '\u06CC') // Arabic Alef Maksura -> Persian Yeh
    .replace(/\u0643/g, '\u06A9') // Arabic Kaf -> Persian Kaf
    .replace(/[\u200B-\u200D\uFEFF]/g, '\u200C') // Standardize zero-width characters to ZWNJ
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Extracts unique emoji sequences from text.
 */
export function extractEmojis(text: string): string[] {
  if (!text) return [];
  const matches = text.match(/\p{Extended_Pictographic}/gu) || [];
  return Array.from(new Set(matches));
}

/**
 * Sanitizes user input for safe SQLite FTS5 MATCH queries.
 * Strips emojis and special operators to prevent SQLite query syntax errors.
 */
export function sanitizeFtsQuery(query: string): string {
  const normalized = normalizePersianText(query);
  if (!normalized) return '';

  // Remove emojis before passing to FTS to avoid tokenizer issues
  const withoutEmojis = normalized.replace(/\p{Extended_Pictographic}/gu, ' ');

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
    .filter((w) => w.length > 1 || /\p{Extended_Pictographic}/u.test(w));

  const uniqueTags = Array.from(new Set([...hashtags, ...words, ...emojis])).join(' ');

  return {
    title,
    tags: uniqueTags,
    cleanCaption: normalized,
  };
}
