import { Context, InlineKeyboard, Keyboard } from 'grammy';
import { Env } from '../types/env';
import { isOwner, isUserAdmin } from '../lib/config';
import { M } from '../messages';
import {
  banUser,
  getAuditLog,
  getGifById,
  getGifByUniqueId,
  getPendingUserGifs,
  unbanUser,
} from '../db/submissions';
import {
  addBotAdmin,
  clearAdminSession,
  getAdminSession,
  getBotAdmins,
  removeBotAdmin,
  setAdminSession,
} from '../db/admins';
import { sendReviewMessage } from './review';

function args(ctx: Context): string {
  return String(ctx.match ?? '').trim();
}

/** Builds the persistent 2-column reply keyboard for admins */
export function getAdminKeyboard(isOwnerUser: boolean): Keyboard {
  const kb = new Keyboard();
  if (isOwnerUser) {
    kb.text(M.btnPending).text(M.btnWho).row();
    kb.text(M.btnBan).text(M.btnUnban).row();
    kb.text(M.btnAdmins).text(M.btnAdminHelp).row();
  } else {
    kb.text(M.btnPending).text(M.btnWho).row();
    kb.text(M.btnAdminHelp).text(M.btnCancelProcess).row();
  }
  return kb.resized().persistent();
}

/** Builds inline keyboard for admin management */
export function adminManagementKeyboard(): InlineKeyboard {
  return new InlineKeyboard()
    .text('➕ افزودن ادمین', 'adm:add')
    .text('➖ حذف ادمین', 'adm:del_menu')
    .row()
    .text('🔄 به‌روزرسانی لیست', 'adm:refresh');
}

export async function handleWho(ctx: Context, env: Env): Promise<void> {
  if (!ctx.from || !(await isUserAdmin(env, ctx.from.id))) return;

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
  if (!ctx.from || !isOwner(env, ctx.from.id)) {
    if (ctx.from && (await isUserAdmin(env, ctx.from.id))) {
      await ctx.reply(M.notAllowed);
    }
    return;
  }
  const [idStr, ...rest] = args(ctx).split(/\s+/);
  if (!/^\d{1,15}$/.test(idStr ?? '')) {
    await ctx.reply(M.banUsage);
    return;
  }
  await banUser(env.DB, Number(idStr), ctx.from.id, rest.join(' ').trim() || null);
  await ctx.reply(M.banDone);
}

export async function handleUnban(ctx: Context, env: Env): Promise<void> {
  if (!ctx.from || !isOwner(env, ctx.from.id)) {
    if (ctx.from && (await isUserAdmin(env, ctx.from.id))) {
      await ctx.reply(M.notAllowed);
    }
    return;
  }
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
  if (!ctx.from || !(await isUserAdmin(env, ctx.from.id))) return;
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

/** Shows the admin management overview to the owner */
export async function showAdminManagement(ctx: Context, env: Env): Promise<void> {
  if (!ctx.from || !isOwner(env, ctx.from.id)) return;
  const admins = await getBotAdmins(env.DB);
  const ownerId = Number(env.OWNER_ID) || 96092687;
  const text = M.adminManageHeader(admins, ownerId);
  const kb = adminManagementKeyboard();
  await ctx.reply(text, { reply_markup: kb, parse_mode: 'Markdown' });
}

/** Handles button texts from the reply keyboard and interactive admin sessions */
export async function handleAdminMenuText(
  ctx: Context,
  env: Env,
  next: () => Promise<void>
): Promise<void> {
  const user = ctx.from;
  const text = ctx.msg?.text?.trim();
  if (!user || !text) return next();

  const userIsAdmin = await isUserAdmin(env, user.id);
  if (!userIsAdmin) return next();

  // 1. Menu Buttons
  if (text === M.btnPending) {
    await handlePending(ctx, env);
    return;
  }

  if (text === M.btnWho) {
    await setAdminSession(env.DB, user.id, 'awaiting_who');
    await ctx.reply(M.adminWhoPrompt);
    return;
  }

  if (text === M.btnBan) {
    if (!isOwner(env, user.id)) {
      await ctx.reply(M.notAllowed);
      return;
    }
    await setAdminSession(env.DB, user.id, 'awaiting_ban');
    await ctx.reply(M.adminBanPrompt, { parse_mode: 'Markdown' });
    return;
  }

  if (text === M.btnUnban) {
    if (!isOwner(env, user.id)) {
      await ctx.reply(M.notAllowed);
      return;
    }
    await setAdminSession(env.DB, user.id, 'awaiting_unban');
    await ctx.reply(M.adminUnbanPrompt);
    return;
  }

  if (text === M.btnAdmins) {
    if (isOwner(env, user.id)) {
      await showAdminManagement(ctx, env);
    } else {
      await ctx.reply('تنها مالک اصلی ربات به این بخش دسترسی دارد.');
    }
    return;
  }

  if (text === M.btnAdminHelp) {
    await ctx.reply(M.adminHelpText);
    return;
  }

  if (text === M.btnCancelProcess) {
    await clearAdminSession(env.DB, user.id);
    await ctx.reply(M.adminSessionCanceled);
    return;
  }

  // 2. Active Admin Interactive Sessions
  const session = await getAdminSession(env.DB, user.id);
  if (!session) return next();

  if (session.action === 'awaiting_who') {
    await clearAdminSession(env.DB, user.id);
    if (/^\d{1,12}$/.test(text)) {
      const gif = await getGifById(env.DB, Number(text));
      if (!gif) {
        await ctx.reply(M.notFound);
        return;
      }
      const audit = await getAuditLog(env.DB, gif.id, 5);
      await ctx.reply(M.whoOutput(gif, audit));
    } else {
      await ctx.reply(M.notFound);
    }
    return;
  }

  if (session.action === 'awaiting_ban') {
    await clearAdminSession(env.DB, user.id);
    if (!isOwner(env, user.id)) {
      await ctx.reply(M.notAllowed);
      return;
    }
    const [idStr, ...rest] = text.split(/\s+/);
    if (!/^\d{1,15}$/.test(idStr ?? '')) {
      await ctx.reply(M.invalidUserId);
      return;
    }
    await banUser(env.DB, Number(idStr), user.id, rest.join(' ').trim() || null);
    await ctx.reply(M.banDone);
    return;
  }

  if (session.action === 'awaiting_unban') {
    await clearAdminSession(env.DB, user.id);
    if (!isOwner(env, user.id)) {
      await ctx.reply(M.notAllowed);
      return;
    }
    const idStr = text.split(/\s+/)[0];
    if (!/^\d{1,15}$/.test(idStr ?? '')) {
      await ctx.reply(M.invalidUserId);
      return;
    }
    await unbanUser(env.DB, Number(idStr));
    await ctx.reply(M.unbanDone);
    return;
  }

  if (session.action === 'awaiting_add_admin') {
    if (!isOwner(env, user.id)) return next();
    await clearAdminSession(env.DB, user.id);
    const [idStr, ...usernameParts] = text.split(/\s+/);
    if (!/^\d{1,15}$/.test(idStr ?? '')) {
      await ctx.reply(M.invalidUserId);
      return;
    }
    const targetId = Number(idStr);
    const targetUsername = usernameParts.join(' ').replace(/^@/, '').trim() || null;
    await addBotAdmin(env.DB, targetId, targetUsername, user.id);
    await ctx.reply(M.adminAddedSuccess(targetId), { parse_mode: 'Markdown' });

    // Optionally set admin scoped commands for the new admin
    try {
      await ctx.api.setMyCommands(
        [
          { command: 'start', description: 'شروع کار با ربات' },
          { command: 'help', description: 'راهنمای استفاده' },
          { command: 'cancel', description: 'لغو فرآیند جاری' },
          { command: 'pending', description: 'گیف‌های در انتظار بررسی' },
          { command: 'who', description: 'مشخصات ارسال‌کننده گیف' },
          { command: 'ban', description: 'مسدودسازی کاربر اسپمر' },
          { command: 'unban', description: 'رفع مسدودی کاربر' },
        ],
        { scope: { type: 'chat', chat_id: targetId } }
      );
    } catch {
      // Ignored if user has not started the bot yet
    }
    return;
  }

  return next();
}

/** Handles inline callbacks for admin management */
export async function handleAdminCallback(ctx: Context, env: Env): Promise<void> {
  const user = ctx.from;
  const data = ctx.callbackQuery?.data ?? '';
  if (!user || !isOwner(env, user.id)) {
    await ctx.answerCallbackQuery({ text: 'تنها مالک ربات مجاز به این عملیات است.', show_alert: true });
    return;
  }

  if (data === 'adm:refresh') {
    const admins = await getBotAdmins(env.DB);
    const ownerId = Number(env.OWNER_ID) || 96092687;
    const text = M.adminManageHeader(admins, ownerId);
    const kb = adminManagementKeyboard();
    try {
      await ctx.editMessageText(text, { reply_markup: kb, parse_mode: 'Markdown' });
    } catch {
      // unchanged
    }
    await ctx.answerCallbackQuery({ text: 'لیست به‌روزرسانی شد.' });
    return;
  }

  if (data === 'adm:add') {
    await setAdminSession(env.DB, user.id, 'awaiting_add_admin');
    await ctx.answerCallbackQuery();
    await ctx.reply(M.promptAddAdmin);
    return;
  }

  if (data === 'adm:del_menu') {
    const admins = await getBotAdmins(env.DB);
    if (admins.length === 0) {
      await ctx.answerCallbackQuery({ text: 'ادمین قابل حذفی وجود ندارد.', show_alert: true });
      return;
    }
    const kb = new InlineKeyboard();
    for (const a of admins) {
      const label = a.username ? `@${a.username} (${a.user_id})` : String(a.user_id);
      kb.text(`❌ ${label}`, `adm:rm:${a.user_id}`).row();
    }
    kb.text('بازگشت', 'adm:refresh');
    await ctx.editMessageText('برای حذف هر ادمین روی نام آن کلیک کنید:', { reply_markup: kb });
    await ctx.answerCallbackQuery();
    return;
  }

  if (data.startsWith('adm:rm:')) {
    const targetId = Number(data.replace('adm:rm:', ''));
    const ownerId = Number(env.OWNER_ID) || 96092687;
    if (targetId === ownerId) {
      await ctx.answerCallbackQuery({ text: M.cannotRemoveOwner, show_alert: true });
      return;
    }
    await removeBotAdmin(env.DB, targetId);
    await ctx.answerCallbackQuery({ text: M.adminRemovedSuccess(targetId) });
    // Refresh list
    const admins = await getBotAdmins(env.DB);
    const text = M.adminManageHeader(admins, ownerId);
    const kb = adminManagementKeyboard();
    await ctx.editMessageText(text, { reply_markup: kb, parse_mode: 'Markdown' });
    return;
  }
}
