import { AuditEntry, GifEntity } from '../types/gif';

/*
 * Design notes
 * - Every status change / audit pair runs in ONE db.batch (atomic).
 * - The audit row is inserted FIRST, guarded by the same WHERE as the update, so we never rely
 *   on changes(). Success is detected with RETURNING (rows returned), not meta.changes, because
 *   the FTS triggers also write rows.
 */

export async function getGifById(db: D1Database, id: number): Promise<GifEntity | null> {
  return db.prepare(`SELECT * FROM gifs WHERE id = ?`).bind(id).first<GifEntity>();
}

export async function getGifByUniqueId(db: D1Database, fileUniqueId: string): Promise<GifEntity | null> {
  return db.prepare(`SELECT * FROM gifs WHERE file_unique_id = ?`).bind(fileUniqueId).first<GifEntity>();
}

export async function countRecentSubmissions(db: D1Database, userId: number): Promise<number> {
  const row = await db
    .prepare(`SELECT COUNT(*) AS n FROM gifs WHERE submitted_by = ? AND submitted_at > datetime('now', '-1 day')`)
    .bind(userId)
    .first<{ n: number }>();
  return row?.n ?? 0;
}

export async function isBanned(db: D1Database, userId: number): Promise<boolean> {
  const row = await db.prepare(`SELECT 1 AS x FROM banned_users WHERE user_id = ?`).bind(userId).first();
  return row !== null;
}

export async function banUser(db: D1Database, userId: number, adminId: number, reason: string | null): Promise<void> {
  await db
    .prepare(
      `INSERT INTO banned_users (user_id, banned_by, reason) VALUES (?, ?, ?)
       ON CONFLICT(user_id) DO UPDATE SET banned_by = excluded.banned_by, reason = excluded.reason, banned_at = datetime('now')`
    )
    .bind(userId, adminId, reason)
    .run();
}

export async function unbanUser(db: D1Database, userId: number): Promise<void> {
  await db.prepare(`DELETE FROM banned_users WHERE user_id = ?`).bind(userId).run();
}

export async function insertPendingGif(
  db: D1Database,
  p: {
    fileId: string;
    fileUniqueId: string;
    title: string;
    caption: string;
    tags: string;
    userId: number;
    username: string;
  }
): Promise<'inserted' | 'duplicate'> {
  const [ins] = await db.batch<{ id: number }>([
    db
      .prepare(
        `INSERT INTO gifs (file_id, file_unique_id, title, caption, tags, status,
                           source, submitted_by, submitted_by_username, submitted_at, updated_at)
         VALUES (?, ?, ?, ?, ?, 'pending_review', 'user', ?, ?, datetime('now'), datetime('now'))
         ON CONFLICT(file_unique_id) DO NOTHING
         RETURNING id`
      )
      .bind(p.fileId, p.fileUniqueId, p.title, p.caption, p.tags, p.userId, p.username),
    // Only the row we just created matches: it is ours and has no 'submitted' audit yet.
    db
      .prepare(
        `INSERT INTO gif_audit_log (gif_id, action, actor_id, actor_username)
         SELECT g.id, 'submitted', ?, ? FROM gifs g
         WHERE g.file_unique_id = ? AND g.submitted_by = ?
           AND NOT EXISTS (SELECT 1 FROM gif_audit_log a WHERE a.gif_id = g.id AND a.action = 'submitted')`
      )
      .bind(p.userId, p.username, p.fileUniqueId, p.userId),
  ]);
  return (ins.results?.length ?? 0) > 0 ? 'inserted' : 'duplicate';
}

export async function reviewGif(
  db: D1Database,
  p: {
    gifId: number;
    outcome: 'approved' | 'rejected';
    adminId: number;
    adminName: string;
    rejectCode?: string;
  }
): Promise<'ok' | 'already_reviewed' | 'not_found'> {
  const status = p.outcome === 'approved' ? 'active' : 'rejected';
  const results = await db.batch<{ id: number }>([
    db
      .prepare(
        `INSERT INTO gif_audit_log (gif_id, action, actor_id, actor_username, details)
         SELECT id, ?, ?, ?, ? FROM gifs WHERE id = ? AND status = 'pending_review'`
      )
      .bind(p.outcome, p.adminId, p.adminName, p.rejectCode ?? null, p.gifId),
    db
      .prepare(
        `UPDATE gifs
         SET status = ?, reviewed_by = ?, reviewed_by_username = ?, reviewed_at = datetime('now'),
             reject_reason = ?, updated_at = datetime('now')
         WHERE id = ? AND status = 'pending_review'
         RETURNING id`
      )
      .bind(status, p.adminId, p.adminName, p.rejectCode ?? null, p.gifId),
  ]);
  if ((results[1].results?.length ?? 0) > 0) return 'ok';
  const row = await getGifById(db, p.gifId);
  return row ? 'already_reviewed' : 'not_found';
}

/** Admin edit of a still-pending GIF. Returns false if it is no longer pending. */
export async function editPendingGif(
  db: D1Database,
  p: { gifId: number; title: string; caption: string; tags: string; adminId: number; adminName: string }
): Promise<boolean> {
  const results = await db.batch<{ id: number }>([
    db
      .prepare(
        `INSERT INTO gif_audit_log (gif_id, action, actor_id, actor_username, details)
         SELECT id, 'tags_edited', ?, ?,
                json_object('old_title', title, 'old_tags', tags, 'new_title', ?, 'new_tags', ?)
         FROM gifs WHERE id = ? AND status = 'pending_review'`
      )
      .bind(p.adminId, p.adminName, p.title, p.tags, p.gifId),
    db
      .prepare(
        `UPDATE gifs SET title = ?, caption = ?, tags = ?, updated_at = datetime('now')
         WHERE id = ? AND status = 'pending_review'
         RETURNING id`
      )
      .bind(p.title, p.caption, p.tags, p.gifId),
  ]);
  return (results[1].results?.length ?? 0) > 0;
}

export async function getPendingUserGifs(db: D1Database, limit: number): Promise<GifEntity[]> {
  const { results } = await db
    .prepare(`SELECT * FROM gifs WHERE status = 'pending_review' AND source = 'user' ORDER BY id ASC LIMIT ?`)
    .bind(limit)
    .all<GifEntity>();
  return results ?? [];
}

export async function getAuditLog(db: D1Database, gifId: number, limit: number): Promise<AuditEntry[]> {
  const { results } = await db
    .prepare(
      `SELECT action, actor_id, actor_username, details, created_at
       FROM gif_audit_log WHERE gif_id = ? ORDER BY id DESC LIMIT ?`
    )
    .bind(gifId, limit)
    .all<AuditEntry>();
  return results ?? [];
}

/**
 * Channel ingestion. Never touches the source, submitted_*, reviewed_* or reject_reason columns.
 * A channel post for a pending/rejected GIF activates it, with a 'channel_override' audit row.
 */
export async function ingestChannelGif(
  db: D1Database,
  data: { file_id: string; file_unique_id: string; title: string; caption: string; tags: string }
): Promise<void> {
  await db.batch([
    db
      .prepare(
        `INSERT INTO gif_audit_log (gif_id, action, actor_id, actor_username, details)
         SELECT id, 'approved', NULL, NULL, 'channel_override' FROM gifs
         WHERE file_unique_id = ? AND status IN ('pending_review', 'rejected')`
      )
      .bind(data.file_unique_id),
    db
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
      .bind(data.file_id, data.file_unique_id, data.title, data.caption, data.tags),
    db
      .prepare(
        `UPDATE gifs SET status = 'active', updated_at = datetime('now')
         WHERE file_unique_id = ? AND status IN ('pending_review', 'rejected')`
      )
      .bind(data.file_unique_id),
  ]);
}

/** Edited channel post. For user-submitted rows, also logs a 'channel_edit' audit entry. */
export async function updateChannelCaption(
  db: D1Database,
  fileUniqueId: string,
  title: string,
  caption: string,
  tags: string
): Promise<void> {
  await db.batch([
    db
      .prepare(
        `INSERT INTO gif_audit_log (gif_id, action, actor_id, actor_username, details)
         SELECT id, 'tags_edited', NULL, NULL, 'channel_edit' FROM gifs
         WHERE file_unique_id = ? AND source = 'user'`
      )
      .bind(fileUniqueId),
    db
      .prepare(
        `UPDATE gifs SET title = ?, caption = ?, tags = ?, updated_at = datetime('now')
         WHERE file_unique_id = ?`
      )
      .bind(title, caption, tags, fileUniqueId),
  ]);
}
