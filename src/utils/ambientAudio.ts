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

  // Ellipses or sharp dramatic exclamations nudge tension subtly
  if (/\.{3}|—/.test(clean) && suspenseScore >= 1) {
    suspenseScore += 1;
  }

  // Require a clear signal (>= 3) so normal descriptive scenes stay silent ('neutral')
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
  private currentTrack: AmbientTrackId = 'silence';
  private currentMood: SceneMood = 'neutral';
  private lastVolume = 0.6;

  private getOutputDestination(ctx: AudioContext): AudioNode {
    if (!this.compressor || this.compressor.context !== ctx) {
      const comp = ctx.createDynamicsCompressor();
      comp.threshold.value = -14;
      comp.knee.value = 12;
      comp.ratio.value = 6;
      comp.attack.value = 0.01;
      comp.release.value = 0.2;
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
        oldMaster.gain.setTargetAtTime(0.0001, now, 0.025);
        window.setTimeout(cleanupNodes, 90);
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
      // Adaptive mode waits for setSceneMood(); remain silent until a mood spot is active
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
    master.gain.setTargetAtTime(this.lastVolume * 0.28, ctx.currentTime, 0.25);
    master.connect(this.getOutputDestination(ctx));
    this.masterGain = master;
    this.activeNodes.push(master);

    if (track === 'fireplace') {
      this.buildFireplaceGraph(ctx, master);
    } else if (track === 'rain') {
      this.buildRainGraph(ctx, master);
    } else if (track === 'mythic_drone') {
      this.buildDroneGraph(ctx, master, [110, 164.81, 220], 380);
    }
  }

  /**
   * Dynamically drives soundscape from the active paragraph's mood.
   * Neutral/normal scenes smoothly fade to silence (zero sound).
   * Suspense/action/storm spots smoothly swell in atmospheric cues.
   */
  public setSceneMood(mood: SceneMood, volume: number): void {
    this.lastVolume = Math.max(0, Math.min(1, volume));
    this.currentTrack = 'adaptive';

    if (mood === this.currentMood) {
      if (mood !== 'neutral') {
        this.setVolume(this.lastVolume);
      }
      return;
    }

    this.currentMood = mood;

    if (mood === 'neutral') {
      if (this.masterGain && this.ctx) {
        const now = this.ctx.currentTime;
        this.masterGain.gain.cancelScheduledValues(now);
        this.masterGain.gain.setTargetAtTime(0.0001, now, 0.35);
        this.clearFadeTimer();
        this.fadeOutCleanupTimer = window.setTimeout(() => {
          if (this.currentTrack === 'adaptive' && this.currentMood === 'neutral') {
            this.stopImmediate();
          }
        }, 1400);
      }
      return;
    }

    const ctx = this.ensureContext();
    if (!ctx) return;

    this.stopImmediate();
    const master = ctx.createGain();
    master.gain.setValueAtTime(0.0001, ctx.currentTime);
    master.gain.setTargetAtTime(this.lastVolume * 0.3, ctx.currentTime, 0.45);
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

  private buildFireplaceGraph(ctx: AudioContext, master: GainNode): void {
    const rumbleSource = ctx.createBufferSource();
    rumbleSource.buffer = this.createNoiseBuffer(ctx, 4, 'brown');
    rumbleSource.loop = true;

    const lowpass = ctx.createBiquadFilter();
    lowpass.type = 'lowpass';
    lowpass.frequency.value = 340;

    rumbleSource.connect(lowpass);
    lowpass.connect(master);
    rumbleSource.start();
    this.activeNodes.push(rumbleSource, lowpass);

    this.crackleTimer = window.setInterval(() => {
      if (!this.ctx || !this.masterGain || this.currentTrack !== 'fireplace') return;
      if (Math.random() > 0.55) return;

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
  }

  private buildRainGraph(ctx: AudioContext, master: GainNode, withStormGust = false): void {
    const rainSource = ctx.createBufferSource();
    rainSource.buffer = this.createNoiseBuffer(ctx, 5, 'pink');
    rainSource.loop = true;

    const bandpass = ctx.createBiquadFilter();
    bandpass.type = 'bandpass';
    bandpass.frequency.value = withStormGust ? 780 : 1100;
    bandpass.Q.value = 0.55;

    if (withStormGust) {
      const windLfo = ctx.createOscillator();
      windLfo.type = 'sine';
      windLfo.frequency.value = 0.14;
      const windDepth = ctx.createGain();
      windDepth.gain.value = 320;
      windLfo.connect(windDepth);
      windDepth.connect(bandpass.frequency);
      windLfo.start();
      this.activeNodes.push(windLfo, windDepth);
    }

    const highShelf = ctx.createBiquadFilter();
    highShelf.type = 'lowpass';
    highShelf.frequency.value = withStormGust ? 2400 : 3200;

    rainSource.connect(bandpass);
    bandpass.connect(highShelf);
    highShelf.connect(master);
    rainSource.start();
    this.activeNodes.push(rainSource, bandpass, highShelf);
  }

  private buildDroneGraph(ctx: AudioContext, master: GainNode, freqs: number[], baseCutoff: number): void {
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = baseCutoff;

    const lfo = ctx.createOscillator();
    lfo.type = 'sine';
    lfo.frequency.value = 0.12;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = 160;
    lfo.connect(lfoGain);
    lfoGain.connect(filter.frequency);
    lfo.start();

    filter.connect(master);
    this.activeNodes.push(filter, lfo, lfoGain);

    freqs.forEach((f, idx) => {
      const osc = ctx.createOscillator();
      osc.type = idx === 1 ? 'triangle' : 'sine';
      osc.frequency.value = f;
      osc.detune.value = idx === 0 ? -4 : idx === 2 ? 4 : 0;

      const voiceGain = ctx.createGain();
      voiceGain.gain.value = idx === 0 ? 0.18 : 0.09;

      osc.connect(voiceGain);
      voiceGain.connect(filter);
      osc.start();
      this.activeNodes.push(osc, voiceGain);
    });
  }

  private buildSuspenseGraph(ctx: AudioContext, master: GainNode): void {
    // 1. Subtle low heartbeat pulse (warm sub-bass C2 modulated smoothly)
    const subOsc = ctx.createOscillator();
    subOsc.type = 'sine';
    subOsc.frequency.value = 65.41; // C2

    const pulseVca = ctx.createGain();
    pulseVca.gain.value = 0.14;

    const pulseLfo = ctx.createOscillator();
    pulseLfo.type = 'sine';
    pulseLfo.frequency.value = 0.85; // ~51 BPM gentle tense pulse
    const pulseDepth = ctx.createGain();
    pulseDepth.gain.value = 0.08;
    pulseLfo.connect(pulseDepth);
    pulseDepth.connect(pulseVca.gain);

    subOsc.connect(pulseVca);
    pulseVca.connect(master);
    subOsc.start();
    pulseLfo.start();
    this.activeNodes.push(subOsc, pulseVca, pulseLfo, pulseDepth);

    // 2. Dark minor-third & diminished-fifth atmospheric pad with gentle filter breathing
    const padFilter = ctx.createBiquadFilter();
    padFilter.type = 'lowpass';
    padFilter.frequency.value = 420;
    padFilter.Q.value = 0.9;

    const sweepLfo = ctx.createOscillator();
    sweepLfo.type = 'sine';
    sweepLfo.frequency.value = 0.18;
    const sweepDepth = ctx.createGain();
    sweepDepth.gain.value = 140;
    sweepLfo.connect(sweepDepth);
    sweepDepth.connect(padFilter.frequency);
    sweepLfo.start();

    padFilter.connect(master);
    this.activeNodes.push(padFilter, sweepLfo, sweepDepth);

    const suspenseFreqs = [130.81, 155.56, 185.0, 246.94]; // C3, Eb3, Gb3, B3 warm eerie cluster
    suspenseFreqs.forEach((f, idx) => {
      const osc = ctx.createOscillator();
      osc.type = idx % 2 === 0 ? 'sine' : 'triangle';
      osc.frequency.value = f;
      osc.detune.value = idx % 2 === 0 ? -3 : 4;

      const g = ctx.createGain();
      g.gain.value = idx === 0 ? 0.11 : idx === 3 ? 0.04 : 0.06;

      osc.connect(g);
      g.connect(padFilter);
      osc.start();
      this.activeNodes.push(osc, g);
    });
  }

  private buildActionGraph(ctx: AudioContext, master: GainNode): void {
    // Urgent muffled low percussive pulse + fifth tension drone (G2 + D3)
    const drumOsc = ctx.createOscillator();
    drumOsc.type = 'triangle';
    drumOsc.frequency.value = 73.42; // D2

    const drumFilter = ctx.createBiquadFilter();
    drumFilter.type = 'lowpass';
    drumFilter.frequency.value = 240;

    const drumVca = ctx.createGain();
    drumVca.gain.value = 0.15;

    const beatLfo = ctx.createOscillator();
    beatLfo.type = 'sine';
    beatLfo.frequency.value = 1.65;
    const beatDepth = ctx.createGain();
    beatDepth.gain.value = 0.1;
    beatLfo.connect(beatDepth);
    beatDepth.connect(drumVca.gain);

    drumOsc.connect(drumFilter);
    drumFilter.connect(drumVca);
    drumVca.connect(master);
    drumOsc.start();
    beatLfo.start();
    this.activeNodes.push(drumOsc, drumFilter, drumVca, beatLfo, beatDepth);

    this.buildDroneGraph(ctx, master, [98.0, 146.83, 233.08], 460);
  }

  public setVolume(volume: number): void {
    this.lastVolume = Math.max(0, Math.min(1, volume));
    if (this.masterGain && this.ctx) {
      if (this.currentTrack === 'adaptive' && this.currentMood === 'neutral') return;
      const scale = this.currentTrack === 'adaptive' ? 0.3 : 0.28;
      this.masterGain.gain.setTargetAtTime(
        this.lastVolume * scale,
        this.ctx.currentTime,
        0.05
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
