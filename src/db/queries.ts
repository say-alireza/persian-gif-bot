import { GifSearchResult } from '../types/gif';
import { sanitizeFtsQuery, extractEmojis, normalizePersianText } from './sanitize';

/**
 * Searches active GIFs using a hybrid approach:
 * - FTS5 full-text match for Persian/English text.
 * - Direct LIKE match on caption/title/tags for emoji and sticker tags.
 */
export async function searchGifs(
  db: D1Database,
  rawQuery: string,
  limit = 50
): Promise<GifSearchResult[]> {
  const trimmed = rawQuery.trim();
  if (!trimmed) {
    return getRecentGifs(db, limit);
  }

  const emojis = extractEmojis(trimmed);
  const ftsQuery = sanitizeFtsQuery(trimmed);

  // Case 1: Pure Emoji / Sticker Search
  if (!ftsQuery && emojis.length > 0) {
    return searchGifsByEmojis(db, emojis, limit);
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
           LIMIT ?`
        )
        .bind(ftsQuery, limit)
        .all<GifSearchResult>();

      if (results && results.length > 0) {
        return results;
      }

      return searchGifsByTextLike(db, trimmed, limit);
    } catch (err) {
      console.error('FTS Search Query Error:', err);
      return searchGifsByTextLike(db, trimmed, limit);
    }
  }

  // Case 3: Combined Text + Emoji Search
  if (ftsQuery && emojis.length > 0) {
    try {
      const emojiConditions = emojis
        .map(() => `(g.caption LIKE ? OR g.title LIKE ? OR g.tags LIKE ?)`)
        .join(' AND ');

      const emojiBinds = emojis.flatMap((e) => [`%${e}%`, `%${e}%`, `%${e}%`]);

      const { results } = await db
        .prepare(
          `SELECT g.id, g.file_id, g.title
           FROM gifs g
           JOIN gifs_fts f ON g.id = f.rowid
           WHERE gifs_fts MATCH ? AND g.status = 'active'
             AND ${emojiConditions}
           ORDER BY g.views DESC, g.id DESC
           LIMIT ?`
        )
        .bind(ftsQuery, ...emojiBinds, limit)
        .all<GifSearchResult>();

      if (results && results.length > 0) {
        return results;
      }

      // If combined returned 0, fallback to matching the emojis
      return searchGifsByEmojis(db, emojis, limit);
    } catch (err) {
      console.error('Combined Search Query Error:', err);
      return searchGifsByEmojis(db, emojis, limit);
    }
  }

  // Fallback for edge cases
  return searchGifsByTextLike(db, trimmed, limit);
}

/**
 * Searches active GIFs containing specific emojis in caption, title, or tags.
 */
export async function searchGifsByEmojis(
  db: D1Database,
  emojis: string[],
  limit = 50
): Promise<GifSearchResult[]> {
  if (emojis.length === 0) return getRecentGifs(db, limit);

  const emojiConditions = emojis
    .map(() => `(caption LIKE ? OR title LIKE ? OR tags LIKE ?)`)
    .join(' AND ');

  const emojiBinds = emojis.flatMap((e) => [`%${e}%`, `%${e}%`, `%${e}%`]);

  try {
    const { results } = await db
      .prepare(
        `SELECT id, file_id, title
         FROM gifs
         WHERE status = 'active' AND ${emojiConditions}
         ORDER BY views DESC, id DESC
         LIMIT ?`
      )
      .bind(...emojiBinds, limit)
      .all<GifSearchResult>();

    return results || [];
  } catch (err) {
    console.error('Emoji Search Error:', err);
    return getRecentGifs(db, limit);
  }
}

/**
 * Fallback substring search across caption, title, and tags using LIKE.
 */
export async function searchGifsByTextLike(
  db: D1Database,
  rawText: string,
  limit = 50
): Promise<GifSearchResult[]> {
  const normalized = normalizePersianText(rawText);
  if (!normalized) return getRecentGifs(db, limit);

  const pattern = `%${normalized}%`;

  try {
    const { results } = await db
      .prepare(
        `SELECT id, file_id, title
         FROM gifs
         WHERE status = 'active'
           AND (caption LIKE ? OR title LIKE ? OR tags LIKE ?)
         ORDER BY views DESC, id DESC
         LIMIT ?`
      )
      .bind(pattern, pattern, pattern, limit)
      .all<GifSearchResult>();

    return results || [];
  } catch (err) {
    console.error('Text LIKE Search Error:', err);
    return getRecentGifs(db, limit);
  }
}

/**
 * Retrieves the most recent / popular active GIFs when the search query is empty.
 */
export async function getRecentGifs(
  db: D1Database,
  limit = 50
): Promise<GifSearchResult[]> {
  const { results } = await db
    .prepare(
      `SELECT id, file_id, title
       FROM gifs
       WHERE status = 'active'
       ORDER BY views DESC, id DESC
       LIMIT ?`
    )
    .bind(limit)
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
