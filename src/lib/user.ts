import { User } from 'grammy/types';

/** Display snapshot stored next to the numeric id (the id is authoritative). */
export function displayName(user: User): string {
  return user.username ? `@${user.username}` : user.first_name;
}
