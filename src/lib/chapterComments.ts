import { supabase, isSupabaseConfigured } from './supabase';
import type { ChapterComment, CommentTag } from '../types';

interface RawCommentRow {
  id: string;
  story_id: string;
  chapter_id: string;
  chapter_number?: number | null;
  user_id?: string | null;
  author_name?: string | null;
  tag?: string | null;
  body: string;
  created_at: string;
}

function formatCommentDate(iso: string): string {
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return 'Just now';
    return d.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  } catch {
    return 'Just now';
  }
}

function normalizeTag(raw: unknown): CommentTag {
  if (raw === 'Lore' || raw === 'Theory' || raw === 'Reaction') {
    return raw;
  }
  return 'Reaction';
}

function mapRawComment(row: RawCommentRow): ChapterComment {
  return {
    id: row.id,
    storyId: row.story_id,
    chapterId: row.chapter_id,
    chapterNumber: typeof row.chapter_number === 'number' ? row.chapter_number : undefined,
    userId: row.user_id || undefined,
    authorName: row.author_name?.trim() || 'Lorethos Reader',
    tag: normalizeTag(row.tag),
    body: row.body,
    createdAt: formatCommentDate(row.created_at),
  };
}

export async function fetchCommentsFromSupabase(
  storyId: string,
  chapterId?: string
): Promise<{ comments: ChapterComment[]; error?: string }> {
  if (!isSupabaseConfigured || !supabase || !storyId) {
    return { comments: [] };
  }

  try {
    let query = supabase
      .from('comments')
      .select('id, story_id, chapter_id, chapter_number, user_id, author_name, tag, body, created_at')
      .eq('story_id', storyId)
      .order('created_at', { ascending: false });

    if (chapterId && chapterId !== 'all') {
      query = query.eq('chapter_id', chapterId);
    }

    const { data, error } = await query;
    if (error) {
      return { comments: [], error: error.message };
    }

    const mapped = Array.isArray(data) ? (data as RawCommentRow[]).map(mapRawComment) : [];
    return { comments: mapped };
  } catch (err) {
    return {
      comments: [],
      error: err instanceof Error ? err.message : 'Unable to load chapter comments.',
    };
  }
}

export async function createCommentInSupabase(input: {
  storyId: string;
  chapterId: string;
  chapterNumber: number;
  authorName: string;
  tag: CommentTag;
  body: string;
}): Promise<{ comment?: ChapterComment; requiresAuth?: boolean; error?: string }> {
  if (!isSupabaseConfigured || !supabase) {
    return { error: 'Supabase comments are unavailable.' };
  }

  const trimmed = input.body.trim();
  if (trimmed.length < 2 || trimmed.length > 1000) {
    return { error: 'Feedback must be between 2 and 1,000 characters.' };
  }

  try {
    const { data: sessionData } = await supabase.auth.getSession();
    let authUserId = sessionData.session?.user?.id || null;
    if (!authUserId) {
      const { data: userData } = await supabase.auth.getUser();
      authUserId = userData.user?.id || null;
    }

    if (!authUserId) {
      return {
        requiresAuth: true,
        error: 'Please log in to post chapter feedback.',
      };
    }

    const { data, error } = await supabase
      .from('comments')
      .insert({
        story_id: input.storyId,
        chapter_id: input.chapterId,
        chapter_number: input.chapterNumber,
        user_id: authUserId,
        author_name: input.authorName.trim() || 'Lorethos Reader',
        tag: normalizeTag(input.tag),
        body: trimmed,
      })
      .select('id, story_id, chapter_id, chapter_number, user_id, author_name, tag, body, created_at')
      .single();

    if (error || !data) {
      return { error: error?.message || 'Could not save your feedback.' };
    }

    return { comment: mapRawComment(data as RawCommentRow) };
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : 'Unable to post feedback.',
    };
  }
}

export async function deleteCommentInSupabase(commentId: string): Promise<{ error?: string }> {
  if (!isSupabaseConfigured || !supabase) {
    return { error: 'Supabase comments are unavailable.' };
  }

  try {
    const { error } = await supabase.from('comments').delete().eq('id', commentId);
    if (error) {
      return { error: error.message };
    }
    return {};
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : 'Unable to delete comment.',
    };
  }
}
