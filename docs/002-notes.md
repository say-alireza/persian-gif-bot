# Feature 002: community submissions. Apply and ship notes

## 1. Copy files into the repo
Copy this tree over the repo root. Replaced files: `package.json`, `schema.sql`, `src/bot.ts`,
`src/types/env.ts`, `src/types/gif.ts`, `src/db/sanitize.ts`, `src/handlers/commands.ts`,
`src/handlers/channel.ts`. New: `migrations/`, `src/lib/`, `src/db/sessions.ts`, `src/db/submissions.ts`,
`src/messages.ts`, `src/handlers/{submission,review,admin}.ts`, `scripts/set-commands.ts`, `vitest.config.ts`.
`src/db/queries.ts` is unchanged (search paths untouched). `upsertGif` / `updateGifCaption` there are now unused
by the channel handler; delete them if you like.

Then: `npm install && npm run typecheck && npm test`.

## 2. wrangler.toml
```toml
[vars]
STORAGE_CHANNEL_ID = "..."          # unchanged
DAILY_SUBMISSION_CAP = "5"
MAX_MEDIA_SIZE_BYTES = "10485760"
MAX_MEDIA_DURATION_SEC = "30"
```
Secrets (and `.dev.vars` locally):
```
npx wrangler secret put ADMIN_IDS        # e.g. 111111,222222
npx wrangler secret put REVIEW_CHAT_ID   # optional; private admin group id, e.g. -100123...
```
The bot must be a member of the review group and able to post there.

## 3. Database (human steps)
```
npx wrangler d1 export persian-gif-db --remote --output backup.sql   # backup first
npm run db:local                                                      # test locally
npm run db:remote                                                     # production
```
0002 uses `ALTER TABLE ADD COLUMN`, which is not idempotent: if it fails midway, restore from the backup
instead of re-running.

## 4. Deploy, webhook, commands
```
npm run deploy
curl -X POST "https://api.telegram.org/bot<TOKEN>/setWebhook" \
  -d url=https://<worker>/webhook -d secret_token=<SECRET_TOKEN> \
  -d 'allowed_updates=["message","inline_query","channel_post","edited_channel_post","callback_query"]'
BOT_TOKEN=... ADMIN_IDS=111,222 npm run set-commands
```
Update `allowed_updates` in `specs/001-persian-gif-bot/quickstart.md` and twice in `README.md` the same way.
Admins must have started the bot for their scoped command list to appear.

## 5. Constitution amendment (bump version, add rationale)
- Section 3, Ingestion Protection: media ingestion MUST come from either (a) configured admin storage
  channels verified by `chat.id`, or (b) private-chat user submissions, stored as `pending_review`, NOT
  searchable until approved by a user in `ADMIN_IDS`.
- Section 1, Storage: also allow the original Telegram `file_id` of approved user submissions.
- New principle "Attribution and Auditability": every user-submitted GIF records its submitter and reviewing
  admin, and every status change writes an audit entry in the same batch.

## 6. Deviations from the guide (on purpose)
- `meta.changes` is not used anywhere. Success is detected with `RETURNING` (FTS triggers also write rows,
  and D1 may count them). Audit rows are inserted before the guarded update, in the same `db.batch`,
  with the same WHERE, so no `changes()` is needed either.
- The edit-tags prompt uses a non-selective `force_reply` (selective does nothing without a mention/reply
  target). The reply is still validated: admin + session + prompt message id + chat id.
- Text starting with `/` is never treated as a title in `handleSessionText`.
- `handleAnimationMessage` must never call `next()`: Telegram also sets `document` on animations.

## 7. Not included
DB-level tests (visibility, review race, insert race, channel override). They need a D1 test pool
(`@cloudflare/vitest-pool-workers`, which may require a newer wrangler than 3.x). Pure parser tests are in
`src/db/sanitize.test.ts`. README/quickstart/spec-folder edits are left for you.
