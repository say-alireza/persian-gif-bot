import { Bot } from 'grammy';
import { Env } from './types/env';
import { handleStartCommand } from './handlers/commands';
import { handleChannelPost, handleEditedChannelPost } from './handlers/channel';
import { handleInlineQuery } from './handlers/inline';
import {
  handleAnimationMessage,
  handleCancel,
  handleSessionText,
  handleSubmissionCallback,
  handleUnsupportedMedia,
} from './handlers/submission';
import { handleAdminEditReply, handleReviewCallback } from './handlers/review';
import {
  handleAdminCallback,
  handleAdminMenuText,
  handleBan,
  handlePending,
  handleUnban,
  handleWho,
} from './handlers/admin';

/**
 * Creates and configures the grammY bot instance for Cloudflare Workers.
 * Registration order matters: handlers that do not act must call next().
 */
export function createBot(token: string, env: Env): Bot {
  const bot = new Bot(token);

  bot.catch((err) => {
    console.error(`Error while handling update ${err.ctx.update.update_id}:`, err.error);
  });

  // 1. Commands (consumed here; they never reach the text handlers)
  bot.command(['start', 'help'], (ctx) => handleStartCommand(ctx, env));
  bot.command('cancel', (ctx) => handleCancel(ctx, env));
  bot.command('who', (ctx) => handleWho(ctx, env));
  bot.command('ban', (ctx) => handleBan(ctx, env));
  bot.command('unban', (ctx) => handleUnban(ctx, env));
  bot.command('pending', (ctx) => handlePending(ctx, env));

  // 2. Callbacks
  bot.callbackQuery(/^sub:(ok|no)$/, (ctx) => handleSubmissionCallback(ctx, env));
  bot.callbackQuery(/^rv:/, (ctx) => handleReviewCallback(ctx, env));
  bot.callbackQuery(/^adm:/, (ctx) => handleAdminCallback(ctx, env));

  // 3. Private-chat media. The animation handler never calls next(), so animations
  //    (which Telegram also exposes as `document`) never reach the unsupported-media handler.
  const priv = bot.chatType('private');
  priv.on('message:animation', (ctx) => handleAnimationMessage(ctx, env));
  priv.on(
    [
      'message:video',
      'message:photo',
      'message:sticker',
      'message:document',
      'message:audio',
      'message:voice',
      'message:video_note',
    ],
    (ctx) => handleUnsupportedMedia(ctx)
  );

  // 4. Text: admin edit replies (any chat), then admin menu texts, then private submission sessions
  bot.on('message:text', (ctx, next) => handleAdminEditReply(ctx, env, next));
  priv.on('message:text', (ctx, next) => handleAdminMenuText(ctx, env, next));
  priv.on('message:text', (ctx, next) => handleSessionText(ctx, env, next));

  // 5. Existing handlers
  bot.on('channel_post', (ctx) => handleChannelPost(ctx, env));
  bot.on('edited_channel_post', (ctx) => handleEditedChannelPost(ctx, env));
  bot.on('inline_query', (ctx) => handleInlineQuery(ctx, env));

  return bot;
}
