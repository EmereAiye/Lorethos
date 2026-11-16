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

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  const app = await getApp();
  return app(req as Parameters<Express>[0], res as Parameters<Express>[1]);
}
