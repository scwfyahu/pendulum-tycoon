/* econ.js — pure tycoon economy (browser + node).
   Tracks belong to 3 archetypes (calm / flare / surge) with different base
   cost, cost growth and gain per level => real build choice. Value of a level
   = ln(1+gain)/cost, so the best track rotates as levels rise.
   Sim tests play this with zero player skill => pacing floor ~1h. */
(function (root, factory) {
  'use strict';
  var api = factory();
  if (typeof module === 'object' && module !== null && module.exports) module.exports = api;
  if (root) root.Econ = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  var SCALE = 0.704;        // global cost multiplier (tuned: greedy run ~ 3600s)
  var GROW_POW = 1;         // 1 = costs grow exactly with income (tight, no choice)
                            // <1 = income outpaces costs -> player banks resonance
                            //      and choices become unconstrained (real tradeoffs)
  var HEAT_PER = 0.05;      // every surge level taxes ALL costs: risk/reward knob

  // five one-time choices. each multiplies income by (1 + 0.015 * levels of
  // that archetype at pick time) => value depends on the build you brought,
  // so double-down vs diversify is a real decision, not a fixed "best pick".
  var FOCUS_AT = [60, 120, 180, 240, 300];
  var FOCUS_K = 0.015;
  var BASE = 1;             // base resonance / second
  var WIN_EACH = 0;         // (targets are per-archetype, see ARCH)
  var WIN = 360;            // sum of all track targets (progress denominator)
  var SWING_MAX = 0.30;     // income bonus from a vigorous swing
  var SWING_AVG = 0.93;     // typical vigour without player input (sim assumption)
  var OD_MULT = 2;          // overdrive multiplier

  var ARCH = [
    { id: 'calm',  c0: 12, r: 0.020, target: 40 }, // safe: +2%  /level
    { id: 'flare', c0: 16, r: 0.060, target: 40 }, // mid:   +6%  /level
    { id: 'surge', c0: 24, r: 0.160, target: 40 }  // spicy: +16% /level, self-punishing when stacked
  ];

  var TRACKS = [
    { id: 'damp',  name: 'DAMP',  arch: 0, unlock: 0,   hint: 'damping falls' },
    { id: 'mass',  name: 'MASS',  arch: 1, unlock: 0,   hint: 'bob grows' },
    { id: 'harv',  name: 'HARV',  arch: 0, unlock: 0,   hint: 'harvest densifies' },
    { id: 'push',  name: 'PUSH',  arch: 2, unlock: 24,  hint: 'kick strengthens' },
    { id: 'chord', name: 'CHORD', arch: 1, unlock: 70,  hint: 'pendulum added' },
    { id: 'aura',  name: 'AURA',  arch: 0, unlock: 120, hint: 'rings bloom' },
    { id: 'fuse',  name: 'FUSE',  arch: 2, unlock: 170, hint: 'overdrive lasts' },
    { id: 'phase', name: 'PHASE', arch: 1, unlock: 230, hint: 'charge quickens' },
    { id: 'harm',  name: 'HARM',  arch: 2, unlock: 300, hint: 'harmonic gain' }
  ];

  for (var ti = 0; ti < TRACKS.length; ti++) {
    TRACKS[ti].target = ARCH[TRACKS[ti].arch].target;
  }

  function create() {
    var levels = [];
    for (var i = 0; i < TRACKS.length; i++) levels.push(0);
    return { money: 25, levels: levels, keystones: [] };
  }

  function total(s) {
    var t = 0;
    for (var i = 0; i < s.levels.length; i++) t += s.levels[i];
    return t;
  }

  // progress toward harmony: overshoot does not count (targets differ per track)
  function progress(s) {
    var t = 0;
    for (var i = 0; i < s.levels.length; i++) {
      t += Math.min(TRACKS[i].target, s.levels[i]);
    }
    return t;
  }

  function unlocked(s, i) { return progress(s) >= TRACKS[i].unlock; }

  function done(s, i) { return s.levels[i] >= TRACKS[i].target; }

  function archOf(i) { return ARCH[TRACKS[i].arch]; }

  /* Cost growth must equal income growth, otherwise the cost tail explodes and
     the (policy-independent) endgame dominates runtime. Per full round of
     purchases, income multiplies by the product below, so every active track's
     cost must multiply by the same factor. Recomputed as tracks unlock/finish,
     which keeps the identity true under any unlock or completion order. */
  function growth(s) {
    var g = 1;
    for (var i = 0; i < TRACKS.length; i++) {
      if (unlocked(s, i) && !done(s, i)) g *= Math.pow(1 + archOf(i).r, GROW_POW);
    }
    return g;
  }

  // total surge levels = heat: stacking the spicy track taxes every cost
  function heat(s) {
    var surge = 0;
    for (var i = 0; i < TRACKS.length; i++) {
      if (TRACKS[i].arch === 2) surge += s.levels[i];
    }
    return Math.pow(1 + HEAT_PER, surge);
  }

  function cost(s, i) {
    var a = archOf(i);
    return a.c0 * SCALE * Math.pow(growth(s), s.levels[i]) * heat(s);
  }

  // multiplicative gain of the next level on track i (e.g. 0.115 => 11.5%)
  function gainPct(i) { return archOf(i).r; }

  // gain per resonance spent — the number that drives every real decision
  function value(s, i) { return Math.log(1 + archOf(i).r) / cost(s, i); }

  function archLevels(s, arch) {
    var n = 0;
    for (var i = 0; i < TRACKS.length; i++) {
      if (TRACKS[i].arch === arch) n += s.levels[i];
    }
    return n;
  }

  function focusMult(s, arch) { return 1 + FOCUS_K * archLevels(s, arch); }

  // index of the next waiting keystone, or -1
  function pending(s) {
    var p = progress(s), need = 0;
    for (var i = 0; i < FOCUS_AT.length; i++) if (p >= FOCUS_AT[i]) need++;
    return s.keystones.length < need ? s.keystones.length : -1;
  }

  function choose(s, arch) { s.keystones.push(focusMult(s, arch)); }

  function keystoneMult(s) {
    var m = 1;
    for (var i = 0; i < s.keystones.length; i++) m *= s.keystones[i];
    return m;
  }

  function income(s) {
    var v = BASE * keystoneMult(s);
    for (var i = 0; i < TRACKS.length; i++) {
      v *= Math.pow(1 + archOf(i).r, s.levels[i]);
    }
    return v;
  }

  function odDuration(s) { return 3.5 + 0.12 * s.levels[6]; }
  function odRate(s)     { return 0.015 + 0.0009 * s.levels[7]; }
  function odUptime(s)   { var d = odDuration(s) * odRate(s); return d / (1 + d); }

  function liveRate(s, swing01, odOn) {
    return income(s) * (1 + SWING_MAX * swing01) * (odOn ? OD_MULT : 1);
  }

  // no-skill assumption: swing ~0.93, modelled overdrive uptime
  function avgRate(s) {
    return income(s) * (1 + SWING_MAX * SWING_AVG) * (1 + odUptime(s));
  }

  function canBuy(s, i) { return unlocked(s, i) && s.money >= cost(s, i); }

  function buy(s, i) {
    if (!canBuy(s, i)) return false;
    s.money -= cost(s, i);
    s.levels[i]++;
    return true;
  }

  // best affordable upgrade: highest gain per resonance spent
  function bestBuy(s) {
    var best = -1, bv = 0;
    for (var i = 0; i < TRACKS.length; i++) {
      if (!canBuy(s, i) || done(s, i)) continue;
      var v = value(s, i);
      if (v > bv) { bv = v; best = i; }
    }
    return best;
  }

  // deliberately poor play: lowest gain per resonance (for tests / trap tracks)
  function worstBuy(s) {
    var best = -1, bv = Infinity;
    for (var i = 0; i < TRACKS.length; i++) {
      if (!canBuy(s, i) || done(s, i)) continue;
      var v = value(s, i);
      if (v < bv) { bv = v; best = i; }
    }
    return best;
  }

  function isWin(s) { return progress(s) >= WIN; }

  var UNITS = ['', 'k', 'M', 'B', 'T', 'Qa', 'Qi'];

  function fmt(n) {
    if (!isFinite(n)) return 'inf';
    if (n < 0) return '-' + fmt(-n);
    if (n < 1000) return n < 10 ? n.toFixed(2) : n < 100 ? n.toFixed(1) : Math.round(n).toString();
    for (var i = UNITS.length - 1; i >= 0; i--) {
      var p = Math.pow(1000, i);
      if (n >= p) {
        var v = n / p;
        return (v < 10 ? v.toFixed(2) : v < 100 ? v.toFixed(1) : Math.floor(v)) + UNITS[i];
      }
    }
    return String(n);
  }

  function mmss(sec) {
    var s = Math.max(0, Math.floor(sec));
    var m = Math.floor(s / 60);
    var r = s % 60;
    return m + ':' + (r < 10 ? '0' : '') + r;
  }

  return {
    SCALE: SCALE, setScale: function (v) { SCALE = v; },
    GROW_POW: GROW_POW, setGrowPow: function (v) { GROW_POW = v; },
    HEAT_PER: HEAT_PER, setHeat: function (v) { HEAT_PER = v; },
    BASE: BASE, WIN: WIN, OD_MULT: OD_MULT,
    SWING_MAX: SWING_MAX, SWING_AVG: SWING_AVG,
    ARCH: ARCH, TRACKS: TRACKS, growth: growth, heat: heat, targetOf: function (i) { return TRACKS[i].target; },
    FOCUS_AT: FOCUS_AT, FOCUS_K: FOCUS_K,
    pending: pending, choose: choose, focusMult: focusMult, archLevels: archLevels, keystoneMult: keystoneMult,
    create: create, total: total, progress: progress, unlocked: unlocked, done: done,
    cost: cost, gainPct: gainPct, value: value, income: income,
    odDuration: odDuration, odRate: odRate, odUptime: odUptime,
    liveRate: liveRate, avgRate: avgRate,
    canBuy: canBuy, buy: buy, bestBuy: bestBuy, worstBuy: worstBuy,
    isWin: isWin, fmt: fmt, mmss: mmss
  };
});
