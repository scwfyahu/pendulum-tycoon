/* game.js — state, input, loop. Physics + economy + minimalist chrome. */
(function () {
  'use strict';

  var canvas = document.getElementById('c');

  // never hard-crash if audio.js is missing/blocked: every sfx call no-ops
  var sfx = (typeof Sfx !== 'undefined') ? Sfx : {
    unlock: function () {}, strike: function () {}, pulse: function () {},
    sync: function () {}, buy: function () {}, phase: function () {},
    od: function () {}, win: function () {}, focus: function () {},
    toggle: function () { return false; }, isMuted: function () { return false; },
    suspend: function () {}, resume: function () {}
  };

  // pause when the tab is hidden or the window loses focus: no income, no
  // physics, no sound while in the background
  var running = true;
  function setRun(v) {
    if (v === running) return;
    running = v;
    sfx[v ? 'resume' : 'suspend']();
    if (v) last = performance.now();
  }

  var W = 0, H = 0, DPR = 1;
  var S = Econ.create();
  var elapsed = 0, won = false, winTime = 0;
  var pends = [];
  var cfg = null;
  var geom = [];
  var L1 = 0, L2 = 0, pivots = [];
  var phase = -1, pendCount = 1;
  var charge = 0, odOn = false, odTimer = 0;
  var swing01 = 0.93, rate = 0, speed01 = 0;
  var OMEGA_REF = 4.05;     // rad/s = full tilt (measured idle mean 2.5 => speed01 0.618)
  var hover = -1, drag = null;
  var pointer = { x: -1, y: -1 };
  var last = performance.now(), acc = 0;
  var FIXED = 1 / 240;

  // resonance timing: bob crossing the bottom opens a short window
  var syncWin = [], prevSign = [], prevX = [], prevY = [];
  var boost = 0;          // fling/pulse boost, decays over ~6s
  var focusHover = -1;

  // ---- tutorial (runs once per page load) ------------------------------
  var TUT = [
    'the pendulum pays \u223f as it swings \u00b7 watch',
    'click the void \u00b7 a pulse feeds the swing',
    'click a tick below \u00b7 buy a level',
    'hover a tick \u00b7 name \u00b7 cost \u00b7 next',
    'drag a bob \u00b7 fling it harder',
    'shift-click a tick \u00b7 buy 50'
  ];
  var TUT_TIMEOUT = [10, 45, 60, 20, 45, 40]; // actionable steps wait for you
  var tutStep = 0, tutTime = 0, tutDwell = 0;

  function tutAdvance() {
    if (tutStep >= TUT.length) return;
    tutStep++;
    tutTime = 0;
    tutDwell = 0;
  }

  function tutTickIndex() {
    var best = -1, bl = Infinity;
    for (var i = 0; i < Econ.TRACKS.length; i++) {
      if (!Econ.unlocked(S, i)) continue;
      if (S.levels[i] < bl) { bl = S.levels[i]; best = i; }
    }
    return best;
  }

  var COL_GAP = 6, STRIP_H = 30;

  function colWidth() {
    return Math.max(24, Math.min(42, (W - 40) / Econ.TRACKS.length - COL_GAP));
  }

  // ---- layout ----------------------------------------------------------

  function stripRects() {
    var n = Econ.TRACKS.length;
    var cw = colWidth();
    var totalW = n * cw + (n - 1) * COL_GAP;
    var x0 = Math.round(W / 2 - totalW / 2);
    var top = H - 44 - STRIP_H;
    var out = [];
    for (var i = 0; i < n; i++) {
      out.push({ x: Math.round(x0 + i * (cw + COL_GAP)), y: top, w: cw, h: STRIP_H + 18, i: i });
    }
    return out;
  }

  function computeLayout() {
    var m = Math.min(W, H);
    L1 = m * 0.17;
    L2 = m * 0.15;
    pendCount = 1 + Math.min(6, Math.floor(S.levels[4] / 6));
    pivots = [];
    var gap = pendCount > 1 ? Math.min(W * 0.86 / (pendCount - 1), m * 0.34) : 0;
    var cx = W / 2, cy = H * 0.42;
    for (var i = 0; i < pendCount; i++) {
      pivots.push({ x: cx + (i - (pendCount - 1) / 2) * gap, y: cy });
    }
    while (pends.length < pendCount) {
      pends.push({ st: Phys.make(pends.length * 0.9), trail: [] });
    }
    while (pends.length > pendCount) pends.pop();

    var m2 = 1 + 0.04 * Math.min(40, S.levels[1]);
    cfg = {
      m1: 1, m2: m2,
      b: 0.14 / (1 + 0.08 * S.levels[0]),
      push: 3.2 + 0.1 * S.levels[3],
      target: 0.55 * Phys.G * (1 + 2 * m2)
    };
  }

  function computeGeom() {
    geom = [];
    var m = Math.min(W, H);
    var r = m * 0.022 * Math.min(2.2, 1 + 0.02 * S.levels[1]);
    for (var i = 0; i < pends.length; i++) {
      var pv = pivots[i];
      var st = pends[i].st;
      // screen mapping: offset = (sin t * L, cos t * L) -> t=0 hangs down
      var s1 = Math.sin(st[0]), c1 = Math.cos(st[0]);
      var s2 = Math.sin(st[2]), c2 = Math.cos(st[2]);
      var ex = pv.x + s1 * L1, ey = pv.y + c1 * L1;
      geom.push({
        px: pv.x, py: pv.y,
        x1: ex, y1: ey,
        x2: ex + s2 * L2, y2: ey + c2 * L2,
        r: r, trail: pends[i].trail
      });
    }
  }

  // ---- economy / simulation -------------------------------------------

  function progressNow() { return Econ.progress(S); }

  function omegaNow() {
    var om = 0;
    for (var i = 0; i < pends.length; i++) {
      om += (Math.abs(pends[i].st[1]) + Math.abs(pends[i].st[3])) * 0.5;
    }
    return pends.length ? om / pends.length : 0;
  }

  function focusZones() {
    var zones = [], n = 3, w = 116, gap = 14;
    var total = n * w + (n - 1) * gap;
    var x0 = Math.round(W / 2 - total / 2);
    var y = Math.round(H * 0.80);
    for (var a = 0; a < n; a++) {
      zones.push({
        x: x0 + a * (w + gap), y: y, w: w, h: 34,
        arch: a, mult: Econ.focusMult(S, a)
      });
    }
    return zones;
  }

  function hitFocus(x, y) {
    if (won || Econ.pending(S) < 0) return -1;
    var z = focusZones();
    for (var a = 0; a < z.length; a++) {
      if (x >= z[a].x && x <= z[a].x + z[a].w && y >= z[a].y && y <= z[a].y + z[a].h) return a;
    }
    return -1;
  }

  function chooseFocus(arch) {
    if (Econ.pending(S) < 0) return;
    Econ.choose(S, arch);
    var z = focusZones()[arch];
    var hue = (phase * 27 + arch * 47) % 360;
    Render.ring(z.x + z.w / 2, z.y + z.h / 2, hue, true);
    Render.float(z.x + z.w / 2, z.y - 12, 'focus \u00d7' + Econ.focusMult(S, arch).toFixed(2), hue);
    Render.spark(z.x + z.w / 2, z.y + z.h / 2, hue, 26, 170);
    Render.boom(10); Render.pop();
    sfx.focus();
  }

  function syncPhase() {
    var p = Math.min(12, Math.floor(progressNow() / 30));
    if (p !== phase) {
      var first = phase < 0;
      phase = p;
      Render.setPhase(p);
      if (!first) { Render.pop(); Render.boom(4); sfx.phase(); }
    }
  }

  function odRatePerSec() { return Econ.odRate(S); }
  function odDuration() { return Econ.odDuration(S); }

  // bottom-crossing detection: opens the resonance window, plays the strike
  function detectSync(dt) {
    var reach = L1 + L2;
    for (var i = 0; i < pends.length; i++) {
      var g = geom[i];
      if (!g) continue;
      var dx = g.x2 - g.px;
      var s = dx > 0 ? 1 : dx < 0 ? -1 : 0;
      var prev = prevSign[i] || 0;
      if (s !== 0 && prev !== 0 && s !== prev && (g.y2 - g.py) / reach > 0.2) {
        syncWin[i] = 0.22;
        var spd = prevX[i] !== undefined
          ? Math.hypot(g.x2 - prevX[i], g.y2 - prevY[i]) / Math.max(dt, 0.001)
          : 0;
        sfx.strike(Math.min(1500, spd));
      }
      prevSign[i] = s;
      prevX[i] = g.x2;
      prevY[i] = g.y2;
      if (syncWin[i] > 0) syncWin[i] -= dt;
    }
  }

  function tickEconomy(dt) {
    var om = 0;
    for (var i = 0; i < pends.length; i++) {
      om += (Math.abs(pends[i].st[1]) + Math.abs(pends[i].st[3])) * 0.5;
    }
    // generation tracks REAL pendulum speed (mean |omega| per rod)
    var omega = pends.length ? om / pends.length : 0;
    speed01 = Math.min(1, omega / OMEGA_REF + 0.15 * boost);
    swing01 = speed01;
    boost = Math.max(0, boost - dt / 6);

    if (!won) {
      if (odOn) {
        odTimer -= dt;
        if (odTimer <= 0) { odOn = false; charge = 0; }
      } else {
        charge += odRatePerSec() * dt;
        if (charge >= 1) {
          charge = 1;
          odOn = true;
          odTimer = odDuration();
          Render.boom(11); Render.pop();
          sfx.od();
          for (var k = 0; k < pends.length; k++) {
            Render.ring(geom[k] ? geom[k].x2 : W / 2, geom[k] ? geom[k].y2 : H / 2, (phase * 27 + 140) % 360, true);
          }
        }
      }
      rate = Econ.liveRate(S, swing01, odOn);
      S.money += rate * dt;
      elapsed += dt;
    } else {
      rate = 0;
    }
    syncPhase();
  }

  function buy(i, times) {
    if (won) return false;
    var rects = stripRects();
    var cx = rects[i].x + rects[i].w / 2;
    var baseY = rects[i].y + STRIP_H;
    if (!Econ.unlocked(S, i)) {
      Render.float(cx, baseY - STRIP_H - 10, '\u22ee locked', (phase * 27) % 360);
      return false;
    }
    var n = 0;
    for (var k = 0; k < times; k++) {
      if (!Econ.buy(S, i)) break;
      n++;
    }
    if (!n) {
      Render.float(cx, baseY - STRIP_H - 10, Econ.fmt(Econ.cost(S, i)), (phase * 27) % 360);
      return false;
    }
    var hue = (phase * 27 + i * 27) % 360;
    Render.ring(cx, baseY - 6, hue, false);
    Render.float(cx, baseY - STRIP_H - 14, Econ.TRACKS[i].name + ' ' + S.levels[i], hue);
    Render.spark(cx, baseY - 6, hue, 14, 140);
    Render.boom(n > 1 ? 9 : 4);
    if (n === 1) Render.pop();
    sfx.buy();

    if (Econ.isWin(S) && !won) {
      won = true;
      winTime = elapsed;
      Render.boom(24); Render.pop();
      Render.float(W / 2, H / 2, 'harmony', (phase * 27 + 140) % 360);
      sfx.win();
    }
    if (tutStep === 2) tutAdvance();
    else if (tutStep === 5 && times > 1) tutAdvance();
    return true;
  }

  // ---- input -----------------------------------------------------------

  function hitStrip(x, y) {
    var rects = stripRects();
    for (var i = 0; i < rects.length; i++) {
      var r = rects[i];
      if (x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h) return i;
    }
    return -1;
  }

  function hitBob(x, y) {
    var best = -1, bestPart = 0, bestD = 46;
    for (var i = 0; i < geom.length; i++) {
      var g = geom[i];
      var d1 = Math.hypot(x - g.x1, y - g.y1);
      var d2 = Math.hypot(x - g.x2, y - g.y2);
      if (d1 < bestD) { bestD = d1; best = i; bestPart = 1; }
      if (d2 < bestD) { bestD = d2; best = i; bestPart = 2; }
    }
    return best < 0 ? null : { pi: best, part: bestPart };
  }

  canvas.addEventListener('pointermove', function (e) {
    pointer.x = e.clientX; pointer.y = e.clientY;
    hover = hitStrip(pointer.x, pointer.y);
    focusHover = hitFocus(pointer.x, pointer.y);
    if (drag) applyDrag();
    canvas.style.cursor = (focusHover >= 0 || hover >= 0 || hitBob(pointer.x, pointer.y)) ? 'pointer' : 'crosshair';
  });

  canvas.addEventListener('pointerdown', function (e) {
    e.preventDefault();
    setRun(true);
    sfx.unlock();
    pointer.x = e.clientX; pointer.y = e.clientY;

    var fz = hitFocus(pointer.x, pointer.y);
    if (fz >= 0) { chooseFocus(fz); return; }

    var i = hitStrip(pointer.x, pointer.y);
    if (i >= 0) { buy(i, e.shiftKey ? 50 : 1); return; }
    var b = hitBob(pointer.x, pointer.y);
    if (b) { drag = b; return; }

    // void pulse: kick every pendulum + fling boost
    for (var k = 0; k < pends.length; k++) {
      var st = pends[k].st;
      var dir = st[1] >= 0 ? 1 : -1;
      st[1] += dir * 1.15;
      st[3] += dir * 0.7;
    }
    boost = 1;

    // resonance: a pulse inside the timing window pays out
    var hit = -1;
    for (k = 0; k < pends.length; k++) {
      if (syncWin[k] > 0) { hit = k; break; }
    }
    if (hit >= 0) {
      syncWin[hit] = 0;
      if (!won) {
        S.money += rate * 0.5;
        if (!odOn) charge = Math.min(1, charge + 0.3);
      }
      var hg = geom[hit];
      var shue = (phase * 27 + 140) % 360;
      Render.ring(hg.x2, hg.y2, shue, true);
      Render.float(hg.x2, hg.y2 - 34, 'sync', shue);
      Render.spark(hg.x2, hg.y2, shue, 30, 200);
      Render.boom(9); Render.pop();
      sfx.sync();
    } else {
      Render.ring(pointer.x, pointer.y, (phase * 27 + 140) % 360, false);
      Render.spark(pointer.x, pointer.y, (phase * 27) % 360, 10, 130);
      Render.boom(3);
      sfx.pulse();
    }
    if (tutStep === 1) tutAdvance();
  });

  window.addEventListener('pointerup', function () {
    if (drag) {
      boost = 1;
      if (tutStep === 4) tutAdvance();
    }
    drag = null;
  });
  window.addEventListener('pointercancel', function () { drag = null; });
  document.addEventListener('visibilitychange', function () { setRun(!document.hidden); });
  window.addEventListener('blur', function () { drag = null; setRun(false); });
  window.addEventListener('focus', function () { setRun(true); });

  window.addEventListener('keydown', function (e) {
    setRun(true);
    if (e.key === 'r' || e.key === 'R') restart();
    if (e.key === 't' || e.key === 'T') {
      tutStep = 0; tutTime = 0; tutDwell = 0;
      Render.float(W / 2, 84, 'tutorial', (phase * 27 + 140) % 360);
    }
    if (e.key === 'm' || e.key === 'M') {
      var mu = sfx.toggle();
      Render.float(W / 2, 62, mu ? 'muted' : 'sound', (phase * 27 + 140) % 360);
    }
  });

  function applyDrag() {
    if (!drag || drag.pi >= pends.length) return;
    var g = geom[drag.pi];
    if (!g) return;
    var st = pends[drag.pi].st;
    if (drag.part === 1) {
      // screen offset = (sin t * L, cos t * L) -> t = atan2(dx, dy)
      var target = Math.atan2(pointer.x - g.px, pointer.y - g.py);
      var prev = st[0];
      st[0] = prev + (target - prev) * 0.5;
      st[1] = Math.max(-18, Math.min(18, (st[0] - prev) / Math.max(1 / 120, lastDt)));
    } else {
      var target2 = Math.atan2(pointer.x - g.x1, pointer.y - g.y1);
      var prev2 = st[2];
      st[2] = prev2 + (target2 - prev2) * 0.5;
      st[3] = Math.max(-18, Math.min(18, (st[2] - prev2) / Math.max(1 / 120, lastDt)));
    }
  }

  function restart() {
    S = Econ.create();
    elapsed = 0; won = false; winTime = 0;
    charge = 0; odOn = false; odTimer = 0; phase = -1;
    pends = []; drag = null; hover = -1; focusHover = -1;
    syncWin = []; prevSign = []; prevX = []; prevY = [];
    boost = 0;
    computeLayout(); computeGeom(); syncPhase();
    Render.setPhase(0);
  }

  // ---- loop ------------------------------------------------------------

  var lastDt = 1 / 60;

  function frame(now) {
    if (!running) {
      last = now;
      requestAnimationFrame(frame);
      return;
    }
    var dt = Math.min((now - last) / 1000, 0.1);
    last = now;
    lastDt = dt;

    computeLayout();
    computeGeom();
    if (drag) applyDrag();

    acc += dt;
    var steps = 0;
    while (acc >= FIXED && steps < 480) {
      for (var i = 0; i < pends.length; i++) {
        Phys.step(pends[i].st, FIXED, cfg, drag && drag.pi === i);
      }
      acc -= FIXED;
      steps++;
    }
    if (steps >= 480) acc = 0;

    computeGeom();
    tickEconomy(dt);
    detectSync(dt);

    // tutorial progression
    if (tutStep < TUT.length) {
      tutTime += dt;
      if (tutStep === 3) {
        if (hover >= 0) {
          tutDwell += dt;
          if (tutDwell > 1.5) tutAdvance();
        } else {
          tutDwell = 0;
        }
      }
      if (tutStep < TUT.length && tutTime > TUT_TIMEOUT[tutStep]) tutAdvance();
    }

    // trails
    for (i = 0; i < pends.length; i++) {
      var g = geom[i];
      var tr = pends[i].trail;
      tr.push([g.x2, g.y2]);
      if (tr.length > 96) tr.shift();
    }

    var rects = stripRects();
    var levels = S.levels.slice();
    var unlockedA = [], affordA = [], costsA = [], gainsA = [];
    for (i = 0; i < Econ.TRACKS.length; i++) {
      unlockedA.push(Econ.unlocked(S, i));
      affordA.push(Econ.canBuy(S, i));
      costsA.push(Econ.cost(S, i));
      gainsA.push(Math.round(Econ.gainPct(i) * 100));
    }

    var syncs = [];
    for (i = 0; i < pends.length; i++) syncs.push(Math.max(0, syncWin[i] || 0) / 0.22);

    var pend = Econ.pending(S);
    var focusUI = null;
    if (pend >= 0 && !won) {
      focusUI = { zones: focusZones(), hover: focusHover, index: pend };
    }

    var energy = 0;
    for (i = 0; i < pends.length; i++) energy += Phys.vigour(pends[i].st, cfg);
    energy = pends.length ? energy / pends.length : 0;

    var view = {
      W: W, H: H, dpr: DPR, time: elapsed,
      pends: geom, energy01: energy, odOn: odOn, phase: phase,
      headAngle: pends.length ? pends[0].st[0] : 0,
      harv: S.levels[2], aura: S.levels[5],
      ui: {
        money: S.money, rate: rate,
        mult: Econ.income(S) / Econ.BASE,
        clock: Econ.mmss(elapsed),
        progress: progressNow(), win: won, winTime: winTime,
        rects: rects, hover: hover, levels: levels,
        unlocked: unlockedA, afford: affordA, costs: costsA, gains: gainsA,
        focus: focusUI, charge: Math.min(1, charge),
        tut: {
          step: tutStep, total: TUT.length,
          text: tutStep < TUT.length ? TUT[tutStep] : '',
          focus: tutStep === 1 ? 'void' : (tutStep === 2 ? 'tick' : null),
          tick: tutTickIndex()
        }
      },
      syncs: syncs,
      speed01: speed01
    };

    Render.frame(view, dt);
    requestAnimationFrame(frame);
  }

  function resize() {
    W = window.innerWidth;
    H = window.innerHeight;
    DPR = Math.min(2, window.devicePixelRatio || 1);
    Render.resize(W, H, DPR);
    computeLayout();
    computeGeom();
  }

  window.addEventListener('resize', resize);

  resize();
  syncPhase();
  requestAnimationFrame(frame);

  window.__game = {
    state: function () { return S; },
    buy: buy, restart: restart,
    tutSet: function (n) { tutStep = n; tutTime = 0; tutDwell = 0; },
    view: function () {
      return {
        money: S.money, levels: S.levels.slice(), elapsed: elapsed,
        won: won, rate: rate, tut: tutStep,
        speed01: speed01, omega: omegaNow(),
        progress: Econ.progress(S), pending: Econ.pending(S),
        keystones: S.keystones.slice(), syncs: syncWin.slice(),
        dy0: geom[0] ? geom[0].y2 - geom[0].py : 0,
        y2s: geom.map(function (g) { return Math.round(g.y2); }),
        bobs: geom.map(function (g) {
          return [Math.round(g.x1), Math.round(g.y1), Math.round(g.x2), Math.round(g.y2), Math.round(g.px), Math.round(g.py)];
        })
      };
    }
  };
})();
