export class AudioEngine {
  private ctx: AudioContext | null = null;
  private sourceNode: AudioBufferSourceNode | null = null;
  private gainNode: GainNode | null = null;
  private audioBuffer: AudioBuffer | null = null;
  private startTimestamp: number = 0; // performance.now() when audio started
  private _isPlaying: boolean = false;
  private _isPaused: boolean = false;
  private pauseOffset: number = 0;

  async init(): Promise<void> {
    this.ctx = new AudioContext();
    this.gainNode = this.ctx.createGain();
    this.gainNode.connect(this.ctx.destination);
  }

  async loadAudio(url: string): Promise<void> {
    if (!this.ctx) await this.init();
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Failed to load audio: ${response.status}`);
    const arrayBuffer = await response.arrayBuffer();
    this.audioBuffer = await this.ctx!.decodeAudioData(arrayBuffer);
  }

  play(offset: number = 0): void {
    this.stop();
    this.startTimestamp = performance.now() - offset;
    this.pauseOffset = offset;
    this._isPlaying = true;
    this._isPaused = false;

    // If we have audio, play it
    if (this.ctx && this.audioBuffer && this.gainNode) {
      if (this.ctx.state === 'suspended') {
        this.ctx.resume();
      }
      this.sourceNode = this.ctx.createBufferSource();
      this.sourceNode.buffer = this.audioBuffer;
      this.sourceNode.connect(this.gainNode);
      this.sourceNode.start(0, offset / 1000);
    }
    // Otherwise we run in timer-only mode — clock still ticks via performance.now()
  }

  pause(): void {
    if (!this._isPlaying || this._isPaused) return;
    this.pauseOffset = this.currentTime();
    try { this.sourceNode?.stop(); } catch { /* already stopped */ }
    this._isPaused = true;
    this._isPlaying = false;
  }

  resume(): void {
    if (!this._isPaused) return;
    this.play(this.pauseOffset);
  }

  stop(): void {
    try { this.sourceNode?.stop(); } catch { /* already stopped */ }
    this.sourceNode = null;
    this._isPlaying = false;
    this._isPaused = false;
    this.pauseOffset = 0;
  }

  setVolume(value: number): void {
    if (this.gainNode) {
      this.gainNode.gain.value = Math.max(0, Math.min(1, value));
    }
  }

  /** Returns current playback position in milliseconds from song start */
  currentTime(): number {
    if (this._isPaused) return this.pauseOffset;
    if (!this._isPlaying) return 0;
    return performance.now() - this.startTimestamp;
  }

  /** Convert a performance.now() timestamp to song time in ms */
  toSongTime(perfTimestamp: number): number {
    if (this.startTimestamp === 0) return 0;
    return perfTimestamp - this.startTimestamp;
  }

  get isPlaying(): boolean { return this._isPlaying; }
  get isPaused(): boolean { return this._isPaused; }

  getDuration(): number {
    return this.audioBuffer ? this.audioBuffer.duration * 1000 : 0;
  }

  destroy(): void {
    this.stop();
    this.ctx?.close();
    this.ctx = null;
    this.gainNode = null;
  }
}
