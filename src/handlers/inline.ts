import { Context } from 'grammy';
import { InlineQueryResultCachedMpeg4Gif } from 'grammy/types';
import { Env } from '../types/env';
import { searchGifs } from '../db/queries';

const PAGE_SIZE = 50;

/**
 * Handles inline search queries, formatting results as cached MPEG4 animations
 * with infinite scroll pagination (next_offset) so users can browse all GIFs.
 */
export async function handleInlineQuery(ctx: Context, env: Env): Promise<void> {
  const query = ctx.inlineQuery?.query || '';
  const offsetStr = ctx.inlineQuery?.offset || '';
  const parsedOffset = Number.parseInt(offsetStr, 10);
  const offset = Number.isSafeInteger(parsedOffset) && parsedOffset >= 0 ? parsedOffset : 0;

  const gifs = await searchGifs(env.DB, query, PAGE_SIZE, offset);

  const results: InlineQueryResultCachedMpeg4Gif[] = gifs.map((gif) => ({
    type: 'mpeg4_gif',
    id: `gif_${gif.id}_${offset}`,
    mpeg4_file_id: gif.file_id,
    title: gif.title || 'گیف فارسی',
  }));

  // If a full page was returned, set next_offset for Telegram's auto-pagination on scroll
  const nextOffset = gifs.length === PAGE_SIZE ? String(offset + PAGE_SIZE) : '';

  await ctx.answerInlineQuery(results, {
    cache_time: 60,
    is_personal: false,
    next_offset: nextOffset,
  });
}
