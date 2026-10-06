export interface Env {
  BOT_TOKEN: string;
  SECRET_TOKEN: string;
  STORAGE_CHANNEL_ID?: string;
  ADMIN_IDS: string; // "123,456"
  REVIEW_CHAT_ID?: string;
  DAILY_SUBMISSION_CAP?: string; // default "5"
  MAX_MEDIA_SIZE_BYTES?: string; // default "10485760"
  MAX_MEDIA_DURATION_SEC?: string; // default "30"
  DB: D1Database;
}
