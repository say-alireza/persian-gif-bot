import { Bot } from 'grammy';
import { Env } from './types/env';
import { handleStartCommand } from './handlers/commands';
import { handleChannelPost, handleEditedChannelPost } from './handlers/channel';
import { handleInlineQuery } from './handlers/inline';

/**
 * Creates and configures the grammY bot instance for Cloudflare Workers.
 */
export function createBot(token: string, env: Env): Bot {
  const bot = new Bot(token);

  // Global error handler
  bot.catch((err) => {
    console.error(`Error while handling update ${err.ctx.update.update_id}:`, err.error);
  });

  // Commands
  bot.command(['start', 'help'], handleStartCommand);

  // Storage channel ingestion
  bot.on('channel_post', (ctx) => handleChannelPost(ctx, env));
  bot.on('edited_channel_post', (ctx) => handleEditedChannelPost(ctx, env));

  // Inline GIF Search
  bot.on('inline_query', (ctx) => handleInlineQuery(ctx, env));

  return bot;
}
