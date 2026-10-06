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
        `${SUBMITTER}: ${g.submitted_by_username ?? '-'}\n` +
        `شناسه عددی: \u200E${g.submitted_by ?? '-'}`,
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

  // Admin Menu & Management
  btnPending: 'گیف\u200cهای در انتظار بررسی',
  btnWho: 'مشخصات ارسال\u200cکننده',
  btnBan: 'مسدودسازی کاربر',
  btnUnban: 'رفع مسدودی',
  btnAdmins: 'مدیریت ادمین\u200cها',
  btnAdminHelp: 'راهنمای پنل',
  btnCancelProcess: 'لغو فرآیند',

  adminPanelWelcome: 'به پنل مدیریت ربات گیف فارسی خوش آمدید.\nلطفاً از دکمه\u200cهای زیر برای دسترسی سریع استفاده کنید:',
  adminHelpText:
    'راهنمای پنل مدیریت:\n\n' +
    '• گیف\u200cهای در انتظار: ارسال مجدد موارد منتظر بررسی\n' +
    '• مشخصات ارسال\u200cکننده: مشاهده اطلاعات فرستنده گیف با شناسه یا ریپلای\n' +
    '• مسدودسازی: مسدود کردن کاربر اسپمر بر اساس شناسه عددی\n' +
    '• رفع مسدودی: رفع مسدودیت کاربر\n' +
    '• مدیریت ادمین\u200cها: افزودن یا حذف ادمین\u200cهای ربات (مخصوص مالک)',

  adminWhoPrompt: 'لطفاً شناسه عددی گیف (ID) را ارسال کنید، یا روی گیف مورد نظر ریپلای کرده و پیام بفرستید:',
  adminBanPrompt: 'لطفاً شناسه عددی کاربر را برای مسدودسازی ارسال کنید (مثال: `123456789` یا همراه با دلیل):',
  adminUnbanPrompt: 'لطفاً شناسه عددی کاربر را برای رفع مسدودی ارسال کنید:',
  adminSessionCanceled: 'عملیات جاری لغو شد.',

  adminManageHeader: (admins: Array<{ user_id: number; username: string | null }>, ownerId: number) => {
    let out = `👥 مدیریت ادمین‌های ربات\n\nمالک ربات: \`${ownerId}\`\n\nلیست سایر ادمین‌ها:\n`;
    if (admins.length === 0) {
      out += 'هیچ ادمین دیگری در دیتابیس ثبت نشده است.';
    } else {
      admins.forEach((a, idx) => {
        out += `${idx + 1}. \`${a.user_id}\` ${a.username ? `(@${a.username})` : ''}\n`;
      });
    }
    return out;
  },

  promptAddAdmin: 'لطفاً شناسه عددی تلگرام ادمین جدید را ارسال کنید (اختیاری: یوزرنیم را با فاصله بنویسید، مثل `123456789 username`):',
  adminAddedSuccess: (id: number) => `ادمین جدید با شناسه \`${id}\` با موفقیت اضافه شد.`,
  adminRemovedSuccess: (id: number) => `ادمین با شناسه \`${id}\` با موفقیت حذف شد.`,
  cannotRemoveOwner: 'مالک اصلی ربات قابل حذف نیست.',
  invalidUserId: 'شناسه ارسالی نامعتبر است. لطفاً یک عدد صحیح ارسال کنید.',

  whoOutput: (g: GifEntity, audit: AuditEntry[]) =>
    [
      `شناسه: ${g.id}`,
      `عنوان: ${g.title}`,
      `${TAGS}: ${g.tags || '-'}`,
      `منبع: ${g.source === 'user' ? 'کاربر' : 'کانال'}`,
      `وضعیت: ${STATUS_FA[g.status] ?? g.status}`,
      `${SUBMITTER}: ${g.submitted_by_username ?? '-'}`,
      `شناسه عددی کاربر: ${g.submitted_by ? `\u200E${g.submitted_by}` : '-'}`,
      ...(g.submitted_at ? [`زمان ارسال: ${g.submitted_at}`] : []),
      `${REVIEWER}: ${g.reviewed_by_username ?? '-'}`,
      ...(g.reviewed_by ? [`شناسه عددی بررسی‌کننده: \u200E${g.reviewed_by}`] : []),
      ...(g.reviewed_at ? [`زمان بررسی: ${g.reviewed_at}`] : []),
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
