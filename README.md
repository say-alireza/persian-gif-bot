# Persian GIF Telegram Bot

[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-blue.svg)](https://www.typescriptlang.org/)
[![Cloudflare Workers](https://img.shields.io/badge/Cloudflare-Workers-orange.svg)](https://workers.cloudflare.com/)
[![Cloudflare D1](https://img.shields.io/badge/Cloudflare-D1%20SQLite-yellow.svg)](https://developers.cloudflare.com/d1/)
[![grammY](https://img.shields.io/badge/grammY-Telegram%20Framework-brightgreen.svg)](https://grammy.dev/)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](https://opensource.org/licenses/MIT)

[🇮🇷 برای خواندن راهنمای فارسی اینجا کلیک کنید](#راهنمای-فارسی-persian-guide) | [English Documentation](#english-documentation)

---

## English Documentation

A blazingly fast, zero-cost, serverless Telegram Inline Bot designed for searching and sharing Persian animated GIFs and meme reactions directly in any Telegram chat.

### Key Architecture & Features

- **Zero-Cost Storage & CDN:** Leverages a private Telegram Channel as media storage. The bot captures and serves Telegram `file_id` (MPEG4 animations) with zero external S3/R2 egress or hosting fees.
- **Edge Full-Text Search:** Built on **Cloudflare D1** (Serverless SQLite) with **FTS5** full-text search indexing, custom Persian character normalization, and safe query tokenization.
- **Sub-200ms Latency:** Native execution on Cloudflare Workers edge network using the **grammY** framework.
- **Cost-Optimized Telegram Caching:** Uses `cache_time >= 300s` on inline query responses to prevent redundant requests from hitting serverless execution limits.
- **Webhook Security:** Strictly validates `X-Telegram-Bot-Api-Secret-Token` on every incoming webhook update.
- **Future-Proof Schema:** The database model includes fields for community upvotes, downvotes, view counts, and approval statuses for future crowdsourced moderation.

---

### Project Structure

```text
persian-gif-bot/
├── .specify/                 # Spec-Kit specifications & governance constitution
├── specs/                    # User stories, plans, contracts, and task breakdown
├── schema.sql                # D1 table schema, FTS5 virtual table, and sync triggers
├── wrangler.toml             # Cloudflare Workers configuration & D1 binding
├── package.json & tsconfig.json
└── src/
    ├── index.ts              # Worker fetch entrypoint & secret token validation
    ├── bot.ts                # grammY bot configuration & handler registration
    ├── handlers/
    │   ├── inline.ts         # Inline query search with cached MPEG4 results
    │   ├── channel.ts        # Channel ingestion & automatic tag indexing
    │   └── commands.ts       # /start and /help commands with interactive UI
    ├── db/
    │   ├── queries.ts        # Parameterized D1 queries (FTS5 search & upsert)
    │   └── sanitize.ts       # Persian alphabet normalizer & safe FTS5 query builder
    └── types/
        ├── env.ts            # Cloudflare Worker environment bindings
        └── gif.ts            # GIF entity and search result interfaces
```

---

### Quick Deployment Guide

#### 1. Install Dependencies
```bash
npm install
```

#### 2. Create Cloudflare D1 Database
```bash
npx wrangler d1 create persian-gif-db
```
Copy the printed `database_id` into your `wrangler.toml` file under `[[d1_databases]]`.

#### 3. Apply Database Schema
```bash
# Local testing database
npm run db:local

# Production Cloudflare D1 database
npm run db:remote
```

#### 4. Configure Cloudflare Secrets
```bash
npx wrangler secret put BOT_TOKEN
# Paste your Telegram Bot Token from @BotFather

npx wrangler secret put SECRET_TOKEN
# Enter a secure random secret string for webhook validation
```

#### 5. Deploy to Cloudflare Workers
```bash
npm run deploy
```

#### 6. Register Telegram Webhook
```bash
curl -F "url=https://<your-worker-subdomain>.workers.dev/webhook" \
     -F "secret_token=<YOUR_SECRET_TOKEN>" \
     -F "allowed_updates=[\"message\",\"inline_query\",\"channel_post\",\"edited_channel_post\"]" \
     https://api.telegram.org/bot<YOUR_BOT_TOKEN>/setWebhook
```

#### 7. Enable Inline Mode in @BotFather
1. Open `@BotFather` on Telegram.
2. Send `/setinline` and select your bot.
3. Enter placeholder text (e.g. `جستجوی گیف فارسی...`).

---

<br>

---

## راهنمای فارسی (Persian Guide)

یک ربات بسیار سریع، رایگان و سرورلس برای جستجو و ارسال لحظهای گیف و میمهای متحرک فارسی در چتها و گروههای تلگرام.

### ویژگیهای کلیدی و معماری

- **هزینه سرور و استوریج کاملاً صفر:** استفاده از کانال خصوصی تلگرام به عنوان استوریج نامحدود. ربات شناسه فایلهای انیمیشن (`file_id`) را در دیتابیس ذخیره کرده و به صورت مستقیم به کاربران نشان میدهد بدون نیاز به هاست دانلود یا S3/R2.
- **موتور جستجوی تماممتنی (FTS5):** جستجوی سریع روی کلمات کلیدی، عنوان و هشتگها در دیتابیس **Cloudflare D1** به همراه نرمالایزر اختصاصی حروف فارسی و نیمفاصله.
- **پاسخدهی آنی (زیر ۲۰۰ میلیثانیه):** به دلیل اجرای بومی روی سرورهای لبه کلودفلر با فریمورک مدرن **grammY**.
- **کنترل مصرف با کش تلگرام:** استفاده از `cache_time` (حداقل ۵ دقیقه) برای پاسخهای اینلاین تا سرچهای تکراری به ورکر ارسال نشوند و سقف پلن رایگان پر نشود.
- **امنیت کامل وبهوک:** اعتبارسنجی خودکار هدر `X-Telegram-Bot-Api-Secret-Token` برای جلوگیری از ارسال ریکوئستهای فیک.
- **آمادگی برای مقیاس و رایگیری جامعه:** دیتابیس دارای فیلدهای `votes_up`، `votes_down`، `views` و `status` است تا در آینده بدون نیاز به مایگریشن مجدد، قابلیت امتیازدهی و فیلتر خودکار میمها فعال شود.

---

### مراحل راهاندازی و آنلاین کردن ربات

#### مرحله اول: تنظیم ربات در BotFather
1. به ربات `@BotFather` در تلگرام بروید.
2. دستور `/newbot` را بزنید و نام و یوزرنیم ربات را تعیین کنید و توکن را ذخیره کنید.
3. دستور `/setinline` را بفرستید، ربات خود را انتخاب کنید و یک متن پیشفرض برای کادر سرچ بنویسید (مثلاً: `جستجوی گیف...`).

#### مرحله دوم: ساخت کانال استوریج
1. یک کانال تلگرام خصوصی (Private Channel) بسازید.
2. ربات را در کانال اد کرده و به آن دسترسی **Administrator** (ارسال و ویرایش پیام) بدهید.
3. آیدی عددی کانال (مثلاً `-1001234567890`) را در فایل `wrangler.toml` جلوی `STORAGE_CHANNEL_ID` بنویسید.

#### مرحله سوم: ساخت دیتابیس در کلودفلر
در ترمینال پروژه دستور زیر را اجرا کنید:
```bash
npx wrangler d1 create persian-gif-db
```
شناسه `database_id` نمایش داده شده را در فایل `wrangler.toml` کپی کنید.

سپس اسکیما و جداول را روی دیتابیس سرور اعمال کنید:
```bash
npm run db:remote
```

#### مرحله چهارم: ست کردن سکرتها و دیپلوی
```bash
# ذخیره امن توکن ربات
npx wrangler secret put BOT_TOKEN

# ذخیره توکن امنیتی وبهوک
npx wrangler secret put SECRET_TOKEN

# انتشار پروژه روی کلودفلر
npm run deploy
```

#### مرحله پنجم: تنظیم وبهوک تلگرام
آدرس ورکر کلودفلر خود را با دستور زیر به تلگرام معرفی کنید:
```bash
curl -F "url=https://<your-worker-subdomain>.workers.dev/webhook" \
     -F "secret_token=<YOUR_SECRET_TOKEN>" \
     -F "allowed_updates=[\"message\",\"inline_query\",\"channel_post\",\"edited_channel_post\"]" \
     https://api.telegram.org/bot<YOUR_BOT_TOKEN>/setWebhook
```

#### مرحله ششم: اضافه کردن گیف و استفاده
1. در کانال استوریج خود، یک گیف/انیمیشن را با کپشن و هشتگ ارسال کنید (مثلاً: `گربه خنده دار #طنز #خنده`).
2. ربات به محض ارسال، متادیتا و `file_id` را در D1 ایندکس میکند.
3. در هر چتی بنویسید: `@your_bot_username خنده` و گیفهای مرتبط را مشاهده و ارسال کنید!

---

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
