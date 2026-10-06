import { Context, InlineKeyboard, NextFunction } from 'grammy';
import { Env } from '../types/env';
import { GifStatus } from '../types/gif';
import { getConfig } from '../lib/config';
import { displayName } from '../lib/user';
import { answerOnce } from '../lib/callback';
import { M, parseErrorMessage } from '../messages';
import { parseSubmissionInput } from '../db/sanitize';
import { clearSession, getSession, putSession } from '../db/sessions';
import {
  countRecentSubmissions,
  getGifByUniqueId,
  insertPendingGif,
  isBanned,
} from '../db/submissions';
import { sendReviewMessage } from './review';

function duplicateMessage(status: GifStatus | undefined): string {
  switch (status) {
    case 'pending_review':
      return M.dupPending;
    case 'rejected':
      return M.dupRejected;
    default:
      return M.dupActive;
  }
}

/**
 * Private chat, animation received. Must NEVER call next(): Telegram also sets `document`
 * on animation messages, and the unsupported-media handler must not see them.
 */
export async function handleAnimationMessage(ctx: Context, env: Env): Promise<void> {
  const anim = ctx.msg?.animation;
  const user = ctx.from;
  if (!anim || !user) return;
  const cfg = getConfig(env);

  if (anim.file_size && anim.file_size > cfg.maxMediaSizeBytes) {
    await ctx.reply(M.errMediaTooLarge(Math.floor(cfg.maxMediaSizeBytes / (1024 * 1024))));
    return;
  }
  if (anim.duration && anim.duration > cfg.maxMediaDurationSec) {
    await ctx.reply(M.errMediaTooLong(cfg.maxMediaDurationSec));
    return;
  }
  if (await isBanned(env.DB, user.id)) {
    await ctx.reply(M.errBanned);
    return;
  }
  if (await getSession(env.DB, user.id, 'submit')) {
    await ctx.reply(M.finishCurrentFirst);
    return;
  }
  const existing = await getGifByUniqueId(env.DB, anim.file_unique_id);
  if (existing) {
    await ctx.reply(duplicateMessage(existing.status));
    return;
  }
  if ((await countRecentSubmissions(env.DB, user.id)) >= cfg.dailyCap) {
    await ctx.reply(M.errDailyCap(cfg.dailyCap));
    return;
  }

  await putSession(env.DB, {
    user_id: user.id,
    kind: 'submit',
    state: 'awaiting_tags',
    pending_file_id: anim.file_id,
    pending_file_unique_id: anim.file_unique_id,
  });
  await ctx.reply(M.askTitleTags);
}

export async function handleUnsupportedMedia(ctx: Context): Promise<void> {
  await ctx.reply(M.errUnsupportedMedia);
}

/** Private text: only acts when the user has an active submit session. */
export async function handleSessionText(ctx: Context, env: Env, next: NextFunction): Promise<void> {
  const user = ctx.from;
  const text = ctx.msg?.text;
  if (!user || !text || text.startsWith('/')) return next();

  const session = await getSession(env.DB, user.id, 'submit');
  if (!session) return next();

  if (session.state === 'awaiting_confirm') {
    await ctx.reply(M.useButtonsOrCancel);
    return;
  }

  const parsed = parseSubmissionInput(text);
  if (!parsed.ok) {
    await ctx.reply(parseErrorMessage(parsed.error));
    await putSession(env.DB, session); // refresh expiry, keep state
    return;
  }

  await putSession(env.DB, {
    ...session,
    state: 'awaiting_confirm',
    draft_title: parsed.title,
    draft_tags: parsed.tags.join(' '),
    draft_caption: parsed.caption,
  });
  await ctx.reply(M.previewText(parsed.title, parsed.tags), {
    reply_markup: new InlineKeyboard().text(M.btnConfirm, 'sub:ok').text(M.btnCancel, 'sub:no'),
  });
}

export async function handleCancel(ctx: Context, env: Env): Promise<void> {
  if (!ctx.from) return;
  await clearSession(env.DB, ctx.from.id, 'submit');
  await ctx.reply(M.cancelled);
}

async function removeKeyboard(ctx: Context): Promise<void> {
  try {
    await ctx.editMessageReplyMarkup({ reply_markup: { inline_keyboard: [] } });
  } catch {
    /* message may be gone or unchanged */
  }
}

/** sub:ok / sub:no. Sessions are keyed by the tapping user, so only the owner can act. */
export async function handleSubmissionCallback(ctx: Context, env: Env): Promise<void> {
  await answerOnce(ctx, async () => {
    const user = ctx.from;
    const data = ctx.callbackQuery?.data;
    if (!user || !data) return undefined;

    const session = await getSession(env.DB, user.id, 'submit');

    if (data === 'sub:no') {
      if (session) await clearSession(env.DB, user.id, 'submit');
      await removeKeyboard(ctx);
      return M.cancelled;
    }
    if (data !== 'sub:ok') return undefined;

    if (
      !session ||
      session.state !== 'awaiting_confirm' ||
      !session.pending_file_id ||
      !session.pending_file_unique_id ||
      !session.draft_title ||
      !session.draft_caption
    ) {
      await removeKeyboard(ctx);
      return M.sessionExpired;
    }

    const cfg = getConfig(env);
    if (await isBanned(env.DB, user.id)) {
      await clearSession(env.DB, user.id, 'submit');
      await removeKeyboard(ctx);
      return M.errBanned;
    }
    if ((await countRecentSubmissions(env.DB, user.id)) >= cfg.dailyCap) {
      await clearSession(env.DB, user.id, 'submit');
      await removeKeyboard(ctx);
      return M.errDailyCap(cfg.dailyCap);
    }

    const result = await insertPendingGif(env.DB, {
      fileId: session.pending_file_id,
      fileUniqueId: session.pending_file_unique_id,
      title: session.draft_title,
      caption: session.draft_caption,
      tags: session.draft_tags ?? '',
      userId: user.id,
      username: displayName(user),
    });

    await clearSession(env.DB, user.id, 'submit');
    await removeKeyboard(ctx);

    if (result === 'duplicate') {
      const existing = await getGifByUniqueId(env.DB, session.pending_file_unique_id);
      await ctx.reply(duplicateMessage(existing?.status));
      return undefined;
    }

    await ctx.reply(M.submittedPending);
    const gif = await getGifByUniqueId(env.DB, session.pending_file_unique_id);
    if (gif) {
      const sent = await sendReviewMessage(ctx.api, env, gif);
      if (sent === 0) console.error(`No review message delivered for gif ${gif.id}; use /pending`);
    }
    return undefined;
  });
}
