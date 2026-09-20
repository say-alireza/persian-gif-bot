# Quickstart & Validation Guide: Persian GIF Bot

## 1. Prerequisites
- Node.js (v18+) or npm / npx.
- Cloudflare Wrangler CLI (`npm i -D wrangler`).
- Telegram Bot Token from `@BotFather`.
- Storage Channel ID (private Telegram channel where the bot is added as administrator).

## 2. Environment Setup

```bash
# 1. Initialize Wrangler configuration & D1 database
npx wrangler d1 create persian-gif-db

# 2. Apply initial database migrations locally
npx wrangler d1 execute persian-gif-db --local --file=./schema.sql

# 3. Apply database migrations to Cloudflare production
npx wrangler d1 execute persian-gif-db --remote --file=./schema.sql
```

## 3. Local Development & Testing

```bash
# Run local dev server simulating Workers edge environment & local D1
npx wrangler dev
```

## 4. Setting Up Webhook

```bash
# Register webhook with Telegram API including secret token and channel post events
curl -F "url=https://<your-worker-subdomain>.workers.dev/webhook" \
     -F "secret_token=<YOUR_SECRET_TOKEN>" \
     -F "allowed_updates=[\"message\",\"inline_query\",\"channel_post\",\"edited_channel_post\"]" \
     https://api.telegram.org/bot<YOUR_BOT_TOKEN>/setWebhook
```

## 5. End-to-End Validation Checklist

1. **Inline Search Validation:**
   - In Telegram, type `@<bot_username> خنده`.
   - Verify that results load instantly without delay.
   - Select a GIF and verify it sends as an animated meme.
2. **Channel Ingestion Validation:**
   - In the storage channel, post a GIF with caption: `گربه خنده دار #cat #خنده`.
   - Check local/remote D1 database with: `npx wrangler d1 execute persian-gif-db --command "SELECT * FROM gifs;"`
   - Verify `file_id`, `tags`, and `title` were stored and indexed.
3. **Security Validation:**
   - Send a POST request to `/webhook` without `X-Telegram-Bot-Api-Secret-Token`.
   - Verify response is `403 Forbidden`.
