export type NarrativeMood = 'calm' | 'tense' | 'solemn' | 'wonder' | 'action';

export interface MoodCueAnalysis {
  mood: NarrativeMood;
  intensity: number; // 0.0 to 1.0
  label: string;
  soundCue: string;
  matchedCues: string[];
  paragraphIndex: number;
}

const MOOD_KEYWORDS: Record<Exclude<NarrativeMood, 'calm'>, string[]> = {
  tense: [
    'shadow', 'shadows', 'blade', 'blood', 'sword', 'dagger', 'ambush', 'whisper', 'whispered',
    'silence', 'trembled', 'tremble', 'dark', 'darkness', 'danger', 'footsteps', 'trap', 'poison',
    'scream', 'shatter', 'shattered', 'cold', 'steel', 'threat', 'enemy', 'betray', 'betrayal',
    'dread', 'crept', 'gasped', 'panic', 'panicked', 'urgent', 'suddenly', 'hunted', 'abyss',
    'watchful', 'suspicion', 'unease', 'fear', 'terror', 'crimson', 'omen', 'secret', 'clandestine',
    'conspiracy', 'cipher', 'venom', 'throat', 'breathless', 'frozen', 'crack', 'stalked', 'loomed'
  ],
  action: [
    'charged', 'leaped', 'clashed', 'erupted', 'sprinted', 'galloped', 'exploded', 'crashed',
    'thundered', 'surged', 'tore', 'hurled', 'swung', 'struck', 'strike', 'blaze', 'blazing',
    'tempest', 'avalanche', 'fury', 'battle', 'roared', 'roar', 'fled', 'pursuit', 'collide',
    'shrieked', 'slashed', 'arrow', 'arrows', 'flames', 'storm', 'lightning', 'crash', 'sprint'
  ],
  solemn: [
    'ancestors', 'ancestral', 'shrine', 'oath', 'throne', 'crown', 'memory', 'mourn', 'mourning',
    'tomb', 'oracle', 'prophecy', 'sacred', 'eternal', 'grief', 'sorrow', 'lament', 'ashes',
    'bone', 'bones', 'covenant', 'temple', 'altar', 'spirit', 'spirits', 'elder', 'elders',
    'solemn', 'ruin', 'ruins', 'dynasty', 'legacy', 'prayer', 'kneel', 'knelt', 'grave',
    'bronze', 'scroll', 'chronicle', 'forgotten', 'ancient', 'sunken', 'cathedral', 'monument'
  ],
  wonder: [
    'starlight', 'stars', 'glow', 'glowed', 'shimmer', 'shimmered', 'cosmos', 'cosmic',
    'constellation', 'horizon', 'ocean', 'pearl', 'bloom', 'golden', 'dawn', 'silver',
    'dream', 'radiant', 'luminous', 'breeze', 'gentle', 'warmth', 'smile', 'smiled', 'laugh',
    'song', 'melody', 'harmony', 'crystal', 'lantern', 'lanterns', 'baobab', 'savanna',
    'emerald', 'wonder', 'awe', 'marvel', 'celestial', 'serene', 'peaceful', 'amber'
  ],
};

// Precomputed O(1) lookup table mapping keyword -> mood to keep scrolling overhead near zero
const KEYWORD_TO_MOOD = new Map<string, Exclude<NarrativeMood, 'calm'>>();
(Object.keys(MOOD_KEYWORDS) as Array<Exclude<NarrativeMood, 'calm'>>).forEach((mood) => {
  for (const kw of MOOD_KEYWORDS[mood]) {
    KEYWORD_TO_MOOD.set(kw, mood);
  }
});

const MOOD_META: Record<NarrativeMood, { label: string; soundCue: string }> = {
  calm: {
    label: 'Calm',
    soundCue: 'Warm baseline ambience',
  },
  tense: {
    label: 'Suspenseful',
    soundCue: 'Minor-tritone suspense synth pad',
  },
  action: {
    label: 'Intense',
    soundCue: 'Driving rhythmic synth pulse',
  },
  solemn: {
    label: 'Solemn',
    soundCue: 'Deep resonant ritual sub-drone',
  },
  wonder: {
    label: 'Luminous',
    soundCue: 'Airy harmonic shimmer pad',
  },
};

function scoreTextSegment(text: string): {
  scores: Record<Exclude<NarrativeMood, 'calm'>, number>;
  matches: Record<Exclude<NarrativeMood, 'calm'>, string[]>;
} {
  const scores: Record<Exclude<NarrativeMood, 'calm'>, number> = {
    tense: 0,
    action: 0,
    solemn: 0,
    wonder: 0,
  };
  const matches: Record<Exclude<NarrativeMood, 'calm'>, string[]> = {
    tense: [],
    action: [],
    solemn: [],
    wonder: [],
  };

  if (!text.trim()) return { scores, matches };

  const words = text.toLowerCase().match(/[a-z0-9'-]+/g) || [];
  const seenWords = new Set<string>();

  for (let i = 0; i < words.length; i++) {
    const word = words[i];
    if (seenWords.has(word)) continue;
    seenWords.add(word);
    const mood = KEYWORD_TO_MOOD.get(word);
    if (mood) {
      scores[mood] += 1;
      if (matches[mood].length < 4) {
        matches[mood].push(word);
      }
    }
  }

  // Structural pacing cues (exclamation marks, em-dashes, short punchy sentences)
  let exclamations = 0;
  let emDashes = 0;
  let sentenceEnds = 0;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '!') {
      exclamations++;
      sentenceEnds++;
    } else if (ch === '.' || ch === '?') {
      sentenceEnds++;
    } else if (ch === '—' || (ch === '-' && text[i + 1] === '-')) {
      emDashes++;
    }
  }

  const sentencesCount = Math.max(1, sentenceEnds);
  const avgWordsPerSentence = words.length / sentencesCount;

  if (exclamations > 0) {
    scores.action += exclamations * 0.75;
    scores.tense += exclamations * 0.45;
  }
  if (emDashes > 0) {
    scores.tense += emDashes * 0.4;
  }
  if (sentencesCount >= 3 && avgWordsPerSentence <= 9) {
    scores.tense += 0.7;
    scores.action += 0.5;
  }

  return { scores, matches };
}

export function analyzeNarrativeSegment(
  primaryText: string,
  secondaryText = '',
  paragraphIndex = 0
): MoodCueAnalysis {
  const primary = scoreTextSegment(primaryText);
  const secondary = scoreTextSegment(secondaryText);

  const blendMood = (mood: Exclude<NarrativeMood, 'calm'>) =>
    primary.scores[mood] > 0
      ? primary.scores[mood] + secondary.scores[mood] * 0.25
      : Math.min(0.45, secondary.scores[mood] * 0.15);

  const combinedScores: Record<Exclude<NarrativeMood, 'calm'>, number> = {
    tense: blendMood('tense'),
    action: blendMood('action'),
    solemn: blendMood('solemn'),
    wonder: blendMood('wonder'),
  };

  let bestMood: NarrativeMood = 'calm';
  let bestScore = 0;

  (Object.keys(combinedScores) as Array<Exclude<NarrativeMood, 'calm'>>).forEach((mood) => {
    if (combinedScores[mood] > bestScore) {
      bestScore = combinedScores[mood];
      bestMood = mood;
    }
  });

  // Require a meaningful narrative cue signal before shifting away from calm baseline
  if (bestScore < 1.1) {
    return {
      mood: 'calm',
      intensity: 0.2,
      label: MOOD_META.calm.label,
      soundCue: MOOD_META.calm.soundCue,
      matchedCues: [],
      paragraphIndex,
    };
  }

  const normalizedIntensity = Math.min(1, Math.max(0.35, bestScore / 4.2));
  const cues =
    bestMood !== 'calm'
      ? [...primary.matches[bestMood], ...secondary.matches[bestMood]].slice(0, 3)
      : [];

  return {
    mood: bestMood,
    intensity: Number(normalizedIntensity.toFixed(2)),
    label: MOOD_META[bestMood].label,
    soundCue: MOOD_META[bestMood].soundCue,
    matchedCues: cues,
    paragraphIndex,
  };
}

export interface EvaluateMoodOptions {
  enabled: boolean;
  immediate?: boolean;
  debounceMs?: number;
  minIntensityDelta?: number;
  cooldownMs?: number;
  onApply: (analysis: MoodCueAnalysis) => void;
}

const DEFAULT_DEBOUNCE_MS = 550;
const DEFAULT_INTENSITY_DELTA = 0.22;
const DEFAULT_COOLDOWN_MS = 1200;

export class NarrativeAudioMiddleware {
  private debounceTimer: ReturnType<typeof setTimeout> | null = null;
  private analysisCache = new Map<string, MoodCueAnalysis>();
  private lastTransitionAt = 0;
  private lastAnalysis: MoodCueAnalysis = {
    mood: 'calm',
    intensity: 0.2,
    label: MOOD_META.calm.label,
    soundCue: MOOD_META.calm.soundCue,
    matchedCues: [],
    paragraphIndex: 0,
  };

  public getCurrentAnalysis(): MoodCueAnalysis {
    return this.lastAnalysis;
  }

  private getOrAnalyze(paragraphs: string[], clampedIndex: number): MoodCueAnalysis {
    const primary = paragraphs[clampedIndex] || '';
    const next = paragraphs[clampedIndex + 1] || '';
    const cacheKey = `${clampedIndex}:${primary.length}:${primary.slice(0, 24)}:${next.length}`;
    const cached = this.analysisCache.get(cacheKey);
    if (cached) return cached;

    const result = analyzeNarrativeSegment(primary, next, clampedIndex);
    if (this.analysisCache.size >= 200) {
      this.analysisCache.clear();
    }
    this.analysisCache.set(cacheKey, result);
    return result;
  }

  public evaluate(
    paragraphs: string[],
    activeIndex: number,
    options: EvaluateMoodOptions
  ): void {
    const clampedIndex = Math.max(0, Math.min(Math.max(0, paragraphs.length - 1), activeIndex));
    const minDelta = options.minIntensityDelta ?? DEFAULT_INTENSITY_DELTA;
    const cooldownMs = options.cooldownMs ?? DEFAULT_COOLDOWN_MS;

    const runAnalysisAndMaybeCommit = () => {
      this.debounceTimer = null;

      const candidate: MoodCueAnalysis = options.enabled
        ? this.getOrAnalyze(paragraphs, clampedIndex)
        : {
            mood: 'calm',
            intensity: 0.2,
            label: MOOD_META.calm.label,
            soundCue: MOOD_META.calm.soundCue,
            matchedCues: [],
            paragraphIndex: clampedIndex,
          };

      const intensityDelta = Math.abs(candidate.intensity - this.lastAnalysis.intensity);
      const moodChanged = candidate.mood !== this.lastAnalysis.mood;
      const now = Date.now();
      const cooldownElapsed = now - this.lastTransitionAt >= cooldownMs;

      // Only transition audio on significant narrative intensity changes or genuine mood shifts (with cooldown guard)
      const isSignificantChange =
        options.immediate ||
        intensityDelta >= minDelta ||
        (moodChanged && (cooldownElapsed || intensityDelta >= 0.14));

      if (isSignificantChange) {
        this.lastAnalysis = candidate;
        this.lastTransitionAt = now;
        options.onApply(candidate);
      }
    };

    if (this.debounceTimer !== null) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }

    if (options.immediate) {
      runAnalysisAndMaybeCommit();
      return;
    }

    const delay = options.debounceMs ?? DEFAULT_DEBOUNCE_MS;
    this.debounceTimer = setTimeout(runAnalysisAndMaybeCommit, delay);
  }

  public reset(): void {
    this.dispose();
    this.analysisCache.clear();
    this.lastTransitionAt = 0;
    this.lastAnalysis = {
      mood: 'calm',
      intensity: 0.2,
      label: MOOD_META.calm.label,
      soundCue: MOOD_META.calm.soundCue,
      matchedCues: [],
      paragraphIndex: 0,
    };
  }

  public dispose(): void {
    if (this.debounceTimer !== null) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }
  }
}
