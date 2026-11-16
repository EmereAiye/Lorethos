import type { NarrativeMood } from './narrativeAudioMiddleware';

export type AmbientTrackId = 'fireplace' | 'rain' | 'mythic_drone' | 'silence';

interface MoodSynthProfile {
  padGain: number;
  cutoffHz: number;
  q: number;
  lfoHz: number;
  lfoDepth: number;
  freqs: [number, number, number, number]; // sub + 3 pad voices
  wave: OscillatorType;
}

const MOOD_PROFILES: Record<NarrativeMood, MoodSynthProfile> = {
  calm: {
    padGain: 0,
    cutoffHz: 340,
    q: 0.7,
    lfoHz: 0.12,
    lfoDepth: 80,
    freqs: [65.41, 130.81, 196.0, 261.63],
    wave: 'sine',
  },
  tense: {
    // Minor-second / tritone dark suspense pad (C2, C3, Eb3, F#3)
    padGain: 0.24,
    cutoffHz: 320,
    q: 3.2,
    lfoHz: 0.42,
    lfoDepth: 220,
    freqs: [65.41, 130.81, 155.56, 185.0],
    wave: 'sawtooth',
  },
  action: {
    // Urgent kinetic pulse (G2, D3, G3, Bb3)
    padGain: 0.26,
    cutoffHz: 540,
    q: 2.6,
    lfoHz: 2.2,
    lfoDepth: 340,
    freqs: [98.0, 146.83, 196.0, 233.08],
    wave: 'sawtooth',
  },
  solemn: {
    // Deep ritual organ drone (E2, B2, E3, G3)
    padGain: 0.22,
    cutoffHz: 250,
    q: 1.1,
    lfoHz: 0.14,
    lfoDepth: 75,
    freqs: [82.41, 123.47, 164.81, 196.0],
    wave: 'triangle',
  },
  wonder: {
    // Luminous harmonic shimmer (D3, A3, C#4, E4)
    padGain: 0.2,
    cutoffHz: 680,
    q: 1.4,
    lfoHz: 0.2,
    lfoDepth: 240,
    freqs: [146.83, 220.0, 277.18, 329.63],
    wave: 'sine',
  },
};

class AmbientSoundEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private activeNodes: AudioNode[] = [];
  private crackleTimer: number | null = null;
  private currentTrack: AmbientTrackId = 'silence';

  // Base track nodes modulated by mood cues
  private baseFilter: BiquadFilterNode | null = null;
  private baseSecondaryFilter: BiquadFilterNode | null = null;
  private baseLfo: OscillatorNode | null = null;
  private crackleChance = 0.45;

  // Dynamic narrative mood synth pad layer
  private padGain: GainNode | null = null;
  private padFilter: BiquadFilterNode | null = null;
  private padLfo: OscillatorNode | null = null;
  private padLfoGain: GainNode | null = null;
  private padOscillators: OscillatorNode[] = [];

  private currentMood: NarrativeMood = 'calm';
  private currentIntensity = 0.2;

  private ensureContext(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return null;
    if (!this.ctx) {
      this.ctx = new AudioCtx();
    }
    if (this.ctx.state === 'suspended') {
      void this.ctx.resume().catch(() => {});
      const resumeOnGesture = () => {
        if (this.ctx && this.ctx.state === 'suspended') {
          void this.ctx.resume().catch(() => {});
        }
        window.removeEventListener('pointerdown', resumeOnGesture);
        window.removeEventListener('keydown', resumeOnGesture);
      };
      window.addEventListener('pointerdown', resumeOnGesture, { once: true, passive: true });
      window.addEventListener('keydown', resumeOnGesture, { once: true, passive: true });
    }
    return this.ctx;
  }

  private createNoiseBuffer(ctx: AudioContext, seconds: number, warmth: 'brown' | 'pink'): AudioBuffer {
    const sampleRate = ctx.sampleRate;
    const length = sampleRate * seconds;
    const buffer = ctx.createBuffer(1, length, sampleRate);
    const data = buffer.getChannelData(0);

    if (warmth === 'brown') {
      let lastOut = 0;
      for (let i = 0; i < length; i++) {
        const white = Math.random() * 2 - 1;
        data[i] = (lastOut + 0.02 * white) / 1.02;
        lastOut = data[i];
        data[i] *= 3.2;
      }
    } else {
      let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
      for (let i = 0; i < length; i++) {
        const white = Math.random() * 2 - 1;
        b0 = 0.99886 * b0 + white * 0.0555179;
        b1 = 0.99332 * b1 + white * 0.0750759;
        b2 = 0.96900 * b2 + white * 0.1538520;
        b3 = 0.86650 * b3 + white * 0.3104856;
        b4 = 0.55000 * b4 + white * 0.5329522;
        b5 = -0.7616 * b5 - white * 0.0168980;
        data[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.06;
        b6 = white * 0.115926;
      }
    }
    return buffer;
  }

  private initMoodPadLayer(ctx: AudioContext, master: GainNode): void {
    const padGain = ctx.createGain();
    padGain.gain.setValueAtTime(0, ctx.currentTime);

    const padFilter = ctx.createBiquadFilter();
    padFilter.type = 'lowpass';
    padFilter.frequency.setValueAtTime(340, ctx.currentTime);
    padFilter.Q.setValueAtTime(1.5, ctx.currentTime);

    const padLfo = ctx.createOscillator();
    padLfo.type = 'sine';
    padLfo.frequency.setValueAtTime(0.25, ctx.currentTime);

    const padLfoGain = ctx.createGain();
    padLfoGain.gain.setValueAtTime(120, ctx.currentTime);

    padLfo.connect(padLfoGain);
    padLfoGain.connect(padFilter.frequency);
    padLfo.start();

    padFilter.connect(padGain);
    padGain.connect(master);

    const oscs: OscillatorNode[] = [];
    const defaultFreqs: [number, number, number, number] = [65.41, 130.81, 155.56, 185.0];
    defaultFreqs.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      osc.type = idx === 0 ? 'sine' : 'triangle';
      osc.frequency.setValueAtTime(freq, ctx.currentTime);
      osc.detune.setValueAtTime(idx === 1 ? -6 : idx === 2 ? 7 : idx === 3 ? -4 : 0, ctx.currentTime);

      const voiceGain = ctx.createGain();
      voiceGain.gain.setValueAtTime(idx === 0 ? 0.34 : 0.22, ctx.currentTime);

      osc.connect(voiceGain);
      voiceGain.connect(padFilter);
      osc.start();

      oscs.push(osc);
      this.activeNodes.push(osc, voiceGain);
    });

    this.padGain = padGain;
    this.padFilter = padFilter;
    this.padLfo = padLfo;
    this.padLfoGain = padLfoGain;
    this.padOscillators = oscs;

    this.activeNodes.push(padGain, padFilter, padLfo, padLfoGain);
  }

  public start(track: AmbientTrackId, volume: number): void {
    this.stop();
    this.currentTrack = track;
    if (track === 'silence') return;

    const ctx = this.ensureContext();
    if (!ctx) return;

    const master = ctx.createGain();
    master.gain.setValueAtTime(Math.max(0, Math.min(1, volume)) * 0.35, ctx.currentTime);
    master.connect(ctx.destination);
    this.masterGain = master;
    this.activeNodes.push(master);

    if (track === 'fireplace') {
      const rumbleSource = ctx.createBufferSource();
      rumbleSource.buffer = this.createNoiseBuffer(ctx, 4, 'brown');
      rumbleSource.loop = true;

      const lowpass = ctx.createBiquadFilter();
      lowpass.type = 'lowpass';
      lowpass.frequency.value = 340;
      this.baseFilter = lowpass;
      this.crackleChance = 0.45;

      rumbleSource.connect(lowpass);
      lowpass.connect(master);
      rumbleSource.start();
      this.activeNodes.push(rumbleSource, lowpass);

      // Gentle random hearth crackle pops
      this.crackleTimer = window.setInterval(() => {
        if (!this.ctx || !this.masterGain || this.currentTrack !== 'fireplace') return;
        if (Math.random() > this.crackleChance) return;

        const now = this.ctx.currentTime;
        const popSource = this.ctx.createBufferSource();
        const popBuf = this.ctx.createBuffer(1, Math.floor(this.ctx.sampleRate * 0.03), this.ctx.sampleRate);
        const ch = popBuf.getChannelData(0);
        for (let i = 0; i < ch.length; i++) {
          ch[i] = (Math.random() * 2 - 1) * Math.exp(-i / (ch.length * 0.25));
        }
        popSource.buffer = popBuf;

        const highpass = this.ctx.createBiquadFilter();
        highpass.type = 'bandpass';
        highpass.frequency.value = 1800 + Math.random() * 2400;
        highpass.Q.value = 1.6;

        const popGain = this.ctx.createGain();
        popGain.gain.setValueAtTime(0.18 + Math.random() * 0.22, now);
        popGain.gain.exponentialRampToValueAtTime(0.001, now + 0.03);

        popSource.connect(highpass);
        highpass.connect(popGain);
        popGain.connect(this.masterGain);
        popSource.start(now);
      }, 280);
    } else if (track === 'rain') {
      const rainSource = ctx.createBufferSource();
      rainSource.buffer = this.createNoiseBuffer(ctx, 5, 'pink');
      rainSource.loop = true;

      const bandpass = ctx.createBiquadFilter();
      bandpass.type = 'bandpass';
      bandpass.frequency.value = 1100;
      bandpass.Q.value = 0.55;

      const highShelf = ctx.createBiquadFilter();
      highShelf.type = 'lowpass';
      highShelf.frequency.value = 3200;

      this.baseFilter = bandpass;
      this.baseSecondaryFilter = highShelf;

      rainSource.connect(bandpass);
      bandpass.connect(highShelf);
      highShelf.connect(master);
      rainSource.start();
      this.activeNodes.push(rainSource, bandpass, highShelf);
    } else if (track === 'mythic_drone') {
      const freqs = [110, 164.81, 220];
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 420;

      const lfo = ctx.createOscillator();
      lfo.type = 'sine';
      lfo.frequency.value = 0.12;
      const lfoGain = ctx.createGain();
      lfoGain.gain.value = 160;
      lfo.connect(lfoGain);
      lfoGain.connect(filter.frequency);
      lfo.start();

      this.baseFilter = filter;
      this.baseLfo = lfo;

      filter.connect(master);
      this.activeNodes.push(filter, lfo, lfoGain);

      freqs.forEach((f, idx) => {
        const osc = ctx.createOscillator();
        osc.type = idx === 1 ? 'triangle' : 'sine';
        osc.frequency.value = f;
        osc.detune.value = idx === 0 ? -4 : idx === 2 ? 4 : 0;

        const voiceGain = ctx.createGain();
        voiceGain.gain.value = idx === 0 ? 0.28 : 0.14;

        osc.connect(voiceGain);
        voiceGain.connect(filter);
        osc.start();
        this.activeNodes.push(osc, voiceGain);
      });
    }

    this.initMoodPadLayer(ctx, master);
    this.applyMoodCue(this.currentMood, this.currentIntensity);
  }

  public applyMoodCue(mood: NarrativeMood, intensity: number): void {
    const clampedIntensity = Math.max(0, Math.min(1, intensity));
    this.currentMood = mood;
    this.currentIntensity = clampedIntensity;

    if (!this.ctx || !this.masterGain || this.currentTrack === 'silence') {
      return;
    }

    const now = this.ctx.currentTime;
    const profile = MOOD_PROFILES[mood];

    // 1. Dynamically modulate the narrative synth pad layer
    if (this.padGain && this.padFilter && this.padLfo && this.padLfoGain) {
      const targetPadGain =
        mood === 'calm' ? 0 : profile.padGain * (0.55 + clampedIntensity * 0.65);
      this.padGain.gain.setTargetAtTime(targetPadGain, now, 0.9);

      const targetCutoff = profile.cutoffHz + clampedIntensity * 260;
      this.padFilter.frequency.setTargetAtTime(targetCutoff, now, 0.85);
      this.padFilter.Q.setTargetAtTime(profile.q, now, 0.8);

      this.padLfo.frequency.setTargetAtTime(
        profile.lfoHz * (0.85 + clampedIntensity * 0.4),
        now,
        0.8
      );
      this.padLfoGain.gain.setTargetAtTime(
        profile.lfoDepth * (0.7 + clampedIntensity * 0.5),
        now,
        0.8
      );

      this.padOscillators.forEach((osc, idx) => {
        osc.type = idx === 0 ? 'sine' : profile.wave;
        osc.frequency.setTargetAtTime(profile.freqs[idx], now, 0.7);
      });
    }

    // 2. Dynamically modulate the active base ambient track
    if (this.currentTrack === 'fireplace' && this.baseFilter) {
      const targetHz =
        mood === 'tense'
          ? 240
          : mood === 'action'
          ? 480 + clampedIntensity * 140
          : mood === 'wonder'
          ? 380
          : 340;
      this.baseFilter.frequency.setTargetAtTime(targetHz, now, 0.9);
      this.crackleChance = mood === 'action' ? 0.72 : mood === 'tense' ? 0.25 : 0.45;
    } else if (this.currentTrack === 'rain' && this.baseFilter && this.baseSecondaryFilter) {
      const bandHz = mood === 'tense' || mood === 'action' ? 1450 + clampedIntensity * 350 : 1100;
      const topHz = mood === 'action' ? 4200 : mood === 'tense' ? 3600 : 3000;
      this.baseFilter.frequency.setTargetAtTime(bandHz, now, 0.9);
      this.baseSecondaryFilter.frequency.setTargetAtTime(topHz, now, 0.9);
    } else if (this.currentTrack === 'mythic_drone' && this.baseFilter && this.baseLfo) {
      const droneCutoff =
        mood === 'tense'
          ? 640
          : mood === 'action'
          ? 760
          : mood === 'solemn'
          ? 300
          : mood === 'wonder'
          ? 560
          : 420;
      const droneLfoHz =
        mood === 'action' ? 0.45 : mood === 'tense' ? 0.28 : 0.12;
      this.baseFilter.frequency.setTargetAtTime(droneCutoff, now, 0.9);
      this.baseLfo.frequency.setTargetAtTime(droneLfoHz, now, 0.9);
    }
  }

  public resetMood(): void {
    this.applyMoodCue('calm', 0.2);
  }

  public setVolume(volume: number): void {
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setTargetAtTime(
        Math.max(0, Math.min(1, volume)) * 0.35,
        this.ctx.currentTime,
        0.05
      );
    }
  }

  public stop(): void {
    if (this.crackleTimer !== null) {
      window.clearInterval(this.crackleTimer);
      this.crackleTimer = null;
    }
    for (const node of this.activeNodes) {
      try {
        if ('stop' in node && typeof (node as AudioScheduledSourceNode).stop === 'function') {
          (node as AudioScheduledSourceNode).stop();
        }
        node.disconnect();
      } catch {
        // ignore cleanup errors on already-stopped nodes
      }
    }
    this.activeNodes = [];
    this.masterGain = null;
    this.baseFilter = null;
    this.baseSecondaryFilter = null;
    this.baseLfo = null;
    this.padGain = null;
    this.padFilter = null;
    this.padLfo = null;
    this.padLfoGain = null;
    this.padOscillators = [];
  }
}

export const ambientAudio = new AmbientSoundEngine();
