// Synthesised sound only: a small WebAudio engine with a looping sun-soaked groove,
// a two-tone police siren, an engine hum that follows the player's speed, and short
// effects. Everything is guarded, so a browser with no audio still plays silently.
import { WANTED } from './config.js';

const MUSIC_BPM = 96;
const BEAT = 60 / MUSIC_BPM;
// Am - F - C - G, one bar each, as bass roots and a light lead line.
const CHORDS = [
  { bass: 55.0, lead: [220.0, 261.63, 329.63] },
  { bass: 43.65, lead: [174.61, 220.0, 261.63] },
  { bass: 65.41, lead: [196.0, 261.63, 329.63] },
  { bass: 49.0, lead: [196.0, 246.94, 293.66] },
];

export function createAudio() {
  let ctx = null;
  let master = null;
  let musicGain = null;
  let sirenOsc = null;
  let sirenGain = null;
  let sirenLfo = null;
  let engineOsc = null;
  let engineGain = null;
  let nextNoteTime = 0;
  let step = 0;
  let started = false;

  function ensure() {
    if (started) return;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = 0.5;
      master.connect(ctx.destination);
      musicGain = ctx.createGain();
      musicGain.gain.value = 0.16;
      musicGain.connect(master);
      // Siren: a triangle wave whose pitch wobbles between two tones.
      sirenOsc = ctx.createOscillator();
      sirenOsc.type = 'triangle';
      sirenOsc.frequency.value = 740;
      sirenLfo = ctx.createOscillator();
      sirenLfo.type = 'square';
      sirenLfo.frequency.value = 0.6;
      const lfoGain = ctx.createGain();
      lfoGain.gain.value = 140;
      sirenLfo.connect(lfoGain);
      lfoGain.connect(sirenOsc.frequency);
      sirenGain = ctx.createGain();
      sirenGain.gain.value = 0;
      sirenOsc.connect(sirenGain);
      sirenGain.connect(master);
      sirenOsc.start();
      sirenLfo.start();
      // Engine: a low sawtooth through a low-pass filter.
      engineOsc = ctx.createOscillator();
      engineOsc.type = 'sawtooth';
      engineOsc.frequency.value = 55;
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 320;
      engineGain = ctx.createGain();
      engineGain.gain.value = 0;
      engineOsc.connect(filter);
      filter.connect(engineGain);
      engineGain.connect(master);
      engineOsc.start();
      nextNoteTime = ctx.currentTime + 0.1;
      started = true;
    } catch {
      ctx = null;
    }
  }

  function note(freq, time, dur, type, gain) {
    try {
      const osc = ctx.createOscillator();
      osc.type = type;
      osc.frequency.value = freq;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0, time);
      g.gain.linearRampToValueAtTime(gain, time + 0.02);
      g.gain.exponentialRampToValueAtTime(0.001, time + dur);
      osc.connect(g);
      g.connect(musicGain);
      osc.start(time);
      osc.stop(time + dur + 0.05);
    } catch {
      // A note that fails to schedule is dropped; the groove goes on.
    }
  }

  /** Schedule the groove a little ahead of the playhead; call once a frame. */
  function update() {
    if (!ctx) return;
    try {
      if (ctx.state === 'suspended') void ctx.resume();
      while (nextNoteTime < ctx.currentTime + 0.25) {
        const bar = Math.floor(step / 8) % CHORDS.length;
        const chord = CHORDS[bar];
        const beatInBar = step % 8;
        if (beatInBar === 0 || beatInBar === 4) note(chord.bass, nextNoteTime, BEAT * 1.8, 'triangle', 0.5);
        if (beatInBar % 2 === 0) note(chord.lead[(beatInBar / 2) % 3], nextNoteTime, BEAT * 0.9, 'sine', 0.22);
        if (beatInBar % 2 === 1) note(chord.lead[0] * 2, nextNoteTime, BEAT * 0.4, 'sine', 0.08);
        nextNoteTime += BEAT / 2;
        step += 1;
      }
    } catch {
      // Music scheduling never breaks the game.
    }
  }

  function setWanted(stars) {
    if (!ctx || !sirenGain) return;
    try {
      sirenGain.gain.setTargetAtTime(stars > 0 ? 0.05 : 0, ctx.currentTime, 0.3);
    } catch { /* ignore */ }
  }

  function setEngine(speed, inCar) {
    if (!ctx || !engineOsc || !engineGain) return;
    try {
      const target = inCar ? 0.06 : 0;
      engineGain.gain.setTargetAtTime(target, ctx.currentTime, 0.1);
      engineOsc.frequency.setTargetAtTime(55 + Math.abs(speed) * 0.22, ctx.currentTime, 0.08);
    } catch { /* ignore */ }
  }

  function blip(freq, dur, type, gain) {
    if (!ctx) return;
    try {
      const osc = ctx.createOscillator();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(Math.max(30, freq * 0.6), ctx.currentTime + dur);
      const g = ctx.createGain();
      g.gain.setValueAtTime(gain, ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
      osc.connect(g);
      g.connect(master);
      osc.start();
      osc.stop(ctx.currentTime + dur + 0.02);
    } catch { /* ignore */ }
  }

  function noise(dur, gain) {
    if (!ctx) return;
    try {
      const len = Math.floor(ctx.sampleRate * dur);
      const buffer = ctx.createBuffer(1, len, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < len; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
      const src = ctx.createBufferSource();
      src.buffer = buffer;
      const g = ctx.createGain();
      g.gain.value = gain;
      src.connect(g);
      g.connect(master);
      src.start();
    } catch { /* ignore */ }
  }

  return {
    ensure,
    update,
    setWanted,
    setEngine,
    punch() { blip(140, 0.12, 'square', 0.25); noise(0.08, 0.12); },
    crash() { noise(0.25, 0.3); blip(70, 0.2, 'sawtooth', 0.2); },
    pickup() { blip(880, 0.12, 'sine', 0.2); },
    cash() { blip(660, 0.08, 'sine', 0.18); blip(990, 0.14, 'sine', 0.18); },
    pass() { [523, 659, 784, 1047].forEach((f, i) => { try { setTimeout(() => blip(f, 0.18, 'sine', 0.2), i * 90); } catch { /* ignore */ } }); },
    fail() { blip(220, 0.3, 'sawtooth', 0.18); },
    busted() { [392, 311, 233].forEach((f, i) => { try { setTimeout(() => blip(f, 0.25, 'triangle', 0.22), i * 140); } catch { /* ignore */ } }); },
  };
}
