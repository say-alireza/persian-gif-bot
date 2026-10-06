export type SessionKind = 'submit' | 'admin_edit';
export type SessionState = 'awaiting_tags' | 'awaiting_confirm' | 'awaiting_edit';

export interface Session {
  user_id: number;
  kind: SessionKind;
  state: SessionState;
  pending_file_id?: string | null;
  pending_file_unique_id?: string | null;
  draft_title?: string | null;
  draft_tags?: string | null;
  draft_caption?: string | null;
  target_gif_id?: number | null;
  prompt_chat_id?: number | null;
  prompt_message_id?: number | null;
  review_message_id?: number | null;
}

/** Returns an unexpired session, or null (and removes the expired row if any). */
export async function getSession(
  db: D1Database,
  userId: number,
  kind: SessionKind
): Promise<Session | null> {
  const row = await db
    .prepare(
      `SELECT * FROM user_sessions
       WHERE user_id = ? AND kind = ? AND expires_at > datetime('now')`
    )
    .bind(userId, kind)
    .first<Session>();
  if (row) return row;

  await db
    .prepare(`DELETE FROM user_sessions WHERE user_id = ? AND kind = ? AND expires_at <= datetime('now')`)
    .bind(userId, kind)
    .run();
  return null;
}

/** Creates or replaces the session and (re)starts its 15-minute lifetime. */
export async function putSession(db: D1Database, s: Session): Promise<void> {
  await db.batch([
    db
      .prepare(`DELETE FROM user_sessions WHERE user_id = ? AND expires_at <= datetime('now')`)
      .bind(s.user_id),
    db
      .prepare(
        `INSERT INTO user_sessions
           (user_id, kind, state, pending_file_id, pending_file_unique_id, draft_title, draft_tags,
            draft_caption, target_gif_id, prompt_chat_id, prompt_message_id, review_message_id,
            expires_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now', '+15 minutes'), datetime('now'))
         ON CONFLICT(user_id, kind) DO UPDATE SET
           state = excluded.state,
           pending_file_id = excluded.pending_file_id,
           pending_file_unique_id = excluded.pending_file_unique_id,
           draft_title = excluded.draft_title,
           draft_tags = excluded.draft_tags,
           draft_caption = excluded.draft_caption,
           target_gif_id = excluded.target_gif_id,
           prompt_chat_id = excluded.prompt_chat_id,
           prompt_message_id = excluded.prompt_message_id,
           review_message_id = excluded.review_message_id,
           expires_at = excluded.expires_at,
           updated_at = excluded.updated_at`
      )
      .bind(
        s.user_id,
        s.kind,
        s.state,
        s.pending_file_id ?? null,
        s.pending_file_unique_id ?? null,
        s.draft_title ?? null,
        s.draft_tags ?? null,
        s.draft_caption ?? null,
        s.target_gif_id ?? null,
        s.prompt_chat_id ?? null,
        s.prompt_message_id ?? null,
        s.review_message_id ?? null
      ),
  ]);
}

export async function clearSession(db: D1Database, userId: number, kind: SessionKind): Promise<void> {
  await db.prepare(`DELETE FROM user_sessions WHERE user_id = ? AND kind = ?`).bind(userId, kind).run();
}
