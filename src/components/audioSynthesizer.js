// Procedural Web Audio Synthesizer Engine
// Provides high-fidelity, zero-dependency musical synthesis fallback if external audio streams encounter network issues.

export class ProceduralMusicEngine {
  constructor() {
    this.audioCtx = null;
    this.isPlaying = false;
    this.timerId = null;
    this.currentTrackId = null;
    this.step = 0;
    this.volume = 0.8;
    this.masterGain = null;
    this.analyser = null;
  }

  init() {
    if (!this.audioCtx) {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      this.audioCtx = new AudioContextClass();
      this.masterGain = this.audioCtx.createGain();
      this.analyser = this.audioCtx.createAnalyser();
      this.analyser.fftSize = 64;
      this.masterGain.gain.setValueAtTime(this.volume, this.audioCtx.currentTime);
      this.masterGain.connect(this.analyser);
      this.analyser.connect(this.audioCtx.destination);
    }
    if (this.audioCtx.state === 'suspended') {
      this.audioCtx.resume();
    }
  }

  setVolume(vol) {
    this.volume = Math.max(0, Math.min(1, vol));
    if (this.masterGain && this.audioCtx) {
      this.masterGain.gain.setTargetAtTime(this.volume, this.audioCtx.currentTime, 0.05);
    }
  }

  playNote(frequency, duration, type = 'sine', startTime = null) {
    if (!this.audioCtx) return;
    const now = startTime || this.audioCtx.currentTime;
    const osc = this.audioCtx.createOscillator();
    const gain = this.audioCtx.createGain();

    osc.type = type;
    osc.frequency.setValueAtTime(frequency, now);

    gain.gain.setValueAtTime(0.001, now);
    gain.gain.exponentialRampToValueAtTime(0.18, now + 0.04);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);

    osc.connect(gain);
    gain.connect(this.masterGain);

    osc.start(now);
    osc.stop(now + duration + 0.05);
  }

  playBeat(track) {
    if (!this.audioCtx || !this.isPlaying) return;
    const now = this.audioCtx.currentTime;

    // Chord progressions based on track genre
    const scales = {
      Synthpop: [261.63, 329.63, 392.00, 523.25, 440.0, 349.23], // C major / A minor
      Chill: [220.00, 261.63, 329.63, 392.00, 440.00],          // Am7 chill
      Electronic: [130.81, 164.81, 196.00, 261.63, 329.63],     // Driving electro
      Pop: [261.63, 293.66, 329.63, 392.00, 440.00],            // Pentatonic pop
      Focus: [196.00, 246.94, 293.66, 369.99, 440.00],          // Ambient dream
      "Hip-Hop": [110.00, 130.81, 146.83, 164.81, 220.00],       // Deep 808
      Rock: [146.83, 174.61, 220.00, 293.66, 440.00],           // Power roots
      Gaming: [261.63, 329.63, 392.00, 587.33, 659.25]          // 8-bit arps
    };

    const notes = scales[track?.genre] || scales.Chill;
    const noteIndex = (this.step + Math.floor(this.step / 4)) % notes.length;
    const rootFreq = notes[noteIndex];

    // Melodic Arpeggio
    const type = track?.genre === 'Gaming' ? 'square' : track?.genre === 'Electronic' ? 'sawtooth' : 'triangle';
    this.playNote(rootFreq, 0.45, type, now);

    // Harmonic Chord Accent every 4 steps
    if (this.step % 4 === 0) {
      const thirdFreq = notes[(noteIndex + 2) % notes.length];
      const fifthFreq = notes[(noteIndex + 4) % notes.length];
      this.playNote(thirdFreq * 0.5, 0.8, 'sine', now);
      this.playNote(fifthFreq * 0.5, 0.8, 'sine', now);

      // Kick drum simulation
      const kickOsc = this.audioCtx.createOscillator();
      const kickGain = this.audioCtx.createGain();
      kickOsc.frequency.setValueAtTime(140, now);
      kickOsc.frequency.exponentialRampToValueAtTime(35, now + 0.12);
      kickGain.gain.setValueAtTime(0.4, now);
      kickGain.gain.exponentialRampToValueAtTime(0.001, now + 0.14);
      kickOsc.connect(kickGain);
      kickGain.connect(this.masterGain);
      kickOsc.start(now);
      kickOsc.stop(now + 0.15);
    }

    // Hi-hat sound every 2 steps
    if (this.step % 2 === 1) {
      const bufferSize = this.audioCtx.sampleRate * 0.04;
      const buffer = this.audioCtx.createBuffer(1, bufferSize, this.audioCtx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = (Math.random() * 2 - 1) * 0.08;
      }
      const noise = this.audioCtx.createBufferSource();
      noise.buffer = buffer;
      const noiseGain = this.audioCtx.createGain();
      noiseGain.gain.setValueAtTime(0.12, now);
      noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.04);
      noise.connect(noiseGain);
      noiseGain.connect(this.masterGain);
      noise.start(now);
    }

    this.step++;
  }

  start(track) {
    this.init();
    this.stop();
    this.isPlaying = true;
    this.currentTrackId = track.id;
    this.step = 0;

    const tempoMs = track.genre === 'Chill' || track.genre === 'Focus' ? 420 : 260;
    this.playBeat(track);
    this.timerId = setInterval(() => {
      this.playBeat(track);
    }, tempoMs);
  }

  stop() {
    this.isPlaying = false;
    if (this.timerId) {
      clearInterval(this.timerId);
      this.timerId = null;
    }
  }
}
