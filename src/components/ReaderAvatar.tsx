import React, { useState, useEffect } from 'react';
import { User } from 'lucide-react';
import { normalizePortableAvatarUrl } from '../utils/avatarImage';

interface ReaderAvatarProps {
  src?: string | null;
  name: string;
  className?: string;
  fallbackMode?: 'initial' | 'icon';
  initialClassName?: string;
  iconClassName?: string;
}

/**
 * Renders a reader's portrait reliably across devices and browsers:
 * normalizes legacy/hashed URLs to portable paths and falls back cleanly
 * to a monogram initial or icon if an external/stale image fails to decode.
 */
export const ReaderAvatar: React.FC<ReaderAvatarProps> = ({
  src,
  name,
  className = 'w-full h-full object-cover',
  fallbackMode = 'initial',
  initialClassName = 'font-display font-bold select-none leading-none',
  iconClassName = 'w-3.5 h-3.5 shrink-0',
}) => {
  const normalizedSrc = normalizePortableAvatarUrl(src);
  const [failedSrc, setFailedSrc] = useState<string | null>(null);

  useEffect(() => {
    setFailedSrc(null);
  }, [normalizedSrc]);

  if (normalizedSrc && failedSrc !== normalizedSrc) {
    return (
      <img
        src={normalizedSrc}
        alt={name}
        referrerPolicy="no-referrer"
        onError={() => setFailedSrc(normalizedSrc)}
        className={className}
      />
    );
  }

  if (fallbackMode === 'icon') {
    return <User className={iconClassName} aria-hidden="true" />;
  }

  const initial = (name || 'R').trim().charAt(0).toUpperCase() || 'R';
  return (
    <span className={initialClassName} aria-hidden="true">
      {initial}
    </span>
  );
};
