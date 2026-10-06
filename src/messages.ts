import { SubmissionParseError } from './db/sanitize';
import { AuditEntry, GifEntity } from './types/gif';

// All user-facing Persian copy lives here. Z = ZWNJ (نیم‌فاصله).
const Z = '\u200c';
const TAGS = `برچسب${Z}ها`;
const SUBMITTER = `ارسال${Z}کننده`;
const REVIEWER = `بررسی${Z}کننده`;

const REASONS: Record<string, string> = {
  '1': 'محتوای نامناسب',
  '2': 'کیفیت پایین',
  '3': 'تکراری',
  '4': 'سایر موارد',
};

export function rejectReasonLabel(code: string | null | undefined): string {
  return (code && REASONS[code]) || REASONS['4'];
}

function truncate(s: string, max: number): string {
  return s.length > max ? `${s.slice(0, max - 1)}…` : s;
}

const STATUS_FA: Record<string, string> = {
  active: 'فعال',
  pending_review: 'در انتظار بررسی',
  rejected: 'رد شده',
};

export const M = {
  startNote: `برای افزودن گیف جدید، یک گیف برای ربات بفرستید. پس از بررسی مدیران، گیف شما در جستجو قرار می${Z}گیرد.`,

  askTitleTags:
    `عنوان و ${TAGS} را در یک پیام بفرستید.\n\n` +
    `خط اول: عنوان گیف (حداکثر ۶۰ نویسه)\n` +
    `خط${Z}های بعد: ${TAGS} با # یا بدون آن؛ ایموجی هم مجاز است (حداکثر ۱۰ برچسب)\n\n` +
    `نمونه:\nگربه خندان\n#گربه #خنده 😂\n\n` +
    `برای لغو، /cancel را بفرستید.`,

  errNoTitle: 'عنوان گیف را در خط اول بنویسید.',
  errTitleTooLong: `عنوان نباید بیش از ۶۰ نویسه باشد. لطفاً کوتاه${Z}تر بنویسید.`,
  errNoTags: `دست${Z}کم یک برچسب لازم است. ${TAGS} را در خط${Z}های بعد از عنوان بنویسید.`,
  errTooManyTags: `تعداد ${TAGS} نباید بیش از ۱۰ باشد.`,
  errTagTooLong: 'هر برچسب نباید بیش از ۳۰ نویسه باشد.',
  errTooLong: 'پیام نباید بیش از ۲۰۰ نویسه باشد.',

  previewText: (title: string, tags: string[]) =>
    `پیش${Z}نمایش ارسال شما\n\nعنوان: ${title}\n${TAGS}: ${tags.join(' ')}\n\nبرای بررسی ارسال شود؟`,
  btnConfirm: 'تأیید و ارسال',
  btnCancel: 'لغو',
  submittedPending: `گیف شما ثبت شد و پس از بررسی مدیران در جستجو قرار می${Z}گیرد.`,
  cancelled: 'ارسال لغو شد.',
  sessionExpired: 'زمان این درخواست به پایان رسیده است. لطفاً گیف را دوباره بفرستید.',
  finishCurrentFirst: 'ابتدا ارسال فعلی را کامل کنید یا با /cancel لغو کنید.',
  useButtonsOrCancel: `از دکمه${Z}های پیش${Z}نمایش استفاده کنید یا با /cancel لغو کنید.`,

  errUnsupportedMedia: `فقط گیف (انیمیشن) پذیرفته می${Z}شود. ویدیو، عکس و استیکر قابل ارسال نیست.`,
  errMediaTooLarge: (mb: number) => `حجم گیف نباید بیش از ${mb} مگابایت باشد.`,
  errMediaTooLong: (sec: number) => `مدت گیف نباید بیش از ${sec} ثانیه باشد.`,
  dupActive: 'این گیف از قبل در ربات موجود است.',
  dupPending: 'این گیف قبلاً ارسال شده و در انتظار بررسی است.',
  dupRejected: 'این گیف قبلاً بررسی و رد شده است.',
  errBanned: 'امکان ارسال گیف برای شما مسدود شده است.',
  errDailyCap: (cap: number) => `سقف ارسال روزانه (${cap} گیف) پر شده است. فردا دوباره تلاش کنید.`,
  errGeneric: 'خطایی رخ داد. لطفاً دوباره تلاش کنید.',
  notAllowed: 'شما اجازه این کار را ندارید.',

  approvedNotice: (title: string) => `گیف «${title}» تأیید شد و اکنون در جستجو در دسترس است.`,
  rejectedNotice: (title: string, code: string) => `گیف «${title}» تأیید نشد.\nدلیل: ${rejectReasonLabel(code)}`,

  btnApprove: 'تأیید',
  btnReject: 'رد',
  btnEditTags: `ویرایش ${TAGS}`,
  btnBack: 'بازگشت',
  rejectReasonButton: (code: string) => rejectReasonLabel(code),

  reviewCaption: (g: GifEntity) =>
    truncate(
      `گیف شماره ${g.id}\nعنوان: ${g.title}\n${TAGS}: ${g.tags || '-'}\n` +
        `${SUBMITTER}: ${g.submitted_by_username ?? '-'} (${g.submitted_by ?? '-'})`,
      1000
    ),
  reviewOutcomeApproved: (admin: string) => `تأیید شد توسط ${admin}`,
  reviewOutcomeRejected: (admin: string, code: string) => `رد شد توسط ${admin}\nدلیل: ${rejectReasonLabel(code)}`,
  alreadyReviewed: 'این گیف قبلاً بررسی شده است.',

  editPrompt: `عنوان و ${TAGS}ی جدید را در پاسخ به همین پیام بفرستید (خط اول عنوان، خط${Z}های بعد ${TAGS}).`,
  editPlaceholder: `عنوان و ${TAGS}`,
  editDone: `عنوان و ${TAGS} به${Z}روز شد.`,

  notFound: 'موردی پیدا نشد.',
  whoUsage: 'روی پیام یک گیف پاسخ دهید و /who بفرستید، یا /who شناسه_گیف را بنویسید.',
  banUsage: 'نحوه استفاده: /ban شناسه_کاربر [دلیل]',
  unbanUsage: 'نحوه استفاده: /unban شناسه_کاربر',
  banDone: 'کاربر مسدود شد.',
  unbanDone: 'مسدودی کاربر برداشته شد.',
  pendingNone: 'گیفی در انتظار بررسی نیست.',
  pendingSent: (n: number) => `${n} پیام بررسی دوباره ارسال شد.`,

  whoOutput: (g: GifEntity, audit: AuditEntry[]) =>
    [
      `شناسه: ${g.id}`,
      `عنوان: ${g.title}`,
      `${TAGS}: ${g.tags || '-'}`,
      `منبع: ${g.source === 'user' ? 'کاربر' : 'کانال'}`,
      `وضعیت: ${STATUS_FA[g.status] ?? g.status}`,
      `${SUBMITTER}: ${g.submitted_by ? `${g.submitted_by_username ?? '-'} (${g.submitted_by}) - ${g.submitted_at ?? '-'}` : '-'}`,
      `${REVIEWER}: ${g.reviewed_by ? `${g.reviewed_by_username ?? '-'} (${g.reviewed_by}) - ${g.reviewed_at ?? '-'}` : '-'}`,
      g.reject_reason ? `دلیل رد: ${rejectReasonLabel(g.reject_reason)}` : null,
      '',
      'تاریخچه:',
      ...audit.map((a) => `${a.created_at} | ${a.action} | ${a.actor_username ?? a.actor_id ?? 'system'}`),
    ]
      .filter((l): l is string => l !== null)
      .join('\n'),
} as const;

export function parseErrorMessage(err: SubmissionParseError): string {
  switch (err) {
    case 'no_title':
      return M.errNoTitle;
    case 'title_too_long':
      return M.errTitleTooLong;
    case 'no_tags':
      return M.errNoTags;
    case 'too_many_tags':
      return M.errTooManyTags;
    case 'tag_too_long':
      return M.errTagTooLong;
    case 'too_long':
      return M.errTooLong;
  }
}
