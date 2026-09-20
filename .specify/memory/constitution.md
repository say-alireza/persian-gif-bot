# Project Constitution: Persian GIF Telegram Bot

## Core Principles

### 1. Zero-Cost Serverless Architecture
- **Runtime:** Exclusively Cloudflare Workers (TypeScript) and Cloudflare D1 (SQLite Edge).
- **Storage:** Telegram Storage Channel acts as the media CDN for MPEG4 animations (`file_id` and `file_unique_id`). No external S3/R2 storage costs.
- **CPU & Latency:** Execution must remain strictly under Cloudflare Worker Free limits (10ms CPU time). Heavy processing is delegated to D1 FTS5 indexing.

### 2. Edge Performance & Inline Optimization
- **Telegram Caching:** All `answerInlineQuery` responses MUST specify `cache_time` (minimum 300 seconds) to prevent redundant queries from exhausting Worker request limits.
- **Query Latency:** D1 queries MUST utilize prepared statements and FTS5 indexes to ensure response delivery under 200ms.

### 3. Security & Access Control
- **Webhook Integrity:** All incoming webhook requests MUST validate `X-Telegram-Bot-Api-Secret-Token`.
- **SQL Injection Prevention:** ALL database operations MUST use parameter binding (`.bind()`); string interpolation in SQL is strictly forbidden.
- **Ingestion Protection:** Media ingestion from channels MUST verify the source `chat.id` against configured admin storage channels.

### 4. UI/UX & Copy Standards
- **Persian Typography:** All user-facing text MUST adhere to standard Persian typography rules, including correct use of zero-width non-joiner (نیمفاصله / ZWNJ).
- **Clean Interface:** Prohibit emoji clutter and internal thought narration in bot responses.
- **Inline Usability:** Results presented in inline mode MUST use `InlineQueryResultCachedMpeg4Gif` with clear Persian titles and tag summaries.

### 5. Forward-Compatible Schema Design
- The database schema MUST include extensible fields (`votes_up`, `votes_down`, `views`, `status`) to support community voting, popularity ranking, and content moderation in future phases without breaking migrations.

## Governance
- Amendments require updating this constitution with version bump and rationale.
- All implementations must strictly conform to these rules.
