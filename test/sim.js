/* sim.js — three autonomous playthroughs, all zero-skill (swing 0.93,
   modelled overdrive, no resonance timing bonuses):
   1. GOOD — highest gain per resonance spent each buy  -> must land ~1 hour
   2. NOOB — always the highest gain% track (the "SURGE feels strong" trap)
   3. CHEAP— lowest gain per resonance
   Gap proves the build decision matters. */
'use strict';
var Econ = require('../js/econ.js');
var sim = require('./simrun.js');

var good = sim.run(sim.policies.GOOD);
var noob = sim.run(sim.policies.NOOB);
var cheap = sim.run(sim.policies.CHEAP);

function show(tag, r) {
  console.log(tag + ' time  : ' + Econ.mmss(r.seconds) + '  (' + Math.round(r.seconds) + 's)' +
              '  end ' + Econ.fmt(r.rate) + '/s  levels ' + r.levels.join(','));
}
show('GOOD', good);
console.log('GOOD timeline:');
good.events.forEach(function (e) { console.log('  ' + e); });
show('NOOB', noob);
show('CHEAP', cheap);

var lo = 3480, hi = 3780;
var paceOK = good.seconds >= lo && good.seconds <= hi;
var gapNoob = noob.seconds / good.seconds;
var gapCheap = cheap.seconds / good.seconds;
var gap = Math.max(gapNoob, gapCheap);

console.log('pace     : ' + (paceOK ? 'OK ~1 hour'
  : 'OFF -> scale SCALE by ' + (3600 / good.seconds).toFixed(4)));
console.log('choice   : noob x' + gapNoob.toFixed(2) + ', cheap x' + gapCheap.toFixed(2) +
  (gap >= 1.35 ? '  MATTERS' : '  TOO WEAK'));

process.exitCode = (paceOK && gap >= 1.35) ? 0 : 1;
