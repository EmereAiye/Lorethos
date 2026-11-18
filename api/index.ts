import type { IncomingMessage, ServerResponse } from 'node:http';
import type { Express } from 'express';
import { createApp } from '../server.js';

let appPromise: Promise<Express> | null = null;

async function getApp(): Promise<Express> {
  if (!appPromise) {
    appPromise = createApp({ withVite: false }).catch((err) => {
      appPromise = null;
      throw err;
    });
  }
  return appPromise;
}

export default async function handler(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const app = await getApp();
  await new Promise<void>((resolve, reject) => {
    const onDone = () => {
      res.removeListener('finish', onDone);
      res.removeListener('close', onDone);
      resolve();
    };
    res.once('finish', onDone);
    res.once('close', onDone);
    app(req as Parameters<Express>[0], res as Parameters<Express>[1], (err?: unknown) => {
      if (err) {
        res.removeListener('finish', onDone);
        res.removeListener('close', onDone);
        reject(err);
      } else if (!res.writableEnded) {
        onDone();
      }
    });
  });
}
