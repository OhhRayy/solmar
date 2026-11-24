// Solmar sound bank — every sound is synthesized with WebAudio, no audio files.
// A tiny step sequencer plays a laid-back bass groove; sirens, engine hum and
// one-shot effects are plain oscillators and noise buffers built at runtime.

(function (global) {
  'use strict';

  function SoundBank() {
    this.ctx = null;
    this.master = null;
    this.muted = false;
    this.musicTimer = null;
    this.step = 0;
    this.engineOsc = null;
    this.engineGain = null;
    this.sirenOsc = null;
    this.sirenGain = null;
    this.sirenLfo = null;
  }

  SoundBank.prototype.ensure = function () {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return true;
    }
    var AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return false;
    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.master.gain.value = 0.5;
    this.master.connect(this.ctx.destination);
    return true;
  };

  SoundBank.prototype.setMuted = function (on) {
    this.muted = !!on;
    if (this.master) this.master.gain.value = this.muted ? 0 : 0.5;
  };

  SoundBank.prototype.blip = function (freq, dur, type, vol, slideTo) {
    if (!this.ensure() || this.muted) return;
    var t = this.ctx.currentTime;
    var o = this.ctx.createOscillator();
    var g = this.ctx.createGain();
    o.type = type || 'square';
    o.frequency.setValueAtTime(freq, t);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
    g.gain.setValueAtTime(vol || 0.15, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g);
    g.connect(this.master);
    o.start(t);
    o.stop(t + dur + 0.02);
  };

  SoundBank.prototype.noiseHit = function (dur, vol, low) {
    if (!this.ensure() || this.muted) return;
    var t = this.ctx.currentTime;
    var len = Math.floor(this.ctx.sampleRate * dur);
    var buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    var data = buf.getChannelData(0);
    for (var i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    var src = this.ctx.createBufferSource();
    src.buffer = buf;
    var filt = this.ctx.createBiquadFilter();
    filt.type = 'lowpass';
    filt.frequency.value = low || 900;
    var g = this.ctx.createGain();
    g.gain.value = vol || 0.25;
    src.connect(filt);
    filt.connect(g);
    g.connect(this.master);
    src.start(t);
  };

  SoundBank.prototype.punch = function () { this.noiseHit(0.12, 0.3, 700); this.blip(140, 0.1, 'sine', 0.2, 60); };
  SoundBank.prototype.pickup = function () { this.blip(660, 0.09, 'sine', 0.18); this.blip(990, 0.14, 'sine', 0.18); };
  SoundBank.prototype.cash = function () {
    var self = this;
    [523, 659, 784, 1046].forEach(function (f, i) {
      setTimeout(function () { self.blip(f, 0.12, 'triangle', 0.16); }, i * 70);
    });
  };
  SoundBank.prototype.crash = function () { this.noiseHit(0.25, 0.35, 500); };
  SoundBank.prototype.wasted = function () {
    var self = this;
    [392, 311, 233, 175].forEach(function (f, i) {
      setTimeout(function () { self.blip(f, 0.3, 'sawtooth', 0.12); }, i * 180);
    });
  };

  // Engine hum that follows the car's speed (0..1).
  SoundBank.prototype.engine = function (level) {
    if (!this.ensure() || this.muted) { this.engineStop(); return; }
    if (!this.engineOsc) {
      this.engineOsc = this.ctx.createOscillator();
      this.engineOsc.type = 'sawtooth';
      this.engineGain = this.ctx.createGain();
      this.engineGain.gain.value = 0;
      var filt = this.ctx.createBiquadFilter();
      filt.type = 'lowpass';
      filt.frequency.value = 420;
      this.engineOsc.connect(filt);
      filt.connect(this.engineGain);
      this.engineGain.connect(this.master);
      this.engineOsc.start();
    }
    this.engineOsc.frequency.value = 55 + level * 130;
    this.engineGain.gain.value = 0.02 + level * 0.05;
  };
  SoundBank.prototype.engineStop = function () {
    if (this.engineOsc) {
      try { this.engineOsc.stop(); } catch (e) { /* already stopped */ }
      this.engineOsc = null;
      this.engineGain = null;
    }
  };

  // Two-tone siren that wails while the police are after the player.
  SoundBank.prototype.siren = function (on) {
    if (!on) {
      if (this.sirenOsc) {
        try { this.sirenOsc.stop(); } catch (e) { /* already stopped */ }
        this.sirenOsc = null;
        this.sirenGain = null;
      }
      return;
    }
    if (!this.ensure() || this.muted || this.sirenOsc) return;
    var o = this.ctx.createOscillator();
    o.type = 'triangle';
    o.frequency.value = 750;
    var lfo = this.ctx.createOscillator();
    lfo.type = 'square';
    lfo.frequency.value = 0.7;
    var lg = this.ctx.createGain();
    lg.gain.value = 220;
    lfo.connect(lg);
    lg.connect(o.frequency);
    var g = this.ctx.createGain();
    g.gain.value = 0.045;
    o.connect(g);
    g.connect(this.master);
    o.start();
    lfo.start();
    this.sirenOsc = o;
    this.sirenGain = g;
    this.sirenLfo = lfo;
  };

  // A simple 16-step groove: root notes on a bass square wave plus a hat tick.
  SoundBank.prototype.startMusic = function () {
    if (!this.ensure() || this.musicTimer) return;
    var self = this;
    var roots = [55, 55, 65.41, 49]; // A1 A1 C2 G1, one bar each
    this.musicTimer = setInterval(function () {
      if (self.muted) return;
      var bar = Math.floor(self.step / 16) % roots.length;
      var beat = self.step % 16;
      var root = roots[bar];
      if (beat % 4 === 0) self.blip(root, 0.22, 'square', 0.07);
      if (beat % 8 === 6) self.blip(root * 1.5, 0.14, 'square', 0.05);
      if (beat % 2 === 0) self.noiseHit(0.03, 0.03, 6000);
      self.step++;
    }, 150);
  };

  SoundBank.prototype.stopMusic = function () {
    if (this.musicTimer) { clearInterval(this.musicTimer); this.musicTimer = null; }
  };

  global.SoundBank = SoundBank;
})(window);
