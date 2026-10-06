import { Context } from 'grammy';
import { M } from '../messages';

/**
 * Runs a callback-query handler body and answers the query exactly once,
 * whether the body returns, returns text, or throws.
 */
export async function answerOnce(
  ctx: Context,
  body: () => Promise<string | undefined>
): Promise<void> {
  let text: string | undefined;
  try {
    text = await body();
  } catch (err) {
    console.error('Callback handler error:', err);
    text = M.errGeneric;
  }
  try {
    await ctx.answerCallbackQuery(text ? { text } : undefined);
  } catch (err) {
    console.error('answerCallbackQuery failed:', err);
  }
}
