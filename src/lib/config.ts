import { Env } from '../types/env';
import { isBotAdminInDb } from '../db/admins';

export const DEFAULT_OWNER_ID = 96092687;

export interface Config {
  ownerId: number;
  adminIds: Set<number>;
  reviewChatId: string | null;
  dailyCap: number;
  maxMediaSizeBytes: number;
  maxMediaDurationSec: number;
}

function positiveInt(value: string | undefined, fallback: number): number {
  const n = Number.parseInt(value ?? '', 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

export function getConfig(env: Env): Config {
  const ownerId = Number(env.OWNER_ID) || DEFAULT_OWNER_ID;
  const adminIds = new Set<number>([ownerId]);
  for (const part of (env.ADMIN_IDS ?? '').split(/[\s,]+/)) {
    if (!part) continue;
    const n = Number(part);
    if (Number.isSafeInteger(n) && n !== 0) adminIds.add(n);
  }
  const review = (env.REVIEW_CHAT_ID ?? '').trim();
  return {
    ownerId,
    adminIds,
    reviewChatId: review || null,
    dailyCap: positiveInt(env.DAILY_SUBMISSION_CAP, 5),
    maxMediaSizeBytes: positiveInt(env.MAX_MEDIA_SIZE_BYTES, 10 * 1024 * 1024),
    maxMediaDurationSec: positiveInt(env.MAX_MEDIA_DURATION_SEC, 30),
  };
}

export function isOwner(env: Env, userId: number | undefined): boolean {
  if (userId === undefined) return false;
  return userId === getConfig(env).ownerId;
}

export function isAdmin(env: Env, userId: number | undefined): boolean {
  if (userId === undefined) return false;
  return getConfig(env).adminIds.has(userId);
}

export async function isUserAdmin(env: Env, userId: number | undefined): Promise<boolean> {
  if (userId === undefined) return false;
  if (isAdmin(env, userId)) return true;
  return await isBotAdminInDb(env.DB, userId);
}
