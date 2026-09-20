import { Context } from 'grammy';
import { InlineQueryResultCachedMpeg4Gif } from 'grammy/types';
import { Env } from '../types/env';
import { searchGifs } from '../db/queries';

/**
 * Handles inline search queries, formatting results as cached MPEG4 animations.
 */
export async function handleInlineQuery(ctx: Context, env: Env): Promise<void> {
  const query = ctx.inlineQuery?.query || '';
  const gifs = await searchGifs(env.DB, query, 50);

  const results: InlineQueryResultCachedMpeg4Gif[] = gifs.map((gif) => ({
    type: 'mpeg4_gif',
    id: `gif_${gif.id}`,
    mpeg4_file_id: gif.file_id,
    title: gif.title || 'گیف فارسی',
  }));

  await ctx.answerInlineQuery(results, {
    cache_time: 300, // 5 minutes cache on client & Telegram servers
    is_personal: false,
  });
}
