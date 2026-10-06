import { Context, InlineKeyboard } from 'grammy';
import { Env } from '../types/env';
import { isOwner, isUserAdmin } from '../lib/config';
import { getAdminKeyboard } from './admin';
import { M } from '../messages';

/**
 * Handles /start and /help commands with clean Persian typography and search trigger.
 * Shows persistent admin keyboard if caller is an admin.
 */
export async function handleStartCommand(ctx: Context, env?: Env): Promise<void> {
  const inlineKb = new InlineKeyboard().switchInlineCurrent('جستجوی گیف', '');

  const user = ctx.from;
  const userIsAdmin = env && user ? await isUserAdmin(env, user.id) : false;
  const userIsOwner = env && user ? isOwner(env, user.id) : false;

  let text =
    'به ربات گیف فارسی خوش آمدید.\n\n' +
    'برای استفاده از ربات در هر چت یا گروهی، کافی است شناسه ربات را به همراه عبارت مورد نظر بنویسید:\n' +
    '`@' +
    (ctx.me?.username || 'bot') +
    ' خنده`\n\n' +
    'همچنین می‌توانید با لمس دکمه زیر، جستجو را در همین چت امتحان کنید.\n\n' +
    M.startNote;

  if (userIsAdmin) {
    text += `\n\n🛡️ *شما دسترسی مدیریت دارید.*\nبرای انجام امور از دکمه‌های منوی پایین استفاده کنید.`;
    await ctx.reply(text, {
      parse_mode: 'Markdown',
      reply_markup: getAdminKeyboard(userIsOwner),
    });
    return;
  }

  await ctx.reply(text, {
    parse_mode: 'Markdown',
    reply_markup: inlineKb,
  });
}
