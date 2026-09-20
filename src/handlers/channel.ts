import { Context } from 'grammy';
import { Env } from '../types/env';
import { parseCaptionMetadata } from '../db/sanitize';
import { upsertGif, updateGifCaption } from '../db/queries';

/**
 * Handles new media posts in the storage channel.
 */
export async function handleChannelPost(ctx: Context, env: Env): Promise<void> {
  const post = ctx.channelPost;
  if (!post) return;

  // Validate origin channel if STORAGE_CHANNEL_ID is set
  if (env.STORAGE_CHANNEL_ID && String(post.chat.id) !== String(env.STORAGE_CHANNEL_ID)) {
    return;
  }

  // Extract animation or video
  const media = post.animation || post.video;
  if (!media) return;

  const { title, tags, cleanCaption } = parseCaptionMetadata(post.caption);

  await upsertGif(env.DB, {
    file_id: media.file_id,
    file_unique_id: media.file_unique_id,
    title,
    caption: cleanCaption,
    tags,
  });
}

/**
 * Handles edited posts in the storage channel to update tags and titles.
 */
export async function handleEditedChannelPost(ctx: Context, env: Env): Promise<void> {
  const post = ctx.editedChannelPost;
  if (!post) return;

  if (env.STORAGE_CHANNEL_ID && String(post.chat.id) !== String(env.STORAGE_CHANNEL_ID)) {
    return;
  }

  const media = post.animation || post.video;
  if (!media) return;

  const { title, tags, cleanCaption } = parseCaptionMetadata(post.caption);

  await updateGifCaption(env.DB, media.file_unique_id, title, cleanCaption, tags);
}
