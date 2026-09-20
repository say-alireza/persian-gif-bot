# Contracts: Telegram Webhook & Inline Query Interface

## 1. Webhook Endpoint Contract

- **Method:** `POST`
- **Path:** `/webhook`
- **Headers:**
  - `X-Telegram-Bot-Api-Secret-Token`: String matching `SECRET_TOKEN` environment variable.
- **Payload:** Telegram `Update` object (JSON).
- **Responses:**
  - `200 OK`: Successful update processing.
  - `403 Forbidden`: Secret token missing or invalid.
  - `405 Method Not Allowed`: Any HTTP method other than `POST`.

## 2. Inline Query Contract

- **Trigger:** Update containing `inline_query` object.
- **Input:** `update.inline_query.query` (String, trimmed and normalized).
- **Output:** `answerInlineQuery` method call:
  - `inline_query_id`: Matching the incoming request.
  - `results`: Array of `InlineQueryResultCachedMpeg4Gif`:
    ```json
    {
      "type": "mpeg4_gif",
      "id": "gif_<id>",
      "mpeg4_file_id": "<file_id>",
      "title": "<Persian Title>"
    }
    ```
  - `cache_time`: `300` (5 minutes minimum).
  - `is_personal`: `false`.

## 3. Channel Post Ingestion Contract

- **Trigger:** Update containing `channel_post` or `edited_channel_post`.
- **Validation:**
  - `update.channel_post.chat.id` equals configured `STORAGE_CHANNEL_ID`.
  - Media type is `animation` or `video`.
- **Action:**
  - Parse caption into Title and Tags.
  - Upsert into `gifs` table matching `file_unique_id`.
