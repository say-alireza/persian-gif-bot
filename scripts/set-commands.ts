// Run by a human: BOT_TOKEN=... ADMIN_IDS=1,2 npx tsx scripts/set-commands.ts
declare const process: { env: Record<string, string | undefined>; exit(code?: number): never };

const token = process.env.BOT_TOKEN;
const adminIds = (process.env.ADMIN_IDS ?? '')
  .split(/[\s,]+/)
  .map(Number)
  .filter((n) => Number.isSafeInteger(n) && n !== 0);

if (!token) {
  console.error('BOT_TOKEN is required');
  process.exit(1);
}

async function call(method: string, body: unknown): Promise<void> {
  const res = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const json = (await res.json()) as { ok: boolean; description?: string };
  if (!json.ok) console.error(`${method} failed:`, json.description);
}

const common = [
  { command: 'start', description: 'شروع' },
  { command: 'help', description: 'راهنما' },
  { command: 'cancel', description: 'لغو ارسال گیف' },
];
const admin = [
  ...common,
  { command: 'who', description: 'مشخصات ارسال‌کننده گیف' },
  { command: 'ban', description: 'مسدود کردن کاربر' },
  { command: 'unban', description: 'رفع مسدودی کاربر' },
  { command: 'pending', description: 'گیف‌های در انتظار بررسی' },
];

await call('setMyCommands', { commands: common });
// Chat-scoped lists only apply once the admin has started the bot.
for (const id of adminIds) {
  await call('setMyCommands', { commands: admin, scope: { type: 'chat', chat_id: id } });
}
console.log(`Done. Default commands set; admin lists set for ${adminIds.length} admin(s).`);
