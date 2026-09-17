// Web Audio API Ambient Sound Engine
class SoundEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private ambientGain: GainNode | null = null;
  private noiseNode: AudioNode | null = null;
  private filterNode: BiquadFilterNode | null = null;
  private isMuted: boolean = true;
  private currentWeather: 'sun' | 'rain' | 'snow' | 'none' = 'none';

  public init() {
    if (this.ctx) return;
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      this.ctx = new AudioCtx();
      this.masterGain = this.ctx.createGain();
      this.ambientGain = this.ctx.createGain();

      this.masterGain.gain.setValueAtTime(0.3, this.ctx.currentTime);
      this.ambientGain.gain.setValueAtTime(0.2, this.ctx.currentTime);

      this.ambientGain.connect(this.masterGain);
      this.masterGain.connect(this.ctx.destination);
    } catch (e) {
      console.warn('Web Audio API not supported or blocked:', e);
    }
  }

  public toggleMute(): boolean {
    if (!this.ctx) {
      this.init();
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      void this.ctx.resume();
    }

    this.isMuted = !this.isMuted;
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setValueAtTime(this.isMuted ? 0 : 0.3, this.ctx.currentTime);
    }
    if (!this.isMuted) {
      this.updateWeatherAmbience(this.currentWeather, 0.5);
    }
    return !this.isMuted;
  }

  public getIsMuted(): boolean {
    return this.isMuted;
  }

  public updateWeatherAmbience(weather: 'sun' | 'rain' | 'snow' | 'none', volatility: number = 0.5) {
    this.currentWeather = weather;
    if (this.isMuted || !this.ctx || !this.ambientGain) return;

    // Clean up previous noise
    if (this.noiseNode) {
      try {
        (this.noiseNode as any).stop?.();
        this.noiseNode.disconnect();
      } catch {}
      this.noiseNode = null;
    }

    const bufferSize = this.ctx.sampleRate * 2;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const output = buffer.getChannelData(0);

    for (let i = 0; i < bufferSize; i++) {
      output[i] = Math.random() * 2 - 1;
    }

    const whiteNoise = this.ctx.createBufferSource();
    whiteNoise.buffer = buffer;
    whiteNoise.loop = true;

    this.filterNode = this.ctx.createBiquadFilter();

    if (weather === 'rain') {
      this.filterNode.type = 'lowpass';
      this.filterNode.frequency.setValueAtTime(800 + volatility * 600, this.ctx.currentTime);
      this.ambientGain.gain.setValueAtTime(0.25 + volatility * 0.15, this.ctx.currentTime);
    } else if (weather === 'snow') {
      this.filterNode.type = 'bandpass';
      this.filterNode.frequency.setValueAtTime(400, this.ctx.currentTime);
      this.filterNode.Q.setValueAtTime(3.0, this.ctx.currentTime);
      this.ambientGain.gain.setValueAtTime(0.15, this.ctx.currentTime);
    } else if (weather === 'sun') {
      this.filterNode.type = 'lowpass';
      this.filterNode.frequency.setValueAtTime(1500, this.ctx.currentTime);
      this.ambientGain.gain.setValueAtTime(0.12, this.ctx.currentTime);
    } else {
      this.filterNode.type = 'lowpass';
      this.filterNode.frequency.setValueAtTime(600, this.ctx.currentTime);
      this.ambientGain.gain.setValueAtTime(0.08, this.ctx.currentTime);
    }

    whiteNoise.connect(this.filterNode);
    this.filterNode.connect(this.ambientGain);
    whiteNoise.start();
    this.noiseNode = whiteNoise;
  }
}

export const soundEngine = new SoundEngine();
