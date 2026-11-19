import { SceneMood } from '../types';

export type AmbientTrackId = 'adaptive' | 'fireplace' | 'rain' | 'mythic_drone' | 'silence';
export type { SceneMood };

const SUSPENSE_STRONG_PATTERNS = [
  /\bsuspense\b/i,
  /\btrembl(?:e|ed|ing)\b/i,
  /\bwhisper(?:s|ed|ing)?\b/i,
  /\bshadow(?:s|ed|y)?\b/i,
  /\bghost(?:s|ly)?\b/i,
  /\bblood(?:-pact|ied|y)?\b/i,
  /\bdread(?:ed|ful)?\b/i,
  /\bominous(?:ly)?\b/i,
  /\bcrept\b|\bcreep(?:s|ing)?\b/i,
  /\bvanished\b|\bdisappear(?:ed|s)?\b/i,
  /\bheartbeat\b|\bpuls(?:e|ed|ing)\b/i,
  /\bblade\b|\bdagger\b|\bpoison(?:ed)?\b|\btrap\b/i,
  /\bwatch(?:er|ers|ing)\b|\bstalk(?:ed|ing)?\b/i,
  /\bdeadly\b|\bdying\b|\bdoom\b|\bcurse(?:d)?\b/i,
  /\bsuddenly\b|\ball at once\b/i,
  /\bbetrayal\b|\bsecret(?:ly)?\b|\bforbidden\b/i,
  /\bbreath misting\b|\bheld (?:his|her|their) breath\b/i,
  /\bcatacombs\b|\bsubterranean\b|\beerie\b|\bchill\b/i
];

const SUSPENSE_SOFT_PATTERNS = [
  /\bdark(?:ness|ened)?\b/i,
  /\bnight\b|\bmidnight\b|\beclipse\b/i,
  /\bsilen(?:t|ce)\b|\bhushed\b/i,
  /\bfear\b|\bafraid\b|\bterror\b/i,
  /\bfootsteps\b|\becho(?:ed|es|ing)?\b/i,
  /\bchant(?:ed|ing)?\b|\bmurmur(?:ed|s)?\b/i,
  /\bwound(?:ed)?\b|\bscar(?:red)?\b|\bskull\b/i,
  /\bgrave\b|\btomb\b|\bcrypt\b|\bruins\b/i
];

const ACTION_PATTERNS = [
  /\bsword(?:s)?\b|\bspear(?:s)?\b|\barrow(?:s)?\b/i,
  /\bstrike\b|\bstruck\b|\bslam(?:med|ming)?\b|\bshatter(?:ed|ing)?\b/i,
  /\broar(?:ed|ing)?\b|\bcharg(?:e|ed|ing)\b|\bsprint(?:ed|ing)?\b/i,
  /\bbattle\b|\bclash(?:ed|ing)?\b|\bcombat\b|\battack(?:ed|ing)?\b/i,
  /\bfire\b|\bflame(?:s)?\b|\bblaze\b|\bexplod(?:e|ed|ing)\b/i,
  /\brun(?:ning)? for\b|\bflee(?:ing)?\b|\bpursuit\b/i
];

const STORM_PATTERNS = [
  /\bstorm(?:s|y|ing)?\b|\btempest\b|\bhurricane\b/i,
  /\blightning\b|\bthunder(?:ed|ing|ous)?\b/i,
  /\brain(?:s|ing|ed|fall)?\b|\bdownpour\b|\bgale\b/i,
  /\bhowl(?:ed|ing)\b wind\b|\bwhipping across\b/i
];

/**
 * Classifies a paragraph (or visible reading window) into a narrative mood.
 * Normal/calm exposition & everyday dialogue deliberately return 'neutral'
 * so normal scenes stay silent when Adaptive Scene Mood is enabled.
 */
export function detectSceneMood(text: string): SceneMood {
  const clean = String(text || '').trim();
  if (!clean) return 'neutral';

  let suspenseScore = 0;
  let actionScore = 0;
  let stormScore = 0;

  for (const re of SUSPENSE_STRONG_PATTERNS) {
    if (re.test(clean)) suspenseScore += 2;
  }
  for (const re of SUSPENSE_SOFT_PATTERNS) {
    if (re.test(clean)) suspenseScore += 1;
  }
  for (const re of ACTION_PATTERNS) {
    if (re.test(clean)) actionScore += 2;
  }
  for (const re of STORM_PATTERNS) {
    if (re.test(clean)) stormScore += 2;
  }

  if (/\.{3}|—/.test(clean) && suspenseScore >= 1) {
    suspenseScore += 1;
  }

  if (actionScore >= 4 && actionScore >= suspenseScore && actionScore >= stormScore) {
    return 'action';
  }
  if (stormScore >= 4 && stormScore > suspenseScore) {
    return 'storm';
  }
  if (suspenseScore >= 3) {
    return 'suspense';
  }
  if (actionScore >= 3 && suspenseScore >= 1) {
    return 'action';
  }
  return 'neutral';
}

class AmbientSoundEngine {
  private ctx: AudioContext | null = null;
  private compressor: DynamicsCompressorNode | null = null;
  private masterGain: GainNode | null = null;
  private activeNodes: AudioNode[] = [];
  private crackleTimer: number | null = null;
  private fadeOutCleanupTimer: number | null = null;
  private pendingCleanupTimers = new Set<number>();
  private noiseBufferCache = new WeakMap<AudioContext, Map<string, AudioBuffer>>();
  private cracklePoolCache = new WeakMap<AudioContext, Map<number, AudioBuffer[]>>();
  private currentTrack: AmbientTrackId = 'silence';
  private currentMood: SceneMood = 'neutral';
  private currentIntensity = 0.2;
  private lastVolume = 0.6;

  private getOutputDestination(ctx: AudioContext): AudioNode {
    if (!this.compressor || this.compressor.context !== ctx) {
      // Gentle transparent safety limiter so summed voices never clip the DAC
      const comp = ctx.createDynamicsCompressor();
      comp.threshold.value = -6;
      comp.knee.value = 24;
      comp.ratio.value = 2.5;
      comp.attack.value = 0.03;
      comp.release.value = 0.25;
      comp.connect(ctx.destination);
      this.compressor = comp;
    }
    return this.compressor;
  }

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

  /** Must be called synchronously inside a user click/tap to unlock browser Web Audio. */
  public unlock(): void {
    const ctx = this.ensureContext();
    if (ctx && ctx.state === 'suspended') {
      void ctx.resume().catch(() => {});
    }
  }

  private createNoiseBuffer(ctx: AudioContext, seconds: number, warmth: 'brown' | 'pink'): AudioBuffer {
    const sampleRate = ctx.sampleRate;
    let ctxCache = this.noiseBufferCache.get(ctx);
    const cacheKey = `${warmth}:${seconds}:${sampleRate}`;
    const cached = ctxCache?.get(cacheKey);
    if (cached) {
      return cached;
    }

    const length = Math.max(1024, Math.floor(sampleRate * seconds));
    const buffer = ctx.createBuffer(1, length, sampleRate);
    const data = buffer.getChannelData(0);

    if (warmth === 'brown') {
      let lastOut = 0;
      for (let i = 0; i < length; i++) {
        const white = Math.random() * 2 - 1;
        lastOut = (lastOut + 0.02 * white) / 1.02;
        data[i] = lastOut;
      }
    } else {
      let b0 = 0,
        b1 = 0,
        b2 = 0,
        b3 = 0,
        b4 = 0,
        b5 = 0,
        b6 = 0;
      for (let i = 0; i < length; i++) {
        const white = Math.random() * 2 - 1;
        b0 = 0.99886 * b0 + white * 0.0555179;
        b1 = 0.99332 * b1 + white * 0.0750759;
        b2 = 0.969 * b2 + white * 0.153852;
        b3 = 0.8665 * b3 + white * 0.3104856;
        b4 = 0.55 * b4 + white * 0.5329522;
        b5 = -0.7616 * b5 - white * 0.016898;
        data[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.06;
        b6 = white * 0.115926;
      }
    }

    // Remove DC offset and normalize strictly within [-0.65, +0.65] to prevent clipping
    let sum = 0;
    for (let i = 0; i < length; i++) sum += data[i];
    const mean = sum / length;
    let maxAbs = 0.0001;
    for (let i = 0; i < length; i++) {
      data[i] -= mean;
      const abs = Math.abs(data[i]);
      if (abs > maxAbs) maxAbs = abs;
    }
    const normScale = 0.65 / maxAbs;
    for (let i = 0; i < length; i++) {
      data[i] *= normScale;
    }

    // Equal-power crossfade loop edges so looping never clicks or pops
    const fadeSamples = Math.min(Math.floor(sampleRate * 0.25), Math.floor(length / 4));
    for (let i = 0; i < fadeSamples; i++) {
      const t = i / fadeSamples;
      const fadeIn = Math.sin(t * Math.PI * 0.5);
      const fadeOut = Math.cos(t * Math.PI * 0.5);
      const tailIdx = length - fadeSamples + i;
      const headSample = data[i];
      const tailSample = data[tailIdx];
      data[i] = headSample * fadeIn + tailSample * fadeOut;
      data[tailIdx] = tailSample * fadeIn + headSample * fadeOut;
    }

    if (!ctxCache) {
      ctxCache = new Map();
      this.noiseBufferCache.set(ctx, ctxCache);
    }
    ctxCache.set(cacheKey, buffer);
    return buffer;
  }

  private clearFadeTimer(): void {
    if (this.fadeOutCleanupTimer !== null) {
      window.clearTimeout(this.fadeOutCleanupTimer);
      this.fadeOutCleanupTimer = null;
    }
  }

  private stopImmediate(): void {
    this.clearFadeTimer();
    if (this.crackleTimer !== null) {
      window.clearInterval(this.crackleTimer);
      this.crackleTimer = null;
    }
    const oldNodes = this.activeNodes;
    const oldMaster = this.masterGain;
    const ctx = this.ctx;
    this.activeNodes = [];
    this.masterGain = null;

    const cleanupNodes = () => {
      for (const node of oldNodes) {
        try {
          if ('stop' in node && typeof (node as AudioScheduledSourceNode).stop === 'function') {
            (node as AudioScheduledSourceNode).stop();
          }
          node.disconnect();
        } catch {
          // ignore cleanup errors on already-stopped nodes
        }
      }
    };

    if (oldMaster && ctx && ctx.state === 'running' && oldNodes.length > 0) {
      try {
        const now = ctx.currentTime;
        oldMaster.gain.cancelScheduledValues(now);
        oldMaster.gain.setTargetAtTime(0.0001, now, 0.02);
        const timerId = window.setTimeout(() => {
          this.pendingCleanupTimers.delete(timerId);
          cleanupNodes();
        }, 80);
        this.pendingCleanupTimers.add(timerId);
        return;
      } catch {
        // fall through to immediate cleanup
      }
    }
    cleanupNodes();
  }

  public start(track: AmbientTrackId, volume: number): void {
    this.lastVolume = Math.max(0, Math.min(1, volume));
    if (track === 'adaptive') {
      if (this.currentTrack !== 'adaptive') {
        this.stopImmediate();
        this.currentTrack = 'adaptive';
        this.currentMood = 'neutral';
      }
      return;
    }

    if (this.currentTrack === track && this.masterGain && this.ctx) {
      this.setVolume(volume);
      return;
    }

    this.stopImmediate();
    this.currentTrack = track;
    this.currentMood = 'neutral';
    if (track === 'silence') return;

    const ctx = this.ensureContext();
    if (!ctx) return;

    const master = ctx.createGain();
    master.gain.setValueAtTime(0.0001, ctx.currentTime);
    master.gain.setTargetAtTime(this.lastVolume * 0.22, ctx.currentTime, 0.28);
    master.connect(this.getOutputDestination(ctx));
    this.masterGain = master;
    this.activeNodes.push(master);

    if (track === 'fireplace') {
      this.buildFireplaceGraph(ctx, master);
    } else if (track === 'rain') {
      this.buildRainGraph(ctx, master);
    } else if (track === 'mythic_drone') {
      this.buildDroneGraph(ctx, master, [110, 164.81, 220], 340);
    }
  }

  /**
   * Dynamically drives soundscape from the active paragraph's mood & intensity.
   * Neutral/normal scenes smoothly fade to silence (zero sound).
   * Redundant same-mood updates (< 0.12 intensity delta) are skipped cleanly.
   */
  public setSceneMood(mood: SceneMood, volume: number, intensity = 0.7): void {
    const clampedVol = Math.max(0, Math.min(1, volume));
    const normalizedIntensity = Math.max(0, Math.min(1, intensity));
    this.currentTrack = 'adaptive';

    if (mood === this.currentMood) {
      if (mood === 'neutral') {
        this.lastVolume = clampedVol;
        return;
      }
      const intensityDelta = Math.abs(normalizedIntensity - this.currentIntensity);
      const volumeDelta = Math.abs(clampedVol - this.lastVolume);
      if (intensityDelta < 0.12 && volumeDelta < 0.02) {
        return;
      }
      this.currentIntensity = normalizedIntensity;
      this.lastVolume = clampedVol;
      this.setVolume(clampedVol, 0.9);
      return;
    }

    this.lastVolume = clampedVol;
    this.currentMood = mood;
    this.currentIntensity = mood === 'neutral' ? 0.2 : normalizedIntensity;

    if (mood === 'neutral') {
      if (this.masterGain && this.ctx) {
        const now = this.ctx.currentTime;
        this.masterGain.gain.cancelScheduledValues(now);
        this.masterGain.gain.setTargetAtTime(0.0001, now, 0.95);
        this.clearFadeTimer();
        this.fadeOutCleanupTimer = window.setTimeout(() => {
          if (this.currentTrack === 'adaptive' && this.currentMood === 'neutral') {
            this.stopImmediate();
          }
        }, 2900);
      }
      return;
    }

    const ctx = this.ensureContext();
    if (!ctx) return;

    this.stopImmediate();
    const master = ctx.createGain();
    master.gain.setValueAtTime(0.0001, ctx.currentTime);
    master.gain.setTargetAtTime(this.lastVolume * 0.22, ctx.currentTime, 0.95);
    master.connect(this.getOutputDestination(ctx));
    this.masterGain = master;
    this.activeNodes.push(master);

    if (mood === 'suspense') {
      this.buildSuspenseGraph(ctx, master);
    } else if (mood === 'action') {
      this.buildActionGraph(ctx, master);
    } else if (mood === 'storm') {
      this.buildRainGraph(ctx, master, true);
    }
  }

  private getCrackleBufferPool(ctx: AudioContext): AudioBuffer[] {
    const sampleRate = ctx.sampleRate;
    let poolByRate = this.cracklePoolCache.get(ctx);
    const existing = poolByRate?.get(sampleRate);
    if (existing && existing.length > 0) {
      return existing;
    }

    const poolSize = 6;
    const len = Math.max(256, Math.floor(sampleRate * 0.025));
    const pool: AudioBuffer[] = [];
    for (let p = 0; p < poolSize; p++) {
      const buf = ctx.createBuffer(1, len, sampleRate);
      const ch = buf.getChannelData(0);
      for (let i = 0; i < len; i++) {
        const env = Math.sin(Math.min(1, i / (len * 0.15)) * Math.PI * 0.5) * Math.exp(-i / (len * 0.25));
        ch[i] = (Math.random() * 2 - 1) * env * 0.6;
      }
      pool.push(buf);
    }

    if (!poolByRate) {
      poolByRate = new Map();
      this.cracklePoolCache.set(ctx, poolByRate);
    }
    poolByRate.set(sampleRate, pool);
    return pool;
  }

  private buildFireplaceGraph(ctx: AudioContext, master: GainNode): void {
    const rumbleSource = ctx.createBufferSource();
    rumbleSource.buffer = this.createNoiseBuffer(ctx, 4, 'brown');
    rumbleSource.loop = true;

    const lowpass = ctx.createBiquadFilter();
    lowpass.type = 'lowpass';
    lowpass.frequency.value = 240;
    lowpass.Q.value = 0.5;

    rumbleSource.connect(lowpass);
    lowpass.connect(master);
    rumbleSource.start();
    this.activeNodes.push(rumbleSource, lowpass);

    const cracklePool = this.getCrackleBufferPool(ctx);

    this.crackleTimer = window.setInterval(() => {
      if (typeof document !== 'undefined' && document.hidden) return;
      if (!this.ctx || !this.masterGain || this.currentTrack !== 'fireplace') return;
      if (Math.random() > 0.42) return;

      const now = this.ctx.currentTime;
      const popSource = this.ctx.createBufferSource();
      popSource.buffer = cracklePool[Math.floor(Math.random() * cracklePool.length)];

      const warmFilter = this.ctx.createBiquadFilter();
      warmFilter.type = 'bandpass';
      warmFilter.frequency.value = 1100 + Math.random() * 1100;
      warmFilter.Q.value = 0.9;

      const popGain = this.ctx.createGain();
      popGain.gain.setValueAtTime(0.04 + Math.random() * 0.04, now);
      popGain.gain.exponentialRampToValueAtTime(0.0005, now + 0.025);

      popSource.connect(warmFilter);
      warmFilter.connect(popGain);
      popGain.connect(this.masterGain);
      popSource.start(now);
    }, 340);
  }

  private buildRainGraph(ctx: AudioContext, master: GainNode, withStormGust = false): void {
    const rainSource = ctx.createBufferSource();
    rainSource.buffer = this.createNoiseBuffer(ctx, 5, 'pink');
    rainSource.loop = true;

    const highpass = ctx.createBiquadFilter();
    highpass.type = 'highpass';
    highpass.frequency.value = 120;
    highpass.Q.value = 0.5;

    const lowpass = ctx.createBiquadFilter();
    lowpass.type = 'lowpass';
    lowpass.frequency.value = withStormGust ? 1250 : 1750;
    lowpass.Q.value = 0.5;

    if (withStormGust) {
      const windLfo = ctx.createOscillator();
      windLfo.type = 'sine';
      windLfo.frequency.value = 0.12;
      const windDepth = ctx.createGain();
      windDepth.gain.value = 180;
      windLfo.connect(windDepth);
      windDepth.connect(lowpass.frequency);
      windLfo.start();
      this.activeNodes.push(windLfo, windDepth);
    }

    rainSource.connect(highpass);
    highpass.connect(lowpass);
    lowpass.connect(master);
    rainSource.start();
    this.activeNodes.push(rainSource, highpass, lowpass);
  }

  private buildDroneGraph(ctx: AudioContext, master: GainNode, freqs: number[], baseCutoff: number): void {
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = baseCutoff;
    filter.Q.value = 0.6;

    const lfo = ctx.createOscillator();
    lfo.type = 'sine';
    lfo.frequency.value = 0.1;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = 90;
    lfo.connect(lfoGain);
    lfoGain.connect(filter.frequency);
    lfo.start();

    filter.connect(master);
    this.activeNodes.push(filter, lfo, lfoGain);

    freqs.forEach((f, idx) => {
      const osc = ctx.createOscillator();
      // Pure sine waves eliminate harsh odd-harmonic speaker buzz at low frequencies
      osc.type = 'sine';
      osc.frequency.value = f;
      osc.detune.value = idx === 0 ? -2 : idx === 2 ? 2 : 0;

      const voiceGain = ctx.createGain();
      voiceGain.gain.value = idx === 0 ? 0.16 : 0.08;

      osc.connect(voiceGain);
      voiceGain.connect(filter);
      osc.start();
      this.activeNodes.push(osc, voiceGain);
    });
  }

  private buildSuspenseGraph(ctx: AudioContext, master: GainNode): void {
    // 1. Soft warm sub-bass breath (C2 pure sine modulated gently, never exceeding headroom)
    const subOsc = ctx.createOscillator();
    subOsc.type = 'sine';
    subOsc.frequency.value = 65.41;

    const pulseVca = ctx.createGain();
    pulseVca.gain.value = 0.1;

    const pulseLfo = ctx.createOscillator();
    pulseLfo.type = 'sine';
    pulseLfo.frequency.value = 0.72;
    const pulseDepth = ctx.createGain();
    pulseDepth.gain.value = 0.04;
    pulseLfo.connect(pulseDepth);
    pulseDepth.connect(pulseVca.gain);

    subOsc.connect(pulseVca);
    pulseVca.connect(master);
    subOsc.start();
    pulseLfo.start();
    this.activeNodes.push(subOsc, pulseVca, pulseLfo, pulseDepth);

    // 2. Smooth dark minor chord pad using pure sine tones (no harsh triangle beating)
    const padFilter = ctx.createBiquadFilter();
    padFilter.type = 'lowpass';
    padFilter.frequency.value = 360;
    padFilter.Q.value = 0.6;

    const sweepLfo = ctx.createOscillator();
    sweepLfo.type = 'sine';
    sweepLfo.frequency.value = 0.14;
    const sweepDepth = ctx.createGain();
    sweepDepth.gain.value = 90;
    sweepLfo.connect(sweepDepth);
    sweepDepth.connect(padFilter.frequency);
    sweepLfo.start();

    padFilter.connect(master);
    this.activeNodes.push(padFilter, sweepLfo, sweepDepth);

    const suspenseFreqs = [130.81, 196.0, 311.13]; // C3, G3, Eb4 clean open dark minor voicing
    suspenseFreqs.forEach((f, idx) => {
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = f;
      osc.detune.value = idx === 0 ? -2 : idx === 2 ? 2 : 0;

      const g = ctx.createGain();
      g.gain.value = idx === 0 ? 0.11 : 0.055;

      osc.connect(g);
      g.connect(padFilter);
      osc.start();
      this.activeNodes.push(osc, g);
    });
  }

  private buildActionGraph(ctx: AudioContext, master: GainNode): void {
    // Clean warm rhythmic pulse (pure sine G2) + open fifth tension drone
    const drumOsc = ctx.createOscillator();
    drumOsc.type = 'sine';
    drumOsc.frequency.value = 98.0; // G2

    const drumFilter = ctx.createBiquadFilter();
    drumFilter.type = 'lowpass';
    drumFilter.frequency.value = 220;

    const drumVca = ctx.createGain();
    drumVca.gain.value = 0.11;

    const beatLfo = ctx.createOscillator();
    beatLfo.type = 'sine';
    beatLfo.frequency.value = 1.45;
    const beatDepth = ctx.createGain();
    beatDepth.gain.value = 0.05;
    beatLfo.connect(beatDepth);
    beatDepth.connect(drumVca.gain);

    drumOsc.connect(drumFilter);
    drumFilter.connect(drumVca);
    drumVca.connect(master);
    drumOsc.start();
    beatLfo.start();
    this.activeNodes.push(drumOsc, drumFilter, drumVca, beatLfo, beatDepth);

    this.buildDroneGraph(ctx, master, [98.0, 146.83, 196.0], 380);
  }

  public setVolume(volume: number, timeConstant = 0.05): void {
    this.lastVolume = Math.max(0, Math.min(1, volume));
    if (this.masterGain && this.ctx) {
      if (this.currentTrack === 'adaptive' && this.currentMood === 'neutral') return;
      const scale = 0.22;
      this.masterGain.gain.setTargetAtTime(
        this.lastVolume * scale,
        this.ctx.currentTime,
        timeConstant
      );
    }
  }

  public stop(): void {
    this.currentTrack = 'silence';
    this.currentMood = 'neutral';
    this.stopImmediate();
  }
}

export const ambientAudio = new AmbientSoundEngine();
