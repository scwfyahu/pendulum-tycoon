/* phys.js — verify auto-push sustains swing vigour (drives income factor). */
'use strict';
var Phys = require('../js/pendulum.js');

function cfgAt(dampLevel, massLevel, pushLevel) {
  var m1 = 1, m2 = 1 + 0.04 * Math.min(40, massLevel);
  var b = 0.14 / (1 + 0.08 * dampLevel);
  var maxPe = Phys.G * (m1 + 2 * m2);
  return { m1: m1, m2: m2, b: b, push: 3.2 + 0.1 * pushLevel, target: 0.55 * maxPe };
}

function trial(dampLevel, massLevel, pushLevel, seconds, seed) {
  var cfg = cfgAt(dampLevel, massLevel, pushLevel);
  var st = Phys.make(seed);
  var dt = 1 / 240;
  var min = Infinity, sum = 0, n = 0;
  for (var t = 0; t < seconds; t += dt) {
    Phys.step(st, dt, cfg, false);
    if (Math.floor(t * 4) !== Math.floor((t - dt) * 4)) continue; // 4 samples/s
    var v = Phys.vigour(st, cfg);
    if (v < min) min = v;
    sum += v; n++;
  }
  return { min: min, avg: sum / n };
}

var cases = [
  ['start  (0,0,0)     ', 0, 0, 0],
  ['mid    (20,20,20)  ', 20, 20, 20],
  ['late   (40,40,40)  ', 40, 40, 40]
];

var fail = false;
cases.forEach(function (c) {
  var seeds = [0, 0.7, -1.3, 2.1];
  var mins = [], avgs = [];
  seeds.forEach(function (s) {
    var r = trial(c[1], c[2], c[3], 120, s);
    mins.push(r.min); avgs.push(r.avg);
  });
  var gmin = Math.min.apply(null, mins);
  var gavg = avgs.reduce(function (a, b) { return a + b; }, 0) / avgs.length;
  console.log(c[0] + ' vigour min=' + gmin.toFixed(3) + ' avg=' + gavg.toFixed(3));
  if (gavg < 0.85) fail = true;
});

console.log(fail ? 'PHYS FAIL (swing too weak -> income sags)' : 'PHYS OK (vigour sustains income)');
process.exitCode = fail ? 1 : 0;
