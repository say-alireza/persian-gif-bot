# Feature Specification: Persian GIF Telegram Bot

## 1. Overview & Objectives
Persian GIF Bot is a high-performance, Persian-focused Telegram bot enabling users to search, discover, and share animated GIF/MPEG4 memes directly in any Telegram chat via Inline Mode. It leverages a private Telegram storage channel as a zero-cost media CDN and Cloudflare D1 with FTS5 for sub-200ms full-text search.

## 2. User Stories

### User Story 1 (P1) - Instant Inline Search
- **As a** Telegram user chatting in any group or private chat,
- **I want to** type `@bot_name <keyword>` (e.g. `@persian_gif_bot خنده`),
- **So that** I receive an instant grid of relevant Persian animated GIFs matching the keyword and can send them with one tap.
- **Acceptance Criteria:**
  - Typing a Persian or English query returns up to 50 matching animated GIFs.
  - An empty query (`@bot_name `) returns the most recent or highest-ranked GIFs.
  - Queries return results with low latency (< 250ms).
  - Repeated identical queries are served from Telegram client cache (`cache_time >= 300s`).

### User Story 2 (P1) - Media Ingestion from Storage Channel
- **As a** bot administrator/curator,
- **I want to** post an animated GIF (video/animation) with a Persian caption containing keywords and hashtags (e.g. `خنده دار خوشحالی #طنز`) to the dedicated storage channel,
- **So that** the bot automatically indexes the `file_id`, `file_unique_id`, caption, and tags into the search catalog without manual database entry.
- **Acceptance Criteria:**
  - Bot listens to `channel_post` events from the designated channel ID.
  - Animations/videos are parsed: `file_id`, `file_unique_id`, tags, and clean caption are extracted.
  - Duplicate uploads (matched by `file_unique_id`) are ignored or updated.
  - Editing a channel post caption (`edited_channel_post`) updates the corresponding tags and title in the database.

### User Story 3 (P2) - Direct Chat & Help
- **As a** user opening the bot directly,
- **I want to** send `/start` or `/help`,
- **So that** I see a clear, elegant Persian guide on how to use inline search with an interactive "Try Search" button.
- **Acceptance Criteria:**
  - `/start` returns a polite, clean Persian message without emoji clutter.
  - Includes an inline button with `switch_inline_query_current_chat=""` to immediately test the bot.

### User Story 4 (P3 - Future-Proof Foundation) - Community Voting & Popularity Architecture
- **As a** future platform maintainer,
- **I want** the data schema to support upvotes, downvotes, view counts, and approval statuses (`active`, `pending_review`, `rejected`),
- **So that** when community submissions and voting are introduced, the storage and ranking system seamlessly supports filtering out low-quality items without database refactoring.

## 3. Functional Requirements
1. **Sanitized Full-Text Search:**
   - User search inputs must be normalized (removing special search syntax operators that could break queries) and matched against title, caption, and tags.
2. **Inline Result Formatting:**
   - Every result must be formatted as an `InlineQueryResultCachedMpeg4Gif` referencing the stored Telegram `file_id`.
   - Results must include descriptive Persian titles.
3. **Channel Security Check:**
   - Ingestion must verify that incoming `channel_post` messages originate strictly from the configured channel ID.
4. **Caching Strategy:**
   - Inline responses must include `cache_time >= 300` seconds to reduce redundant queries.

## 4. Success Criteria
- **Search Latency:** 95% of inline searches return results to Telegram in under 250 milliseconds.
- **Accuracy:** Ingested tags and keywords in Persian (with or without half-space) correctly match search queries.
- **Cost Efficiency:** Zero server hosting and storage cost within Cloudflare Free Tier limits for up to 50,000 active daily queries.
- **Zero Media Loss:** Media files remain permanently hosted on Telegram's servers and accessible via cached file IDs.

## 5. Key Entities
- **GIF Item:** `id`, `file_id`, `file_unique_id`, `title`, `caption`, `tags`, `views`, `votes_up`, `votes_down`, `status`, `created_at`, `updated_at`.
- **Search Index (FTS):** `title`, `tags`, `caption`.

## 6. Assumptions & Edge Cases
- **Assumptions:** Admin uploads media as native Telegram animations (MPEG4 GIFs) rather than generic uncompressed files.
- **Edge Cases:**
  - Non-animation posts in the channel (text, images, stickers) are silently ignored.
  - Empty or single-character search queries return default curated items.
  - Search queries containing special characters (`'`, `"`, `*`, `%`) are sanitized without throwing syntax errors.
