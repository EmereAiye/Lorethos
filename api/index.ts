process.env.LORETHOS_NO_LISTEN = '1';

import type { IncomingMessage, ServerResponse } from 'node:http';
import type { Express } from 'express';
import { createApp } from '../server';

export const config = {
  api: {
    bodyParser: false,
  },
};

let appPromise: Promise<Express> | null = null;

function getApp(): Promise<Express> {
  if (!appPromise) {
    appPromise = createApp({ withVite: false }).catch((err) => {
      appPromise = null;
      throw err;
    });
  }
  return appPromise;
}

export function normalizeVercelRequestUrl(rawUrl: string): string {
  const input = rawUrl || '/api';
  try {
    const parsed = new URL(input, 'http://localhost');
    if (!parsed.searchParams.has('__vercel_path')) {
      return input;
    }
    const rawSubpath = parsed.searchParams.get('__vercel_path') || '';
    const cleanSubpath = rawSubpath.replace(/^\/+/, '');
    parsed.searchParams.delete('__vercel_path');
    const qs = parsed.searchParams.toString();
    const basePath = cleanSubpath ? `/api/${cleanSubpath}` : '/api';
    return qs ? `${basePath}?${qs}` : basePath;
  } catch {
    return input;
  }
}

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  req.url = normalizeVercelRequestUrl(req.url || '/api');
  const app = await getApp();
  return app(req as Parameters<Express>[0], res as Parameters<Express>[1]);
}
