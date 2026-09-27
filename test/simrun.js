/* simrun.js — shared autonomous playthrough engine (zero-skill run).
   Each policy also answers the 5 keystone choices. */
'use strict';
var Econ = require('../js/econ.js');

function bestFocus(s) {          // max multiplier now
  var best = 0, bm = -1;
  for (var a = 0; a < 3; a++) {
    var m = Econ.focusMult(s, a);
    if (m > bm) { bm = m; best = a; }
  }
  return best;
}
function worstFocus(s) {         // min multiplier now
  var best = 0, bm = Infinity;
  for (var a = 0; a < 3; a++) {
    var m = Econ.focusMult(s, a);
    if (m < bm) { bm = m; best = a; }
  }
  return best;
}
function surgeFocus() { return 2; } // the "spicy feels strong" pick

function run(policy) {
  var s = Econ.create();
  var dt = 0.25, t = 0, buys = 0;
  var seen = {}, events = [], prevPhase = 0;

  while (!Econ.isWin(s) && t < 900000) {
    if (Econ.pending(s) >= 0) Econ.choose(s, policy.focus(s));

    var i = policy.buy(s);
    if (i >= 0 && Econ.buy(s, i)) buys++;

    for (var j = 0; j < Econ.TRACKS.length; j++) {
      var tr = Econ.TRACKS[j];
      if (tr.unlock > 0 && !seen[tr.id] && Econ.unlocked(s, j)) {
        seen[tr.id] = 1;
        events.push(Econ.mmss(t) + '  unlock ' + tr.name);
      }
    }
    var ph = Math.min(12, Math.floor(Econ.progress(s) / 30));
    if (ph !== prevPhase) { events.push(Econ.mmss(t) + '  phase ' + ph); prevPhase = ph; }

    t += dt;
    s.money += Econ.avgRate(s) * dt;
  }

  if (!Econ.isWin(s)) throw new Error('run never finished (policy stall)');

  return { seconds: t, buys: buys, levels: s.levels.slice(), keystones: s.keystones.slice(),
           rate: Econ.avgRate(s), money: s.money, events: events };
}

function affordable(s) {
  var out = [];
  for (var i = 0; i < Econ.TRACKS.length; i++) {
    if (Econ.canBuy(s, i) && !Econ.done(s, i)) out.push(i);
  }
  return out;
}

var policies = {
  // highest gain per resonance spent + focus where you already invested
  GOOD: {
    focus: bestFocus,
    buy: function (s) { return Econ.bestBuy(s); }
  },
  // always the highest gain% track and always the spicy focus (the trap)
  NOOB: {
    focus: surgeFocus,
    buy: function (s) {
      var list = affordable(s), best = -1, bg = -1;
      for (var k = 0; k < list.length; k++) {
        var g = Econ.gainPct(list[k]);
        if (g > bg) { bg = g; best = list[k]; }
      }
      return best;
    }
  },
  // lowest gain per resonance + focus where you did NOT invest
  CHEAP: {
    focus: worstFocus,
    buy: function (s) { return Econ.worstBuy(s); }
  },
  RANDOM: {
    focus: function () { return (Math.random() * 3) | 0; },
    buy: function (s) {
      var list = affordable(s);
      if (!list.length) return -1;
      return list[(Math.random() * list.length) | 0];
    }
  }
};

module.exports = { run: run, policies: policies, affordable: affordable };
