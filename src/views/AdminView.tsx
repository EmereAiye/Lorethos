import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { 
  ShieldCheck, 
  BookOpen, 
  Plus, 
  DollarSign, 
  Users, 
  TrendingUp, 
  Edit3, 
  Save, 
  Trash2, 
  CheckCircle2, 
  Image as ImageIcon,
  Key,
  Layers,
  ArrowRight,
  Sparkles
} from 'lucide-react';
import { Story, Chapter, AccessTier, StoryStatus } from '../types';

export const AdminView: React.FC = () => {
  const { 
    stories, 
    transactions, 
    user, 
    toggleRole, 
    updateStory, 
    addStory, 
    addChapterToStory, 
    updateStoryPricing,
    navigate
  } = useApp();

  const [activeTab, setActiveTab] = useState<'studio' | 'pricing' | 'ledger' | 'assets'>('studio');
  const [selectedStoryId, setSelectedStoryId] = useState<string>(stories[0]?.id || '');
  const [isCreatingStory, setIsCreatingStory] = useState(false);
  const [isAddingChapter, setIsAddingChapter] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  // New Story Form State
  const [newStoryTitle, setNewStoryTitle] = useState('');
  const [newStorySubtitle, setNewStorySubtitle] = useState('');
  const [newStoryAuthor, setNewStoryAuthor] = useState('Lorethos Scriptorium');
  const [newStoryGenre, setNewStoryGenre] = useState('Epic Fantasy');
  const [newStorySynopsis, setNewStorySynopsis] = useState('');
  const [newStoryPrice, setNewStoryPrice] = useState(2500);
  const [newStoryTier, setNewStoryTier] = useState<AccessTier>('subscription');
  const [newStoryCover, setNewStoryCover] = useState('/src/assets/images/book_cover_obsidian_throne_1794465561565.jpg');

  // New Chapter Form State
  const [newChapterTitle, setNewChapterTitle] = useState('');
  const [newChapterNumber, setNewChapterNumber] = useState(1);
  const [newChapterExcerpt, setNewChapterExcerpt] = useState('');
  const [newChapterContent, setNewChapterContent] = useState('');
  const [newChapterIsFree, setNewChapterIsFree] = useState(false);

  const selectedStory = stories.find(s => s.id === selectedStoryId) || stories[0];

  const totalRevenueNgn = transactions.reduce((acc, curr) => acc + curr.amountNgn, 2450000);
  const totalReads = stories.reduce((acc, curr) => acc + curr.totalReads, 0);

  const handleCreateStory = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newStoryTitle.trim()) return;

    addStory({
      slug: newStoryTitle.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, ''),
      title: newStoryTitle,
      subtitle: newStorySubtitle || 'An Original Lorethos Saga',
      author: newStoryAuthor,
      authorBio: 'Prolific writer under the Lorethos independent imprint.',
      genre: newStoryGenre,
      tags: [newStoryGenre, 'Serialized', 'New Release'],
      coverImage: newStoryCover,
      synopsis: newStorySynopsis,
      prologueLore: 'Transcribed from the foundational manuscripts of the Scriptorium.',
      status: 'Ongoing',
      accessTier: newStoryTier,
      priceNgn: Number(newStoryPrice),
      rating: 5.0,
      ratingsCount: 1,
      totalChapters: 1,
      totalReads: 120,
      freeChaptersCount: 3,
      featured: false,
      updatedAt: 'Just now'
    });

    setIsCreatingStory(false);
    setNewStoryTitle('');
    setNewStorySynopsis('');
    showToast('New story published to catalog successfully!');
  };

  const handleAddChapter = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newChapterTitle.trim() || !selectedStory) return;

    const paragraphs = newChapterContent.split('\n\n').filter(p => p.trim().length > 0);

    addChapterToStory(selectedStory.id, {
      chapterNumber: Number(newChapterNumber),
      title: newChapterTitle,
      slug: newChapterTitle.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
      releaseDate: 'Today',
      wordCount: Math.round(newChapterContent.split(' ').length) || 1500,
      readTimeMinutes: Math.max(3, Math.round(newChapterContent.split(' ').length / 250)),
      isFree: newChapterIsFree,
      excerpt: newChapterExcerpt || paragraphs[0] || 'A new chapter begins in the annals of Lorethos.',
      content: paragraphs.length > 0 ? paragraphs : ['The ink settles upon the page.']
    });

    setIsAddingChapter(false);
    setNewChapterTitle('');
    setNewChapterContent('');
    setNewChapterExcerpt('');
    showToast(`Chapter ${newChapterNumber} published to "${selectedStory.title}"!`);
  };

  const showToast = (msg: string) => {
    setStatusMessage(msg);
    setTimeout(() => setStatusMessage(null), 3000);
  };

  return (
    <div className="min-h-screen bg-[#F9F6F0] dark:bg-[#160C16] text-[#2D142C] dark:text-[#F9F6F0] py-12 transition-colors">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-10">
        
        {/* Toast */}
        {statusMessage && (
          <div className="fixed bottom-6 right-6 z-50 bg-[#2D142C] text-white px-5 py-3 rounded-lg shadow-2xl border border-[#C85A32] flex items-center gap-2 text-xs font-sans-ui animate-in fade-in">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            <span>{statusMessage}</span>
          </div>
        )}

        {/* Admin Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-8 rounded-2xl bg-white dark:bg-[#1E111E] border border-[#2D142C]/10 dark:border-white/10 shadow-xs">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-bold tracking-widest uppercase bg-[#C85A32]/10 text-[#C85A32] px-2 py-0.5 rounded font-sans-ui">
                OWNER COMMAND CENTER
              </span>
              <span className="text-xs text-[#2D142C]/60 dark:text-white/60">
                Independent Publishing Platform
              </span>
            </div>
            <h1 className="font-display text-3xl sm:text-4xl font-bold">
              Lorethos Publishing Desk
            </h1>
            <p className="text-xs text-[#2D142C]/70 dark:text-white/70 font-sans-ui">
              Manage stories, write serialized chapters, configure Naira pricing rules, and monitor Paystack reader revenue.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={toggleRole}
              className="px-3.5 py-2 text-xs rounded-lg border border-[#2D142C]/20 dark:border-white/20 hover:border-[#C85A32] transition-colors cursor-pointer font-sans-ui"
            >
              Mode: {user.role === 'owner' ? 'Owner (Active)' : 'Reader'} (Click to toggle)
            </button>
            <button
              onClick={() => setIsCreatingStory(true)}
              className="px-4 py-2.5 bg-[#C85A32] hover:bg-[#b04d28] text-white text-xs font-semibold rounded-lg flex items-center gap-2 transition-colors cursor-pointer shadow-xs"
            >
              <Plus className="w-4 h-4" />
              <span>Create New Story</span>
            </button>
          </div>
        </div>

        {/* KPI Summary Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="p-6 rounded-xl bg-white dark:bg-[#1E111E] border border-[#2D142C]/10 dark:border-white/10 space-y-2">
            <div className="flex items-center justify-between text-xs text-[#2D142C]/60 dark:text-white/60 font-sans-ui">
              <span>Gross Revenue (Paystack)</span>
              <DollarSign className="w-4 h-4 text-[#C85A32]" />
            </div>
            <div className="font-sans-ui text-2xl sm:text-3xl font-bold tabular-nums text-[#2D142C] dark:text-white">
              ₦{totalRevenueNgn.toLocaleString('en-NG')}
            </div>
            <p className="text-[11px] text-emerald-600 font-medium">
              +18.4% from last month &middot; Nigerian Cards & USSD
            </p>
          </div>

          <div className="p-6 rounded-xl bg-white dark:bg-[#1E111E] border border-[#2D142C]/10 dark:border-white/10 space-y-2">
            <div className="flex items-center justify-between text-xs text-[#2D142C]/60 dark:text-white/60 font-sans-ui">
              <span>Active Patron Subscribers</span>
              <Users className="w-4 h-4 text-[#C85A32]" />
            </div>
            <div className="font-sans-ui text-2xl sm:text-3xl font-bold tabular-nums text-[#2D142C] dark:text-white">
              842
            </div>
            <p className="text-[11px] text-[#2D142C]/60 dark:text-white/60 font-sans-ui">
              ₦3,500/mo &middot; 92.4% renewal retention
            </p>
          </div>

          <div className="p-6 rounded-xl bg-white dark:bg-[#1E111E] border border-[#2D142C]/10 dark:border-white/10 space-y-2">
            <div className="flex items-center justify-between text-xs text-[#2D142C]/60 dark:text-white/60 font-sans-ui">
              <span>Total Chapter Reads</span>
              <BookOpen className="w-4 h-4 text-[#C85A32]" />
            </div>
            <div className="font-sans-ui text-2xl sm:text-3xl font-bold tabular-nums text-[#2D142C] dark:text-white">
              {totalReads.toLocaleString()}
            </div>
            <p className="text-[11px] text-[#2D142C]/60 dark:text-white/60 font-sans-ui">
              Across {stories.length} catalog novels
            </p>
          </div>

          <div className="p-6 rounded-xl bg-white dark:bg-[#1E111E] border border-[#2D142C]/10 dark:border-white/10 space-y-2">
            <div className="flex items-center justify-between text-xs text-[#2D142C]/60 dark:text-white/60 font-sans-ui">
              <span>Published Titles</span>
              <Layers className="w-4 h-4 text-[#C85A32]" />
            </div>
            <div className="font-sans-ui text-2xl sm:text-3xl font-bold tabular-nums text-[#2D142C] dark:text-white">
              {stories.length}
            </div>
            <p className="text-[11px] text-[#2D142C]/60 dark:text-white/60 font-sans-ui">
              All series have 3-chapter freemium hooks
            </p>
          </div>
        </div>

        {/* Section Tabs */}
        <div className="flex border-b border-[#2D142C]/10 dark:border-white/10 gap-2 font-sans-ui text-xs font-semibold">
          <button
            onClick={() => setActiveTab('studio')}
            className={`py-3 px-4 border-b-2 transition-all cursor-pointer flex items-center gap-2 ${
              activeTab === 'studio'
                ? 'border-[#C85A32] text-[#C85A32]'
                : 'border-transparent text-[#2D142C]/60 dark:text-white/60 hover:text-[#C85A32]'
            }`}
          >
            <Edit3 className="w-3.5 h-3.5" />
            <span>Story & Chapter Studio</span>
          </button>

          <button
            onClick={() => setActiveTab('pricing')}
            className={`py-3 px-4 border-b-2 transition-all cursor-pointer flex items-center gap-2 ${
              activeTab === 'pricing'
                ? 'border-[#C85A32] text-[#C85A32]'
                : 'border-transparent text-[#2D142C]/60 dark:text-white/60 hover:text-[#C85A32]'
            }`}
          >
            <Key className="w-3.5 h-3.5" />
            <span>Access & Pricing Rules</span>
          </button>

          <button
            onClick={() => setActiveTab('ledger')}
            className={`py-3 px-4 border-b-2 transition-all cursor-pointer flex items-center gap-2 ${
              activeTab === 'ledger'
                ? 'border-[#C85A32] text-[#C85A32]'
                : 'border-transparent text-[#2D142C]/60 dark:text-white/60 hover:text-[#C85A32]'
            }`}
          >
            <TrendingUp className="w-3.5 h-3.5" />
            <span>Subscriber & Revenue Ledger</span>
          </button>
        </div>

        {/* Tab 1: Story & Chapter Studio */}
        {activeTab === 'studio' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            
            {/* Story Selector List */}
            <div className="lg:col-span-4 bg-white dark:bg-[#1E111E] p-5 rounded-xl border border-[#2D142C]/10 dark:border-white/10 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-display text-lg font-bold">Catalog Stories</h3>
                <span className="text-[11px] font-mono text-[#2D142C]/60 dark:text-white/60">
                  {stories.length} Works
                </span>
              </div>

              <div className="space-y-2">
                {stories.map(story => (
                  <div
                    key={story.id}
                    onClick={() => setSelectedStoryId(story.id)}
                    className={`p-3 rounded-lg border transition-all cursor-pointer flex items-center gap-3 ${
                      selectedStory.id === story.id
                        ? 'border-[#C85A32] bg-[#C85A32]/5 ring-1 ring-[#C85A32]'
                        : 'border-[#2D142C]/10 dark:border-white/10 hover:border-[#C85A32]/40'
                    }`}
                  >
                    <img
                      src={story.coverImage}
                      alt=""
                      className="w-10 h-14 object-cover rounded shrink-0 shadow-2xs"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="text-[10px] text-[#C85A32] font-semibold uppercase font-sans-ui">
                        {story.genre}
                      </div>
                      <h4 className="font-display text-sm font-bold truncate">
                        {story.title}
                      </h4>
                      <div className="text-[11px] text-[#2D142C]/50 dark:text-white/50 font-sans-ui">
                        {story.chapters.length} Chapters &middot; ₦{story.priceNgn}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Chapter Management & Editor */}
            <div className="lg:col-span-8 bg-white dark:bg-[#1E111E] p-6 rounded-xl border border-[#2D142C]/10 dark:border-white/10 space-y-6">
              
              <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-[#2D142C]/10 dark:border-white/10 gap-3">
                <div>
                  <div className="text-xs text-[#C85A32] font-semibold uppercase font-sans-ui">
                    Editing Series
                  </div>
                  <h3 className="font-display text-2xl font-bold">{selectedStory.title}</h3>
                  <p className="text-xs text-[#2D142C]/60 dark:text-white/60 font-sans-ui">
                    Author: {selectedStory.author} &middot; Status: {selectedStory.status}
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      setNewChapterNumber(selectedStory.chapters.length + 1);
                      setIsAddingChapter(true);
                    }}
                    className="px-3 py-2 bg-[#C85A32] text-white text-xs font-semibold rounded-lg hover:bg-[#b04d28] transition-colors cursor-pointer flex items-center gap-1.5"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add Chapter {selectedStory.chapters.length + 1}</span>
                  </button>

                  <button
                    onClick={() => navigate('story-detail', { slug: selectedStory.slug })}
                    className="px-3 py-2 border border-[#2D142C]/20 dark:border-white/20 text-xs font-medium rounded-lg hover:border-[#C85A32] transition-colors cursor-pointer"
                  >
                    View Live
                  </button>
                </div>
              </div>

              {/* Add Chapter Inline Modal/Form */}
              {isAddingChapter ? (
                <form onSubmit={handleAddChapter} className="p-6 rounded-xl bg-[#F9F6F0] dark:bg-[#160C16] border border-[#C85A32]/40 space-y-4 text-xs font-sans-ui">
                  <div className="flex items-center justify-between">
                    <h4 className="font-display text-lg font-bold">
                      Add Chapter {newChapterNumber} to "{selectedStory.title}"
                    </h4>
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
                      <label className="block font-semibold mb-1">Chapter Title</label>
                      <input
                        type="text"
                        required
                        value={newChapterTitle}
                        onChange={(e) => setNewChapterTitle(e.target.value)}
                        placeholder="e.g. The Glass Tower of Ostraka"
                        className="w-full px-3 py-2 rounded border border-slate-300 dark:border-white/20 bg-white dark:bg-[#1E111E]"
                      />
                    </div>
                    <div>
                      <label className="block font-semibold mb-1">Access Rule</label>
                      <div className="flex items-center gap-4 pt-1">
                        <label className="flex items-center gap-1.5 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={newChapterIsFree}
                            onChange={(e) => setNewChapterIsFree(e.target.checked)}
                          />
                          <span>Make this Chapter Free to all readers</span>
                        </label>
                      </div>
                    </div>
                  </div>

                  <div>
                    <label className="block font-semibold mb-1">Excerpt Teaser (shown in previews & paywalls)</label>
                    <input
                      type="text"
                      value={newChapterExcerpt}
                      onChange={(e) => setNewChapterExcerpt(e.target.value)}
                      placeholder="One-sentence teaser hook..."
                      className="w-full px-3 py-2 rounded border border-slate-300 dark:border-white/20 bg-white dark:bg-[#1E111E]"
                    />
                  </div>

                  <div>
                    <label className="block font-semibold mb-1">Chapter Body (separate paragraphs with blank lines)</label>
                    <textarea
                      rows={8}
                      required
                      value={newChapterContent}
                      onChange={(e) => setNewChapterContent(e.target.value)}
                      placeholder="Write or paste your literary chapter prose here..."
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
              ) : null}

              {/* Chapters List */}
              <div className="space-y-3">
                <h4 className="font-display text-base font-bold">
                  Existing Chapters ({selectedStory.chapters.length})
                </h4>
                <div className="divide-y divide-[#2D142C]/10 dark:divide-white/10 rounded-lg border border-[#2D142C]/10 dark:border-white/10 overflow-hidden">
                  {selectedStory.chapters.map(ch => (
                    <div key={ch.id} className="p-3.5 flex items-center justify-between text-xs font-sans-ui hover:bg-[#2D142C]/[0.02]">
                      <div className="min-w-0 pr-4">
                        <div className="font-semibold text-sm truncate">
                          Ch. {ch.chapterNumber}: {ch.title}
                        </div>
                        <div className="text-[11px] text-[#2D142C]/60 dark:text-white/60">
                          {ch.wordCount.toLocaleString()} words &middot; {ch.readTimeMinutes} min &middot; {ch.releaseDate}
                        </div>
                      </div>

                      <div className="flex items-center gap-3 shrink-0">
                        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded ${
                          ch.isFree
                            ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                            : 'bg-[#C85A32]/10 text-[#C85A32]'
                        }`}>
                          {ch.isFree ? 'Free Chapter' : 'Patron Locked'}
                        </span>
                        <button
                          onClick={() => navigate('reader', { slug: selectedStory.slug, chapterNumber: ch.chapterNumber })}
                          className="text-[#C85A32] hover:underline cursor-pointer"
                        >
                          Read &rarr;
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

            </div>

          </div>
        )}

        {/* Create Story Modal */}
        {isCreatingStory && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
            <div className="bg-white dark:bg-[#1E111E] rounded-2xl max-w-xl w-full p-6 space-y-4 border border-[#2D142C]/15 dark:border-white/15 max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between border-b pb-3 border-current/10">
                <h3 className="font-display text-2xl font-bold">Publish New Story</h3>
                <button
                  onClick={() => setIsCreatingStory(false)}
                  className="text-xs text-slate-500 hover:text-black cursor-pointer"
                >
                  &times; Close
                </button>
              </div>

              <form onSubmit={handleCreateStory} className="space-y-4 text-xs font-sans-ui">
                <div>
                  <label className="block font-semibold mb-1">Story Title</label>
                  <input
                    type="text"
                    required
                    value={newStoryTitle}
                    onChange={(e) => setNewStoryTitle(e.target.value)}
                    placeholder="e.g. Chronicles of the Silver Citadel"
                    className="w-full px-3 py-2 rounded border border-slate-300 dark:border-white/20 bg-transparent text-sm"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-semibold mb-1">Author Name</label>
                    <input
                      type="text"
                      required
                      value={newStoryAuthor}
                      onChange={(e) => setNewStoryAuthor(e.target.value)}
                      className="w-full px-3 py-2 rounded border border-slate-300 dark:border-white/20 bg-transparent"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold mb-1">Genre</label>
                    <select
                      value={newStoryGenre}
                      onChange={(e) => setNewStoryGenre(e.target.value)}
                      className="w-full px-3 py-2 rounded border border-slate-300 dark:border-white/20 bg-white dark:bg-[#1E111E]"
                    >
                      <option value="Epic Fantasy">Epic Fantasy</option>
                      <option value="Mythological Realism">Mythological Realism</option>
                      <option value="Afrofuturism">Afrofuturism</option>
                      <option value="Historical Mystery">Historical Mystery</option>
                      <option value="Lost Epoch & Sci-Fi">Lost Epoch & Sci-Fi</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block font-semibold mb-1">Book Cover Artwork</label>
                  <select
                    value={newStoryCover}
                    onChange={(e) => setNewStoryCover(e.target.value)}
                    className="w-full px-3 py-2 rounded border border-slate-300 dark:border-white/20 bg-white dark:bg-[#1E111E]"
                  >
                    <option value="/src/assets/images/book_cover_obsidian_throne_1794465561565.jpg">Obsidian Throne Art</option>
                    <option value="/src/assets/images/book_cover_whispering_savanna_1794465562207.jpg">Whisper of the Baobab Art</option>
                    <option value="/src/assets/images/book_cover_sunken_epoch_1794465563519.jpg">Sunken Epoch Art</option>
                    <option value="/src/assets/images/book_cover_crimson_dynasty_1794465562273.jpg">Crimson Scribe Art</option>
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-semibold mb-1">Access Tier</label>
                    <select
                      value={newStoryTier}
                      onChange={(e) => setNewStoryTier(e.target.value as any)}
                      className="w-full px-3 py-2 rounded border border-slate-300 dark:border-white/20 bg-white dark:bg-[#1E111E]"
                    >
                      <option value="subscription">Patron Subscription Only</option>
                      <option value="purchase">Single Purchase Unlocks</option>
                      <option value="free">100% Free Access</option>
                    </select>
                  </div>
                  <div>
                    <label className="block font-semibold mb-1">One-Time Price (₦ NGN)</label>
                    <input
                      type="number"
                      value={newStoryPrice}
                      onChange={(e) => setNewStoryPrice(Number(e.target.value))}
                      className="w-full px-3 py-2 rounded border border-slate-300 dark:border-white/20 bg-transparent font-mono"
                    />
                  </div>
                </div>

                <div>
                  <label className="block font-semibold mb-1">Synopsis</label>
                  <textarea
                    rows={4}
                    required
                    value={newStorySynopsis}
                    onChange={(e) => setNewStorySynopsis(e.target.value)}
                    placeholder="Enter an evocative synopsis for the readers..."
                    className="w-full px-3 py-2 rounded border border-slate-300 dark:border-white/20 bg-transparent font-reader text-sm"
                  />
                </div>

                <button
                  type="submit"
                  className="w-full py-3 bg-[#C85A32] text-white font-semibold rounded-lg hover:bg-[#b04d28] cursor-pointer"
                >
                  Confirm & Publish Story
                </button>
              </form>
            </div>
          </div>
        )}

        {/* Tab 2: Access & Pricing Rules */}
        {activeTab === 'pricing' && (
          <div className="bg-white dark:bg-[#1E111E] p-6 rounded-xl border border-[#2D142C]/10 dark:border-white/10 space-y-6">
            <div>
              <h3 className="font-display text-2xl font-bold">Access Tier & Pricing Configuration</h3>
              <p className="text-xs text-[#2D142C]/60 dark:text-white/60 font-sans-ui mt-0.5">
                Toggle paywall rules, set individual Naira pricing for Paystack checkout, and choose the number of free chapters per series.
              </p>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs font-sans-ui">
                <thead className="bg-[#2D142C]/5 dark:bg-white/5 border-b border-[#2D142C]/10 dark:border-white/10 text-[#2D142C]/70 dark:text-white/70">
                  <tr>
                    <th className="py-3 px-4">Story Title</th>
                    <th className="py-3 px-4">Access Tier</th>
                    <th className="py-3 px-4">Naira Price (₦)</th>
                    <th className="py-3 px-4">Free Chapters Hook</th>
                    <th className="py-3 px-4">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#2D142C]/10 dark:divide-white/10">
                  {stories.map(story => (
                    <tr key={story.id} className="hover:bg-[#2D142C]/[0.02]">
                      <td className="py-3 px-4 font-bold">{story.title}</td>
                      <td className="py-3 px-4">
                        <select
                          value={story.accessTier}
                          onChange={(e) => updateStoryPricing(story.id, e.target.value as any, story.priceNgn, story.freeChaptersCount)}
                          className="bg-transparent border border-slate-300 dark:border-white/20 rounded px-2 py-1 text-xs"
                        >
                          <option value="subscription" className="bg-white dark:bg-[#1E111E]">Patron Subscription</option>
                          <option value="purchase" className="bg-white dark:bg-[#1E111E]">Single Purchase</option>
                          <option value="free" className="bg-white dark:bg-[#1E111E]">Completely Free</option>
                        </select>
                      </td>
                      <td className="py-3 px-4">
                        <input
                          type="number"
                          value={story.priceNgn}
                          onChange={(e) => updateStoryPricing(story.id, story.accessTier, Number(e.target.value), story.freeChaptersCount)}
                          className="w-24 px-2 py-1 border border-slate-300 dark:border-white/20 rounded font-mono text-xs"
                        />
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => updateStoryPricing(story.id, story.accessTier, story.priceNgn, Math.max(1, story.freeChaptersCount - 1))}
                            className="px-2 py-0.5 border rounded cursor-pointer"
                          >
                            -
                          </button>
                          <span className="font-semibold">{story.freeChaptersCount} Free Chs</span>
                          <button
                            onClick={() => updateStoryPricing(story.id, story.accessTier, story.priceNgn, story.freeChaptersCount + 1)}
                            className="px-2 py-0.5 border rounded cursor-pointer"
                          >
                            +
                          </button>
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <span className="text-emerald-600 font-semibold text-[11px] flex items-center gap-1">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>Active in Paystack</span>
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Tab 3: Subscriber & Revenue Ledger */}
        {activeTab === 'ledger' && (
          <div className="space-y-6">
            <div className="bg-white dark:bg-[#1E111E] p-6 rounded-xl border border-[#2D142C]/10 dark:border-white/10 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-display text-2xl font-bold">Paystack Webhooks & Transaction Ledger</h3>
                  <p className="text-xs text-[#2D142C]/60 dark:text-white/60 font-sans-ui mt-0.5">
                    Real-time transaction settlement log from the Paystack payment gateway.
                  </p>
                </div>
                <div className="text-xs bg-[#0BA4DB]/10 text-[#0BA4DB] px-3 py-1 rounded font-mono font-bold">
                  NIBSS Direct Settlement: LIVE
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs font-sans-ui">
                  <thead className="bg-[#2D142C]/5 dark:bg-white/5 border-b border-[#2D142C]/10 dark:border-white/10 text-[#2D142C]/70 dark:text-white/70">
                    <tr>
                      <th className="py-3 px-4">Transaction Ref</th>
                      <th className="py-3 px-4">Customer Email</th>
                      <th className="py-3 px-4">Item Transacted</th>
                      <th className="py-3 px-4">Amount (NGN)</th>
                      <th className="py-3 px-4">Channel</th>
                      <th className="py-3 px-4">Settlement</th>
                      <th className="py-3 px-4">Timestamp</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#2D142C]/10 dark:divide-white/10">
                    {transactions.map(tx => (
                      <tr key={tx.id} className="hover:bg-[#2D142C]/[0.02]">
                        <td className="py-3 px-4 font-mono text-[11px] text-[#C85A32]">{tx.reference}</td>
                        <td className="py-3 px-4">{tx.customerEmail}</td>
                        <td className="py-3 px-4 font-medium">{tx.itemName}</td>
                        <td className="py-3 px-4 font-bold tabular-nums">₦{tx.amountNgn.toLocaleString('en-NG')}</td>
                        <td className="py-3 px-4 uppercase text-[10px] font-semibold">{tx.channel}</td>
                        <td className="py-3 px-4">
                          <span className="inline-flex items-center gap-1 text-emerald-600 font-semibold text-[11px]">
                            <CheckCircle2 className="w-3 h-3" />
                            <span>Paid</span>
                          </span>
                        </td>
                        <td className="py-3 px-4 text-[#2D142C]/60 dark:text-white/60">{tx.date}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
};
