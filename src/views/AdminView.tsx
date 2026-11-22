import React, { useState, useEffect, useRef } from 'react';
import { useApp } from '../context/AppContext';
import {
  BookOpen,
  Plus,
  DollarSign,
  Users,
  TrendingUp,
  Edit3,
  Save,
  CheckCircle2,
  Key,
  Layers,
  Sparkles,
  Loader2,
  Download,
  Lock,
  Feather,
  Search,
  Copy,
  Check,
  Eye,
  ShieldCheck,
  X
} from 'lucide-react';
import { AccessTier, AdminUserDirectoryEntry, PublicationStatus, WriterRole } from '../types';
import { VoiceDictationButton } from '../components/VoiceDictationButton';
import { VideoTrailerStudio } from '../components/VideoTrailerStudio';
import { ReaderAvatar } from '../components/ReaderAvatar';
import { apiFetch, parseJsonSafe } from '../lib/apiClient';

export const AdminView: React.FC = () => {
  const {
    stories,
    user,
    isAuthenticated,
    adminOverview,
    refreshAdminOverview,
    adminUsers,
    refreshAdminUsers,
    updateUserRole,
    addStory,
    addChapterToStory,
    updateStoryPricing,
    updateStoryWorkflow,
    navigate,
    buildHref,
    routeParams
  } = useApp();

  const [activeTab, setActiveTab] = useState<'studio' | 'users' | 'pricing' | 'ledger' | 'inquiries'>('studio');
  const [selectedStoryId, setSelectedStoryId] = useState<string>(stories[0]?.id || '');
  const [isCreatingStory, setIsCreatingStory] = useState(false);
  const [isAddingChapter, setIsAddingChapter] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [exportingZip, setExportingZip] = useState(false);
  const [userSearch, setUserSearch] = useState('');
  const [userRoleFilter, setUserRoleFilter] = useState<'all' | 'writers' | 'readers'>('all');
  const [updatingRoleId, setUpdatingRoleId] = useState<string | null>(null);
  const [inspectedProfile, setInspectedProfile] = useState<AdminUserDirectoryEntry | null>(null);
  const [copiedWriterLink, setCopiedWriterLink] = useState(false);
  const profileDialogRef = useRef<HTMLDivElement | null>(null);

  // New Story Form
  const [newStoryTitle, setNewStoryTitle] = useState('');
  const [newStorySubtitle, setNewStorySubtitle] = useState('');
  const [newStoryAuthor, setNewStoryAuthor] = useState('Lorethos Editorial');
  const [newStoryGenre, setNewStoryGenre] = useState('Epic Fantasy');
  const [newStorySynopsis, setNewStorySynopsis] = useState('');
  const [newStoryPrice, setNewStoryPrice] = useState(2500);
  const [newStoryTier, setNewStoryTier] = useState<AccessTier>('subscription');
  const [newStoryWriterRequiresPurchase, setNewStoryWriterRequiresPurchase] = useState(false);
  const [newStoryPubStatus, setNewStoryPubStatus] = useState<PublicationStatus>('draft');
  const [newStoryCover, setNewStoryCover] = useState('/assets/images/book_cover_obsidian_throne_1794465561565.jpg');
  const createDialogRef = useRef<HTMLDivElement | null>(null);
  const createTriggerRef = useRef<HTMLElement | null>(null);

  // New Chapter Form
  const [newChapterTitle, setNewChapterTitle] = useState('');
  const [newChapterNumber, setNewChapterNumber] = useState(1);
  const [newChapterExcerpt, setNewChapterExcerpt] = useState('');
  const [newChapterContent, setNewChapterContent] = useState('');
  const [newChapterIsFree, setNewChapterIsFree] = useState(false);
  const [aiScenePrompt, setAiScenePrompt] = useState('');
  const [aiDraftingChapter, setAiDraftingChapter] = useState(false);
  const [aiCraftingSynopsis, setAiCraftingSynopsis] = useState(false);
  const [aiAdminError, setAiAdminError] = useState<string | null>(null);

  const isOwner = isAuthenticated && user.role === 'owner';

  useEffect(() => {
    const valid = new Set(['studio', 'users', 'pricing', 'ledger', 'inquiries']);
    if (routeParams.tab && valid.has(routeParams.tab)) {
      setActiveTab(routeParams.tab as 'studio' | 'users' | 'pricing' | 'ledger' | 'inquiries');
    }
  }, [routeParams.tab]);

  useEffect(() => {
    if (isOwner) {
      void refreshAdminOverview();
      void refreshAdminUsers();
    }
  }, [isOwner, refreshAdminOverview, refreshAdminUsers]);

  useEffect(() => {
    if (!inspectedProfile) return;
    const t = window.setTimeout(() => profileDialogRef.current?.focus(), 10);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setInspectedProfile(null);
    };
    window.addEventListener('keydown', onKey);
    return () => {
      window.clearTimeout(t);
      window.removeEventListener('keydown', onKey);
    };
  }, [inspectedProfile]);

  useEffect(() => {
    if (!isCreatingStory) return;
    createTriggerRef.current = document.activeElement as HTMLElement | null;
    const t = window.setTimeout(() => createDialogRef.current?.focus(), 10);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsCreatingStory(false);
    };
    window.addEventListener('keydown', onKey);
    return () => {
      window.clearTimeout(t);
      window.removeEventListener('keydown', onKey);
      createTriggerRef.current?.focus?.();
    };
  }, [isCreatingStory]);

  if (!isOwner) {
    return (
      <div className="min-h-screen bg-[#F9F6F0] dark:bg-[#160C16] text-[#2D142C] dark:text-[#F9F6F0] py-20 px-4">
        <div className="max-w-lg mx-auto p-8 rounded-2xl bg-white dark:bg-[#1E111E] border border-[#2D142C]/10 dark:border-white/10 text-center space-y-4">
          <div className="w-12 h-12 rounded-full bg-[#C85A32]/15 text-[#C85A32] flex items-center justify-center mx-auto">
            <Lock className="w-6 h-6" />
          </div>
          <h1 className="font-display text-2xl font-bold">Owner Authorization Required</h1>
          <p className="text-xs text-[#2D142C]/70 dark:text-white/70 font-sans-ui leading-relaxed">
            Publishing Desk is restricted to authenticated owner accounts authorized by the server. Client-side role switching is disabled.
          </p>
          <a
            href={buildHref('account', { redirect: '/admin' })}
            onClick={(e) => {
              e.preventDefault();
              navigate('account', { redirect: '/admin' });
            }}
            className="inline-block px-5 py-2.5 bg-[#C85A32] hover:bg-[#b04d28] text-white text-xs font-semibold rounded-lg"
          >
            Sign In on Account Page
          </a>
        </div>
      </div>
    );
  }

  const selectedStory = stories.find(s => s.id === selectedStoryId) || stories[0];
  const grossRevenueNgn = adminOverview?.grossRevenueNgn ?? 0;
  const activeSubscribers = adminOverview?.activeSubscribers ?? 0;
  const totalUsers = adminOverview?.totalRegisteredUsers ?? 0;
  const adminTransactions = adminOverview?.transactions ?? [];
  const adminInquiries = adminOverview?.inquiries ?? [];

  const showToast = (msg: string) => {
    setStatusMessage(msg);
    setTimeout(() => setStatusMessage(null), 3500);
  };

  const writerPortalUrl =
    typeof window !== 'undefined' ? `${window.location.origin}/writer` : 'https://lorethos-two.vercel.app/writer';

  const handleCopyWriterPortalLink = async () => {
    try {
      await navigator.clipboard.writeText(writerPortalUrl);
      setCopiedWriterLink(true);
      showToast('Writer Studio portal link copied.');
      window.setTimeout(() => setCopiedWriterLink(false), 2500);
    } catch {
      showToast(`Writer portal URL: ${writerPortalUrl}`);
    }
  };

  const handleRoleToggle = async (target: AdminUserDirectoryEntry, nextRole: WriterRole) => {
    if (target.role === 'owner') return;
    setUpdatingRoleId(target.id);
    try {
      const res = await updateUserRole(target.id, nextRole, target.email);
      if (!res.ok) {
        showToast(res.error || 'Could not update user role.');
        return;
      }
      if (inspectedProfile?.id === target.id) {
        setInspectedProfile({ ...inspectedProfile, role: nextRole });
      }
      showToast(
        nextRole === 'writer'
          ? `${target.nickname || target.name} upgraded to Approved Writer.`
          : `${target.nickname || target.name} updated to Reader access.`
      );
    } finally {
      setUpdatingRoleId(null);
    }
  };

  const approvedWritersList = adminUsers.filter(
    (u) => u.role === 'writer' || u.role === 'admin' || u.role === 'owner'
  );
  const filteredUsers = adminUsers.filter((entry) => {
    if (userRoleFilter === 'writers' && entry.role === 'reader') return false;
    if (userRoleFilter === 'readers' && entry.role !== 'reader') return false;
    const q = userSearch.trim().toLowerCase();
    if (!q) return true;
    return (
      entry.name.toLowerCase().includes(q) ||
      (entry.nickname || '').toLowerCase().includes(q) ||
      entry.email.toLowerCase().includes(q)
    );
  });

  const handleCreateStory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newStoryTitle.trim()) return;

    const res = await addStory({
      title: newStoryTitle,
      subtitle: newStorySubtitle || 'An Original Lorethos Release',
      author: newStoryAuthor,
      genre: newStoryGenre,
      synopsis: newStorySynopsis,
      coverImage: newStoryCover,
      accessTier: newStoryTier,
      priceNgn: Number(newStoryPrice),
      writerRequiresPurchase: newStoryTier !== 'free' && newStoryWriterRequiresPurchase,
      publicationStatus: newStoryPubStatus
    });

    if (!res.ok) {
      showToast(res.error || 'Could not publish story.');
      return;
    }

    setIsCreatingStory(false);
    setNewStoryTitle('');
    setNewStorySynopsis('');
    setNewStoryWriterRequiresPurchase(false);
    void refreshAdminOverview();
    showToast(`Story saved as ${newStoryPubStatus}.`);
  };

  const handleAddChapter = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newChapterTitle.trim() || !selectedStory) return;

    const paragraphs = newChapterContent.split('\n\n').map(p => p.trim()).filter(Boolean);
    const res = await addChapterToStory(selectedStory.id, {
      chapterNumber: Number(newChapterNumber),
      title: newChapterTitle,
      excerpt: newChapterExcerpt || paragraphs[0] || 'New chapter published.',
      content: paragraphs.length > 0 ? paragraphs : ['Chapter text coming soon.'],
      isFree: newChapterIsFree
    });

    if (!res.ok) {
      showToast(res.error || 'Failed to add chapter.');
      return;
    }

    setIsAddingChapter(false);
    setNewChapterTitle('');
    setNewChapterContent('');
    setNewChapterExcerpt('');
    void refreshAdminOverview();
    showToast(`Chapter ${newChapterNumber} published to "${selectedStory.title}".`);
  };

  const handleDownloadZip = async () => {
    setExportingZip(true);
    try {
      const res = await apiFetch('/api/export-zip');
      if (!res.ok) throw new Error('Failed to generate ZIP');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'lorethos-source.zip';
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      showToast('Source archive downloaded.');
    } catch {
      showToast('Could not download ZIP archive.');
    } finally {
      setExportingZip(false);
    }
  };

  const handleAIDraftChapter = async () => {
    if (!selectedStory) return;
    setAiDraftingChapter(true);
    setAiAdminError(null);
    try {
      const res = await apiFetch('/api/ai/scriptorium', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          task: 'draft_chapter',
          storyTitle: selectedStory.title,
          genre: selectedStory.genre,
          chapterTitle: newChapterTitle || `Chapter ${newChapterNumber}`,
          outline: aiScenePrompt || `Continue ${selectedStory.title}.`
        })
      });
      const data = await parseJsonSafe<{
        excerpt?: string;
        paragraphs?: string[];
        error?: string;
      }>(res);
      if (!res.ok || !data) {
        throw new Error(data?.error || 'Failed to draft chapter.');
      }
      if (data.excerpt) setNewChapterExcerpt(data.excerpt);
      if (Array.isArray(data.paragraphs) && data.paragraphs.length > 0) {
        setNewChapterContent(data.paragraphs.join('\n\n'));
      }
      showToast('Chapter draft generated.');
    } catch (err) {
      setAiAdminError(err instanceof Error ? err.message : 'Unable to draft chapter.');
    } finally {
      setAiDraftingChapter(false);
    }
  };

  const handleAICraftSynopsis = async () => {
    setAiCraftingSynopsis(true);
    setAiAdminError(null);
    try {
      const res = await apiFetch('/api/ai/scriptorium', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          task: 'craft_synopsis',
          storyTitle: newStoryTitle || 'Untitled Chronicle',
          genre: newStoryGenre,
          existingSynopsis: newStorySynopsis
        })
      });
      const data = await parseJsonSafe<{ synopsis?: string; error?: string }>(res);
      if (!res.ok || !data) {
        throw new Error(data?.error || 'Failed to craft synopsis.');
      }
      if (data.synopsis) {
        setNewStorySynopsis(data.synopsis);
        showToast('Synopsis generated.');
      }
    } catch (err) {
      setAiAdminError(err instanceof Error ? err.message : 'Unable to craft synopsis.');
    } finally {
      setAiCraftingSynopsis(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F9F6F0] dark:bg-[#160C16] text-[#2D142C] dark:text-[#F9F6F0] py-12 transition-colors">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-10">

        {statusMessage && (
          <div
            role="status"
            className="fixed bottom-6 right-6 z-50 bg-[#2D142C] text-white px-5 py-3 rounded-lg shadow-2xl border border-[#C85A32] flex items-center gap-2 text-xs font-sans-ui"
          >
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            <span>{statusMessage}</span>
          </div>
        )}

        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-8 rounded-2xl bg-white dark:bg-[#1E111E] border border-[#2D142C]/10 dark:border-white/10 shadow-xs">
          <div className="space-y-1">
            <span className="text-[11px] font-bold tracking-widest uppercase bg-[#C85A32]/10 text-[#C85A32] px-2 py-0.5 rounded font-sans-ui">
              PUBLISHER ADMIN DESK
            </span>
            <h1 className="font-display text-3xl sm:text-4xl font-bold">
              Lorethos Publishing Desk
            </h1>
            <p className="text-xs text-[#2D142C]/70 dark:text-white/70 font-sans-ui">
              Manage published works, add serialized chapters, configure pricing rules, and inspect verified orders.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <a
              href={buildHref('writer')}
              onClick={(e) => {
                if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
                e.preventDefault();
                navigate('writer');
              }}
              className="px-4 py-2.5 rounded-lg bg-[#2D142C] dark:bg-white text-white dark:text-[#160C16] hover:bg-[#C85A32] dark:hover:bg-[#C85A32] dark:hover:text-white text-xs font-semibold flex items-center gap-2 transition-colors whitespace-nowrap shrink-0"
            >
              <Feather className="w-3.5 h-3.5 text-[#C85A32]" />
              <span>Open Writer Studio</span>
            </a>
            <button
              type="button"
              onClick={handleDownloadZip}
              disabled={exportingZip}
              className="px-3.5 py-2 text-xs rounded-lg border border-[#2D142C]/20 dark:border-white/20 hover:border-[#C85A32] hover:text-[#C85A32] transition-colors cursor-pointer font-sans-ui flex items-center gap-1.5 disabled:opacity-60 whitespace-nowrap shrink-0"
            >
              {exportingZip ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
              <span>{exportingZip ? 'Zipping...' : 'Export Code (.zip)'}</span>
            </button>
            <button
              type="button"
              onClick={() => setIsCreatingStory(true)}
              className="px-4 py-2.5 bg-[#C85A32] hover:bg-[#b04d28] text-white text-xs font-semibold rounded-lg flex items-center gap-2 transition-colors cursor-pointer shadow-xs whitespace-nowrap shrink-0"
            >
              <Plus className="w-4 h-4" />
              <span>Publish New Story</span>
            </button>
          </div>
        </div>

        {/* Verified Server KPI Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="p-6 rounded-xl bg-white dark:bg-[#1E111E] border border-[#2D142C]/10 dark:border-white/10 space-y-2">
            <div className="flex items-center justify-between text-xs text-[#2D142C]/65 dark:text-white/65 font-sans-ui">
              <span>Verified Gross Revenue</span>
              <DollarSign className="w-4 h-4 text-[#C85A32]" />
            </div>
            <div className="font-sans-ui text-2xl sm:text-3xl font-bold tabular-nums">
              ₦{grossRevenueNgn.toLocaleString('en-NG')}
            </div>
            <p className="text-[11px] text-[#2D142C]/60 dark:text-white/60 font-sans-ui">
              Settled Paystack orders
            </p>
          </div>

          <div className="p-6 rounded-xl bg-white dark:bg-[#1E111E] border border-[#2D142C]/10 dark:border-white/10 space-y-2">
            <div className="flex items-center justify-between text-xs text-[#2D142C]/65 dark:text-white/65 font-sans-ui">
              <span>Active Subscribers</span>
              <Users className="w-4 h-4 text-[#C85A32]" />
            </div>
            <div className="font-sans-ui text-2xl sm:text-3xl font-bold tabular-nums">
              {activeSubscribers}
            </div>
            <p className="text-[11px] text-[#2D142C]/60 dark:text-white/60 font-sans-ui">
              {totalUsers} registered account{totalUsers === 1 ? '' : 's'}
            </p>
          </div>

          <div className="p-6 rounded-xl bg-white dark:bg-[#1E111E] border border-[#2D142C]/10 dark:border-white/10 space-y-2">
            <div className="flex items-center justify-between text-xs text-[#2D142C]/65 dark:text-white/65 font-sans-ui">
              <span>Published Chapters</span>
              <BookOpen className="w-4 h-4 text-[#C85A32]" />
            </div>
            <div className="font-sans-ui text-2xl sm:text-3xl font-bold tabular-nums">
              {stories.reduce((acc, s) => acc + s.chapters.length, 0)}
            </div>
            <p className="text-[11px] text-[#2D142C]/60 dark:text-white/60 font-sans-ui">
              Across catalog stories
            </p>
          </div>

          <div className="p-6 rounded-xl bg-white dark:bg-[#1E111E] border border-[#2D142C]/10 dark:border-white/10 space-y-2">
            <div className="flex items-center justify-between text-xs text-[#2D142C]/65 dark:text-white/65 font-sans-ui">
              <span>Published Stories</span>
              <Layers className="w-4 h-4 text-[#C85A32]" />
            </div>
            <div className="font-sans-ui text-2xl sm:text-3xl font-bold tabular-nums">
              {stories.length}
            </div>
            <p className="text-[11px] text-[#2D142C]/60 dark:text-white/60 font-sans-ui">
              Live in catalog
            </p>
          </div>
        </div>

        {/* Section Tabs */}
        <div className="flex border-b border-[#2D142C]/10 dark:border-white/10 gap-2 font-sans-ui text-xs font-semibold overflow-x-auto">
          <button
            type="button"
            onClick={() => setActiveTab('studio')}
            className={`py-3 px-4 border-b-2 transition-all cursor-pointer flex items-center gap-2 whitespace-nowrap ${
              activeTab === 'studio'
                ? 'border-[#C85A32] text-[#C85A32]'
                : 'border-transparent text-[#2D142C]/65 dark:text-white/65 hover:text-[#C85A32]'
            }`}
          >
            <Edit3 className="w-3.5 h-3.5" />
            <span>Story &amp; Chapter Studio</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('users')}
            className={`py-3 px-4 border-b-2 transition-all cursor-pointer flex items-center gap-2 whitespace-nowrap ${
              activeTab === 'users'
                ? 'border-[#C85A32] text-[#C85A32]'
                : 'border-transparent text-[#2D142C]/65 dark:text-white/65 hover:text-[#C85A32]'
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            <span>Profiles &amp; Writers ({adminUsers.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('pricing')}
            className={`py-3 px-4 border-b-2 transition-all cursor-pointer flex items-center gap-2 whitespace-nowrap ${
              activeTab === 'pricing'
                ? 'border-[#C85A32] text-[#C85A32]'
                : 'border-transparent text-[#2D142C]/65 dark:text-white/65 hover:text-[#C85A32]'
            }`}
          >
            <Key className="w-3.5 h-3.5" />
            <span>Access &amp; Pricing Rules</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('ledger')}
            className={`py-3 px-4 border-b-2 transition-all cursor-pointer flex items-center gap-2 whitespace-nowrap ${
              activeTab === 'ledger'
                ? 'border-[#C85A32] text-[#C85A32]'
                : 'border-transparent text-[#2D142C]/65 dark:text-white/65 hover:text-[#C85A32]'
            }`}
          >
            <TrendingUp className="w-3.5 h-3.5" />
            <span>Order Ledger ({adminTransactions.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('inquiries')}
            className={`py-3 px-4 border-b-2 transition-all cursor-pointer flex items-center gap-2 whitespace-nowrap ${
              activeTab === 'inquiries'
                ? 'border-[#C85A32] text-[#C85A32]'
                : 'border-transparent text-[#2D142C]/65 dark:text-white/65 hover:text-[#C85A32]'
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            <span>Contact Messages ({adminInquiries.length})</span>
          </button>
        </div>

        {/* Tab 1: Studio */}
        {activeTab === 'studio' && selectedStory && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            <div className="lg:col-span-4 bg-white dark:bg-[#1E111E] p-5 rounded-xl border border-[#2D142C]/10 dark:border-white/10 space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="font-display text-lg font-bold">Catalog Stories</h2>
                <span className="text-[11px] font-mono text-[#2D142C]/60 dark:text-white/60">
                  {stories.length} Works
                </span>
              </div>

              <div className="space-y-2">
                {stories.map(story => (
                  <button
                    key={story.id}
                    type="button"
                    onClick={() => setSelectedStoryId(story.id)}
                    className={`w-full text-left p-3 rounded-lg border transition-all cursor-pointer flex items-center gap-3 ${
                      selectedStory.id === story.id
                        ? 'border-[#C85A32] bg-[#C85A32]/5 ring-1 ring-[#C85A32]'
                        : 'border-[#2D142C]/10 dark:border-white/10 hover:border-[#C85A32]/40'
                    }`}
                  >
                    <img
                      src={story.coverImage}
                      alt=""
                      loading="lazy"
                      className="w-10 h-14 object-cover rounded shrink-0 shadow-2xs"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-1 text-[10px] text-[#C85A32] font-semibold uppercase font-sans-ui">
                        <span className="truncate">{story.genre}</span>
                        <span className="px-1.5 py-0.5 rounded bg-current/10 uppercase">
                          {story.publicationStatus || 'published'}
                        </span>
                      </div>
                      <div className="font-display text-sm font-bold truncate">
                        {story.title}
                      </div>
                      <div className="text-[11px] text-[#2D142C]/55 dark:text-white/55 font-sans-ui">
                        {story.chapters.length} Chapters &middot; ₦{story.priceNgn}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            <div className="lg:col-span-8 bg-white dark:bg-[#1E111E] p-6 rounded-xl border border-[#2D142C]/10 dark:border-white/10 space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-[#2D142C]/10 dark:border-white/10 gap-3">
                <div>
                  <div className="text-xs text-[#C85A32] font-semibold uppercase font-sans-ui">
                    Selected Series
                  </div>
                  <h2 className="font-display text-2xl font-bold">{selectedStory.title}</h2>
                  <p className="text-xs text-[#2D142C]/65 dark:text-white/65 font-sans-ui">
                    Author: {selectedStory.author} &middot; Serialization: {selectedStory.status}
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <label htmlFor="admin-story-workflow" className="sr-only">
                    Publication workflow status
                  </label>
                  <select
                    id="admin-story-workflow"
                    value={selectedStory.publicationStatus || 'published'}
                    onChange={async (e) => {
                      const nextStatus = e.target.value as PublicationStatus;
                      const res = await updateStoryWorkflow(selectedStory.id, nextStatus);
                      if (res.ok) {
                        void refreshAdminOverview();
                        showToast(`Workflow status updated to ${nextStatus}.`);
                      } else {
                        showToast(res.error || 'Could not update workflow.');
                      }
                    }}
                    className="px-2.5 py-2 border border-[#2D142C]/20 dark:border-white/20 rounded-lg text-xs font-semibold bg-white dark:bg-[#1E111E]"
                  >
                    <option value="draft">Workflow: Draft</option>
                    <option value="review">Workflow: In Review</option>
                    <option value="published">Workflow: Published</option>
                  </select>

                  <button
                    type="button"
                    onClick={() => {
                      setNewChapterNumber(selectedStory.chapters.length + 1);
                      setIsAddingChapter(true);
                    }}
                    className="px-3 py-2 bg-[#C85A32] text-white text-xs font-semibold rounded-lg hover:bg-[#b04d28] transition-colors cursor-pointer flex items-center gap-1.5"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add Chapter {selectedStory.chapters.length + 1}</span>
                  </button>

                  <a
                    href={buildHref('story-detail', { slug: selectedStory.slug })}
                    onClick={(e) => {
                      e.preventDefault();
                      navigate('story-detail', { slug: selectedStory.slug });
                    }}
                    className="px-3 py-2 border border-[#2D142C]/20 dark:border-white/20 text-xs font-medium rounded-lg hover:border-[#C85A32] transition-colors"
                  >
                    View Page
                  </a>
                </div>
              </div>

              {isAddingChapter && (
                <form onSubmit={handleAddChapter} className="p-6 rounded-xl bg-[#F9F6F0] dark:bg-[#160C16] border border-[#C85A32]/40 space-y-4 text-xs font-sans-ui">
                  <div className="flex items-center justify-between">
                    <h3 className="font-display text-lg font-bold">
                      Add Chapter {newChapterNumber} to &ldquo;{selectedStory.title}&rdquo;
                    </h3>
                    <button
                      type="button"
                      onClick={() => setIsAddingChapter(false)}
                      className="text-xs text-red-600 hover:underline cursor-pointer"
                    >
                      Cancel
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label htmlFor="admin-chapter-title" className="block font-semibold mb-1">
                        Chapter Title
                      </label>
                      <input
                        id="admin-chapter-title"
                        type="text"
                        required
                        value={newChapterTitle}
                        onChange={(e) => setNewChapterTitle(e.target.value)}
                        placeholder="Chapter title"
                        className="w-full px-3 py-2 rounded border border-slate-300 dark:border-white/20 bg-white dark:bg-[#1E111E]"
                      />
                    </div>
                    <div>
                      <span className="block font-semibold mb-1">Access Rule</span>
                      <div className="flex items-center gap-4 pt-1">
                        <label htmlFor="admin-chapter-free" className="flex items-center gap-1.5 cursor-pointer">
                          <input
                            id="admin-chapter-free"
                            type="checkbox"
                            checked={newChapterIsFree}
                            onChange={(e) => setNewChapterIsFree(e.target.checked)}
                          />
                          <span>Free for all readers</span>
                        </label>
                      </div>
                    </div>
                  </div>

                  <div className="p-4 rounded-xl bg-white dark:bg-[#1E111E] border border-[#C85A32]/30 space-y-2.5">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-semibold text-[#C85A32] flex items-center gap-1.5">
                        <Sparkles className="w-3.5 h-3.5" />
                        <span>AI Drafting Assistant</span>
                      </span>
                    </div>
                    <div className="flex flex-col sm:flex-row gap-2">
                      <label htmlFor="ai-scene-prompt" className="sr-only">
                        Scene outline prompt
                      </label>
                      <input
                        id="ai-scene-prompt"
                        type="text"
                        value={aiScenePrompt}
                        onChange={(e) => setAiScenePrompt(e.target.value)}
                        placeholder="Describe scene beats..."
                        className="flex-1 px-3 py-2 rounded border border-slate-300 dark:border-white/20 bg-transparent"
                      />
                      <VoiceDictationButton
                        compact
                        label="Dictate Beats"
                        contextHint={`Scene beats for ${selectedStory.title}`}
                        onTranscript={(text) => setAiScenePrompt((prev) => (prev.trim() ? `${prev.trim()} ${text}` : text))}
                      />
                      <button
                        type="button"
                        disabled={aiDraftingChapter}
                        onClick={handleAIDraftChapter}
                        className="px-4 py-2 rounded bg-[#2D142C] dark:bg-white text-white dark:text-[#160C16] font-semibold flex items-center justify-center gap-1.5 hover:opacity-90 disabled:opacity-55 cursor-pointer shrink-0"
                      >
                        {aiDraftingChapter ? (
                          <>
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            <span>Drafting...</span>
                          </>
                        ) : (
                          <>
                            <Sparkles className="w-3.5 h-3.5 text-[#C85A32]" />
                            <span>Draft Chapter</span>
                          </>
                        )}
                      </button>
                    </div>
                    {aiAdminError && (
                      <div role="alert" className="text-[11px] text-red-600 dark:text-red-400">
                        {aiAdminError}
                      </div>
                    )}
                  </div>

                  <div>
                    <label htmlFor="admin-chapter-excerpt" className="block font-semibold mb-1">
                      Excerpt Preview
                    </label>
                    <input
                      id="admin-chapter-excerpt"
                      type="text"
                      value={newChapterExcerpt}
                      onChange={(e) => setNewChapterExcerpt(e.target.value)}
                      placeholder="Short preview hook..."
                      className="w-full px-3 py-2 rounded border border-slate-300 dark:border-white/20 bg-white dark:bg-[#1E111E]"
                    />
                  </div>

                  <div>
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <label htmlFor="admin-chapter-content" className="block font-semibold">
                        Chapter Prose (separate paragraphs with blank lines)
                      </label>
                      <VoiceDictationButton
                        compact
                        label="Dictate Prose"
                        contextHint={`Narrative prose for ${selectedStory.title}, Chapter ${newChapterNumber}`}
                        onTranscript={(text) =>
                          setNewChapterContent((prev) => (prev.trim() ? `${prev.trim()}\n\n${text}` : text))
                        }
                      />
                    </div>
                    <textarea
                      id="admin-chapter-content"
                      rows={8}
                      required
                      value={newChapterContent}
                      onChange={(e) => setNewChapterContent(e.target.value)}
                      placeholder="Write chapter paragraphs..."
                      className="w-full px-3 py-2 rounded border border-slate-300 dark:border-white/20 bg-white dark:bg-[#1E111E] font-reader text-sm"
                    />
                  </div>

                  <button
                    type="submit"
                    className="py-2.5 px-5 bg-[#C85A32] text-white font-semibold rounded-lg hover:bg-[#b04d28] cursor-pointer flex items-center gap-1.5"
                  >
                    <Save className="w-3.5 h-3.5" />
                    <span>Publish Chapter</span>
                  </button>
                </form>
              )}

              <div className="space-y-3">
                <h3 className="font-display text-base font-bold">
                  Published Chapters ({selectedStory.chapters.length})
                </h3>
                <div className="divide-y divide-[#2D142C]/10 dark:divide-white/10 rounded-lg border border-[#2D142C]/10 dark:border-white/10 overflow-hidden">
                  {selectedStory.chapters.map(ch => (
                    <div key={ch.id} className="p-3.5 flex items-center justify-between text-xs font-sans-ui">
                      <div className="min-w-0 pr-4">
                        <div className="font-semibold text-sm truncate">
                          Ch. {ch.chapterNumber}: {ch.title}
                        </div>
                        <div className="text-[11px] text-[#2D142C]/60 dark:text-white/60">
                          {ch.wordCount.toLocaleString()} words &middot; {ch.readTimeMinutes} min &middot; {ch.releaseDate}
                        </div>
                      </div>

                      <div className="flex items-center gap-3 shrink-0">
                        <span
                          className={`text-[10px] font-semibold px-2 py-0.5 rounded ${
                            ch.isFree
                              ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                              : 'bg-[#C85A32]/10 text-[#C85A32]'
                          }`}
                        >
                          {ch.isFree ? 'Free' : 'Locked'}
                        </span>
                        <a
                          href={buildHref('reader', { slug: selectedStory.slug, chapterNumber: ch.chapterNumber })}
                          onClick={(e) => {
                            e.preventDefault();
                            navigate('reader', { slug: selectedStory.slug, chapterNumber: ch.chapterNumber });
                          }}
                          className="text-[#C85A32] hover:underline"
                        >
                          Open &rarr;
                        </a>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="pt-2">
                <VideoTrailerStudio
                  key={selectedStory.id}
                  storySlug={selectedStory.slug}
                  storyTitle={selectedStory.title}
                  heading="Promotional Video Trailer Studio"
                  description="Produce a 16:9 widescreen launch trailer or 9:16 vertical reel for this series."
                  defaultPrompt={`${selectedStory.synopsis.slice(0, 180)} Dramatic book teaser with rich golden-hour atmosphere.`}
                />
              </div>
            </div>
          </div>
        )}

        {/* Create Story Dialog */}
        {isCreatingStory && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs"
            onClick={() => setIsCreatingStory(false)}
          >
            <div
              ref={createDialogRef}
              tabIndex={-1}
              role="dialog"
              aria-modal="true"
              aria-labelledby="create-story-dialog-title"
              className="bg-white dark:bg-[#1E111E] rounded-2xl max-w-xl w-full p-6 space-y-4 border border-[#2D142C]/15 dark:border-white/15 max-h-[90vh] overflow-y-auto focus:outline-none"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between border-b pb-3 border-current/10">
                <h2 id="create-story-dialog-title" className="font-display text-2xl font-bold">
                  Publish New Story
                </h2>
                <button
                  type="button"
                  onClick={() => setIsCreatingStory(false)}
                  aria-label="Close modal"
                  className="text-xs text-slate-500 hover:text-black dark:hover:text-white cursor-pointer"
                >
                  &times; Close
                </button>
              </div>

              <form onSubmit={handleCreateStory} className="space-y-4 text-xs font-sans-ui">
                <div>
                  <label htmlFor="new-story-title" className="block font-semibold mb-1">
                    Story Title
                  </label>
                  <input
                    id="new-story-title"
                    type="text"
                    required
                    value={newStoryTitle}
                    onChange={(e) => setNewStoryTitle(e.target.value)}
                    placeholder="Story title"
                    className="w-full px-3 py-2 rounded border border-slate-300 dark:border-white/20 bg-transparent text-sm"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label htmlFor="new-story-author" className="block font-semibold mb-1">
                      Author Name
                    </label>
                    <input
                      id="new-story-author"
                      type="text"
                      required
                      value={newStoryAuthor}
                      onChange={(e) => setNewStoryAuthor(e.target.value)}
                      className="w-full px-3 py-2 rounded border border-slate-300 dark:border-white/20 bg-transparent"
                    />
                  </div>
                  <div>
                    <label htmlFor="new-story-genre" className="block font-semibold mb-1">
                      Genre
                    </label>
                    <select
                      id="new-story-genre"
                      value={newStoryGenre}
                      onChange={(e) => setNewStoryGenre(e.target.value)}
                      className="w-full px-3 py-2 rounded border border-slate-300 dark:border-white/20 bg-white dark:bg-[#1E111E]"
                    >
                      <option value="Epic Fantasy">Epic Fantasy</option>
                      <option value="Poetry">Poetry</option>
                      <option value="Literary Fiction">Literary Fiction</option>
                      <option value="Short Stories">Short Stories</option>
                      <option value="Essays & Memoir">Essays &amp; Memoir</option>
                      <option value="Mythological Realism">Mythological Realism</option>
                      <option value="Afrofuturism">Afrofuturism</option>
                      <option value="Historical Mystery">Historical Mystery</option>
                      <option value="Lost Epoch & Sci-Fi">Lost Epoch &amp; Sci-Fi</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label htmlFor="new-story-cover" className="block font-semibold mb-1">
                    Cover Artwork
                  </label>
                  <select
                    id="new-story-cover"
                    value={newStoryCover}
                    onChange={(e) => setNewStoryCover(e.target.value)}
                    className="w-full px-3 py-2 rounded border border-slate-300 dark:border-white/20 bg-white dark:bg-[#1E111E]"
                  >
                    <option value="/assets/images/book_cover_obsidian_throne_1794465561565.jpg">Obsidian Throne Cover</option>
                    <option value="/assets/images/book_cover_whispering_savanna_1794465562207.jpg">Whisper of the Baobab Cover</option>
                    <option value="/assets/images/book_cover_sunken_epoch_1794465563519.jpg">Sunken Epoch Cover</option>
                    <option value="/assets/images/book_cover_crimson_dynasty_1794465562273.jpg">Crimson Scribe Cover</option>
                  </select>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label htmlFor="new-story-tier" className="block font-semibold mb-1">
                      Access Tier
                    </label>
                    <select
                      id="new-story-tier"
                      value={newStoryTier}
                      onChange={(e) => setNewStoryTier(e.target.value as AccessTier)}
                      className="w-full px-3 py-2 rounded border border-slate-300 dark:border-white/20 bg-white dark:bg-[#1E111E]"
                    >
                      <option value="subscription">Subscription</option>
                      <option value="purchase">Single Purchase</option>
                      <option value="free">Free</option>
                    </select>
                  </div>
                  <div>
                    <label htmlFor="new-story-price" className="block font-semibold mb-1">
                      Price (₦ NGN)
                    </label>
                    <input
                      id="new-story-price"
                      type="number"
                      value={newStoryPrice}
                      onChange={(e) => setNewStoryPrice(Number(e.target.value))}
                      className="w-full px-3 py-2 rounded border border-slate-300 dark:border-white/20 bg-transparent font-mono"
                    />
                  </div>
                  <div>
                    <label htmlFor="new-story-pub-status" className="block font-semibold mb-1">
                      Workflow Status
                    </label>
                    <select
                      id="new-story-pub-status"
                      value={newStoryPubStatus}
                      onChange={(e) => setNewStoryPubStatus(e.target.value as PublicationStatus)}
                      className="w-full px-3 py-2 rounded border border-slate-300 dark:border-white/20 bg-white dark:bg-[#1E111E]"
                    >
                      <option value="draft">Draft (Private)</option>
                      <option value="review">In Review (Private)</option>
                      <option value="published">Published (Live)</option>
                    </select>
                  </div>
                </div>

                {newStoryTier !== 'free' && (
                  <label
                    htmlFor="new-story-writer-purchase"
                    className="flex items-start gap-2.5 p-3 rounded-lg border border-[#2D142C]/15 dark:border-white/15 bg-[#F9F6F0]/70 dark:bg-[#160C16]/70 cursor-pointer"
                  >
                    <input
                      id="new-story-writer-purchase"
                      type="checkbox"
                      checked={newStoryWriterRequiresPurchase}
                      onChange={(e) => setNewStoryWriterRequiresPurchase(e.target.checked)}
                      className="mt-0.5 accent-[#C85A32]"
                    />
                    <span className="text-xs leading-relaxed">
                      <strong className="block font-semibold">Require writers to purchase this book</strong>
                      <span className="opacity-75">
                        By default, upgraded Writers read catalog books free. Check this to require Writers to purchase this specific release (Owner always retains total access).
                      </span>
                    </span>
                  </label>
                )}

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label htmlFor="new-story-synopsis" className="block font-semibold">
                      Synopsis
                    </label>
                    <button
                      type="button"
                      disabled={aiCraftingSynopsis}
                      onClick={handleAICraftSynopsis}
                      className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#C85A32] hover:underline disabled:opacity-55 cursor-pointer"
                    >
                      <Sparkles className="w-3 h-3" />
                      <span>{aiCraftingSynopsis ? 'Generating...' : 'Generate Synopsis'}</span>
                    </button>
                  </div>
                  <textarea
                    id="new-story-synopsis"
                    rows={4}
                    required
                    value={newStorySynopsis}
                    onChange={(e) => setNewStorySynopsis(e.target.value)}
                    placeholder="Enter story synopsis..."
                    className="w-full px-3 py-2 rounded border border-slate-300 dark:border-white/20 bg-transparent font-reader text-sm"
                  />
                </div>

                <button
                  type="submit"
                  className="w-full py-3 bg-[#C85A32] text-white font-semibold rounded-lg hover:bg-[#b04d28] cursor-pointer"
                >
                  Publish Story
                </button>
              </form>
            </div>
          </div>
        )}

        {/* Tab 2: Access & Pricing Rules */}
        {activeTab === 'pricing' && (
          <div className="bg-white dark:bg-[#1E111E] p-6 rounded-xl border border-[#2D142C]/10 dark:border-white/10 space-y-6">
            <div className="space-y-2">
              <h2 className="font-display text-2xl font-bold">Access Tier &amp; Pricing Rules</h2>
              <p className="text-xs text-[#2D142C]/65 dark:text-white/65 font-sans-ui">
                Server-authoritative pricing, free chapter threshold, and Owner-specified Writer paywall exclusions per title.
              </p>
              <div className="p-3.5 rounded-lg bg-[#F9F6F0] dark:bg-[#160C16] border border-[#C85A32]/25 text-xs font-reader text-[#2D142C]/85 dark:text-white/85">
                <strong>Owner Privilege:</strong> Your Owner account always has complimentary total access to every title and draft. Upgraded Writers read all paid books free by default unless you switch a specific book to <strong>Writers Must Pay</strong> below.
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs font-sans-ui">
                <thead className="bg-[#2D142C]/5 dark:bg-white/5 border-b border-[#2D142C]/10 dark:border-white/10 text-[#2D142C]/70 dark:text-white/70">
                  <tr>
                    <th className="py-3 px-4">Story Title</th>
                    <th className="py-3 px-4">Access Tier</th>
                    <th className="py-3 px-4">One-Time Price (₦)</th>
                    <th className="py-3 px-4">Free Chapters</th>
                    <th className="py-3 px-4">Writer Access</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#2D142C]/10 dark:divide-white/10">
                  {stories.map(story => {
                    const isFreeTier = story.accessTier === 'free';
                    const writerMustPay = !isFreeTier && Boolean(story.writerRequiresPurchase);
                    return (
                    <tr key={story.id}>
                      <td className="py-3 px-4 font-bold">{story.title}</td>
                      <td className="py-3 px-4">
                        <select
                          aria-label={`Access tier for ${story.title}`}
                          value={story.accessTier}
                          onChange={(e) =>
                            void updateStoryPricing(
                              story.id,
                              e.target.value as AccessTier,
                              story.priceNgn,
                              story.freeChaptersCount,
                              e.target.value === 'free' ? false : Boolean(story.writerRequiresPurchase)
                            )
                          }
                          className="bg-transparent border border-slate-300 dark:border-white/20 rounded px-2 py-1 text-xs"
                        >
                          <option value="subscription" className="bg-white dark:bg-[#1E111E]">Subscription</option>
                          <option value="purchase" className="bg-white dark:bg-[#1E111E]">Single Purchase</option>
                          <option value="free" className="bg-white dark:bg-[#1E111E]">Free</option>
                        </select>
                      </td>
                      <td className="py-3 px-4">
                        <input
                          type="number"
                          aria-label={`Price in NGN for ${story.title}`}
                          value={story.priceNgn}
                          onChange={(e) =>
                            void updateStoryPricing(
                              story.id,
                              story.accessTier,
                              Number(e.target.value),
                              story.freeChaptersCount,
                              Boolean(story.writerRequiresPurchase)
                            )
                          }
                          className="w-24 px-2 py-1 border border-slate-300 dark:border-white/20 rounded font-mono text-xs"
                        />
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() =>
                              void updateStoryPricing(
                                story.id,
                                story.accessTier,
                                story.priceNgn,
                                Math.max(0, story.freeChaptersCount - 1),
                                Boolean(story.writerRequiresPurchase)
                              )
                            }
                            className="px-2 py-0.5 border rounded cursor-pointer"
                          >
                            -
                          </button>
                          <span className="font-semibold">{story.freeChaptersCount} Free</span>
                          <button
                            type="button"
                            onClick={() =>
                              void updateStoryPricing(
                                story.id,
                                story.accessTier,
                                story.priceNgn,
                                story.freeChaptersCount + 1,
                                Boolean(story.writerRequiresPurchase)
                              )
                            }
                            className="px-2 py-0.5 border rounded cursor-pointer"
                          >
                            +
                          </button>
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        {isFreeTier ? (
                          <span className="text-[11px] opacity-65">Open to All (Free)</span>
                        ) : (
                          <button
                            type="button"
                            onClick={async () => {
                              const nextRestricted = !writerMustPay;
                              const res = await updateStoryPricing(
                                story.id,
                                story.accessTier,
                                story.priceNgn,
                                story.freeChaptersCount,
                                nextRestricted
                              );
                              if (res.ok) {
                                showToast(
                                  nextRestricted
                                    ? `Writers now require purchase for "${story.title}".`
                                    : `Writers now have complimentary access to "${story.title}".`
                                );
                              } else {
                                showToast(res.error || 'Could not update writer access rule.');
                              }
                            }}
                            className={`px-3 py-1.5 rounded-lg text-[11px] font-semibold cursor-pointer whitespace-nowrap shrink-0 transition-colors ${
                              writerMustPay
                                ? 'bg-[#C85A32] text-white hover:bg-[#b04d28]'
                                : 'border border-emerald-600/40 text-emerald-700 dark:text-emerald-300 bg-emerald-50/70 dark:bg-emerald-950/30 hover:border-[#C85A32]'
                            }`}
                          >
                            {writerMustPay ? 'Writers Must Pay' : 'Complimentary for Writers'}
                          </button>
                        )}
                      </td>
                    </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Tab 3: Verified Order Ledger */}
        {activeTab === 'ledger' && (
          <div className="bg-white dark:bg-[#1E111E] p-6 rounded-xl border border-[#2D142C]/10 dark:border-white/10 space-y-4">
            <div>
              <h2 className="font-display text-2xl font-bold">Server Order &amp; Webhook Ledger</h2>
              <p className="text-xs text-[#2D142C]/65 dark:text-white/65 font-sans-ui mt-0.5">
                Recorded orders and settled Paystack transactions.
              </p>
            </div>

            {adminTransactions.length === 0 ? (
              <div className="p-8 text-center text-xs text-[#2D142C]/60 dark:text-white/60 border border-dashed border-current/15 rounded-xl">
                No orders have been initialized yet.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs font-sans-ui">
                  <thead className="bg-[#2D142C]/5 dark:bg-white/5 border-b border-[#2D142C]/10 dark:border-white/10">
                    <tr>
                      <th className="py-3 px-4">Reference</th>
                      <th className="py-3 px-4">Customer Email</th>
                      <th className="py-3 px-4">Item</th>
                      <th className="py-3 px-4">Amount (NGN)</th>
                      <th className="py-3 px-4">Status</th>
                      <th className="py-3 px-4">Date</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#2D142C]/10 dark:divide-white/10">
                    {adminTransactions.map(tx => (
                      <tr key={tx.id}>
                        <td className="py-3 px-4 font-mono text-[11px] text-[#C85A32]">{tx.reference}</td>
                        <td className="py-3 px-4">{tx.customerEmail}</td>
                        <td className="py-3 px-4 font-medium">{tx.itemName}</td>
                        <td className="py-3 px-4 font-bold tabular-nums">₦{tx.amountNgn.toLocaleString('en-NG')}</td>
                        <td className="py-3 px-4 capitalize">{tx.status}</td>
                        <td className="py-3 px-4 text-[#2D142C]/65 dark:text-white/65">
                          {new Date(tx.date).toLocaleDateString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Tab 1b: Profiles & Approved Writers (Owner Only) */}
        {activeTab === 'users' && (
          <div className="space-y-8">
            {/* Approved Writers Launchpad */}
            <section className="p-6 sm:p-7 rounded-2xl bg-[#2D142C] text-[#F9F6F0] border border-[#C85A32]/35 space-y-5 shadow-sm">
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                <div className="space-y-1.5 max-w-2xl">
                  <div className="flex items-center gap-2 text-[11px] font-sans-ui font-semibold uppercase tracking-[0.18em] text-[#C85A32]">
                    <Feather className="w-3.5 h-3.5" />
                    <span>Writer Portal Launchpad</span>
                    <span className="opacity-40">&middot;</span>
                    <span>{approvedWritersList.length} Approved {approvedWritersList.length === 1 ? 'Writer' : 'Writers'}</span>
                  </div>
                  <h2 className="font-display text-2xl font-bold text-white">
                    Writers &amp; Publishing Portal Roster
                  </h2>
                  <p className="font-reader text-xs sm:text-sm text-white/80 leading-relaxed">
                    Anyone upgraded to a Writer receives direct access to Writer Studio on their Account Dashboard and Profile. Share the portal link below or open Writer Studio yourself as Owner.
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2.5 shrink-0 font-sans-ui">
                  <button
                    type="button"
                    onClick={() => void handleCopyWriterPortalLink()}
                    className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-lg border border-white/25 hover:border-[#C85A32] text-white text-xs font-semibold cursor-pointer whitespace-nowrap shrink-0 transition-colors"
                  >
                    {copiedWriterLink ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-300" />
                        <span>Invite Link Copied</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5 text-[#C85A32]" />
                        <span>Copy Writer Link (/writer)</span>
                      </>
                    )}
                  </button>
                  <a
                    href={buildHref('writer')}
                    onClick={(e) => {
                      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
                      e.preventDefault();
                      navigate('writer');
                    }}
                    className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-[#C85A32] hover:bg-[#b04d28] text-white text-xs font-semibold whitespace-nowrap shrink-0 transition-colors"
                  >
                    <Feather className="w-3.5 h-3.5" />
                    <span>Open Writer Studio</span>
                  </a>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {approvedWritersList.map((writer) => (
                  <div
                    key={`roster-${writer.id}`}
                    className="p-3.5 rounded-xl bg-white/[0.07] border border-white/15 flex items-center justify-between gap-3"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-10 h-10 rounded-full overflow-hidden border border-[#C85A32] bg-[#160C16] text-white flex items-center justify-center shrink-0">
                        <ReaderAvatar
                          src={writer.avatar}
                          name={writer.nickname || writer.name}
                          initialClassName="font-display text-sm font-bold leading-none"
                        />
                      </div>
                      <div className="min-w-0">
                        <div className="font-display text-sm font-bold text-white truncate">
                          {writer.nickname || writer.name}
                        </div>
                        <div className="text-[11px] font-sans-ui text-white/70 truncate">
                          {writer.email}
                        </div>
                        <div className="text-[10px] font-sans-ui uppercase tracking-wider text-[#C85A32] font-semibold mt-0.5">
                          {writer.role === 'owner' ? 'Owner · Writer & Reader' : writer.role}
                        </div>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => setInspectedProfile(writer)}
                      className="px-2.5 py-1.5 rounded-lg border border-white/20 hover:border-[#C85A32] text-white text-[11px] font-semibold font-sans-ui cursor-pointer whitespace-nowrap shrink-0"
                    >
                      Profile
                    </button>
                  </div>
                ))}
              </div>
            </section>

            {/* All Community Profiles Directory */}
            <section className="bg-white dark:bg-[#1E111E] p-6 rounded-2xl border border-[#2D142C]/10 dark:border-white/10 space-y-5">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <h2 className="font-display text-2xl font-bold">
                    All Registered Community Profiles
                  </h2>
                  <p className="text-xs text-[#2D142C]/65 dark:text-white/65 font-sans-ui mt-0.5">
                    Inspect any reader or writer profile and upgrade trusted contributors to Writer access.
                  </p>
                </div>

                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 font-sans-ui text-xs">
                  <div className="relative min-w-[220px]">
                    <label htmlFor="admin-user-search" className="sr-only">
                      Search user profiles by name, nickname, or email
                    </label>
                    <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 opacity-50 pointer-events-none" />
                    <input
                      id="admin-user-search"
                      type="search"
                      value={userSearch}
                      onChange={(e) => setUserSearch(e.target.value)}
                      placeholder="Search name, nickname, or email..."
                      className="w-full pl-8 pr-3 py-2 rounded-lg border border-[#2D142C]/20 dark:border-white/20 bg-transparent focus:outline-none focus:border-[#C85A32]"
                    />
                  </div>

                  <div className="flex items-center rounded-lg border border-[#2D142C]/15 dark:border-white/15 p-0.5 bg-[#F9F6F0] dark:bg-[#160C16]">
                    {(
                      [
                        { key: 'all', label: `All (${adminUsers.length})` },
                        { key: 'writers', label: `Writers (${approvedWritersList.length})` },
                        {
                          key: 'readers',
                          label: `Readers (${adminUsers.filter((u) => u.role === 'reader').length})`,
                        },
                      ] as const
                    ).map((item) => (
                      <button
                        key={item.key}
                        type="button"
                        onClick={() => setUserRoleFilter(item.key)}
                        className={`px-3 py-1.5 rounded-md font-semibold cursor-pointer whitespace-nowrap shrink-0 transition-colors ${
                          userRoleFilter === item.key
                            ? 'bg-[#C85A32] text-white'
                            : 'text-[#2D142C]/70 dark:text-white/70 hover:text-[#C85A32]'
                        }`}
                      >
                        {item.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {filteredUsers.length === 0 ? (
                <div className="p-8 text-center text-xs text-[#2D142C]/60 dark:text-white/60 border border-dashed border-current/15 rounded-xl font-sans-ui">
                  No profiles match your search filter.
                </div>
              ) : (
                <div className="divide-y divide-[#2D142C]/10 dark:divide-white/10 border border-[#2D142C]/10 dark:border-white/10 rounded-xl overflow-hidden">
                  {filteredUsers.map((entry) => {
                    const isEntryOwner = entry.role === 'owner';
                    const isWriter = entry.role === 'writer' || entry.role === 'admin';
                    const entryDisplay = entry.nickname || entry.name;
                    const busy = updatingRoleId === entry.id;
                    return (
                      <div
                        key={entry.id}
                        className="p-4 sm:p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4 hover:bg-[#F9F6F0]/60 dark:hover:bg-white/[0.02] transition-colors"
                      >
                        <div className="flex items-start gap-3.5 min-w-0">
                          <div className="w-12 h-12 rounded-full overflow-hidden border border-[#C85A32]/60 bg-[#2D142C] text-[#F9F6F0] flex items-center justify-center shrink-0">
                            <ReaderAvatar
                              src={entry.avatar}
                              name={entryDisplay}
                              initialClassName="font-display text-lg font-bold leading-none"
                            />
                          </div>
                          <div className="min-w-0 space-y-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="font-display text-base font-bold truncate">
                                {entryDisplay}
                              </span>
                              {entry.nickname && entry.nickname !== entry.name && (
                                <span className="text-xs opacity-65 font-sans-ui truncate">
                                  ({entry.name})
                                </span>
                              )}
                            </div>
                            <div className="text-xs font-sans-ui text-[#2D142C]/70 dark:text-white/70 truncate">
                              {entry.email || 'No email recorded'}
                            </div>
                            <div className="text-[11px] font-sans-ui text-[#2D142C]/70 dark:text-white/70 flex flex-wrap items-center gap-1.5">
                              <span className="font-semibold text-[#C85A32] uppercase tracking-wider">
                                {isEntryOwner
                                  ? 'Owner · Writer & Reader'
                                  : isWriter
                                  ? `Approved ${entry.role}`
                                  : 'Reader'}
                              </span>
                              <span>&middot;</span>
                              <span>
                                {entry.subscription.status === 'active'
                                  ? `Patron (${entry.subscription.plan})`
                                  : 'Free Account'}
                              </span>
                              <span>&middot;</span>
                              <span className="tabular-nums">
                                {entry.completedChaptersCount} ch completed
                              </span>
                              <span>&middot;</span>
                              <span>
                                Joined{' '}
                                {new Date(entry.createdAt).toLocaleDateString('en-US', {
                                  month: 'short',
                                  day: 'numeric',
                                  year: 'numeric',
                                })}
                              </span>
                            </div>
                            {entry.bio && (
                              <p className="font-reader text-xs opacity-80 line-clamp-2 pt-0.5 max-w-2xl">
                                {entry.bio}
                              </p>
                            )}
                          </div>
                        </div>

                        <div className="flex flex-wrap items-center gap-2 shrink-0 font-sans-ui text-xs">
                          <button
                            type="button"
                            onClick={() => setInspectedProfile(entry)}
                            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-[#2D142C]/20 dark:border-white/20 hover:border-[#C85A32] hover:text-[#C85A32] font-semibold cursor-pointer whitespace-nowrap shrink-0 transition-colors"
                          >
                            <Eye className="w-3.5 h-3.5 text-[#C85A32]" />
                            <span>View Profile</span>
                          </button>

                          {!isEntryOwner && (
                            <button
                              type="button"
                              disabled={busy}
                              onClick={() =>
                                void handleRoleToggle(entry, isWriter ? 'reader' : 'writer')
                              }
                              className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg font-semibold cursor-pointer whitespace-nowrap shrink-0 disabled:opacity-60 transition-colors ${
                                isWriter
                                  ? 'border border-[#2D142C]/20 dark:border-white/20 hover:border-red-500 hover:text-red-600 dark:hover:text-red-400'
                                  : 'bg-[#C85A32] hover:bg-[#b04d28] text-white'
                              }`}
                            >
                              {busy ? (
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              ) : (
                                <Feather className="w-3.5 h-3.5" />
                              )}
                              <span>
                                {busy
                                  ? 'Saving...'
                                  : isWriter
                                  ? 'Set as Reader'
                                  : 'Upgrade to Writer'}
                              </span>
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>
          </div>
        )}

        {/* Profile Inspection Modal */}
        {inspectedProfile && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs"
            onClick={() => setInspectedProfile(null)}
          >
            <div
              ref={profileDialogRef}
              tabIndex={-1}
              role="dialog"
              aria-modal="true"
              aria-labelledby="inspected-profile-title"
              className="bg-white dark:bg-[#1E111E] rounded-2xl max-w-lg w-full p-6 space-y-5 border border-[#2D142C]/15 dark:border-white/15 shadow-2xl focus:outline-none"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-start justify-between gap-4 border-b border-current/10 pb-4">
                <div className="flex items-center gap-3.5 min-w-0">
                  <div className="w-16 h-16 rounded-full overflow-hidden border-2 border-[#C85A32] bg-[#2D142C] text-[#F9F6F0] flex items-center justify-center shrink-0">
                    <ReaderAvatar
                      src={inspectedProfile.avatar}
                      name={inspectedProfile.nickname || inspectedProfile.name}
                      initialClassName="font-display text-2xl font-bold leading-none"
                    />
                  </div>
                  <div className="min-w-0">
                    <h3 id="inspected-profile-title" className="font-display text-xl font-bold truncate">
                      {inspectedProfile.nickname || inspectedProfile.name}
                    </h3>
                    {inspectedProfile.nickname && inspectedProfile.nickname !== inspectedProfile.name && (
                      <p className="text-xs font-sans-ui opacity-70 truncate">
                        Full Name: {inspectedProfile.name}
                      </p>
                    )}
                    <p className="text-xs font-sans-ui text-[#C85A32] font-medium truncate">
                      {inspectedProfile.email}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setInspectedProfile(null)}
                  aria-label="Close profile dialog"
                  className="p-1.5 rounded-lg hover:bg-current/10 cursor-pointer shrink-0"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="grid grid-cols-2 gap-3 text-xs font-sans-ui">
                <div className="p-3 rounded-xl bg-[#F9F6F0] dark:bg-[#160C16] border border-current/10">
                  <div className="opacity-65 text-[11px]">Account Role</div>
                  <div className="font-bold uppercase tracking-wider text-[#C85A32] mt-0.5">
                    {inspectedProfile.role === 'owner'
                      ? 'Owner (Writer & Reader)'
                      : inspectedProfile.role}
                  </div>
                </div>
                <div className="p-3 rounded-xl bg-[#F9F6F0] dark:bg-[#160C16] border border-current/10">
                  <div className="opacity-65 text-[11px]">Membership Tier</div>
                  <div className="font-bold mt-0.5 capitalize">
                    {inspectedProfile.subscription.status === 'active'
                      ? `${inspectedProfile.subscription.plan} Patron`
                      : 'Free Account'}
                  </div>
                </div>
                <div className="p-3 rounded-xl bg-[#F9F6F0] dark:bg-[#160C16] border border-current/10">
                  <div className="opacity-65 text-[11px]">Chapters Completed</div>
                  <div className="font-bold font-mono tabular-nums mt-0.5">
                    {inspectedProfile.completedChaptersCount}
                  </div>
                </div>
                <div className="p-3 rounded-xl bg-[#F9F6F0] dark:bg-[#160C16] border border-current/10">
                  <div className="opacity-65 text-[11px]">Custom Bookshelves</div>
                  <div className="font-bold font-mono tabular-nums mt-0.5">
                    {inspectedProfile.bookshelvesCount}
                  </div>
                </div>
              </div>

              <div className="space-y-1">
                <div className="text-[11px] font-sans-ui uppercase tracking-wider font-semibold opacity-65">
                  Reader Bio
                </div>
                <p className="font-reader text-sm opacity-85 leading-relaxed">
                  {inspectedProfile.bio || 'No bio added yet.'}
                </p>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-current/10 font-sans-ui text-xs">
                <span className="opacity-65">
                  Member since{' '}
                  {new Date(inspectedProfile.createdAt).toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                  })}
                </span>
                <div className="flex items-center gap-2">
                  {inspectedProfile.role !== 'owner' && (
                    <button
                      type="button"
                      disabled={updatingRoleId === inspectedProfile.id}
                      onClick={() =>
                        void handleRoleToggle(
                          inspectedProfile,
                          inspectedProfile.role === 'writer' || inspectedProfile.role === 'admin'
                            ? 'reader'
                            : 'writer'
                        )
                      }
                      className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#C85A32] hover:bg-[#b04d28] text-white font-semibold cursor-pointer whitespace-nowrap shrink-0 disabled:opacity-60"
                    >
                      <ShieldCheck className="w-3.5 h-3.5" />
                      <span>
                        {inspectedProfile.role === 'writer' || inspectedProfile.role === 'admin'
                          ? 'Set as Reader'
                          : 'Upgrade to Writer'}
                      </span>
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setInspectedProfile(null)}
                    className="px-4 py-2 rounded-lg border border-current/20 font-semibold cursor-pointer whitespace-nowrap shrink-0"
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Tab 4: Contact Messages */}
        {activeTab === 'inquiries' && (
          <div className="bg-white dark:bg-[#1E111E] p-6 rounded-xl border border-[#2D142C]/10 dark:border-white/10 space-y-4">
            <div>
              <h2 className="font-display text-2xl font-bold">Contact Messages</h2>
              <p className="text-xs text-[#2D142C]/65 dark:text-white/65 font-sans-ui mt-0.5">
                Messages submitted via the Contact page.
              </p>
            </div>

            {adminInquiries.length === 0 ? (
              <div className="p-8 text-center text-xs text-[#2D142C]/60 dark:text-white/60 border border-dashed border-current/15 rounded-xl">
                No contact messages submitted yet.
              </div>
            ) : (
              <div className="space-y-3">
                {adminInquiries.map(inq => (
                  <div
                    key={inq.id}
                    className="p-4 rounded-xl border border-[#2D142C]/10 dark:border-white/10 bg-[#F9F6F0]/50 dark:bg-[#160C16]/50 space-y-2 text-xs font-sans-ui"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-[10px] font-bold px-2 py-0.5 rounded bg-[#C85A32]/15 text-[#C85A32]">
                          {inq.referenceId}
                        </span>
                        <span className="font-bold text-sm">{inq.subject}</span>
                      </div>
                      <span className="opacity-60">{inq.submittedAt}</span>
                    </div>
                    <div className="text-[11px] opacity-75">
                      From <strong>{inq.name}</strong> ({inq.email}) &middot; {inq.inquiryType}
                    </div>
                    <p className="font-reader text-sm opacity-90 pt-1">{inq.message}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

      </div>
    </div>
  );
};
