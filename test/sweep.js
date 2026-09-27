/* sweep.js — find (GROW_POW, SCALE) where good play ~3600s and the
   noob/cheap policies are much slower (build choice matters). */
'use strict';
var Econ = require('../js/econ.js');
var sim = require('./simrun.js');

function tune(pow) {
  Econ.setGrowPow(pow);
  Econ.setScale(1);
  var scale = 1;
  for (var pass = 0; pass < 4; pass++) {
    var t = sim.run(sim.policies.GOOD).seconds;
    scale *= 3600 / t;
    Econ.setScale(scale);
  }
  return scale;
}

[[1.0,0.05],[0.6,0.05],[1.0,0.03],[0.6,0.03],[1.0,0.08],[0.6,0.08],[1.0,0.0]].forEach(function (cfg) {
  var pow = cfg[0], heat = cfg[1];
  Econ.setHeat(heat);
  var scale = tune(pow);
  var good = sim.run(sim.policies.GOOD);
  var noob = sim.run(sim.policies.NOOB);
  var cheap = sim.run(sim.policies.CHEAP);
  var gap = Math.max(noob.seconds, cheap.seconds) / good.seconds;
  console.log(
    'pow=' + pow.toFixed(2) +
    '  scale=' + scale.toFixed(3) +
    '  good=' + (good.seconds / 60).toFixed(1) + 'm' +
    '  noob=' + (noob.seconds / 60).toFixed(1) + 'm (x' + (noob.seconds / good.seconds).toFixed(2) + ')' +
    '  cheap=' + (cheap.seconds / 60).toFixed(1) + 'm (x' + (cheap.seconds / good.seconds).toFixed(2) + ')' +
    '  gap=' + gap.toFixed(2) + (gap >= 1.35 ? '  <-- OK' : '')
  );
});
