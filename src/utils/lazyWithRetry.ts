import React, { lazy, type ComponentType } from 'react';

const CHUNK_RELOAD_STORAGE_KEY = 'lorethos_chunk_reload_at';
const CHUNK_RELOAD_COOLDOWN_MS = 15_000;

export function isChunkLoadError(error: unknown): boolean {
  if (!error) return false;
  const message =
    error instanceof Error
      ? `${error.name} ${error.message}`
      : typeof error === 'string'
      ? error
      : String(error);

  return /importing a module script failed|failed to fetch dynamically imported module|error loading dynamically imported module|chunkloaderror|loading chunk [\w-]+ failed|unable to preload css|failed to load module script/i.test(
    message
  );
}

export function canAttemptChunkAutoReload(nowMs: number = Date.now()): boolean {
  try {
    if (typeof window === 'undefined' || !window.sessionStorage) return false;
    const raw = window.sessionStorage.getItem(CHUNK_RELOAD_STORAGE_KEY);
    if (!raw) return true;
    const lastAttempt = Number(raw);
    if (!Number.isFinite(lastAttempt)) return true;
    return nowMs - lastAttempt > CHUNK_RELOAD_COOLDOWN_MS;
  } catch {
    return false;
  }
}

export function triggerSafeChunkReload(): boolean {
  try {
    if (typeof window === 'undefined') return false;
    if (!canAttemptChunkAutoReload()) return false;
    window.sessionStorage?.setItem(CHUNK_RELOAD_STORAGE_KEY, String(Date.now()));
    window.location.reload();
    return true;
  } catch {
    return false;
  }
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function lazyWithRetry<T extends ComponentType<any>>(
  importer: () => Promise<{ default: T }>
): React.LazyExoticComponent<T> {
  return lazy(async () => {
    const delays = [350, 900];
    let lastError: unknown;

    for (let attempt = 0; attempt <= delays.length; attempt += 1) {
      try {
        return await importer();
      } catch (err) {
        lastError = err;
        if (attempt < delays.length) {
          await wait(delays[attempt]);
          continue;
        }
      }
    }

    if (isChunkLoadError(lastError) && triggerSafeChunkReload()) {
      // Keep Suspense fallback visible while browser reloads the updated HTML & chunk manifest
      return new Promise<{ default: T }>(() => {});
    }

    throw lastError instanceof Error
      ? lastError
      : new Error('Unable to load this page module. Please reload to fetch the latest version.');
  });
}
