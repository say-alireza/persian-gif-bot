import { GifSearchResult } from '../types/gif';
import { sanitizeFtsQuery } from './sanitize';

/**
 * Searches active GIFs using D1 FTS5 full-text match.
 */
export async function searchGifs(
  db: D1Database,
  rawQuery: string,
  limit = 50
): Promise<GifSearchResult[]> {
  const ftsQuery = sanitizeFtsQuery(rawQuery);

  if (!ftsQuery) {
    return getRecentGifs(db, limit);
  }

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

    return results || [];
  } catch (err) {
    console.error('FTS Search Query Error:', err);
    // Fallback to recent GIFs if FTS query encounters edge case
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
