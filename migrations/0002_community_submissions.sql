-- gifs: attribution and review fields
ALTER TABLE gifs ADD COLUMN source TEXT NOT NULL DEFAULT 'channel'
  CHECK(source IN ('channel', 'user'));
ALTER TABLE gifs ADD COLUMN submitted_by INTEGER;
ALTER TABLE gifs ADD COLUMN submitted_by_username TEXT;
ALTER TABLE gifs ADD COLUMN submitted_at DATETIME;
ALTER TABLE gifs ADD COLUMN reviewed_by INTEGER;
ALTER TABLE gifs ADD COLUMN reviewed_by_username TEXT;
ALTER TABLE gifs ADD COLUMN reviewed_at DATETIME;
ALTER TABLE gifs ADD COLUMN reject_reason TEXT;

CREATE INDEX IF NOT EXISTS idx_gifs_status ON gifs(status);
CREATE INDEX IF NOT EXISTS idx_gifs_submitted_by ON gifs(submitted_by, submitted_at);

-- Conversation state, one row per (user, kind).
CREATE TABLE IF NOT EXISTS user_sessions (
    user_id INTEGER NOT NULL,
    kind TEXT NOT NULL CHECK(kind IN ('submit', 'admin_edit')),
    state TEXT NOT NULL,
    pending_file_id TEXT,
    pending_file_unique_id TEXT,
    draft_title TEXT,
    draft_tags TEXT,
    draft_caption TEXT,
    target_gif_id INTEGER,
    prompt_chat_id INTEGER,
    prompt_message_id INTEGER,
    review_message_id INTEGER,
    expires_at DATETIME NOT NULL,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (user_id, kind),
    CHECK (
      (kind = 'submit' AND state IN ('awaiting_tags', 'awaiting_confirm'))
      OR (kind = 'admin_edit' AND state = 'awaiting_edit')
    )
);

CREATE TABLE IF NOT EXISTS gif_audit_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    gif_id INTEGER NOT NULL,
    action TEXT NOT NULL
      CHECK(action IN ('submitted', 'approved', 'rejected', 'tags_edited')),
    actor_id INTEGER,
    actor_username TEXT,
    details TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (gif_id) REFERENCES gifs(id)
);
CREATE INDEX IF NOT EXISTS idx_audit_gif ON gif_audit_log(gif_id, created_at);

CREATE TABLE IF NOT EXISTS banned_users (
    user_id INTEGER PRIMARY KEY,
    banned_by INTEGER NOT NULL,
    reason TEXT,
    banned_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
