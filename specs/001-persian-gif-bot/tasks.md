# Tasks: Persian GIF Telegram Bot Implementation

## Phase 1: Setup & Project Initialization
- [x] Task 1.1: Create `package.json` with dependencies (`grammy`, `@cloudflare/workers-types`, `typescript`, `wrangler`).
- [x] Task 1.2: Create `tsconfig.json` with strict mode and Cloudflare Workers ESNext types.
- [x] Task 1.3: Create `wrangler.toml` configured with D1 database binding `DB` and compatibility dates.
- [x] Task 1.4: Create `.gitignore` ignoring `node_modules`, `.wrangler`, `.dev.vars`, and build outputs.

## Phase 2: Database Schema & Search Index
- [x] Task 2.1: Create `schema.sql` defining `gifs` table, `gifs_fts` virtual FTS5 table, and automatic synchronization triggers (`AFTER INSERT`, `AFTER UPDATE`, `AFTER DELETE`).

## Phase 3: Data Contracts & Text Sanitization
- [x] Task 3.1: Create `src/types/env.ts` defining `Env` bindings (`BOT_TOKEN`, `SECRET_TOKEN`, `STORAGE_CHANNEL_ID`, `DB: D1Database`).
- [x] Task 3.2: Create `src/types/gif.ts` defining GIF models and inline query payloads.
- [x] Task 3.3: Create `src/db/sanitize.ts` with Persian normalization (ک/ی standard, نیمفاصله) and FTS5 query sanitization (stripping unsafe operator symbols).

## Phase 4: Database Access Layer
- [x] Task 4.1: Create `src/db/queries.ts` with parameterized prepared statements:
  - `searchGifs(db, query, limit)`
  - `getRecentGifs(db, limit)`
  - `upsertGif(db, gifData)`
  - `updateGifCaption(db, fileUniqueId, title, caption, tags)`

## Phase 5: Bot Handlers
- [x] Task 5.1: Create `src/handlers/commands.ts` for `/start` and `/help` with clean Persian instructions and an inline search action button.
- [x] Task 5.2: Create `src/handlers/channel.ts` for `channel_post` and `edited_channel_post` media ingestion from the storage channel.
- [x] Task 5.3: Create `src/handlers/inline.ts` for `inline_query` returning `InlineQueryResultCachedMpeg4Gif` with `cache_time: 300`.

## Phase 6: Bot Assembly & Worker Entrypoint
- [x] Task 6.1: Create `src/bot.ts` to instantiate grammY bot, attach error boundary, and register handlers.
- [x] Task 6.2: Create `src/index.ts` to handle Worker fetch events, validate `X-Telegram-Bot-Api-Secret-Token`, and dispatch updates via `webhookCallback(bot, 'cloudflare-mod')`.

## Phase 7: Documentation, Verification & Git Sync
- [x] Task 7.1: Create `README.md` with complete architecture overview, setup commands, and deployment guide.
- [x] Task 7.2: Verify TypeScript compilation without errors.
- [x] Task 7.3: Initialize Git repository, commit all artifacts, create GitHub repository via `gh repo create`, and push.
