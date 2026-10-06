export interface BotAdminRow {
  user_id: number;
  username: string | null;
  added_by: number;
  created_at: string;
}

export interface AdminSessionRow {
  user_id: number;
  action: string;
  payload: string | null;
  created_at: string;
}

export async function getBotAdmins(db: D1Database): Promise<BotAdminRow[]> {
  const { results } = await db
    .prepare('SELECT user_id, username, added_by, created_at FROM bot_admins ORDER BY created_at ASC')
    .all<BotAdminRow>();
  return results || [];
}

export async function addBotAdmin(
  db: D1Database,
  userId: number,
  username: string | null,
  addedBy: number
): Promise<void> {
  await db
    .prepare(
      `INSERT INTO bot_admins (user_id, username, added_by, created_at)
       VALUES (?, ?, ?, datetime('now'))
       ON CONFLICT(user_id) DO UPDATE SET
         username = excluded.username,
         added_by = excluded.added_by`
    )
    .bind(userId, username, addedBy)
    .run();
}

export async function removeBotAdmin(db: D1Database, userId: number): Promise<boolean> {
  const result = await db.prepare('DELETE FROM bot_admins WHERE user_id = ?').bind(userId).run();
  return (result.meta?.changes ?? 0) > 0;
}

export async function isBotAdminInDb(db: D1Database, userId: number): Promise<boolean> {
  const row = await db
    .prepare('SELECT 1 FROM bot_admins WHERE user_id = ? LIMIT 1')
    .bind(userId)
    .first();
  return Boolean(row);
}

export async function setAdminSession(
  db: D1Database,
  userId: number,
  action: string,
  payload: string | null = null
): Promise<void> {
  await db
    .prepare(
      `INSERT INTO admin_sessions (user_id, action, payload, created_at)
       VALUES (?, ?, ?, datetime('now'))
       ON CONFLICT(user_id) DO UPDATE SET
         action = excluded.action,
         payload = excluded.payload,
         created_at = excluded.created_at`
    )
    .bind(userId, action, payload)
    .run();
}

export async function getAdminSession(
  db: D1Database,
  userId: number
): Promise<AdminSessionRow | null> {
  return await db
    .prepare('SELECT user_id, action, payload, created_at FROM admin_sessions WHERE user_id = ?')
    .bind(userId)
    .first<AdminSessionRow>();
}

export async function clearAdminSession(db: D1Database, userId: number): Promise<void> {
  await db.prepare('DELETE FROM admin_sessions WHERE user_id = ?').bind(userId).run();
}
