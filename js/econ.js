/* econ.js — pure tycoon economy. Browser (global Econ) + node (module.exports). */
(function (root, factory) {
  'use strict';
  var api = factory();
  if (typeof module === 'object' && module !== null && module.exports) module.exports = api;
  if (root) root.Econ = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  // Balance identity: income = BASE*(1+R)^totalLevels, cost = C0*G^level with
  // G = (1+R)^unlockedCount => time per level = C0 / (BASE * avgFactors), constant.
  var R         = 0.036;   // multiplicative gain per level (every track)
  var BASE      = 1;       // base resonance per second
  var C0        = 23.0;    // base cost of a level
  var WIN       = 360;     // total levels required to reach harmony
  var SWING_MAX = 0.30;    // income bonus from a vigorous swing
  var SWING_AVG = 0.93;    // typical swing vigour (auto-push keeps it high)
  var OD_MULT   = 2;       // overdrive multiplier

  var TRACKS = [
    { id: 'damp',  name: 'DAMP',  unlock: 0,   hint: 'damping falls' },
    { id: 'mass',  name: 'MASS',  unlock: 0,   hint: 'bob grows' },
    { id: 'harv',  name: 'HARV',  unlock: 0,   hint: 'harvest densifies' },
    { id: 'push',  name: 'PUSH',  unlock: 24,  hint: 'kick strengthens' },
    { id: 'chord', name: 'CHORD', unlock: 70,  hint: 'pendulum added' },
    { id: 'aura',  name: 'AURA',  unlock: 120, hint: 'rings bloom' },
    { id: 'fuse',  name: 'FUSE',  unlock: 170, hint: 'overdrive lasts' },
    { id: 'phase', name: 'PHASE', unlock: 230, hint: 'charge quickens' },
    { id: 'harm',  name: 'HARM',  unlock: 300, hint: 'harmonic gain' }
  ];

  function create() {
    var levels = [];
    for (var i = 0; i < TRACKS.length; i++) levels.push(0);
    return { money: 25, levels: levels }; // 25 = enough for first level, tutorial instant
  }

  function total(s) {
    var t = 0;
    for (var i = 0; i < s.levels.length; i++) t += s.levels[i];
    return t;
  }

  function isUnlockedAt(t, i) { return t >= TRACKS[i].unlock; }

  function unlockedCount(s) {
    var t = total(s), n = 0;
    for (var i = 0; i < TRACKS.length; i++) if (isUnlockedAt(t, i)) n++;
    return n;
  }

  function growth(s) { return Math.pow(1 + R, unlockedCount(s)); }

  function unlocked(s, i) { return isUnlockedAt(total(s), i); }

  function cost(s, i) { return C0 * Math.pow(growth(s), s.levels[i]); }

  function income(s) { return BASE * Math.pow(1 + R, total(s)); }

  function odDuration(s) { return 3.5 + 0.12 * s.levels[6]; }
  function odRate(s)     { return 0.015 + 0.0009 * s.levels[7]; }
  function odUptime(s)   { var d = odDuration(s) * odRate(s); return d / (1 + d); }

  function liveRate(s, swing01, odOn) {
    return income(s) * (1 + SWING_MAX * swing01) * (odOn ? OD_MULT : 1);
  }

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

  function isWin(s) { return total(s) >= WIN; }

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
    R: R, BASE: BASE, C0: C0, WIN: WIN, OD_MULT: OD_MULT,
    SWING_MAX: SWING_MAX, SWING_AVG: SWING_AVG,
    TRACKS: TRACKS,
    create: create, total: total, unlockedCount: unlockedCount,
    unlocked: unlocked, growth: growth, cost: cost, income: income,
    odDuration: odDuration, odRate: odRate, odUptime: odUptime,
    liveRate: liveRate, avgRate: avgRate,
    canBuy: canBuy, buy: buy, isWin: isWin,
    fmt: fmt, mmss: mmss
  };
});
