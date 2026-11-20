import React, { useEffect, useState } from 'react';
import { Heart } from 'lucide-react';
import { useApp } from '../context/AppContext';
import {
  emitLikesChanged,
  subscribeLikesChanged,
  toggleStoryLikeInSupabase,
} from '../lib/storyLikes';

interface StoryLikeButtonProps {
  storyId: string;
  storyTitle: string;
  initialCount?: number;
  initialLiked?: boolean;
  size?: 'sm' | 'md';
  onUpdated?: (storyId: string, liked: boolean, count: number) => void;
}

export const StoryLikeButton: React.FC<StoryLikeButtonProps> = ({
  storyId,
  storyTitle,
  initialCount = 0,
  initialLiked = false,
  size = 'sm',
  onUpdated,
}) => {
  const { navigate, isAuthenticated } = useApp();
  const [liked, setLiked] = useState(initialLiked);
  const [count, setCount] = useState(initialCount);
  const [pending, setPending] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [needsSignIn, setNeedsSignIn] = useState(false);
  const [requiresReauth, setRequiresReauth] = useState(false);

  useEffect(() => {
    setLiked(initialLiked);
  }, [initialLiked]);

  useEffect(() => {
    setCount(initialCount);
  }, [initialCount]);

  useEffect(() => {
    if (isAuthenticated && needsSignIn && !requiresReauth) {
      setNeedsSignIn(false);
      setNotice(null);
    }
  }, [isAuthenticated, needsSignIn, requiresReauth]);

  useEffect(() => {
    return subscribeLikesChanged((detail) => {
      if (detail.storyId === storyId) {
        setLiked(detail.liked);
        setCount(detail.count);
      }
    });
  }, [storyId]);

  const handleToggle = async (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (pending) return;

    setNotice(null);
    setNeedsSignIn(false);
    setRequiresReauth(false);

    if (!isAuthenticated) {
      setNeedsSignIn(true);
      setNotice('Please log in to like stories.');
      return;
    }

    const prevLiked = liked;
    const prevCount = count;
    const optimisticLiked = !prevLiked;
    const optimisticCount = Math.max(0, prevCount + (optimisticLiked ? 1 : -1));

    setPending(true);
    setLiked(optimisticLiked);
    setCount(optimisticCount);

    const res = await toggleStoryLikeInSupabase(storyId, prevLiked, prevCount);
    setPending(false);

    if (res.requiresAuth) {
      setLiked(prevLiked);
      setCount(prevCount);
      setNeedsSignIn(true);
      setRequiresReauth(true);
      setNotice(res.error || 'Please log in to like stories.');
      return;
    }

    if (res.error) {
      setLiked(prevLiked);
      setCount(prevCount);
      setNotice(res.error);
      return;
    }

    setLiked(res.liked);
    setCount(res.count);
    emitLikesChanged({ storyId, liked: res.liked, count: res.count });
    onUpdated?.(storyId, res.liked, res.count);
  };

  return (
    <div
      className="inline-flex flex-col items-start gap-1"
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
      }}
    >
      <button
        type="button"
        onClick={(e) => void handleToggle(e)}
        disabled={pending}
        aria-pressed={liked}
        aria-label={`${liked ? 'Unlike' : 'Like'} ${storyTitle} (${count} ${count === 1 ? 'like' : 'likes'})`}
        className={`inline-flex items-center gap-1.5 rounded-lg border font-sans-ui font-semibold transition-colors cursor-pointer disabled:opacity-60 whitespace-nowrap shrink-0 ${
          size === 'md' ? 'px-3.5 py-2 text-xs' : 'px-2.5 py-1 text-[11px]'
        } ${
          liked
            ? 'bg-[#C85A32]/15 border-[#C85A32] text-[#C85A32]'
            : 'border-[#2D142C]/15 dark:border-white/15 sepia:border-[#2C1E18]/20 text-[#2D142C]/75 dark:text-white/75 sepia:text-[#2C1E18]/75 hover:border-[#C85A32] hover:text-[#C85A32]'
        }`}
      >
        <Heart className={`w-3.5 h-3.5 ${liked ? 'fill-[#C85A32] text-[#C85A32]' : ''}`} />
        <span className="tabular-nums">{count}</span>
        <span>{liked ? 'Liked' : 'Like'}</span>
      </button>

      {notice && (
        <div
          role="status"
          className="text-[11px] font-sans-ui text-[#C85A32] flex flex-wrap items-center gap-1.5 leading-snug"
        >
          <span>{notice}</span>
          {needsSignIn && (
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                navigate('account', {
                  redirect:
                    typeof window !== 'undefined'
                      ? `${window.location.pathname}${window.location.search}`
                      : '/',
                  ...(requiresReauth ? { reauth: '1' } : {}),
                });
              }}
              className="underline font-semibold cursor-pointer"
            >
              Log In
            </button>
          )}
        </div>
      )}
    </div>
  );
};
