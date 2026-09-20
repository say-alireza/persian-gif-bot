import { webhookCallback } from 'grammy';
import { Env } from './types/env';
import { createBot } from './bot';

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    // Health check endpoint
    if (request.method === 'GET' && (url.pathname === '/' || url.pathname === '/health')) {
      return new Response('Persian GIF Bot Worker is healthy.', {
        status: 200,
        headers: { 'Content-Type': 'text/plain; charset=utf-8' },
      });
    }

    // Telegram webhook endpoint
    if (request.method === 'POST' && url.pathname === '/webhook') {
      // Validate incoming webhook secret token
      if (env.SECRET_TOKEN) {
        const incomingToken = request.headers.get('X-Telegram-Bot-Api-Secret-Token');
        if (incomingToken !== env.SECRET_TOKEN) {
          return new Response('Forbidden: Invalid secret token', { status: 403 });
        }
      }

      const bot = createBot(env.BOT_TOKEN, env);
      const handleUpdate = webhookCallback(bot, 'cloudflare-mod', {
        secretToken: env.SECRET_TOKEN,
      });

      return handleUpdate(request);
    }

    return new Response('Not Found', { status: 404 });
  },
};
