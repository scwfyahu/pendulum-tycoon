/* audio.js — zero-asset WebAudio. Everything synthesized, no files. */
var Sfx = (function () {
  'use strict';

  var ctx = null, master = null, muted = false, lastStrike = 0;

  function ensure() {
    try {
      if (!ctx) {
        var AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return null;
        ctx = new AC();
        master = ctx.createGain();
        master.gain.value = muted ? 0 : 0.3;
        master.connect(ctx.destination);
      }
      if (ctx.state === 'suspended') ctx.resume();
      return ctx;
    } catch (e) { return null; }
  }

  function tone(type, f0, f1, dur, gain, delay) {
    var c = ensure();
    if (!c || muted) return;
    var t0 = c.currentTime + (delay || 0);
    var osc = c.createOscillator();
    var g = c.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(f0, t0);
    if (f1 && f1 !== f0) osc.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t0 + dur);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(gain, t0 + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(g); g.connect(master);
    osc.start(t0); osc.stop(t0 + dur + 0.05);
  }

  return {
    unlock: function () { ensure(); },

    // bob strikes the bottom: pitch follows speed
    strike: function (speed) {
      var now = performance.now();
      if (now - lastStrike < 90) return;
      lastStrike = now;
      var f = Math.min(760, 150 + speed * 0.9);
      tone('sine', f, f * 0.72, 0.16, Math.min(0.16, 0.03 + speed * 0.0004));
    },

    buy: function () {
      tone('square', 660, 990, 0.07, 0.06);
      tone('square', 990, 1320, 0.06, 0.04, 0.05);
    },

    pulse: function () { tone('sine', 320, 190, 0.12, 0.05); },

    // perfect-timing resonance hit
    sync: function () {
      tone('triangle', 880, 1760, 0.2, 0.11);
      tone('triangle', 1320, 2640, 0.18, 0.06, 0.03);
    },

    od: function () { tone('sawtooth', 55, 165, 1.1, 0.09); },

    focus: function () { tone('sine', 440, 880, 0.3, 0.08); },

    phase: function () { tone('sine', 220, 880, 0.5, 0.05); },

    win: function () {
      [523.25, 659.25, 783.99, 1046.5].forEach(function (f, i) {
        tone('triangle', f, f, 1.5, 0.07, i * 0.14);
      });
    },

    toggle: function () {
      muted = !muted;
      if (master) master.gain.value = muted ? 0 : 0.3;
      return muted;
    },
    isMuted: function () { return muted; },

    // background tab / unfocused window: silence completely
    suspend: function () { if (ctx && ctx.state === 'running') ctx.suspend(); },
    resume: function () { if (ctx && ctx.state === 'suspended') ctx.resume(); }
  };
})();
