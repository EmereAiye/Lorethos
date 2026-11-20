import { supabase, isSupabaseConfigured } from './supabase';
import { apiFetch, parseJsonSafe } from './apiClient';

export interface StoryLikesState {
  counts: Record<string, number>;
  likedStoryIds: Set<string>;
}

const LIKES_EVENT = 'lorethos-likes-changed';
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function emitLikesChanged(detail: {
  storyId: string;
  liked: boolean;
  count: number;
}): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(LIKES_EVENT, { detail }));
}

export function subscribeLikesChanged(
  handler: (detail: { storyId: string; liked: boolean; count: number }) => void
): () => void {
  if (typeof window === 'undefined') return () => {};
  const listener = (e: Event) => {
    const custom = e as CustomEvent<{ storyId: string; liked: boolean; count: number }>;
    if (custom.detail) handler(custom.detail);
  };
  window.addEventListener(LIKES_EVENT, listener);
  return () => window.removeEventListener(LIKES_EVENT, listener);
}

async function getSignedInSupabaseUserId(): Promise<string | null> {
  if (!supabase) return null;
  const { data: sessionData } = await supabase.auth.getSession();
  if (sessionData.session?.user?.id) {
    return sessionData.session.user.id;
  }
  const { data: userData } = await supabase.auth.getUser();
  return userData.user?.id || null;
}

async function fetchStoryRowsLikesCounts(storyIds: string[]): Promise<Map<string, number>> {
  const result = new Map<string, number>();
  if (!supabase || storyIds.length === 0) return result;

  // Try querying all storyIds first (works when stories.id is text OR uuid if all are UUIDs)
  const { data: storyRows, error } = await supabase
    .from('stories')
    .select('id, likes_count')
    .in('id', storyIds);

  if (!error && Array.isArray(storyRows)) {
    for (const row of storyRows) {
      if (!row.id) continue;
      result.set(
        String(row.id),
        typeof row.likes_count === 'number' ? Math.max(0, row.likes_count) : 0
      );
    }
    return result;
  }

  // If stories.id is uuid and non-UUID catalog IDs caused 22P02, retry with UUID IDs only
  if (error?.code === '22P02') {
    const uuidStoryIds = storyIds.filter((id) => UUID_PATTERN.test(id));
    if (uuidStoryIds.length > 0) {
      const { data: uuidRows } = await supabase
        .from('stories')
        .select('id, likes_count')
        .in('id', uuidStoryIds);

      if (Array.isArray(uuidRows)) {
        for (const row of uuidRows) {
          if (!row.id) continue;
          result.set(
            String(row.id),
            typeof row.likes_count === 'number' ? Math.max(0, row.likes_count) : 0
          );
        }
      }
    }
  }

  return result;
}

export async function fetchLikesForStories(
  storyIds: string[]
): Promise<{ state: StoryLikesState; currentUserId: string | null; error?: string }> {
  const counts: Record<string, number> = {};
  const likedStoryIds = new Set<string>();

  if (storyIds.length === 0) {
    return { state: { counts, likedStoryIds }, currentUserId: null };
  }

  // Fallback to Express backend API when Supabase env vars are not configured
  if (!isSupabaseConfigured || !supabase) {
    try {
      const qs = encodeURIComponent(storyIds.join(','));
      const res = await apiFetch(`/api/stories/likes?storyIds=${qs}`);
      const data = await parseJsonSafe<{
        counts?: Record<string, number>;
        likedStoryIds?: string[];
      }>(res);
      if (res.ok && data) {
        if (data.counts && typeof data.counts === 'object') {
          for (const [k, v] of Object.entries(data.counts)) {
            counts[k] = typeof v === 'number' ? Math.max(0, v) : 0;
          }
        }
        if (Array.isArray(data.likedStoryIds)) {
          for (const id of data.likedStoryIds) {
            likedStoryIds.add(id);
          }
        }
      }
    } catch {
      // Ignore fallback fetch errors cleanly
    }
    return { state: { counts, likedStoryIds }, currentUserId: null };
  }

  try {
    const currentUserId = await getSignedInSupabaseUserId();

    // 1. Read trigger-maintained likes_count from `stories` (supports both text & uuid stories.id)
    const storiesCountMap = await fetchStoryRowsLikesCounts(storyIds);
    for (const [id, count] of storiesCountMap.entries()) {
      counts[id] = count;
    }

    // 2. Check which stories the signed-in user has liked in `story_likes`
    if (currentUserId) {
      const { data: userLikes } = await supabase
        .from('story_likes')
        .select('story_id')
        .eq('user_id', currentUserId)
        .in('story_id', storyIds);

      if (Array.isArray(userLikes)) {
        for (const row of userLikes) {
          if (row.story_id) {
            likedStoryIds.add(String(row.story_id));
          }
        }
      }
    }

    // 3. For stories not stored in the `stories` table (e.g. built-in catalog slugs/IDs),
    // compute counts from `story_likes` rows
    const missingCountIds = storyIds.filter((id) => !storiesCountMap.has(id));
    if (missingCountIds.length > 0) {
      const { data: likeRows } = await supabase
        .from('story_likes')
        .select('story_id')
        .in('story_id', missingCountIds);

      if (Array.isArray(likeRows)) {
        for (const row of likeRows) {
          if (!row.story_id) continue;
          const sid = String(row.story_id);
          counts[sid] = (counts[sid] || 0) + 1;
        }
      }
    }

    return { state: { counts, likedStoryIds }, currentUserId };
  } catch (err) {
    return {
      state: { counts, likedStoryIds },
      currentUserId: null,
      error: err instanceof Error ? err.message : 'Unable to fetch story likes.',
    };
  }
}

export async function toggleStoryLikeInSupabase(
  storyId: string,
  currentlyLiked: boolean,
  currentCount: number
): Promise<{
  liked: boolean;
  count: number;
  requiresAuth?: boolean;
  error?: string;
}> {
  // Fallback to Express backend API when Supabase env vars are not configured
  if (!isSupabaseConfigured || !supabase) {
    try {
      const res = await apiFetch(`/api/stories/${encodeURIComponent(storyId)}/like`, {
        method: 'POST',
      });
      const data = await parseJsonSafe<{
        liked?: boolean;
        count?: number;
        error?: string;
      }>(res);
      if (res.status === 401) {
        return {
          liked: currentlyLiked,
          count: currentCount,
          requiresAuth: true,
          error: 'Please log in to like stories.',
        };
      }
      if (!res.ok || !data) {
        return {
          liked: currentlyLiked,
          count: currentCount,
          error: data?.error || 'Unable to update story like.',
        };
      }
      return {
        liked: Boolean(data.liked),
        count: typeof data.count === 'number' ? Math.max(0, data.count) : currentCount,
      };
    } catch {
      return {
        liked: currentlyLiked,
        count: currentCount,
        error: 'Network error while updating like.',
      };
    }
  }

  try {
    const userId = await getSignedInSupabaseUserId();
    if (!userId) {
      return {
        liked: currentlyLiked,
        count: currentCount,
        requiresAuth: true,
        error: 'Please log in to like stories.',
      };
    }

    let nextLiked = currentlyLiked;

    if (currentlyLiked) {
      const { error } = await supabase
        .from('story_likes')
        .delete()
        .eq('story_id', storyId)
        .eq('user_id', userId);

      if (error) {
        return { liked: currentlyLiked, count: currentCount, error: error.message };
      }
      nextLiked = false;
    } else {
      const { error } = await supabase
        .from('story_likes')
        .insert({ story_id: storyId, user_id: userId });

      if (error) {
        if (error.code === '23505') {
          nextLiked = true;
        } else {
          return { liked: currentlyLiked, count: currentCount, error: error.message };
        }
      } else {
        nextLiked = true;
      }
    }

    // Read the trigger-updated likes_count from `stories` when the story row exists
    const { data: updatedStory, error: storyLookupError } = await supabase
      .from('stories')
      .select('likes_count')
      .eq('id', storyId)
      .maybeSingle();

    if (!storyLookupError && updatedStory && typeof updatedStory.likes_count === 'number') {
      return {
        liked: nextLiked,
        count: Math.max(0, updatedStory.likes_count),
      };
    }

    // Fallback for built-in catalog stories not in `stories` table: query exact count from `story_likes`
    const { count: exactCount, error: countErr } = await supabase
      .from('story_likes')
      .select('story_id', { count: 'exact', head: true })
      .eq('story_id', storyId);

    if (!countErr && typeof exactCount === 'number') {
      return {
        liked: nextLiked,
        count: Math.max(0, exactCount),
      };
    }

    const fallbackCount =
      nextLiked === currentlyLiked
        ? currentCount
        : Math.max(0, currentCount + (nextLiked ? 1 : -1));

    return {
      liked: nextLiked,
      count: fallbackCount,
    };
  } catch (err) {
    return {
      liked: currentlyLiked,
      count: currentCount,
      error: err instanceof Error ? err.message : 'Unable to update like.',
    };
  }
}
