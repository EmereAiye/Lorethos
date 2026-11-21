import React, { useEffect, useRef, useState } from 'react';
import { WifiOff, Wifi, RefreshCw, X } from 'lucide-react';

export const OfflineStatusIndicator: React.FC = () => {
  const [isOffline, setIsOffline] = useState<boolean>(() =>
    typeof navigator !== 'undefined' ? navigator.onLine === false : false
  );
  const [showRestored, setShowRestored] = useState(false);
  const [checking, setChecking] = useState(false);
  const wasOfflineRef = useRef<boolean>(isOffline);
  const restoredTimerRef = useRef<number | null>(null);

  const markOffline = () => {
    if (restoredTimerRef.current) {
      window.clearTimeout(restoredTimerRef.current);
      restoredTimerRef.current = null;
    }
    wasOfflineRef.current = true;
    setShowRestored(false);
    setIsOffline(true);
  };

  const markOnline = () => {
    setIsOffline(false);
    if (wasOfflineRef.current) {
      wasOfflineRef.current = false;
      setShowRestored(true);
      if (restoredTimerRef.current) {
        window.clearTimeout(restoredTimerRef.current);
      }
      restoredTimerRef.current = window.setTimeout(() => {
        setShowRestored(false);
        restoredTimerRef.current = null;
      }, 4500);
    }
  };

  useEffect(() => {
    const onBrowserOffline = () => markOffline();
    const onBrowserOnline = () => markOnline();
    const onApiOffline = () => markOffline();
    const onApiOnline = () => {
      if (typeof navigator === 'undefined' || navigator.onLine !== false) {
        markOnline();
      }
    };

    window.addEventListener('offline', onBrowserOffline);
    window.addEventListener('online', onBrowserOnline);
    window.addEventListener('lorethos:network-offline', onApiOffline);
    window.addEventListener('lorethos:network-online', onApiOnline);

    return () => {
      window.removeEventListener('offline', onBrowserOffline);
      window.removeEventListener('online', onBrowserOnline);
      window.removeEventListener('lorethos:network-offline', onApiOffline);
      window.removeEventListener('lorethos:network-online', onApiOnline);
      if (restoredTimerRef.current) {
        window.clearTimeout(restoredTimerRef.current);
      }
    };
  }, []);

  const handleRetryConnection = async () => {
    setChecking(true);
    try {
      const res = await fetch('/api/health', { cache: 'no-store' });
      if (res.ok || res.status < 500) {
        markOnline();
      } else {
        markOffline();
      }
    } catch {
      markOffline();
    } finally {
      setChecking(false);
    }
  };

  if (!isOffline && !showRestored) {
    return null;
  }

  return (
    <div
      role="status"
      aria-live="polite"
      className={`w-full border-b px-4 py-2 text-xs font-sans-ui transition-colors ${
        isOffline
          ? 'bg-amber-950 text-amber-50 border-amber-700/60 dark:bg-amber-950/95 sepia:bg-[#3B2618]'
          : 'bg-emerald-800 text-emerald-50 border-emerald-600/60'
      }`}
    >
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          {isOffline ? (
            <WifiOff className="w-3.5 h-3.5 text-amber-300 shrink-0" />
          ) : (
            <Wifi className="w-3.5 h-3.5 text-emerald-200 shrink-0" />
          )}
          <p className="leading-snug truncate sm:whitespace-normal">
            {isOffline
              ? 'Offline — Connection lost. Keep this tab open; your reading progress and story drafts are saved on this device until you reconnect.'
              : 'Connection restored — Back online and ready to sync.'}
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {isOffline ? (
            <button
              type="button"
              onClick={() => void handleRetryConnection()}
              disabled={checking}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-white/15 hover:bg-white/25 text-white text-[11px] font-semibold cursor-pointer whitespace-nowrap shrink-0 disabled:opacity-60 transition-colors"
            >
              <RefreshCw className={`w-3 h-3 ${checking ? 'animate-spin' : ''}`} />
              <span>{checking ? 'Checking...' : 'Retry'}</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setShowRestored(false)}
              aria-label="Dismiss connection restored notice"
              className="p-1 rounded hover:bg-white/15 text-white/85 hover:text-white cursor-pointer shrink-0"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
