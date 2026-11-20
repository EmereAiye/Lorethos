import { supabase, isSupabaseConfigured } from './supabase';
import type { SupabaseProfile, WriterRole, WriterStory } from '../types';

export interface SupabaseAuthProfileState {
  configured: boolean;
  userId: string | null;
  email: string | null;
  profile: (SupabaseProfile & { name?: string | null; nickname?: string | null; avatar_url?: string | null; bio?: string | null }) | null;
}

export function normalizeWriterRole(rawRole: unknown): WriterRole {
  const val = typeof rawRole === 'string' ? rawRole.trim().toLowerCase() : '';
  if (val === 'writer') return 'writer';
  if (val === 'admin' || val === 'owner') return 'admin';
  return 'reader';
}

export function canAccessWriterStudio(role: WriterRole | null | undefined): boolean {
  return role === 'writer' || role === 'admin';
}

/**
 * Ensures trailer summaries / blurbs cleanly invite the listener or reader
 * to read the full story on Lorethos if not already included.
 */
export function formatTrailerSummaryWithLorethosCta(summary: string, title?: string): string {
  const trimmed = summary.trim();
  if (!trimmed) return '';
  if (/\blorethos\b/i.test(trimmed)) {
    return trimmed;
  }
  const cleanBase = /[.!?]$/.test(trimmed) ? trimmed : `${trimmed}.`;
  const cleanTitle = title?.trim();
  return cleanTitle
    ? `${cleanBase} Read the full story, ${cleanTitle}, on Lorethos.`
    : `${cleanBase} Read the full story on Lorethos.`;
}

export async function ensureSupabaseReaderProfile(
  userId: string,
  username: string,
  email?: string | null
): Promise<SupabaseProfile | null> {
  if (!isSupabaseConfigured || !supabase || !userId) return null;

  try {
    const { data: existing, error: selectErr } = await supabase
      .from('profiles')
      .select('id, username, role')
      .eq('id', userId)
      .maybeSingle();

    if (!selectErr && existing) {
      return {
        id: existing.id,
        username: existing.username || username || 'Lorethos Reader',
        role: normalizeWriterRole(existing.role),
      };
    }

    const cleanUsername = username.trim() || email?.split('@')[0] || 'Lorethos Reader';
    const { data: inserted, error: insertErr } = await supabase
      .from('profiles')
      .insert({
        id: userId,
        username: cleanUsername,
        ...(email ? { email } : {}),
        role: 'reader',
      })
      .select('id, username, role')
      .single();

    if (insertErr) {
      // Retry select in case trigger already inserted the row concurrently
      const { data: fallback } = await supabase
        .from('profiles')
        .select('id, username, role')
        .eq('id', userId)
        .maybeSingle();
      if (fallback) {
        return {
          id: fallback.id,
          username: fallback.username || cleanUsername,
          role: normalizeWriterRole(fallback.role),
        };
      }
      return null;
    }

    return {
      id: inserted.id,
      username: inserted.username || cleanUsername,
      role: normalizeWriterRole(inserted.role),
    };
  } catch {
    return null;
  }
}

export async function getCurrentSupabaseAuthAndProfile(): Promise<SupabaseAuthProfileState> {
  if (!isSupabaseConfigured || !supabase) {
    return {
      configured: false,
      userId: null,
      email: null,
      profile: null,
    };
  }

  try {
    const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
    if (sessionError || !sessionData.session?.user) {
      return {
        configured: true,
        userId: null,
        email: null,
        profile: null,
      };
    }

    const authUser = sessionData.session.user;
    let profileRow: Record<string, unknown> | null = null;

    const fullQuery = await supabase
      .from('profiles')
      .select('id, username, name, nickname, avatar_url, bio, role')
      .eq('id', authUser.id)
      .maybeSingle();

    if (!fullQuery.error && fullQuery.data) {
      profileRow = fullQuery.data as Record<string, unknown>;
    } else {
      const basicQuery = await supabase
        .from('profiles')
        .select('id, username, role')
        .eq('id', authUser.id)
        .maybeSingle();
      if (!basicQuery.error && basicQuery.data) {
        profileRow = basicQuery.data as Record<string, unknown>;
      }
    }

    if (!profileRow) {
      return {
        configured: true,
        userId: authUser.id,
        email: authUser.email || null,
        profile: null,
      };
    }

    const rowUsername = typeof profileRow.username === 'string' ? profileRow.username : '';
    return {
      configured: true,
      userId: authUser.id,
      email: authUser.email || null,
      profile: {
        id: String(profileRow.id),
        username:
          rowUsername ||
          (typeof authUser.user_metadata?.username === 'string' && authUser.user_metadata.username) ||
          authUser.email?.split('@')[0] ||
          'Writer',
        name: typeof profileRow.name === 'string' ? profileRow.name : null,
        nickname: typeof profileRow.nickname === 'string' ? profileRow.nickname : null,
        avatar_url: typeof profileRow.avatar_url === 'string' ? profileRow.avatar_url : null,
        bio: typeof profileRow.bio === 'string' ? profileRow.bio : null,
        role: normalizeWriterRole(profileRow.role),
      },
    };
  } catch {
    return {
      configured: true,
      userId: null,
      email: null,
      profile: null,
    };
  }
}

export async function updateSupabaseUserProfile(
  userId: string,
  patch: {
    name?: string;
    nickname?: string | null;
    avatar?: string | null;
    bio?: string | null;
  }
): Promise<{ ok: boolean; error?: string }> {
  if (!isSupabaseConfigured || !supabase || !userId) {
    return { ok: false };
  }

  try {
    const derivedUsername =
      (patch.nickname && patch.nickname.trim()) ||
      (patch.name && patch.name.trim()) ||
      undefined;

    const fullPayload: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };
    if (patch.name !== undefined) fullPayload.name = patch.name.trim();
    if (patch.nickname !== undefined) fullPayload.nickname = patch.nickname;
    if (derivedUsername !== undefined) fullPayload.username = derivedUsername;
    if (patch.avatar !== undefined) fullPayload.avatar_url = patch.avatar;
    if (patch.bio !== undefined) fullPayload.bio = patch.bio;

    const { error } = await supabase
      .from('profiles')
      .update(fullPayload)
      .eq('id', userId);

    if (!error) return { ok: true };

    // Fallback in case avatar_url / bio columns haven't been added to older schema
    const minimalPayload: Record<string, unknown> = {};
    if (patch.name !== undefined) minimalPayload.name = patch.name.trim();
    if (patch.nickname !== undefined) minimalPayload.nickname = patch.nickname;
    if (derivedUsername !== undefined) minimalPayload.username = derivedUsername;

    if (Object.keys(minimalPayload).length > 0) {
      const { error: fallbackError } = await supabase
        .from('profiles')
        .update(minimalPayload)
        .eq('id', userId);
      if (fallbackError) {
        return { ok: false, error: fallbackError.message };
      }
    }
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Unable to sync profile.' };
  }
}

interface RawStoryRow {
  id: string;
  author_id: string;
  title: string;
  summary: string;
  body: string;
  audio_url: string | null;
  status: string;
  likes_count?: number | null;
  created_at: string;
  profiles?: { username?: string | null } | Array<{ username?: string | null }> | null;
}

async function resolveStoriesWithAuthorUsernames(rows: RawStoryRow[]): Promise<WriterStory[]> {
  if (!supabase || rows.length === 0) return [];

  const missingAuthorIds = new Set<string>();
  for (const row of rows) {
    const joined = Array.isArray(row.profiles) ? row.profiles[0] : row.profiles;
    if (!joined?.username && row.author_id) {
      missingAuthorIds.add(row.author_id);
    }
  }

  const authorMap = new Map<string, string>();
  if (missingAuthorIds.size > 0) {
    const { data: profileRows } = await supabase
      .from('profiles')
      .select('id, username')
      .in('id', Array.from(missingAuthorIds));
    if (Array.isArray(profileRows)) {
      for (const p of profileRows) {
        if (p.id && p.username) {
          authorMap.set(p.id, p.username);
        }
      }
    }
  }

  return rows.map((row) => {
    const joined = Array.isArray(row.profiles) ? row.profiles[0] : row.profiles;
    const authorUsername =
      joined?.username || authorMap.get(row.author_id) || 'Lorethos Writer';

    return {
      id: row.id,
      author_id: row.author_id,
      author_username: authorUsername,
      title: row.title || 'Untitled Story',
      summary: row.summary || '',
      body: row.body || '',
      audio_url: row.audio_url || null,
      status: row.status === 'draft' ? 'draft' : 'published',
      likes_count: typeof row.likes_count === 'number' ? Math.max(0, row.likes_count) : 0,
      created_at: row.created_at,
    };
  });
}

export async function fetchPublishedWriterStories(): Promise<{
  stories: WriterStory[];
  error?: string;
}> {
  if (!isSupabaseConfigured || !supabase) {
    return { stories: [] };
  }

  try {
    const { data, error } = await supabase
      .from('stories')
      .select('id, author_id, title, summary, body, audio_url, status, likes_count, created_at, profiles(username)')
      .eq('status', 'published')
      .order('created_at', { ascending: false });

    if (error) {
      // Retry without FK join in case foreign key alias isn't configured yet
      const fallbackRes = await supabase
        .from('stories')
        .select('id, author_id, title, summary, body, audio_url, status, likes_count, created_at')
        .eq('status', 'published')
        .order('created_at', { ascending: false });

      if (fallbackRes.error) {
        return { stories: [], error: fallbackRes.error.message };
      }
      const mapped = await resolveStoriesWithAuthorUsernames((fallbackRes.data || []) as RawStoryRow[]);
      return { stories: mapped };
    }

    const mapped = await resolveStoriesWithAuthorUsernames((data || []) as RawStoryRow[]);
    return { stories: mapped };
  } catch (err) {
    return {
      stories: [],
      error: err instanceof Error ? err.message : 'Unable to fetch published stories.',
    };
  }
}

export async function fetchManageableWriterStories(
  authorId: string,
  isAdmin: boolean
): Promise<{ stories: WriterStory[]; error?: string }> {
  if (!isSupabaseConfigured || !supabase) {
    return { stories: [], error: 'Supabase is not configured.' };
  }

  try {
    let query = supabase
      .from('stories')
      .select('id, author_id, title, summary, body, audio_url, status, likes_count, created_at, profiles(username)')
      .order('created_at', { ascending: false });

    if (!isAdmin) {
      query = query.eq('author_id', authorId);
    }

    const { data, error } = await query;
    if (error) {
      let fallbackQuery = supabase
        .from('stories')
        .select('id, author_id, title, summary, body, audio_url, status, likes_count, created_at')
        .order('created_at', { ascending: false });
      if (!isAdmin) {
        fallbackQuery = fallbackQuery.eq('author_id', authorId);
      }
      const fallbackRes = await fallbackQuery;
      if (fallbackRes.error) {
        return { stories: [], error: fallbackRes.error.message };
      }
      const mapped = await resolveStoriesWithAuthorUsernames((fallbackRes.data || []) as RawStoryRow[]);
      return { stories: mapped };
    }

    const mapped = await resolveStoriesWithAuthorUsernames((data || []) as RawStoryRow[]);
    return { stories: mapped };
  } catch (err) {
    return {
      stories: [],
      error: err instanceof Error ? err.message : 'Unable to fetch submitted stories.',
    };
  }
}

export async function uploadTrailerAudioToBucket(
  file: File,
  userId: string
): Promise<{ audioUrl?: string; error?: string }> {
  if (!isSupabaseConfigured || !supabase) {
    return { error: 'Supabase is not configured.' };
  }
  if (!file.type.startsWith('audio/')) {
    return { error: 'Please select a valid audio file (MP3, WAV, M4A, OGG, or AAC).' };
  }
  const maxBytes = 25 * 1024 * 1024;
  if (file.size > maxBytes) {
    return { error: 'Trailer audio must be 25 MB or smaller.' };
  }

  const ext = (file.name.split('.').pop() || 'mp3').toLowerCase().replace(/[^a-z0-9]/g, '') || 'mp3';
  const safePath = `${userId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;

  const { error: uploadError } = await supabase.storage
    .from('trailers')
    .upload(safePath, file, {
      contentType: file.type || 'audio/mpeg',
      upsert: false,
    });

  if (uploadError) {
    return { error: uploadError.message };
  }

  const { data: publicUrlData } = supabase.storage.from('trailers').getPublicUrl(safePath);
  return { audioUrl: publicUrlData.publicUrl };
}

export async function createWriterStory(input: {
  authorId: string;
  title: string;
  summary: string;
  body: string;
  audioUrl?: string | null;
}): Promise<{ story?: WriterStory; error?: string }> {
  if (!isSupabaseConfigured || !supabase) {
    return { error: 'Supabase is not configured.' };
  }

  const formattedSummary = formatTrailerSummaryWithLorethosCta(input.summary, input.title);
  const { data, error } = await supabase
    .from('stories')
    .insert({
      author_id: input.authorId,
      title: input.title.trim(),
      summary: formattedSummary,
      body: input.body.trim(),
      audio_url: input.audioUrl || null,
      status: 'published',
    })
    .select('id, author_id, title, summary, body, audio_url, status, likes_count, created_at')
    .single();

  if (error || !data) {
    return { error: error?.message || 'Failed to publish story.' };
  }

  const resolved = await resolveStoriesWithAuthorUsernames([data as RawStoryRow]);
  return { story: resolved[0] };
}

export async function updateWriterStory(
  storyId: string,
  input: {
    title: string;
    summary: string;
    body: string;
    audioUrl?: string | null;
  }
): Promise<{ story?: WriterStory; error?: string }> {
  if (!isSupabaseConfigured || !supabase) {
    return { error: 'Supabase is not configured.' };
  }

  const formattedSummary = formatTrailerSummaryWithLorethosCta(input.summary, input.title);
  const { data, error } = await supabase
    .from('stories')
    .update({
      title: input.title.trim(),
      summary: formattedSummary,
      body: input.body.trim(),
      audio_url: input.audioUrl ?? null,
    })
    .eq('id', storyId)
    .select('id, author_id, title, summary, body, audio_url, status, likes_count, created_at')
    .single();

  if (error || !data) {
    return { error: error?.message || 'Failed to update story.' };
  }

  const resolved = await resolveStoriesWithAuthorUsernames([data as RawStoryRow]);
  return { story: resolved[0] };
}

export async function deleteWriterStory(storyId: string): Promise<{ error?: string }> {
  if (!isSupabaseConfigured || !supabase) {
    return { error: 'Supabase is not configured.' };
  }

  const { error } = await supabase.from('stories').delete().eq('id', storyId);
  if (error) {
    return { error: error.message };
  }
  return {};
}
