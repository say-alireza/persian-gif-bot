import { Context } from 'grammy';
import { Env } from '../types/env';
import { isAdmin } from '../lib/config';
import { M } from '../messages';
import {
  banUser,
  getAuditLog,
  getGifById,
  getGifByUniqueId,
  getPendingUserGifs,
  unbanUser,
} from '../db/submissions';
import { sendReviewMessage } from './review';

function args(ctx: Context): string {
  return String(ctx.match ?? '').trim();
}

// Non-admins get no response at all (handlers just return).

export async function handleWho(ctx: Context, env: Env): Promise<void> {
  if (!ctx.from || !isAdmin(env, ctx.from.id)) return;

  const replied = ctx.msg?.reply_to_message;
  const media = replied?.animation ?? replied?.video;
  let gif = null;

  if (media) {
    gif = await getGifByUniqueId(env.DB, media.file_unique_id);
  } else {
    const arg = args(ctx);
    if (!/^\d{1,12}$/.test(arg)) {
      await ctx.reply(M.whoUsage);
      return;
    }
    gif = await getGifById(env.DB, Number(arg));
  }

  if (!gif) {
    await ctx.reply(M.notFound);
    return;
  }
  const audit = await getAuditLog(env.DB, gif.id, 5);
  await ctx.reply(M.whoOutput(gif, audit));
}

export async function handleBan(ctx: Context, env: Env): Promise<void> {
  if (!ctx.from || !isAdmin(env, ctx.from.id)) return;
  const [idStr, ...rest] = args(ctx).split(/\s+/);
  if (!/^\d{1,15}$/.test(idStr ?? '')) {
    await ctx.reply(M.banUsage);
    return;
  }
  await banUser(env.DB, Number(idStr), ctx.from.id, rest.join(' ').trim() || null);
  await ctx.reply(M.banDone);
}

export async function handleUnban(ctx: Context, env: Env): Promise<void> {
  if (!ctx.from || !isAdmin(env, ctx.from.id)) return;
  const idStr = args(ctx).split(/\s+/)[0];
  if (!/^\d{1,15}$/.test(idStr ?? '')) {
    await ctx.reply(M.unbanUsage);
    return;
  }
  await unbanUser(env.DB, Number(idStr));
  await ctx.reply(M.unbanDone);
}

/** Re-sends review messages for up to 5 oldest pending user submissions. */
export async function handlePending(ctx: Context, env: Env): Promise<void> {
  if (!ctx.from || !isAdmin(env, ctx.from.id)) return;
  const pending = await getPendingUserGifs(env.DB, 5);
  if (pending.length === 0) {
    await ctx.reply(M.pendingNone);
    return;
  }
  let sent = 0;
  for (const gif of pending) {
    sent += (await sendReviewMessage(ctx.api, env, gif)) > 0 ? 1 : 0;
  }
  await ctx.reply(M.pendingSent(sent));
}
