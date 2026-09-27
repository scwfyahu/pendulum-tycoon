/* sim.js — autonomous playthrough, checks pacing toward ~1 hour. */
'use strict';
var Econ = require('../js/econ.js');

function run() {
  var s = Econ.create();
  var dt = 0.25, t = 0, buys = 0;
  var events = [];
  var seen = {};
  var prevPhase = 0;

  while (!Econ.isWin(s) && t < 400000) {
    // greedy: always cheapest = lowest level (equal per-level cost across tracks)
    var guard = 0;
    for (;;) {
      if (guard++ > 2000) throw new Error('buy loop guard');
      var best = -1, bl = Infinity;
      for (var i = 0; i < Econ.TRACKS.length; i++) {
        if (!Econ.unlocked(s, i)) continue;
        if (s.levels[i] < bl) { bl = s.levels[i]; best = i; }
      }
      if (best < 0) break;
      if (Econ.buy(s, best)) { buys++; continue; }
      break;
    }

    for (var j = 0; j < Econ.TRACKS.length; j++) {
      var tr = Econ.TRACKS[j];
      if (tr.unlock > 0 && !seen[tr.id] && Econ.unlocked(s, j)) {
        seen[tr.id] = 1;
        events.push(Econ.mmss(t) + '  unlock ' + tr.name);
      }
    }

    var ph = Math.min(12, Math.floor(Econ.total(s) / 30));
    if (ph !== prevPhase) {
      events.push(Econ.mmss(t) + '  phase ' + ph + '  (' + Econ.total(s) + ' levels)');
      prevPhase = ph;
    }

    t += dt;
    s.money += Econ.avgRate(s) * dt;
  }

  if (!Econ.isWin(s)) throw new Error('did not finish in time budget');

  return {
    seconds: t, buys: buys, levels: s.levels.slice(),
    rate: Econ.avgRate(s), money: s.money, events: events
  };
}

var r = run();
console.log('time      : ' + Econ.mmss(r.seconds) + '  (' + Math.round(r.seconds) + 's)');
console.log('buys      : ' + r.buys);
console.log('levels    : ' + r.levels.join(','));
console.log('end rate  : ' + Econ.fmt(r.rate) + '/s');
console.log('end cash  : ' + Econ.fmt(r.money));
console.log('timeline  :');
r.events.forEach(function (e) { console.log('  ' + e); });

var lo = 3480, hi = 3780;
if (r.seconds < lo || r.seconds > hi) {
  console.log('PACE OFF target 3600 [' + lo + ',' + hi + '] -> scale C0 by ' + (3600 / r.seconds).toFixed(4));
  process.exitCode = 1;
} else {
  console.log('PACE OK ~1 hour');
}
