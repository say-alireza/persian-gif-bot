import { Context, InlineKeyboard } from 'grammy';
import { M } from '../messages';

/**
 * Handles /start and /help commands with clean Persian typography and search trigger.
 */
export async function handleStartCommand(ctx: Context): Promise<void> {
  const keyboard = new InlineKeyboard().switchInlineCurrent('جستجوی گیف', '');

  const text =
    'به ربات گیف فارسی خوش آمدید.\n\n' +
    'برای استفاده از ربات در هر چت یا گروهی، کافی است شناسه ربات را به همراه عبارت مورد نظر بنویسید:\n' +
    '`@' +
    (ctx.me?.username || 'bot') +
    ' خنده`\n\n' +
    'همچنین می\u200cتوانید با لمس دکمه زیر، جستجو را در همین چت امتحان کنید.\n\n' +
    M.startNote;

  await ctx.reply(text, {
    parse_mode: 'Markdown',
    reply_markup: keyboard,
  });
}
