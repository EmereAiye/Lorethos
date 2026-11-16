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

function tokenizeWords(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s'-]/g, ' ')
    .split(/\s+/)
    .filter(Boolean);
}

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

  const words = tokenizeWords(text);
  const wordSet = new Set(words);

  (Object.keys(MOOD_KEYWORDS) as Array<Exclude<NarrativeMood, 'calm'>>).forEach((mood) => {
    for (const kw of MOOD_KEYWORDS[mood]) {
      if (wordSet.has(kw)) {
        scores[mood] += 1;
        if (!matches[mood].includes(kw)) {
          matches[mood].push(kw);
        }
      }
    }
  });

  // Structural pacing cues (exclamation marks, em-dashes, short punchy sentences)
  const exclamations = (text.match(/!/g) || []).length;
  const emDashes = (text.match(/—|--/g) || []).length;
  const sentences = text.split(/[.!?]+/).map((s) => s.trim()).filter(Boolean);
  const avgWordsPerSentence =
    sentences.length > 0 ? words.length / sentences.length : words.length;

  if (exclamations > 0) {
    scores.action += exclamations * 0.75;
    scores.tense += exclamations * 0.45;
  }
  if (emDashes > 0) {
    scores.tense += emDashes * 0.4;
  }
  if (sentences.length >= 3 && avgWordsPerSentence <= 9) {
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

  const combinedScores: Record<Exclude<NarrativeMood, 'calm'>, number> = {
    tense: primary.scores.tense + secondary.scores.tense * 0.35,
    action: primary.scores.action + secondary.scores.action * 0.35,
    solemn: primary.scores.solemn + secondary.scores.solemn * 0.35,
    wonder: primary.scores.wonder + secondary.scores.wonder * 0.35,
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

export class NarrativeAudioMiddleware {
  private debounceTimer: number | null = null;
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

  public evaluate(
    paragraphs: string[],
    activeIndex: number,
    options: {
      enabled: boolean;
      immediate?: boolean;
      debounceMs?: number;
      onApply: (analysis: MoodCueAnalysis) => void;
    }
  ): void {
    const clampedIndex = Math.max(0, Math.min(paragraphs.length - 1, activeIndex));
    const primary = paragraphs[clampedIndex] || '';
    const next = paragraphs[clampedIndex + 1] || '';

    const candidate: MoodCueAnalysis = options.enabled
      ? analyzeNarrativeSegment(primary, next, clampedIndex)
      : {
          mood: 'calm',
          intensity: 0.2,
          label: MOOD_META.calm.label,
          soundCue: MOOD_META.calm.soundCue,
          matchedCues: [],
          paragraphIndex: clampedIndex,
        };

    const commit = () => {
      const changed =
        candidate.mood !== this.lastAnalysis.mood ||
        Math.abs(candidate.intensity - this.lastAnalysis.intensity) >= 0.12 ||
        candidate.paragraphIndex !== this.lastAnalysis.paragraphIndex;

      if (changed || options.immediate) {
        this.lastAnalysis = candidate;
        options.onApply(candidate);
      }
    };

    if (this.debounceTimer !== null) {
      window.clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }

    if (options.immediate) {
      commit();
      return;
    }

    const delay = options.debounceMs ?? 280;
    this.debounceTimer = window.setTimeout(commit, delay);
  }

  public dispose(): void {
    if (this.debounceTimer !== null) {
      window.clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }
  }
}
