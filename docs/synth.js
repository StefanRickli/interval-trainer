/* Audio engines: uniform interface { init(), playNote(midi, ms), chain? , dispose() }
   - WebSynth: basic OscillatorNode
   - ToneSynthEngine: Tone.Synth
   - ToneSamplerEngine: Tone.Sampler (piano samples from Tone.js demo)
*/

export class OwnWebSynth {
  constructor() { this.ctx = null; this.gain = null; }
  async init() {
    if (!this.ctx) {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
      this.gain = this.ctx.createGain();
      this.gain.gain.value = 0.15;
      this.gain.connect(this.ctx.destination);
    }
    if (this.ctx.state !== 'running') {
      try { await this.ctx.resume(); } catch {}
    }
  }
  midiToFreq(m){ return 440 * Math.pow(2, (m-69)/12); }
  async playNote(midi, ms=600){
    await this.init();
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.value = this.midiToFreq(midi);
    const env = this.ctx.createGain();
    env.gain.setValueAtTime(0, now);
    env.gain.linearRampToValueAtTime(1, now + 0.01);
    env.gain.exponentialRampToValueAtTime(0.0001, now + ms/1000);
    osc.connect(env).connect(this.gain);
    osc.start(now);
    osc.stop(now + ms/1000 + 0.02);
  }
  dispose(){/* noop for simple nodes */}
}

export class ToneSynthEngine {
  constructor() { this.synth = null; }
  async init() {
    if (!this.synth) {
      // Ensure Tone started by a user gesture elsewhere
      this.synth = new Tone.Synth({
        oscillator:{ type:'sine' },
        envelope:{ attack:0.01, decay:0.1, sustain:0.3, release:0.2 }
      }).toDestination();
      this.synth.volume.value = -8;
    }
  }
  async playNote(midi, ms=600){
    await this.init();
    const freq = Tone.Frequency(midi, "midi");
    this.synth.triggerAttackRelease(freq, ms/1000);
  }
  dispose(){ this.synth?.dispose(); this.synth = null; }
}

export class ToneSamplerEngine {
  constructor(){
    this.sampler = null;
    this.loaded = false;
    this._loadPromise = null;
  }
  async init(){
    if (this.loaded) return;
    if (this._loadPromise) {               // already loading → await it
      await this._loadPromise;
      return;
    }
    this._loadPromise = new Promise((resolve, reject) => {
      try {
        this.sampler = new Tone.Sampler({
          urls: {
            C4: "C4.mp3",
            "D#4": "Ds4.mp3",
            "F#4": "Fs4.mp3",
            A4: "A4.mp3",
          },
          baseUrl: "https://tonejs.github.io/audio/salamander/",
          onload: () => { this.loaded = true; resolve(); }
        }).toDestination();
        this.sampler.volume.value = -6;
      } catch (e) {
        reject(e);
      }
    });
    await this._loadPromise;
  }
  async playNote(midi, ms=800){
    await this.init();                     // ← waits until samples are ready
    const freq = Tone.Frequency(midi, "midi");
    this.sampler.triggerAttackRelease(freq, ms/1000);
  }
  dispose(){
    this.sampler?.dispose();
    this.sampler = null;
    this.loaded = false;
    this._loadPromise = null;
  }
}
