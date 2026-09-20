# Implementation Plan: Persian GIF Telegram Bot

## 1. Technical Context
- **Runtime:** Cloudflare Workers (TypeScript)
- **Framework:** `grammy` with `cloudflare-mod` webhook adapter
- **Database:** Cloudflare D1 (Serverless SQLite) with FTS5 virtual table
- **Tooling:** Wrangler CLI, TypeScript 5+, esbuild (via Wrangler)

## 2. Architecture & File Structure

```text
persian-gif-bot/
├── .specify/
│   ├── feature.json
│   └── memory/
│       └── constitution.md
├── specs/
│   └── 001-persian-gif-bot/
│       ├── spec.md
│       ├── plan.md
│       ├── research.md
│       ├── data-model.md
│       ├── quickstart.md
│       ├── tasks.md
│       ├── checklists/
│       │   └── requirements.md
│       └── contracts/
│           └── webhook-api.md
├── schema.sql                # D1 database schema & FTS5 triggers
├── wrangler.toml             # Cloudflare Workers configuration
├── package.json              # Project dependencies
├── tsconfig.json             # TypeScript strict configuration
├── README.md                 # Project documentation
└── src/
    ├── index.ts              # Worker fetch entrypoint & webhook secret check
    ├── bot.ts                # grammY bot setup & handler registration
    ├── handlers/
    │   ├── inline.ts         # Inline query search & cached MPEG4 formatting
    │   ├── channel.ts        # Channel post ingestion & caption parsing
    │   └── commands.ts       # /start and /help command handlers
    ├── db/
    │   ├── queries.ts        # D1 query execution (search, upsert, update)
    │   └── sanitize.ts       # Persian text normalization & FTS5 sanitization
    └── types/
        ├── env.ts            # Cloudflare Worker environment interface
        └── gif.ts            # GIF entity and search result interfaces
```

## 3. Data Flow & Security Gates

1. **Webhook Ingress:**
   - Worker receives `POST /webhook`.
   - Validates header `X-Telegram-Bot-Api-Secret-Token == env.SECRET_TOKEN`. Rejects with 403 on mismatch.
   - Forwards valid requests to `webhookCallback(bot, 'cloudflare-mod')`.

2. **Inline Query Flow:**
   - User types `@bot query`.
   - Bot calls `sanitizeQuery(query)`.
   - Executes parameterized FTS5 query on D1: `SELECT * FROM gifs_fts WHERE gifs_fts MATCH ?`.
   - Formats results into `InlineQueryResultCachedMpeg4Gif[]`.
   - Returns response with `cache_time: 300`.

3. **Channel Ingestion Flow:**
   - Admin sends GIF with caption to storage channel.
   - Bot receives `channel_post`. Verifies `chat.id == env.STORAGE_CHANNEL_ID`.
   - Extracts `animation.file_id`, `animation.file_unique_id`.
   - Normalizes title and tags from caption.
   - Executes upsert prepared statement on D1.
