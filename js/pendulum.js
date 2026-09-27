/* pendulum.js — double pendulum physics (RK4). Browser (global Phys) + node. */
(function (root, factory) {
  'use strict';
  var api = factory();
  if (typeof module === 'object' && module !== null && module.exports) module.exports = api;
  if (root) root.Phys = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  var G = 9.81;
  var d = new Float64Array(4);
  var k1 = new Float64Array(4), k2 = new Float64Array(4);
  var k3 = new Float64Array(4), k4 = new Float64Array(4);
  var tmp = new Float64Array(4);

  function derivs(s, cfg, out) {
    var t1 = s[0], w1 = s[1], t2 = s[2], w2 = s[3];
    var m1 = cfg.m1, m2 = cfg.m2;
    var del = t1 - t2;
    var sd = Math.sin(del), cd = Math.cos(del);
    var den = 2 * m1 + m2 - m2 * Math.cos(2 * del);
    if (Math.abs(den) < 1e-9) den = 1e-9;

    var a1 = (-G * (2 * m1 + m2) * Math.sin(t1)
              - m2 * G * Math.sin(t1 - 2 * t2)
              - 2 * sd * m2 * (w2 * w2 + w1 * w1 * cd)) / den
             - cfg.b * w1;

    var a2 = (2 * sd * (w1 * w1 * (m1 + m2) + G * (m1 + m2) * Math.cos(t1) + w2 * w2 * m2 * cd)) / den
             - cfg.b * w2;

    out[0] = w1; out[1] = a1; out[2] = w2; out[3] = a2;
  }

  function rk4(s, dt, cfg) {
    derivs(s, cfg, k1);
    for (var i = 0; i < 4; i++) tmp[i] = s[i] + k1[i] * dt * 0.5;
    derivs(tmp, cfg, k2);
    for (i = 0; i < 4; i++) tmp[i] = s[i] + k2[i] * dt * 0.5;
    derivs(tmp, cfg, k3);
    for (i = 0; i < 4; i++) tmp[i] = s[i] + k3[i] * dt;
    derivs(tmp, cfg, k4);
    for (i = 0; i < 4; i++) s[i] += (dt / 6) * (k1[i] + 2 * k2[i] + 2 * k3[i] + k4[i]);
  }

  // Relative energy: 0 = hanging at rest, = max when fully inverted.
  function energyRel(st, cfg) {
    var t1 = st[0], w1 = st[1], t2 = st[2], w2 = st[3];
    var y1 = -Math.cos(t1), y2 = y1 - Math.cos(t2);
    var v1sq = w1 * w1;
    var v2sq = w1 * w1 + w2 * w2 + 2 * w1 * w2 * Math.cos(t1 - t2);
    var ke = 0.5 * cfg.m1 * v1sq + 0.5 * cfg.m2 * v2sq;
    var pe = G * (cfg.m1 * y1 + cfg.m2 * y2);
    var peMin = -G * (cfg.m1 + 2 * cfg.m2);
    var e = ke + (pe - peMin);
    return isFinite(e) ? e : 0;
  }

  function make(seedAngle) {
    var a = seedAngle || 0;
    return new Float64Array([0.35 + a, 0, -0.2 + a * 0.5, 0]);
  }

  // Advance one pendulum. cfg: {m1, m2, b, push, target, hold}
  function step(st, dt, cfg, hold) {
    if (hold) return;
    rk4(st, dt, cfg);
    var e = energyRel(st, cfg);
    var def = (cfg.target - e) / cfg.target;
    if (def > 0) {
      var dir = st[1] >= 0 ? 1 : -1;
      var k = cfg.push * def;
      st[1] += dir * k * 3 * dt;
      st[3] += dir * k * 2 * dt;
    } else if (e > cfg.target * 1.7) {
      st[1] *= 0.994; st[3] *= 0.994;
    }
    if (!isFinite(st[0] + st[1] + st[2] + st[3])) {
      st[0] = 0.35; st[1] = 0; st[2] = -0.2; st[3] = 0;
    }
  }

  function vigour(st, cfg) {
    var e = energyRel(st, cfg);
    var v = e / cfg.target;
    return v < 0 ? 0 : v > 1 ? 1 : v;
  }

  return { G: G, make: make, step: step, energyRel: energyRel, vigour: vigour };
});
