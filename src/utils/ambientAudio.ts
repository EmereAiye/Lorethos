export type AmbientTrackId = 'fireplace' | 'rain' | 'mythic_drone' | 'silence';

class AmbientSoundEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private activeNodes: AudioNode[] = [];
  private crackleTimer: number | null = null;
  private currentTrack: AmbientTrackId = 'silence';

  private ensureContext(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
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

      rumbleSource.connect(lowpass);
      lowpass.connect(master);
      rumbleSource.start();
      this.activeNodes.push(rumbleSource, lowpass);

      // Gentle random hearth crackle pops
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
  }
}

export const ambientAudio = new AmbientSoundEngine();
