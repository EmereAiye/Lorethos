import { supabase, isSupabaseConfigured } from './supabase';
import { dataUrlToBlob, normalizePortableAvatarUrl } from '../utils/avatarImage';
import type { AdminUserDirectoryEntry, SupabaseProfile, WriterRole, WriterStory } from '../types';

export interface SupabaseAuthProfileState {
  configured: boolean;
  userId: string | null;
  email: string | null;
  profile: (SupabaseProfile & { name?: string | null; nickname?: string | null; avatar_url?: string | null; bio?: string | null }) | null;
}

export const OWNER_EMAIL_FALLBACK = 'emmymasterwise@gmail.com';

export function isOwnerEmail(email: string | null | undefined): boolean {
  return typeof email === 'string' && email.trim().toLowerCase() === OWNER_EMAIL_FALLBACK;
}

export function normalizeWriterRole(rawRole: unknown, email?: string | null): WriterRole {
  if (isOwnerEmail(email)) return 'owner';
  const val = typeof rawRole === 'string' ? rawRole.trim().toLowerCase() : '';
  if (val === 'writer') return 'writer';
  if (val === 'owner') return 'owner';
  if (val === 'admin') return 'admin';
  return 'reader';
}

export function canAccessWriterStudio(role: string | WriterRole | null | undefined): boolean {
  const val = typeof role === 'string' ? role.trim().toLowerCase() : '';
  return val === 'writer' || val === 'owner' || val === 'admin';
}

export function isWriterStudioAdmin(role: string | WriterRole | null | undefined): boolean {
  const val = typeof role === 'string' ? role.trim().toLowerCase() : '';
  return val === 'owner' || val === 'admin';
}

export interface SupabaseRoleLookupResult {
  role: WriterRole;
  userRow: Record<string, unknown> | null;
  source: 'users' | 'profiles' | 'none';
}

/**
 * Merges Express session role with live Supabase role without letting stale local/cached `'reader'`
 * values hide an upgraded `'writer'`, `'admin'`, or `'owner'` role.
 */
export function resolveMergedUserRole(
  expressRoleRaw: string | WriterRole | null | undefined,
  sbLookup?: SupabaseRoleLookupResult | null,
  email?: string | null
): WriterRole {
  if (isOwnerEmail(email)) return 'owner';
  const expressRole = normalizeWriterRole(expressRoleRaw);
  const sbRole = sbLookup ? normalizeWriterRole(sbLookup.role) : 'reader';
  const sbSource = sbLookup?.source ?? 'none';

  if (expressRole === 'owner' || sbRole === 'owner') return 'owner';
  if (sbSource === 'users' && sbRole !== 'reader') return sbRole;
  if (expressRole !== 'reader') return expressRole;
  if (sbSource === 'profiles' && sbRole !== 'reader') return sbRole;
  return 'reader';
}

async function querySupabaseTableRow(
  table: 'users' | 'profiles',
  userId?: string | null,
  email?: string | null
): Promise<Record<string, unknown> | null> {
  if (!isSupabaseConfigured || !supabase) return null;

  const columnVariants =
    table === 'users'
      ? [
          'id, role, email, username, name, nickname, avatar_url, bio',
          'id, role, email, username, name, nickname, avatar, bio',
          'id, role, email',
          'id, role',
        ]
      : [
          'id, username, name, nickname, avatar_url, bio, role, email',
          'id, username, name, nickname, avatar_url, bio, role',
          'id, username, avatar_url, role',
          'id, username, avatar, role',
          'id, username, role',
        ];

  if (userId) {
    for (const cols of columnVariants) {
      try {
        const res = await supabase.from(table).select(cols).eq('id', userId).maybeSingle();
        if (!res.error) {
          if (res.data) return res.data as unknown as Record<string, unknown>;
          break;
        }
      } catch {
        // Try next column set or email lookup
      }
    }
  }

  const cleanEmail = email?.trim().toLowerCase();
  if (cleanEmail) {
    for (const cols of columnVariants) {
      if (!cols.includes('email')) continue;
      try {
        const res = await supabase.from(table).select(cols).ilike('email', cleanEmail).maybeSingle();
        if (!res.error) {
          if (res.data) return res.data as unknown as Record<string, unknown>;
          break;
        }
      } catch {
        // Try next fallback
      }
    }
  }

  return null;
}

/**
 * Fetches the user's latest role directly from `public.users` in Supabase
 * (never relying on localStorage), falling back to `public.profiles` only if needed.
 */
export async function fetchLatestSupabaseUserRole(
  userId?: string | null,
  email?: string | null
): Promise<SupabaseRoleLookupResult> {
  if (!isSupabaseConfigured || !supabase || (!userId && !email?.trim())) {
    return { role: 'reader', userRow: null, source: 'none' };
  }

  const usersRow = await querySupabaseTableRow('users', userId, email);
  if (usersRow) {
    return {
      role: normalizeWriterRole(usersRow.role),
      userRow: usersRow,
      source: 'users',
    };
  }

  const profilesRow = await querySupabaseTableRow('profiles', userId, email);
  if (profilesRow) {
    return {
      role: normalizeWriterRole(profilesRow.role),
      userRow: profilesRow,
      source: 'profiles',
    };
  }

  return { role: 'reader', userRow: null, source: 'none' };
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
    const liveRole = await fetchLatestSupabaseUserRole(userId, email);
    const { data: existing, error: selectErr } = await supabase
      .from('profiles')
      .select('id, username, role')
      .eq('id', userId)
      .maybeSingle();

    if (!selectErr && existing) {
      return {
        id: existing.id,
        username: existing.username || username || 'Lorethos Reader',
        role: liveRole.source === 'users' ? liveRole.role : normalizeWriterRole(existing.role),
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
      const { data: fallback } = await supabase
        .from('profiles')
        .select('id, username, role')
        .eq('id', userId)
        .maybeSingle();
      if (fallback || liveRole.source !== 'none') {
        return {
          id: fallback?.id || userId,
          username: fallback?.username || cleanUsername,
          role:
            liveRole.source !== 'none'
              ? liveRole.role
              : normalizeWriterRole(fallback?.role),
        };
      }
      return null;
    }

    return {
      id: inserted.id,
      username: inserted.username || cleanUsername,
      role: liveRole.source === 'users' ? liveRole.role : normalizeWriterRole(inserted.role),
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
    const [latestRole, profileRow] = await Promise.all([
      fetchLatestSupabaseUserRole(authUser.id, authUser.email),
      querySupabaseTableRow('profiles', authUser.id, authUser.email),
    ]);

    const userRow = latestRole.userRow;
    const rowUsername =
      (profileRow && typeof profileRow.username === 'string' && profileRow.username) ||
      (userRow && typeof userRow.username === 'string' && userRow.username) ||
      (typeof authUser.user_metadata?.username === 'string' && authUser.user_metadata.username) ||
      authUser.email?.split('@')[0] ||
      'Writer';

    const resolvedRole =
      latestRole.source !== 'none'
        ? latestRole.role
        : profileRow
        ? normalizeWriterRole(profileRow.role)
        : 'reader';

    const rawAvatar =
      (profileRow && typeof profileRow.avatar_url === 'string' && profileRow.avatar_url) ||
      (profileRow && typeof profileRow.avatar === 'string' && profileRow.avatar) ||
      (userRow && typeof userRow.avatar_url === 'string' && userRow.avatar_url) ||
      (userRow && typeof userRow.avatar === 'string' && userRow.avatar) ||
      (typeof authUser.user_metadata?.avatar_url === 'string' ? authUser.user_metadata.avatar_url : null);

    return {
      configured: true,
      userId: authUser.id,
      email: authUser.email || null,
      profile: {
        id: String(profileRow?.id || userRow?.id || authUser.id),
        username: rowUsername,
        name:
          (profileRow && typeof profileRow.name === 'string' ? profileRow.name : null) ||
          (userRow && typeof userRow.name === 'string' ? userRow.name : null) ||
          (typeof authUser.user_metadata?.full_name === 'string' ? authUser.user_metadata.full_name : null),
        nickname:
          (profileRow && typeof profileRow.nickname === 'string' ? profileRow.nickname : null) ||
          (userRow && typeof userRow.nickname === 'string' ? userRow.nickname : null) ||
          (typeof authUser.user_metadata?.nickname === 'string' ? authUser.user_metadata.nickname : null),
        avatar_url: normalizePortableAvatarUrl(rawAvatar) || null,
        bio:
          (profileRow && typeof profileRow.bio === 'string' ? profileRow.bio : null) ||
          (userRow && typeof userRow.bio === 'string' ? userRow.bio : null),
        role: resolvedRole,
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

/**
 * Attempts to upload a cropped gallery portrait Blob to Supabase Storage
 * (`avatars` bucket first, then `trailers/avatars/` fallback) so gallery photos
 * load via HTTPS across every phone and web deployment.
 */
export async function uploadProfileAvatarToSupabaseStorage(
  dataUrl: string,
  userId: string
): Promise<string | null> {
  if (!isSupabaseConfigured || !supabase || !userId) return null;
  const blob = dataUrlToBlob(dataUrl);
  if (!blob) return null;

  const ext = blob.type === 'image/png' ? 'png' : blob.type === 'image/webp' ? 'webp' : 'jpg';
  const fileName = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const candidates: Array<{ bucket: string; objectPath: string }> = [
    { bucket: 'avatars', objectPath: `${userId}/${fileName}` },
    { bucket: 'trailers', objectPath: `avatars/${userId}/${fileName}` },
  ];

  for (const candidate of candidates) {
    try {
      const { error } = await supabase.storage
        .from(candidate.bucket)
        .upload(candidate.objectPath, blob, {
          contentType: blob.type || 'image/jpeg',
          upsert: true,
        });
      if (!error) {
        const { data } = supabase.storage.from(candidate.bucket).getPublicUrl(candidate.objectPath);
        if (data?.publicUrl) {
          return data.publicUrl;
        }
      }
    } catch {
      // Try next storage bucket fallback
    }
  }

  return null;
}

export async function updateSupabaseUserProfile(
  userId: string,
  patch: {
    name?: string;
    nickname?: string | null;
    avatar?: string | null;
    bio?: string | null;
  },
  email?: string | null
): Promise<{ ok: boolean; error?: string }> {
  if (!isSupabaseConfigured || !supabase || !userId) {
    return { ok: false };
  }

  try {
    const derivedUsername =
      (patch.nickname && patch.nickname.trim()) ||
      (patch.name && patch.name.trim()) ||
      undefined;

    const normalizedAvatar =
      patch.avatar === null
        ? null
        : patch.avatar !== undefined
        ? normalizePortableAvatarUrl(patch.avatar) ?? null
        : undefined;

    const fullPayload: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };
    if (patch.name !== undefined) fullPayload.name = patch.name.trim();
    if (patch.nickname !== undefined) fullPayload.nickname = patch.nickname;
    if (derivedUsername !== undefined) fullPayload.username = derivedUsername;
    if (normalizedAvatar !== undefined) fullPayload.avatar_url = normalizedAvatar;
    if (patch.bio !== undefined) fullPayload.bio = patch.bio;

    const cleanEmail = email?.trim().toLowerCase();
    const upsertRow: Record<string, unknown> = {
      id: userId,
      ...(cleanEmail ? { email: cleanEmail } : {}),
      ...fullPayload,
    };

    const { error: upsertErr } = await supabase
      .from('profiles')
      .upsert(upsertRow, { onConflict: 'id' });

    if (upsertErr) {
      const { error: updateErr } = await supabase
        .from('profiles')
        .update(fullPayload)
        .eq('id', userId);

      if (updateErr) {
        // Fallback in case avatar_url / bio / email columns haven't been added to older schema
        const minimalPayload: Record<string, unknown> = {};
        if (patch.name !== undefined) minimalPayload.name = patch.name.trim();
        if (patch.nickname !== undefined) minimalPayload.nickname = patch.nickname;
        if (derivedUsername !== undefined) minimalPayload.username = derivedUsername;
        if (normalizedAvatar !== undefined) minimalPayload.avatar_url = normalizedAvatar;

        if (Object.keys(minimalPayload).length > 0) {
          await supabase
            .from('profiles')
            .upsert({ id: userId, ...minimalPayload }, { onConflict: 'id' });
        }
      }
    }

    // Mirror profile updates into public.users as well if the schema holds profile columns there
    const userTablePatch: Record<string, unknown> = {};
    if (patch.name !== undefined) userTablePatch.name = patch.name.trim();
    if (patch.nickname !== undefined) userTablePatch.nickname = patch.nickname;
    if (derivedUsername !== undefined) userTablePatch.username = derivedUsername;
    if (normalizedAvatar !== undefined) userTablePatch.avatar_url = normalizedAvatar;
    if (patch.bio !== undefined) userTablePatch.bio = patch.bio;

    if (Object.keys(userTablePatch).length > 0) {
      const userRes = await supabase.from('users').update(userTablePatch).eq('id', userId);
      if (userRes.error && normalizedAvatar !== undefined) {
        await supabase
          .from('users')
          .update({ avatar_url: normalizedAvatar })
          .eq('id', userId)
          .then(() => undefined, () => undefined);
      }
      if (cleanEmail) {
        await supabase
          .from('users')
          .update({ avatar_url: normalizedAvatar })
          .ilike('email', cleanEmail)
          .then(() => undefined, () => undefined);
      }
    }

    // Keep short preset/HTTPS avatar URLs and nickname synced in Supabase Auth user_metadata
    // (never store large base64 data URLs inside JWT user_metadata to avoid token bloat)
    const authMetaPatch: Record<string, unknown> = {};
    if (patch.name !== undefined) authMetaPatch.full_name = patch.name.trim();
    if (patch.nickname !== undefined) authMetaPatch.nickname = patch.nickname;
    if (derivedUsername !== undefined) authMetaPatch.username = derivedUsername;
    if (
      normalizedAvatar === null ||
      (typeof normalizedAvatar === 'string' && !normalizedAvatar.startsWith('data:'))
    ) {
      authMetaPatch.avatar_url = normalizedAvatar;
    }
    if (Object.keys(authMetaPatch).length > 0) {
      await supabase.auth.updateUser({ data: authMetaPatch }).catch(() => undefined);
    }

    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Unable to sync profile.' };
  }
}

export async function fetchAllSupabaseProfilesForOwner(): Promise<{
  users: AdminUserDirectoryEntry[];
  error?: string;
}> {
  if (!isSupabaseConfigured || !supabase) {
    return { users: [] };
  }

  try {
    const [usersRes, profilesRes] = await Promise.all([
      supabase.from('users').select('*'),
      supabase.from('profiles').select('*'),
    ]);

    const merged = new Map<string, AdminUserDirectoryEntry>();
    const emailToKey = new Map<string, string>();

    const upsertRow = (row: Record<string, unknown>, source: 'users' | 'profiles') => {
      const id = typeof row.id === 'string' && row.id.trim() ? row.id.trim() : '';
      const rawEmail = typeof row.email === 'string' ? row.email.trim().toLowerCase() : '';
      if (!id && !rawEmail) return;

      const existingKey = (rawEmail && emailToKey.get(rawEmail)) || id || rawEmail;
      const existing = merged.get(existingKey);

      const rawName =
        (typeof row.name === 'string' && row.name.trim()) ||
        (typeof row.username === 'string' && row.username.trim()) ||
        (typeof row.nickname === 'string' && row.nickname.trim()) ||
        (rawEmail ? rawEmail.split('@')[0] : '') ||
        'Lorethos Reader';

      const rawNickname =
        typeof row.nickname === 'string' && row.nickname.trim()
          ? row.nickname.trim()
          : typeof row.username === 'string' && row.username.trim() && row.username.trim() !== rawName
          ? row.username.trim()
          : undefined;

      const rawAvatar =
        normalizePortableAvatarUrl(
          (typeof row.avatar_url === 'string' && row.avatar_url) ||
            (typeof row.avatar === 'string' && row.avatar) ||
            undefined
        ) || existing?.avatar;

      const rowRole = normalizeWriterRole(row.role);
      const resolvedRole: WriterRole =
        existing?.role === 'owner' || rowRole === 'owner'
          ? 'owner'
          : source === 'users' && row.role
          ? rowRole
          : existing?.role || rowRole;

      const createdAt =
        (typeof row.created_at === 'string' && row.created_at) ||
        existing?.createdAt ||
        new Date().toISOString();

      const entry: AdminUserDirectoryEntry = {
        id: existing?.id || id || rawEmail,
        name: existing?.name && source === 'profiles' ? existing.name : rawName,
        nickname: rawNickname || existing?.nickname,
        email: rawEmail || existing?.email || '',
        avatar: rawAvatar,
        bio: (typeof row.bio === 'string' && row.bio.trim()) || existing?.bio,
        role: resolvedRole,
        subscription: existing?.subscription || {
          status: 'none',
          plan: 'free',
          amountNgn: 0,
        },
        completedChaptersCount: existing?.completedChaptersCount ?? 0,
        bookshelvesCount: existing?.bookshelvesCount ?? 0,
        createdAt,
        source: existing ? 'merged' : 'supabase',
      };

      merged.set(existingKey, entry);
      if (rawEmail) emailToKey.set(rawEmail, existingKey);
    };

    if (!usersRes.error && Array.isArray(usersRes.data)) {
      for (const row of usersRes.data) {
        upsertRow(row as Record<string, unknown>, 'users');
      }
    }
    if (!profilesRes.error && Array.isArray(profilesRes.data)) {
      for (const row of profilesRes.data) {
        upsertRow(row as Record<string, unknown>, 'profiles');
      }
    }

    return { users: Array.from(merged.values()) };
  } catch (err) {
    return {
      users: [],
      error: err instanceof Error ? err.message : 'Unable to fetch Supabase profiles.',
    };
  }
}

export async function updateSupabaseUserRole(
  userId: string,
  email: string | undefined,
  role: WriterRole
): Promise<{ ok: boolean; error?: string }> {
  if (!isSupabaseConfigured || !supabase) {
    return { ok: false };
  }

  let updatedAny = false;
  let lastError: string | undefined;
  const cleanEmail = email?.trim().toLowerCase();

  if (userId) {
    try {
      const res = await supabase.from('users').update({ role }).eq('id', userId).select('id');
      if (!res.error && Array.isArray(res.data) && res.data.length > 0) {
        updatedAny = true;
      } else if (res.error) {
        lastError = res.error.message;
      }
    } catch {
      // Fall through to email update
    }
  }

  if (cleanEmail) {
    try {
      const res = await supabase.from('users').update({ role }).ilike('email', cleanEmail).select('id');
      if (!res.error && Array.isArray(res.data) && res.data.length > 0) {
        updatedAny = true;
      } else if (res.error && !lastError) {
        lastError = res.error.message;
      }
    } catch {
      // Ignore fallback error
    }
  }

  if (userId) {
    try {
      const res = await supabase.from('profiles').update({ role }).eq('id', userId).select('id');
      if (!res.error && Array.isArray(res.data) && res.data.length > 0) {
        updatedAny = true;
      } else if (res.error && !lastError) {
        lastError = res.error.message;
      }
    } catch {
      // Ignore profiles update error
    }
  }

  if (cleanEmail) {
    try {
      const res = await supabase.from('profiles').update({ role }).ilike('email', cleanEmail).select('id');
      if (!res.error && Array.isArray(res.data) && res.data.length > 0) {
        updatedAny = true;
      }
    } catch {
      // Ignore email update fallback
    }
  }

  return updatedAny ? { ok: true } : { ok: false, error: lastError };
}

type RawStoryRow = Record<string, unknown>;

const WRITER_PORTAL_VISITED_PREFIX = 'lorethos_writer_portal_visited_';

export function markWriterPortalVisited(userId: string): void {
  if (typeof window === 'undefined' || !userId) return;
  try {
    window.localStorage.setItem(`${WRITER_PORTAL_VISITED_PREFIX}${userId}`, new Date().toISOString());
  } catch {
    // Ignore storage errors
  }
}

export function hasVisitedWriterPortal(userId: string): boolean {
  if (typeof window === 'undefined' || !userId) return false;
  try {
    return Boolean(window.localStorage.getItem(`${WRITER_PORTAL_VISITED_PREFIX}${userId}`));
  } catch {
    return false;
  }
}

export function extractRawAuthorId(row: RawStoryRow): string {
  const candidates = [row.author_id, row.user_id, row.writer_id, row.created_by, row.owner_id];
  for (const val of candidates) {
    if (typeof val === 'string' && val.trim()) {
      return val.trim();
    }
  }
  return '';
}

function isMissingColumnOrSchemaError(error: { code?: string; message?: string } | null | undefined): boolean {
  if (!error) return false;
  if (error.code === '42703' || error.code === 'PGRST204' || error.code === 'PGRST200') return true;
  const msg = (error.message || '').toLowerCase();
  return (
    msg.includes('does not exist') ||
    msg.includes('schema cache') ||
    msg.includes('could not find')
  );
}

export function mapRawStoryRowToWriterStory(
  row: RawStoryRow,
  authorMap: Map<string, string> = new Map()
): WriterStory {
  const profilesField = row.profiles as
    | { username?: string | null }
    | Array<{ username?: string | null }>
    | null
    | undefined;
  const joined = Array.isArray(profilesField) ? profilesField[0] : profilesField;
  const authorId = extractRawAuthorId(row);

  const inlineAuthorName = [
    row.author_username,
    row.author_name,
    row.author,
    row.writer_name,
  ].find((v): v is string => typeof v === 'string' && v.trim().length > 0);

  const authorUsername =
    (typeof joined?.username === 'string' && joined.username.trim()) ||
    (authorId ? authorMap.get(authorId) : undefined) ||
    inlineAuthorName ||
    'Lorethos Writer';

  const summary = [row.summary, row.synopsis, row.subtitle].find(
    (v): v is string => typeof v === 'string' && v.trim().length > 0
  ) || '';

  let body = '';
  if (typeof row.body === 'string') {
    body = row.body;
  } else if (typeof row.content === 'string') {
    body = row.content;
  } else if (Array.isArray(row.content)) {
    body = row.content.filter((item): item is string => typeof item === 'string').join('\n\n');
  }

  const rawStatus =
    typeof row.status === 'string'
      ? row.status
      : typeof row.publication_status === 'string'
      ? row.publication_status
      : 'published';

  const createdAt =
    (typeof row.created_at === 'string' && row.created_at) ||
    (typeof row.updated_at === 'string' && row.updated_at) ||
    new Date().toISOString();

  return {
    id: String(row.id || ''),
    author_id: authorId,
    author_username: authorUsername,
    title: typeof row.title === 'string' && row.title.trim() ? row.title : 'Untitled Story',
    summary,
    body,
    audio_url: typeof row.audio_url === 'string' && row.audio_url ? row.audio_url : null,
    status: rawStatus.trim().toLowerCase() === 'draft' ? 'draft' : 'published',
    likes_count: typeof row.likes_count === 'number' ? Math.max(0, row.likes_count) : 0,
    created_at: createdAt,
  };
}

export function filterManageableRowsForAuthor(
  rows: RawStoryRow[],
  authorId: string,
  isAdmin: boolean,
  authorAliases: string[] = []
): RawStoryRow[] {
  if (isAdmin) return rows;
  const cleanAuthorId = authorId.trim().toLowerCase();
  const aliasSet = new Set(
    authorAliases.map((a) => a.trim().toLowerCase()).filter(Boolean)
  );

  return rows.filter((row) => {
    const rowAuthorId = extractRawAuthorId(row).toLowerCase();
    if (rowAuthorId) {
      return rowAuthorId === cleanAuthorId;
    }

    const rowAuthorName = [
      row.author_username,
      row.author_name,
      row.author,
      row.writer_name,
    ].find((v): v is string => typeof v === 'string' && v.trim().length > 0);

    if (rowAuthorName && aliasSet.size > 0) {
      return aliasSet.has(rowAuthorName.trim().toLowerCase());
    }

    // If stories table lacks any author attribution column, avoid hiding writer submissions silently
    return typeof row.body === 'string' || typeof row.summary === 'string';
  });
}

async function resolveStoriesWithAuthorUsernames(rows: RawStoryRow[]): Promise<WriterStory[]> {
  if (rows.length === 0) return [];

  const missingAuthorIds = new Set<string>();
  for (const row of rows) {
    const profilesField = row.profiles as
      | { username?: string | null }
      | Array<{ username?: string | null }>
      | null
      | undefined;
    const joined = Array.isArray(profilesField) ? profilesField[0] : profilesField;
    const rowAuthorId = extractRawAuthorId(row);
    if (!joined?.username && rowAuthorId) {
      missingAuthorIds.add(rowAuthorId);
    }
  }

  const authorMap = new Map<string, string>();
  if (supabase && missingAuthorIds.size > 0) {
    const ids = Array.from(missingAuthorIds);
    const { data: profileRows } = await supabase
      .from('profiles')
      .select('id, username')
      .in('id', ids);
    if (Array.isArray(profileRows)) {
      for (const p of profileRows) {
        if (p.id && p.username) {
          authorMap.set(String(p.id), String(p.username));
        }
      }
    }

    const stillMissing = ids.filter((id) => !authorMap.has(id));
    if (stillMissing.length > 0) {
      const { data: userRows } = await supabase
        .from('users')
        .select('id, username, nickname, name')
        .in('id', stillMissing);
      if (Array.isArray(userRows)) {
        for (const u of userRows) {
          const display = u.username || u.nickname || u.name;
          if (u.id && display) {
            authorMap.set(String(u.id), String(display));
          }
        }
      }
    }
  }

  return rows.map((row) => mapRawStoryRowToWriterStory(row, authorMap));
}

async function selectAllStoryRowsOrdered(): Promise<{
  rows: RawStoryRow[];
  error?: string;
}> {
  if (!supabase) return { rows: [] };

  const orderedRes = await supabase
    .from('stories')
    .select('*')
    .order('created_at', { ascending: false });

  if (!orderedRes.error) {
    return { rows: (orderedRes.data || []) as RawStoryRow[] };
  }

  if (isMissingColumnOrSchemaError(orderedRes.error)) {
    const plainRes = await supabase.from('stories').select('*');
    if (!plainRes.error) {
      return { rows: (plainRes.data || []) as RawStoryRow[] };
    }
    return { rows: [], error: plainRes.error.message };
  }

  return { rows: [], error: orderedRes.error.message };
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

    if (!error && Array.isArray(data)) {
      const mapped = await resolveStoriesWithAuthorUsernames(data as RawStoryRow[]);
      return { stories: mapped };
    }

    // Schema-adaptive fallback when author_id, profiles join, or optional columns differ
    const fallback = await selectAllStoryRowsOrdered();
    if (fallback.error) {
      return { stories: [], error: fallback.error };
    }
    const mappedAll = await resolveStoriesWithAuthorUsernames(fallback.rows);
    return {
      stories: mappedAll.filter(
        (story) => story.status === 'published' && story.body.trim().length > 0
      ),
    };
  } catch (err) {
    return {
      stories: [],
      error: err instanceof Error ? err.message : 'Unable to fetch published stories.',
    };
  }
}

export async function fetchManageableWriterStories(
  authorId: string,
  isAdmin: boolean,
  authorAliases: string[] = []
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
    if (!error && Array.isArray(data)) {
      const mapped = await resolveStoriesWithAuthorUsernames(data as RawStoryRow[]);
      return { stories: mapped };
    }

    // Schema-adaptive fallback: handles missing stories.author_id, user_id/writer_id aliases, or missing FK join
    const fallback = await selectAllStoryRowsOrdered();
    if (fallback.error) {
      return { stories: [], error: fallback.error };
    }

    const scopedRows = filterManageableRowsForAuthor(
      fallback.rows,
      authorId,
      isAdmin,
      authorAliases
    );
    const mapped = await resolveStoriesWithAuthorUsernames(scopedRows);
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
  authorUsername?: string;
  title: string;
  summary: string;
  body: string;
  audioUrl?: string | null;
}): Promise<{ story?: WriterStory; error?: string }> {
  if (!isSupabaseConfigured || !supabase) {
    return { error: 'Supabase is not configured.' };
  }

  const cleanTitle = input.title.trim();
  const formattedSummary = formatTrailerSummaryWithLorethosCta(input.summary, input.title);
  const cleanBody = input.body.trim();
  const authorDisplay = input.authorUsername?.trim() || 'Lorethos Writer';

  const baseFields: Record<string, unknown> = {
    title: cleanTitle,
    summary: formattedSummary,
    body: cleanBody,
    audio_url: input.audioUrl || null,
    status: 'published',
  };

  const payloadCandidates: Array<Record<string, unknown>> = [
    { author_id: input.authorId, ...baseFields },
    { user_id: input.authorId, ...baseFields },
    { writer_id: input.authorId, ...baseFields },
    { created_by: input.authorId, ...baseFields },
    { author: authorDisplay, ...baseFields },
    baseFields,
  ];

  let lastErrorMessage = 'Failed to publish story.';

  for (const payload of payloadCandidates) {
    const { data, error } = await supabase
      .from('stories')
      .insert(payload)
      .select('*')
      .single();

    if (!error && data) {
      const resolved = await resolveStoriesWithAuthorUsernames([data as RawStoryRow]);
      return { story: resolved[0] };
    }

    if (error) {
      lastErrorMessage = error.message;
      if (!isMissingColumnOrSchemaError(error)) {
        return { error: error.message };
      }
    }
  }

  return { error: lastErrorMessage };
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
    .select('*')
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
