import { ambientAudio } from './ambientAudio';

type PauseCallback = () => void;

const activeListeners = new Map<string, PauseCallback>();
let currentAudioId: string | null = null;

/**
 * Ensures only one media/audio source plays at a time across the reader feed,
 * trailer players, and ambient soundscapes so tracks never overlap.
 */
export function registerExclusiveAudio(id: string, onPause: PauseCallback): () => void {
  activeListeners.set(id, onPause);
  return () => {
    activeListeners.delete(id);
    if (currentAudioId === id) {
      currentAudioId = null;
    }
  };
}

export function claimExclusiveAudio(activeId: string): void {
  currentAudioId = activeId;

  // Pause ambient reader engine if active
  ambientAudio.stop();

  // Notify registered players
  for (const [id, pauseCb] of activeListeners.entries()) {
    if (id !== activeId) {
      try {
        pauseCb();
      } catch {
        // Ignore callback cleanup errors
      }
    }
  }

  // Also pause any other native DOM audio/video elements on the page
  if (typeof document !== 'undefined') {
    const mediaEls = document.querySelectorAll<HTMLMediaElement>('audio, video');
    mediaEls.forEach((el) => {
      if (el.dataset.exclusiveId !== activeId && !el.paused) {
        try {
          el.pause();
        } catch {
          // Ignore pause errors
        }
      }
    });
  }
}

export function releaseExclusiveAudio(id: string): void {
  if (currentAudioId === id) {
    currentAudioId = null;
  }
}
