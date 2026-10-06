-- Main GIFs Table
CREATE TABLE IF NOT EXISTS gifs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    file_id TEXT NOT NULL,
    file_unique_id TEXT NOT NULL UNIQUE,
    title TEXT NOT NULL,
    caption TEXT,
    tags TEXT,
    views INTEGER DEFAULT 0,
    votes_up INTEGER DEFAULT 0,
    votes_down INTEGER DEFAULT 0,
    status TEXT DEFAULT 'active' CHECK(status IN ('active', 'pending_review', 'rejected')),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Full-Text Search Virtual Table (FTS5)
CREATE VIRTUAL TABLE IF NOT EXISTS gifs_fts USING fts5(
    title,
    tags,
    caption,
    content='gifs',
    content_rowid='id'
);

-- Triggers for FTS5 Synchronization
CREATE TRIGGER IF NOT EXISTS gifs_ai AFTER INSERT ON gifs BEGIN
  INSERT INTO gifs_fts(rowid, title, tags, caption)
  VALUES (new.id, new.title, new.tags, new.caption);
END;

CREATE TRIGGER IF NOT EXISTS gifs_ad AFTER DELETE ON gifs BEGIN
  INSERT INTO gifs_fts(gifs_fts, rowid, title, tags, caption)
  VALUES('delete', old.id, old.title, old.tags, old.caption);
END;

CREATE TRIGGER IF NOT EXISTS gifs_au AFTER UPDATE ON gifs BEGIN
  INSERT INTO gifs_fts(gifs_fts, rowid, title, tags, caption)
  VALUES('delete', old.id, old.title, old.tags, old.caption);
  INSERT INTO gifs_fts(rowid, title, tags, caption)
  VALUES (new.id, new.title, new.tags, new.caption);
END;
