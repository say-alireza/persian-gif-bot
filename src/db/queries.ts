import { GifSearchResult } from '../types/gif';
import { sanitizeFtsQuery, extractEmojis, normalizePersianText } from './sanitize';

/**
 * Searches active GIFs using a hybrid approach:
 * - FTS5 full-text match for Persian/English text.
 * - Multi-variant LIKE matching on caption/title/tags for all Telegram emojis,
 *   supporting variations (with/without \uFE0F) and skin tones.
 */
export async function searchGifs(
  db: D1Database,
  rawQuery: string,
  limit = 50,
  offset = 0
): Promise<GifSearchResult[]> {
  const trimmed = rawQuery.trim();
  if (!trimmed) {
    return getRecentGifs(db, limit, offset);
  }

  const emojis = extractEmojis(trimmed);
  const ftsQuery = sanitizeFtsQuery(trimmed);

  // Case 1: Pure Emoji / Sticker Search
  if (!ftsQuery && emojis.length > 0) {
    return searchGifsByEmojis(db, emojis, limit, offset);
  }

  // Case 2: Pure Text Search (FTS5 with LIKE fallback)
  if (ftsQuery && emojis.length === 0) {
    try {
      const { results } = await db
        .prepare(
          `SELECT g.id, g.file_id, g.title
           FROM gifs g
           JOIN gifs_fts f ON g.id = f.rowid
           WHERE gifs_fts MATCH ? AND g.status = 'active'
           ORDER BY g.views DESC, g.id DESC
           LIMIT ? OFFSET ?`
        )
        .bind(ftsQuery, limit, offset)
        .all<GifSearchResult>();

      if (results && results.length > 0) {
        return results;
      }

      return searchGifsByTextLike(db, trimmed, limit, offset);
    } catch (err) {
      console.error('FTS Search Query Error:', err);
      return searchGifsByTextLike(db, trimmed, limit, offset);
    }
  }

  // Case 3: Combined Text + Emoji Search
  if (ftsQuery && emojis.length > 0) {
    try {
      const conditions: string[] = [];
      const binds: string[] = [];

      for (const emoji of emojis) {
        const canonical = emoji.replace(/[\uFE0E\uFE0F]/g, '');
        const base = canonical.replace(/[\u{1F3FB}-\u{1F3FF}]/gu, '');
        const variants = Array.from(new Set([emoji, canonical, base].filter(Boolean)));

        const variantConditions = variants.map(
          () => `(g.caption LIKE ? OR g.title LIKE ? OR g.tags LIKE ?)`
        );
        conditions.push(`(${variantConditions.join(' OR ')})`);

        for (const v of variants) {
          const pattern = `%${v}%`;
          binds.push(pattern, pattern, pattern);
        }
      }

      const whereClause = conditions.join(' AND ');

      const { results } = await db
        .prepare(
          `SELECT g.id, g.file_id, g.title
           FROM gifs g
           JOIN gifs_fts f ON g.id = f.rowid
           WHERE gifs_fts MATCH ? AND g.status = 'active'
             AND ${whereClause}
           ORDER BY g.views DESC, g.id DESC
           LIMIT ? OFFSET ?`
        )
        .bind(ftsQuery, ...binds, limit, offset)
        .all<GifSearchResult>();

      if (results && results.length > 0) {
        return results;
      }

      return searchGifsByEmojis(db, emojis, limit, offset);
    } catch (err) {
      console.error('Combined Search Query Error:', err);
      return searchGifsByEmojis(db, emojis, limit, offset);
    }
  }

  // Fallback for edge cases
  return searchGifsByTextLike(db, trimmed, limit, offset);
}

/**
 * Searches active GIFs containing specific emojis in caption, title, or tags.
 * Resolves variation selectors and skin tone differences so all emoji variants match.
 */
export async function searchGifsByEmojis(
  db: D1Database,
  emojis: string[],
  limit = 50,
  offset = 0
): Promise<GifSearchResult[]> {
  if (emojis.length === 0) return getRecentGifs(db, limit, offset);

  const conditions: string[] = [];
  const binds: string[] = [];

  for (const emoji of emojis) {
    const canonical = emoji.replace(/[\uFE0E\uFE0F]/g, '');
    const base = canonical.replace(/[\u{1F3FB}-\u{1F3FF}]/gu, '');
    const variants = Array.from(new Set([emoji, canonical, base].filter(Boolean)));

    const variantConditions = variants.map(
      () => `(caption LIKE ? OR title LIKE ? OR tags LIKE ?)`
    );
    conditions.push(`(${variantConditions.join(' OR ')})`);

    for (const v of variants) {
      const pattern = `%${v}%`;
      binds.push(pattern, pattern, pattern);
    }
  }

  const whereClause = conditions.join(' AND ');

  try {
    const { results } = await db
      .prepare(
        `SELECT id, file_id, title
         FROM gifs
         WHERE status = 'active' AND ${whereClause}
         ORDER BY views DESC, id DESC
         LIMIT ? OFFSET ?`
      )
      .bind(...binds, limit, offset)
      .all<GifSearchResult>();

    return results || [];
  } catch (err) {
    console.error('Emoji Search Error:', err);
    return getRecentGifs(db, limit, offset);
  }
}

/**
 * Fallback substring search across caption, title, and tags using LIKE.
 */
export async function searchGifsByTextLike(
  db: D1Database,
  rawText: string,
  limit = 50,
  offset = 0
): Promise<GifSearchResult[]> {
  const normalized = normalizePersianText(rawText);
  if (!normalized) return getRecentGifs(db, limit, offset);

  const pattern = `%${normalized}%`;

  try {
    const { results } = await db
      .prepare(
        `SELECT id, file_id, title
         FROM gifs
         WHERE status = 'active'
           AND (caption LIKE ? OR title LIKE ? OR tags LIKE ?)
         ORDER BY views DESC, id DESC
         LIMIT ? OFFSET ?`
      )
      .bind(pattern, pattern, pattern, limit, offset)
      .all<GifSearchResult>();

    return results || [];
  } catch (err) {
    console.error('Text LIKE Search Error:', err);
    return getRecentGifs(db, limit, offset);
  }
}

/**
 * Retrieves the most recent / popular active GIFs when the search query is empty.
 */
export async function getRecentGifs(
  db: D1Database,
  limit = 50,
  offset = 0
): Promise<GifSearchResult[]> {
  const { results } = await db
    .prepare(
      `SELECT id, file_id, title
       FROM gifs
       WHERE status = 'active'
       ORDER BY id DESC
       LIMIT ? OFFSET ?`
    )
    .bind(limit, offset)
    .all<GifSearchResult>();

  return results || [];
}

/**
 * Upserts a GIF item into the database by file_unique_id.
 */
export async function upsertGif(
  db: D1Database,
  data: {
    file_id: string;
    file_unique_id: string;
    title: string;
    caption?: string;
    tags?: string;
  }
): Promise<void> {
  await db
    .prepare(
      `INSERT INTO gifs (file_id, file_unique_id, title, caption, tags, updated_at)
       VALUES (?, ?, ?, ?, ?, datetime('now'))
       ON CONFLICT(file_unique_id) DO UPDATE SET
         file_id = excluded.file_id,
         title = excluded.title,
         caption = excluded.caption,
         tags = excluded.tags,
         updated_at = datetime('now')`
    )
    .bind(
      data.file_id,
      data.file_unique_id,
      data.title,
      data.caption || '',
      data.tags || ''
    )
    .run();
}

/**
 * Updates an existing GIF's caption and tags by file_unique_id.
 */
export async function updateGifCaption(
  db: D1Database,
  fileUniqueId: string,
  title: string,
  caption: string,
  tags: string
): Promise<void> {
  await db
    .prepare(
      `UPDATE gifs
       SET title = ?, caption = ?, tags = ?, updated_at = datetime('now')
       WHERE file_unique_id = ?`
    )
    .bind(title, caption, tags, fileUniqueId)
    .run();
}
