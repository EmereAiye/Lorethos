import React, { useState } from 'react';
import { Film, Sparkles, ArrowLeft } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { StoryTrailerPlayer } from '../components/StoryTrailerPlayer';
import { VideoTrailerStudio } from '../components/VideoTrailerStudio';

const STARTER_PROMPTS = [
  {
    label: 'Stormy Watchtower',
    text: 'A lone watchman stands atop bronze ramparts in pouring midnight storm rain while lightning illuminates distant warships and a narrator reveals the coming siege.'
  },
  {
    label: 'Moonlit Whispering Catacombs',
    text: 'Lantern light trembles across ancient carved stone catacombs as hidden footsteps echo behind a fleeing scribe whispering a forbidden prophecy.'
  },
  {
    label: 'Royal Brass Clash',
    text: 'Two rival champions clash with gleaming iron blades amid rising embers inside a torchlit palace courtyard while the chronicler explains the duel.'
  }
];

export const VideoStudioView: React.FC = () => {
  const { stories, navigate, buildHref } = useApp();
  const [selectedSlug, setSelectedSlug] = useState<string>(stories[0]?.slug || '');
  const [seedPrompt, setSeedPrompt] = useState<string>('');
  const [studioKey, setStudioKey] = useState(0);

  const selectedStory = stories.find((s) => s.slug === selectedSlug);

  const applyStarterPrompt = (text: string) => {
    setSeedPrompt(text);
    setStudioKey((k) => k + 1);
  };

  return (
    <div className="min-h-screen bg-[#F9F6F0] dark:bg-[#160C16] text-[#2D142C] dark:text-[#F9F6F0] py-10 transition-colors">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#2D142C]/10 dark:border-white/10 pb-5">
          <div className="space-y-1.5">
            <div className="inline-flex items-center gap-1.5 text-xs uppercase tracking-wider font-semibold text-[#C85A32] font-sans-ui">
              <Film className="w-3.5 h-3.5" />
              <span>Lorethos Scene Studio</span>
            </div>
            <h1 className="font-display text-3xl sm:text-4xl font-bold tracking-tight">
              Turn Your Words Into Talking Video
            </h1>
            <p className="font-reader text-sm text-[#2D142C]/75 dark:text-white/75 max-w-2xl">
              Type or speak your scene description below, pick a 15s&ndash;30s duration and mood motion, and generate a cinematic talking trailer with synchronized scene-explaining audio.
            </p>
          </div>

          <a
            href={buildHref('stories')}
            onClick={(e) => {
              if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
              e.preventDefault();
              navigate('stories');
            }}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#C85A32] hover:underline shrink-0 self-start sm:self-auto"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back to Library</span>
          </a>
        </div>

        {/* Story Context & Quick Scene Ideas */}
        <div className="p-4 rounded-xl bg-white dark:bg-[#1E111E] border border-[#2D142C]/10 dark:border-white/10 flex flex-col md:flex-row md:items-center justify-between gap-4 text-xs font-sans-ui">
          <div className="flex items-center gap-2.5">
            <label htmlFor="studio-story-select" className="font-semibold shrink-0">
              Link to Story (optional):
            </label>
            <select
              id="studio-story-select"
              value={selectedSlug}
              onChange={(e) => {
                setSelectedSlug(e.target.value);
                setSeedPrompt('');
              }}
              className="px-3 py-1.5 rounded-lg border border-[#2D142C]/15 dark:border-white/15 bg-[#F9F6F0] dark:bg-[#160C16] font-medium focus:outline-none focus:border-[#C85A32]"
            >
              <option value="">Original Custom Scene (No Story Link)</option>
              {stories.map((story) => (
                <option key={story.id} value={story.slug}>
                  {story.title} ({story.genre})
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#2D142C]/65 dark:text-white/65">
              <Sparkles className="w-3 h-3 text-[#C85A32]" />
              <span>Try sample words:</span>
            </span>
            {STARTER_PROMPTS.map((item) => (
              <button
                key={item.label}
                type="button"
                onClick={() => applyStarterPrompt(item.text)}
                className="px-2.5 py-1 rounded-md border border-[#2D142C]/15 dark:border-white/15 hover:border-[#C85A32] hover:text-[#C85A32] font-medium transition-colors cursor-pointer"
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>

        {selectedStory?.trailerVideoUrl && (
          <StoryTrailerPlayer
            story={selectedStory}
            storyHref={buildHref('story-detail', { slug: selectedStory.slug })}
            readerHref={buildHref('reader', { slug: selectedStory.slug, chapterNumber: 1 })}
            onNavigateStory={() => navigate('story-detail', { slug: selectedStory.slug })}
            onNavigateReader={() => navigate('reader', { slug: selectedStory.slug, chapterNumber: 1 })}
          />
        )}

        <VideoTrailerStudio
          key={`${selectedStory?.slug || 'custom'}-${studioKey}`}
          storySlug={selectedStory?.slug}
          storyTitle={selectedStory?.title}
          heading="Custom Scene Video Studio"
          description="Or write your own words below to generate a brand-new 15–30 second AI talking scene video."
          defaultPrompt={
            seedPrompt ||
            (selectedStory
              ? `${selectedStory.synopsis.slice(0, 180)} Atmospheric book trailer with dramatic mood lighting and spoken narration.`
              : '')
          }
        />
      </div>
    </div>
  );
};
