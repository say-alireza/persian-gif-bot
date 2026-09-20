# Research & Technical Decisions: Persian GIF Bot

## 1. Runtime & Framework
- **Decision:** Cloudflare Workers + TypeScript + `grammy` (`cloudflare-mod` webhook adapter).
- **Rationale:**
  - grammY is purpose-built for modern TypeScript and edge runtimes.
  - Workers provides near-zero cold start (< 5ms) and 100k daily requests on the free tier.
  - Pyodide / Python on Workers suffers from 300-1000ms cold start and high CPU time consumption.
- **Alternatives Considered:** Python with aiogram on VPS/Docker (requires persistent server maintenance and monthly costs).

## 2. Media Storage & Delivery
- **Decision:** Telegram Storage Channel as CDN using `file_id` and `file_unique_id`.
- **Rationale:**
  - Telegram hosts animations up to 50MB for free with global CDN delivery.
  - Inline queries can directly return `InlineQueryResultCachedMpeg4Gif` using `file_id`, bypassing any Worker bandwidth usage.
- **Alternatives Considered:** Cloudflare R2 / AWS S3 (introduces egress costs and storage limits).

## 3. Search Engine & Database
- **Decision:** Cloudflare D1 (SQLite Edge) with FTS5 (Full-Text Search).
- **Rationale:**
  - D1 runs within the same edge location as the Worker (1-5ms query latency).
  - Built-in FTS5 allows tokenized search across Persian titles and tags without external search services (e.g. Algolia/Meilisearch).
  - SQLite triggers keep the FTS5 virtual table synchronized automatically on INSERT, UPDATE, and DELETE.
- **Alternatives Considered:** Supabase PostgreSQL (higher network latency between Worker and database, connection limits).

## 4. Query Sanitization & Persian Tokenization
- **Decision:** Custom sanitizer for FTS5 queries with Persian character normalization (e.g. converting Arabic ی and ک to Persian standard, handling half-space / ZWNJ).
- **Rationale:**
  - Prevents SQLite FTS5 syntax errors caused by unmatched quotes or special boolean operators (`AND`, `OR`, `NOT`, `*`).
  - Ensures accurate matching regardless of keyboard layout differences.
