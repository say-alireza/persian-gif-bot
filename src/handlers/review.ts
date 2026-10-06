import { Api, Context, InlineKeyboard, NextFunction } from 'grammy';
import { Env } from '../types/env';
import { GifEntity } from '../types/gif';
import { getConfig, isUserAdmin } from '../lib/config';
import { getBotAdmins } from '../db/admins';
import { displayName } from '../lib/user';
import { answerOnce } from '../lib/callback';
import { M, parseErrorMessage } from '../messages';
import { parseSubmissionInput } from '../db/sanitize';
import { clearSession, getSession, putSession } from '../db/sessions';
import { editPendingGif, getGifById, reviewGif } from '../db/submissions';

const RV_SIMPLE = /^rv:(a|r|b|e):(\d{1,12})$/;
const RV_REJECT = /^rv:rr:(\d{1,12}):([1-4])$/;

export function mainKeyboard(id: number): InlineKeyboard {
  return new InlineKeyboard()
    .text(M.btnApprove, `rv:a:${id}`)
    .text(M.btnReject, `rv:r:${id}`)
    .row()
    .text(M.btnEditTags, `rv:e:${id}`);
}

function reasonKeyboard(id: number): InlineKeyboard {
  const kb = new InlineKeyboard();
  for (const code of ['1', '2', '3', '4']) {
    kb.text(M.rejectReasonButton(code), `rv:rr:${id}:${code}`).row();
  }
  return kb.text(M.btnBack, `rv:b:${id}`);
}

/** Sends the review message to REVIEW_CHAT_ID, or to every admin by DM. Returns how many succeeded. */
export async function sendReviewMessage(api: Api, env: Env, gif: GifEntity): Promise<number> {
  const cfg = getConfig(env);
  const dbAdmins = await getBotAdmins(env.DB);
  const allTargets = new Set<string | number>();
  if (cfg.reviewChatId) {
    allTargets.add(cfg.reviewChatId);
  } else {
    for (const id of cfg.adminIds) allTargets.add(id);
    for (const a of dbAdmins) allTargets.add(a.user_id);
  }

  let sent = 0;
  for (const target of allTargets) {
    try {
      await api.sendAnimation(target, gif.file_id, {
        caption: M.reviewCaption(gif),
        reply_markup: mainKeyboard(gif.id),
      });
      sent++;
    } catch (err) {
      console.error(`Failed to send review message to ${target}:`, err);
    }
  }
  return sent;
}

async function safeEditCaption(
  api: Api,
  chatId: number | string,
  messageId: number,
  caption: string,
  keyboard: InlineKeyboard | null
): Promise<void> {
  try {
    await api.editMessageCaption(chatId, messageId, {
      caption,
      reply_markup: keyboard ?? { inline_keyboard: [] },
    });
  } catch (err) {
    console.error('editMessageCaption failed:', err);
  }
}

function outcomeLine(gif: GifEntity): string {
  const who = gif.reviewed_by_username ?? String(gif.reviewed_by ?? '-');
  return gif.status === 'active'
    ? M.reviewOutcomeApproved(who)
    : M.reviewOutcomeRejected(who, gif.reject_reason ?? '4');
}

/** Approve / reject: shared flow. */
async function finalizeReview(
  ctx: Context,
  env: Env,
  gifId: number,
  outcome: 'approved' | 'rejected',
  rejectCode?: string
): Promise<string | undefined> {
  const admin = ctx.from!;
  const msg = ctx.callbackQuery?.message;
  const adminName = displayName(admin);

  const result = await reviewGif(env.DB, { gifId, outcome, adminId: admin.id, adminName, rejectCode });
  const gif = await getGifById(env.DB, gifId);
  if (!gif) return M.notFound;

  if (msg) {
    await safeEditCaption(ctx.api, msg.chat.id, msg.message_id, `${M.reviewCaption(gif)}\n\n${outcomeLine(gif)}`, null);
  }

  if (result !== 'ok') return M.alreadyReviewed;

  // Notify the submitter. Failure (blocked bot etc.) must never undo the review.
  if (gif.submitted_by) {
    try {
      await ctx.api.sendMessage(
        gif.submitted_by,
        outcome === 'approved' ? M.approvedNotice(gif.title) : M.rejectedNotice(gif.title, rejectCode ?? '4')
      );
    } catch (err) {
      console.error(`Could not notify submitter ${gif.submitted_by}:`, err);
    }
  }
  return undefined;
}

async function startTagEdit(ctx: Context, env: Env, gifId: number): Promise<string | undefined> {
  const admin = ctx.from!;
  const msg = ctx.callbackQuery?.message;
  if (!msg) return undefined;

  const gif = await getGifById(env.DB, gifId);
  if (!gif) return M.notFound;
  if (gif.status !== 'pending_review') return M.alreadyReviewed;

  // Non-selective ForceReply: selective needs a mention/reply target and silently does nothing otherwise.
  // The reply is validated server-side (admin + prompt id + chat), so this is safe in a shared group.
  const prompt = await ctx.api.sendMessage(msg.chat.id, M.editPrompt, {
    reply_markup: { force_reply: true, input_field_placeholder: M.editPlaceholder },
  });

  await putSession(env.DB, {
    user_id: admin.id,
    kind: 'admin_edit',
    state: 'awaiting_edit',
    target_gif_id: gifId,
    prompt_chat_id: msg.chat.id,
    prompt_message_id: prompt.message_id,
    review_message_id: msg.message_id,
  });
  return undefined;
}

/** All rv:* callbacks. Strict payload parsing; unknown payloads are answered and ignored. */
export async function handleReviewCallback(ctx: Context, env: Env): Promise<void> {
  await answerOnce(ctx, async () => {
    const user = ctx.from;
    const data = ctx.callbackQuery?.data ?? '';
    if (!user || !(await isUserAdmin(env, user.id))) return M.notAllowed;

    const rr = RV_REJECT.exec(data);
    if (rr) return finalizeReview(ctx, env, Number(rr[1]), 'rejected', rr[2]);

    const m = RV_SIMPLE.exec(data);
    if (!m) return undefined;
    const action = m[1];
    const gifId = Number(m[2]);
    const msg = ctx.callbackQuery?.message;

    switch (action) {
      case 'a':
        return finalizeReview(ctx, env, gifId, 'approved');
      case 'r':
        if (msg) await ctx.api.editMessageReplyMarkup(msg.chat.id, msg.message_id, { reply_markup: reasonKeyboard(gifId) });
        return undefined;
      case 'b':
        if (msg) await ctx.api.editMessageReplyMarkup(msg.chat.id, msg.message_id, { reply_markup: mainKeyboard(gifId) });
        return undefined;
      case 'e':
        return startTagEdit(ctx, env, gifId);
      default:
        return undefined;
    }
  });
}

/** Admin replies to the bot's ForceReply prompt (any chat type). Otherwise falls through. */
export async function handleAdminEditReply(ctx: Context, env: Env, next: NextFunction): Promise<void> {
  const user = ctx.from;
  const text = ctx.msg?.text;
  const reply = ctx.msg?.reply_to_message;
  if (!user || !text || !reply || !(await isUserAdmin(env, user.id))) return next();

  const session = await getSession(env.DB, user.id, 'admin_edit');
  if (
    !session ||
    session.prompt_message_id !== reply.message_id ||
    String(session.prompt_chat_id) !== String(ctx.chat?.id) ||
    !session.target_gif_id
  ) {
    return next();
  }

  const parsed = parseSubmissionInput(text);
  if (!parsed.ok) {
    await ctx.reply(parseErrorMessage(parsed.error));
    await putSession(env.DB, session);
    return;
  }

  const ok = await editPendingGif(env.DB, {
    gifId: session.target_gif_id,
    title: parsed.title,
    caption: parsed.caption,
    tags: parsed.tags.join(' '),
    adminId: user.id,
    adminName: displayName(user),
  });
  await clearSession(env.DB, user.id, 'admin_edit');

  if (!ok) {
    await ctx.reply(M.alreadyReviewed);
    return;
  }

  const gif = await getGifById(env.DB, session.target_gif_id);
  if (gif && session.prompt_chat_id && session.review_message_id) {
    await safeEditCaption(ctx.api, session.prompt_chat_id, session.review_message_id, M.reviewCaption(gif), mainKeyboard(gif.id));
  }
  await ctx.reply(M.editDone);
}
