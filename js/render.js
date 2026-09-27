/* render.js — maximalist scene, minimalist chrome. All UI drawn on canvas. */
var Render = (function () {
  'use strict';

  var W = 0, H = 0;
  var phase = -1;
  var h0 = 205, h1 = 345;
  var stars = [], parts = [], rings = [], floats = [], hist = [];
  var grainPattern = null, vignette = null;
  var shake = 0, flash = 0, tGlobal = 0;
  var MAX_PARTS = 900, MAX_HIST = 480;

  function rand(a, b) { return a + Math.random() * (b - a); }

  function buildGrain() {
    var n = document.createElement('canvas');
    n.width = n.height = 128;
    var g = n.getContext('2d');
    var img = g.createImageData(128, 128);
    for (var i = 0; i < img.data.length; i += 4) {
      var v = (Math.random() * 255) | 0;
      img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
      img.data[i + 3] = 26;
    }
    g.putImageData(img, 0, 0);
    grainPattern = g.createPattern(n, 'repeat');
  }

  function buildStars() {
    stars = [];
    for (var i = 0; i < 210; i++) {
      stars.push({
        x: Math.random(), y: Math.random(),
        z: rand(0.25, 1), s: rand(0.5, 1.7),
        seed: rand(0, Math.PI * 2)
      });
    }
  }

  function resize(w, h, dpr) {
    W = w; H = h;
    var c = document.getElementById('c');
    c.width = Math.round(w * dpr);
    c.height = Math.round(h * dpr);
    c.style.width = w + 'px';
    c.style.height = h + 'px';
    vignette = ctx.createRadialGradient(w / 2, h * 0.45, Math.min(w, h) * 0.25, w / 2, h * 0.5, Math.max(w, h) * 0.78);
    vignette.addColorStop(0, 'rgba(0,0,0,0)');
    vignette.addColorStop(0.62, 'rgba(0,0,0,0.18)');
    vignette.addColorStop(1, 'rgba(0,0,0,0.72)');
    if (!grainPattern) buildGrain();
    if (!stars.length) buildStars();
    if (phase < 0) setPhase(0);
  }

  function setPhase(p) {
    phase = p;
    h0 = (205 + p * 27) % 360;
    h1 = (h0 + 140) % 360;
    flash = Math.max(flash, 0.9);
  }

  function spark(x, y, hue, n, spd) {
    for (var i = 0; i < n && parts.length < MAX_PARTS; i++) {
      var a = rand(0, Math.PI * 2), v = rand(0.3, 1) * spd;
      parts.push({
        x: x, y: y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - spd * 0.25,
        life: 1, decay: rand(0.5, 1.2), hue: hue + rand(-24, 24), s: rand(1, 2.8)
      });
    }
  }

  function ring(x, y, hue, big) {
    rings.push({ x: x, y: y, r: 4, rMax: big ? 260 : 90, life: 1, hue: hue, w: big ? 3 : 1.6 });
    if (rings.length > 40) rings.shift();
  }

  function float(x, y, txt, hue) {
    floats.push({ x: x, y: y, txt: txt, life: 1, hue: hue });
    if (floats.length > 24) floats.shift();
  }

  function boom(v) { shake = Math.min(26, shake + v); }
  function pop() { flash = Math.min(1, flash + 0.55); }

  function update(dt, view) {
    tGlobal += dt;
    shake *= Math.pow(0.001, dt);
    flash *= Math.pow(0.02, dt);
    if (shake < 0.05) shake = 0;

    for (var i = parts.length - 1; i >= 0; i--) {
      var p = parts[i];
      p.life -= p.decay * dt;
      if (p.life <= 0) { parts.splice(i, 1); continue; }
      p.x += p.vx * dt; p.y += p.vy * dt;
      p.vx *= Math.pow(0.35, dt); p.vy *= Math.pow(0.35, dt);
      p.vy += 26 * dt;
    }
    for (i = rings.length - 1; i >= 0; i--) {
      var r = rings[i];
      r.life -= dt * 0.9;
      r.r += (r.rMax - r.r) * Math.min(1, dt * 4.2);
      if (r.life <= 0) rings.splice(i, 1);
    }
    for (i = floats.length - 1; i >= 0; i--) {
      var f = floats[i];
      f.life -= dt * 0.62;
      f.y -= dt * 26;
      if (f.life <= 0) floats.splice(i, 1);
    }

    hist.push(view.energy01);
    if (hist.length > MAX_HIST) hist.shift();

    // harvest motes: emission follows live pendulum speed
    var rate = (0.6 + view.harv * 0.16) * view.pends.length * (0.35 + 0.9 * (view.speed01 || 0));
    for (i = 0; i < view.pends.length; i++) {
      var pd = view.pends[i];
      var emit = Math.min(6, rate * dt / Math.max(1, view.pends.length));
      if (Math.random() < emit * (1 + view.harv * 0.05)) {
        spark(pd.x2, pd.y2, (Math.random() < 0.5 ? h0 : h1) + rand(-30, 30), 1, 70);
      }
    }
  }

  function drawSpaced(g, txt, x, y, sp) {
    var prev = g.textAlign;
    g.textAlign = 'left';
    var total = 0, i;
    for (i = 0; i < txt.length; i++) total += g.measureText(txt[i]).width + sp;
    total -= sp;
    var cx = x - total / 2;
    for (i = 0; i < txt.length; i++) {
      g.fillText(txt[i], cx, y);
      cx += g.measureText(txt[i]).width + sp;
    }
    g.textAlign = prev;
  }

  function drawBackground(view) {
    var t = tGlobal;
    var grad = ctx.createLinearGradient(0, 0, 0, H);
    grad.addColorStop(0, 'hsl(' + h0 + ',52%,' + (4 + view.energy01 * 3) + '%)');
    grad.addColorStop(0.55, 'hsl(' + ((h0 + 24) % 360) + ',48%,' + (7 + view.odOn * 4) + '%)');
    grad.addColorStop(1, 'hsl(' + h1 + ',44%,3%)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);

    // nebula blooms
    ctx.globalCompositeOperation = 'lighter';
    var blobs = Math.min(5, 3 + Math.floor(view.aura / 16));
    for (var i = 0; i < blobs; i++) {
      var ph = i * 1.7;
      var bx = W * (0.5 + 0.42 * Math.sin(t * 0.07 + ph) * Math.cos(t * 0.031 + ph * 2));
      var by = H * (0.45 + 0.35 * Math.cos(t * 0.05 + ph * 1.3));
      var rr = Math.min(W, H) * (0.17 + 0.08 * Math.sin(t * 0.09 + ph));
      var gg = ctx.createRadialGradient(bx, by, 0, bx, by, rr);
      var hue = i % 2 ? h1 : h0;
      gg.addColorStop(0, 'hsla(' + hue + ',90%,55%,' + (0.05 + 0.03 * view.energy01) + ')');
      gg.addColorStop(1, 'hsla(' + hue + ',90%,50%,0)');
      ctx.fillStyle = gg;
      ctx.fillRect(bx - rr, by - rr, rr * 2, rr * 2);
    }

    // stars
    for (i = 0; i < stars.length; i++) {
      var s = stars[i];
      var tw = 0.35 + 0.65 * Math.abs(Math.sin(t * (0.4 + s.z) + s.seed));
      var sx = ((s.x + t * 0.004 * s.z) % 1) * W;
      var sy = ((s.y + t * 0.0016 * s.z) % 1) * H;
      ctx.fillStyle = 'hsla(' + ((i * 7) % 360) + ',60%,85%,' + (0.5 * tw * s.z) + ')';
      ctx.fillRect(sx, sy, s.s, s.s);
    }
    ctx.globalCompositeOperation = 'source-over';
  }

  function drawMandala(view) {
    var cx = W / 2, cy = H * 0.42;
    var base = Math.min(W, H) * 0.5;
    var t = tGlobal;
    var ringsN = 4 + Math.floor(view.energy01 * 5 + view.aura / 6);
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.lineWidth = 1;
    for (var i = 0; i < ringsN; i++) {
      var rr = base * (0.34 + i * 0.13) + Math.sin(t * 0.6 + i) * 6;
      if (rr > Math.max(W, H) * 0.78) break;
      var spin = (i % 2 ? 1 : -1) * (0.05 + i * 0.018) * (1 + view.energy01 * 1.6 + (view.odOn ? 1.4 : 0));
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(t * spin + view.headAngle * (i % 2 ? 0.3 : -0.2));
      var segs = 6 + i * 3;
      var hue = (h0 + i * 16) % 360;
      ctx.strokeStyle = 'hsla(' + hue + ',85%,62%,' + (0.05 + 0.05 * view.energy01) + ')';
      ctx.beginPath();
      for (var k = 0; k < segs; k++) {
        var a0 = (k / segs) * Math.PI * 2;
        var a1 = a0 + (Math.PI * 2 / segs) * 0.55;
        ctx.moveTo(Math.cos(a0) * rr, Math.sin(a0) * rr);
        ctx.arc(0, 0, rr, a0, a1);
      }
      ctx.stroke();
      if (i % 3 === 0) {
        ctx.strokeStyle = 'hsla(' + h1 + ',90%,70%,0.09)';
        ctx.beginPath();
        ctx.arc(0, 0, rr, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.restore();
    }
    ctx.restore();
  }

  function drawGrid() {
    ctx.save();
    ctx.strokeStyle = 'hsla(' + h1 + ',80%,60%,0.055)';
    ctx.lineWidth = 1;
    var y0 = H * 0.7;
    for (var i = 0; i < 10; i++) {
      var f = i / 10;
      var y = y0 + (H - y0) * f * f;
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
    }
    var vp = H * 0.62;
    for (i = -8; i <= 8; i++) {
      ctx.beginPath();
      ctx.moveTo(W / 2 + i * (W / 8) * 0.16, H);
      ctx.lineTo(W / 2 + i * 24, vp);
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawScope() {
    if (hist.length < 2) return;
    var y = H - 130, amp = 15;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.lineWidth = 1.2;
    ctx.strokeStyle = 'hsla(' + h1 + ',90%,66%,0.34)';
    ctx.beginPath();
    for (var i = 0; i < hist.length; i++) {
      var x = (i / (MAX_HIST - 1)) * W;
      var yy = y - hist[i] * amp;
      if (i === 0) ctx.moveTo(x, yy); else ctx.lineTo(x, yy);
    }
    ctx.stroke();
    ctx.restore();
  }

  function drawTrails(view) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    var CHUNKS = 8;
    for (var p = 0; p < view.pends.length; p++) {
      var tr = view.pends[p].trail;
      if (tr.length < 6) continue;
      var per = Math.ceil(tr.length / CHUNKS);
      for (var c = 0; c < CHUNKS; c++) {
        var a = c * per;
        var b = Math.min(tr.length - 1, a + per);
        if (b - a < 1) continue;
        var f = (c + 1) / CHUNKS;
        ctx.strokeStyle = 'hsla(' + ((h0 + c * 20 + tGlobal * 40) % 360) + ',95%,' + (52 + f * 20) + '%,' + (f * f * 0.30) + ')';
        ctx.lineWidth = 0.7 + f * 3.2;
        ctx.beginPath();
        ctx.moveTo(tr[a][0], tr[a][1]);
        for (var i = a + 1; i <= b; i++) ctx.lineTo(tr[i][0], tr[i][1]);
        ctx.stroke();
      }
    }
    ctx.restore();
  }

  function drawPendulums(view) {
    for (var p = 0; p < view.pends.length; p++) {
      var pd = view.pends[p];
      var hue = (h0 + p * 24) % 360;
      // rods: cheap layered glow (no shadowBlur — it tanks fill-rate)
      ctx.save();
      ctx.lineCap = 'round';
      ctx.globalCompositeOperation = 'lighter';
      ctx.strokeStyle = 'hsla(' + hue + ',95%,60%,0.16)';
      ctx.lineWidth = 7;
      ctx.beginPath();
      ctx.moveTo(pd.px, pd.py);
      ctx.lineTo(pd.x1, pd.y1);
      ctx.lineTo(pd.x2, pd.y2);
      ctx.stroke();
      ctx.globalCompositeOperation = 'source-over';
      var gr = ctx.createLinearGradient(pd.px, pd.py, pd.x2, pd.y2);
      gr.addColorStop(0, 'hsla(0,0%,100%,0.9)');
      gr.addColorStop(0.5, 'hsla(' + hue + ',95%,70%,0.85)');
      gr.addColorStop(1, 'hsla(' + h1 + ',95%,70%,0.9)');
      ctx.strokeStyle = gr;
      ctx.lineWidth = 2.6;
      ctx.beginPath();
      ctx.moveTo(pd.px, pd.py);
      ctx.lineTo(pd.x1, pd.y1);
      ctx.lineTo(pd.x2, pd.y2);
      ctx.stroke();
      ctx.restore();

      // joints
      joint(pd.px, pd.py, 3.2, hue);
      joint(pd.x1, pd.y1, pd.r * 0.42, hue);
      bob(pd.x2, pd.y2, pd.r, hue, p);

      // resonance window: the bob is a live target for ~0.22s
      var sync = view.syncs ? view.syncs[p] : 0;
      if (sync > 0) {
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        var sr = pd.r * (2.1 + (1 - sync) * 1.3);
        ctx.strokeStyle = 'rgba(255,255,255,' + (0.3 + 0.6 * sync) + ')';
        ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(pd.x2, pd.y2, sr, 0, Math.PI * 2); ctx.stroke();
        ctx.fillStyle = 'rgba(255,255,255,' + (0.45 + 0.5 * sync) + ')';
        ctx.beginPath();
        ctx.moveTo(pd.x2 - 6, pd.y2 - sr - 9);
        ctx.lineTo(pd.x2 + 6, pd.y2 - sr - 9);
        ctx.lineTo(pd.x2, pd.y2 - sr - 3);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      }
    }
  }

  function joint(x, y, r, hue) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    var g = ctx.createRadialGradient(x, y, 0, x, y, r * 3);
    g.addColorStop(0, 'rgba(255,255,255,0.95)');
    g.addColorStop(0.4, 'hsla(' + hue + ',95%,70%,0.7)');
    g.addColorStop(1, 'hsla(' + hue + ',95%,60%,0)');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(x, y, r * 3, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }

  function bob(x, y, r, hue, idx) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    var g = ctx.createRadialGradient(x - r * 0.3, y - r * 0.35, r * 0.1, x, y, r * 1.6);
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(0.35, 'hsla(' + hue + ',100%,72%,0.95)');
    g.addColorStop(0.75, 'hsla(' + hue + ',100%,52%,0.55)');
    g.addColorStop(1, 'hsla(' + hue + ',100%,50%,0)');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(x, y, r * 1.6, 0, Math.PI * 2); ctx.fill();

    ctx.globalCompositeOperation = 'source-over';
    ctx.strokeStyle = 'hsla(' + hue + ',100%,86%,0.85)';
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.stroke();

    // orbiting ticks
    ctx.globalCompositeOperation = 'lighter';
    var t = tGlobal * (1.4 + idx * 0.2);
    for (var i = 0; i < 6; i++) {
      var a = t + (i / 6) * Math.PI * 2;
      var rr = r * 1.25;
      ctx.fillStyle = 'hsla(' + h1 + ',100%,75%,0.7)';
      ctx.fillRect(x + Math.cos(a) * rr - 0.9, y + Math.sin(a) * rr - 0.9, 1.8, 1.8);
    }
    ctx.restore();
  }

  function drawParts() {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (var i = 0; i < parts.length; i++) {
      var p = parts[i];
      ctx.fillStyle = 'hsla(' + p.hue + ',95%,66%,' + (p.life * 0.85) + ')';
      ctx.fillRect(p.x, p.y, p.s, p.s);
    }
    for (i = 0; i < rings.length; i++) {
      var r = rings[i];
      ctx.strokeStyle = 'hsla(' + r.hue + ',95%,68%,' + (r.life * 0.75) + ')';
      ctx.lineWidth = r.w * r.life;
      ctx.beginPath(); ctx.arc(r.x, r.y, r.r, 0, Math.PI * 2); ctx.stroke();
    }
    ctx.restore();

    ctx.save();
    ctx.textAlign = 'center';
    ctx.font = '600 12px ui-monospace, Menlo, Consolas, monospace';
    for (i = 0; i < floats.length; i++) {
      var f = floats[i];
      ctx.fillStyle = 'hsla(' + f.hue + ',95%,76%,' + Math.max(0, f.life) + ')';
      ctx.fillText(f.txt, f.x, f.y);
    }
    ctx.restore();
  }

  function drawOverdrive(view) {
    if (!view.odOn && flash < 0.02) return;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    if (view.odOn) {
      var t = tGlobal;
      for (var i = 0; i < 4; i++) {
        var rr = ((t * 0.42 + i * 0.25) % 1) * Math.max(W, H) * 0.75;
        ctx.strokeStyle = 'hsla(' + ((h0 + i * 45 + t * 60) % 360) + ',95%,62%,0.14)';
        ctx.lineWidth = 2 + i;
        ctx.beginPath(); ctx.arc(W / 2, H * 0.42, rr, 0, Math.PI * 2); ctx.stroke();
      }
      ctx.fillStyle = 'hsla(' + ((h0 + t * 40) % 360) + ',90%,55%,0.055)';
      ctx.fillRect(0, 0, W, H);
    }
    if (flash > 0.02) {
      ctx.fillStyle = 'rgba(255,255,255,' + (flash * 0.30) + ')';
      ctx.fillRect(0, 0, W, H);
    }
    ctx.restore();
  }

  // ---- minimal chrome -------------------------------------------------

  function mono(size, weight) {
    return (weight || 400) + ' ' + size + 'px ui-monospace, Menlo, Consolas, monospace';
  }

  function drawHUD(view) {
    var ui = view.ui;
    ctx.save();
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';

    ctx.font = mono(12);
    ctx.fillStyle = 'rgba(255,255,255,0.62)';
    ctx.fillText(Econ.fmt(ui.money) + ' \u223f', 16, 24);

    ctx.fillStyle = 'rgba(255,255,255,0.34)';
    ctx.fillText('\u00d7' + Econ.fmt(ui.mult), 16 + ctx.measureText(Econ.fmt(ui.money) + ' \u223f').width + 16, 24);

    ctx.textAlign = 'right';
    ctx.fillStyle = 'rgba(255,255,255,0.34)';
    ctx.fillText(ui.clock, W - 16, 24);

    ctx.font = mono(10);
    ctx.textAlign = 'left';
    // rate readout breathes with pendulum speed: generation is visible
    var sp = view.speed01 || 0;
    ctx.fillStyle = 'rgba(255,255,255,' + (0.2 + 0.6 * sp) + ')';
    ctx.fillText(Econ.fmt(ui.rate) + '/s', 16, 40);
    ctx.fillStyle = 'rgba(255,255,255,0.2)';
    ctx.fillText(ui.progress + '/' + Econ.WIN, 16 + ctx.measureText(Econ.fmt(ui.rate) + '/s').width + 12, 40);
    // speed bar: generation vs pendulum speed, 0..44px
    ctx.fillStyle = 'rgba(255,255,255,0.14)';
    ctx.fillRect(16, 44, 44, 1);
    ctx.fillStyle = 'rgba(255,255,255,' + (0.3 + 0.55 * sp) + ')';
    ctx.fillRect(16, 44, 44 * sp, 1);

    // overdrive charge: right side, opposite the speed bar
    if (ui.charge > 0.001 && !ui.win) {
      ctx.fillStyle = 'rgba(255,255,255,0.16)';
      ctx.fillRect(W - 16 - 60, 32, 60, 2);
      ctx.fillStyle = 'rgba(255,255,255,0.55)';
      ctx.fillRect(W - 16 - 60, 32, 60 * ui.charge, 2);
    }
    ctx.restore();
  }

  // five one-time archetype choices: 3 zones, one line
  function drawFocus(view) {
    var f = view.ui.focus;
    if (!f) return;
    var names = ['calm', 'flare', 'surge'];
    ctx.save();
    ctx.textAlign = 'center';
    ctx.font = mono(10);
    ctx.fillStyle = 'rgba(255,255,255,0.32)';
    ctx.fillText('focus \u2014 ' + (f.index + 1) + '/5', W / 2, f.zones[0].y - 16);
    for (var a = 0; a < f.zones.length; a++) {
      var z = f.zones[a];
      var hov = f.hover === a;
      ctx.font = mono(12);
      ctx.fillStyle = hov ? 'rgba(255,255,255,0.92)' : 'rgba(255,255,255,0.5)';
      ctx.fillText(names[a] + ' \u00d7' + z.mult.toFixed(2), z.x + z.w / 2, z.y + 15);
      ctx.fillStyle = hov ? 'rgba(255,255,255,0.7)' : 'rgba(255,255,255,0.18)';
      ctx.fillRect(z.x + 10, z.y + 24, z.w - 20, hov ? 2 : 1);
    }
    ctx.restore();
  }

  function drawStrip(view) {
    var ui = view.ui;
    var rects = ui.rects;
    ctx.save();
    ctx.textAlign = 'center';
    ctx.font = mono(10);

    for (var i = 0; i < rects.length; i++) {
      var r = rects[i];
      var lvl = ui.levels[i];
      var unlocked = ui.unlocked[i];
      var afford = ui.afford[i];
      var cx = r.x + r.w / 2;
      var baseY = r.y + r.h - 14;
      var maxH = 30;
      var h = Math.min(1, lvl / 40) * maxH;

      if (!unlocked) {
        ctx.fillStyle = 'rgba(255,255,255,0.14)';
        ctx.fillRect(cx - 1, baseY - 4, 2, 4);
      } else {
        var hue = afford ? (h0 + i * 27) % 360 : 0;
        ctx.fillStyle = afford
          ? 'hsla(' + hue + ',95%,66%,0.92)'
          : 'rgba(255,255,255,0.30)';
        ctx.fillRect(cx - 1.5, baseY - h, 3, h);
        if (afford) {
          ctx.beginPath();
          ctx.moveTo(cx - 3.5, baseY - h - 8);
          ctx.lineTo(cx + 3.5, baseY - h - 8);
          ctx.lineTo(cx, baseY - h - 3.5);
          ctx.closePath();
          ctx.fill();
        }
        if (ui.hover === i) {
          ctx.fillStyle = 'rgba(255,255,255,0.85)';
          ctx.fillRect(cx - 1.5, baseY - h, 3, h);
        }
      }

      // baseline hairline
      ctx.fillStyle = 'rgba(255,255,255,0.10)';
      ctx.fillRect(r.x, baseY + 3, r.w, 1);

      // faint track name (only chrome besides hairlines)
      ctx.fillStyle = ui.hover === i ? 'rgba(255,255,255,0.7)' : 'rgba(255,255,255,0.17)';
      ctx.fillText(Econ.TRACKS[i].name, cx, baseY + 15);
    }

    // hover label
    if (ui.hover >= 0) {
      var j = ui.hover, rr = rects[j];
      var cx2 = rr.x + rr.w / 2;
      var tr = Econ.TRACKS[j];
      var line = ui.unlocked[j]
        ? tr.name + ' ' + ui.levels[j] + '  ' + Econ.fmt(ui.costs[j]) + '  +' + ui.gains[j] + '%'
        : tr.name + '  \u22ee ' + tr.unlock;
      ctx.fillStyle = 'rgba(255,255,255,0.75)';
      ctx.fillText(line, cx2, rr.y - 20);
      ctx.fillStyle = 'rgba(255,255,255,0.3)';
      ctx.fillText(ui.unlocked[j] ? tr.hint : 'locked', cx2, rr.y - 8);
    }

    ctx.restore();
  }

  // one dim line + one faint focus mark. nothing else.
  function drawTut(view) {
    var t = view.ui.tut;
    if (!t || t.step >= t.total) return;
    var rects = view.ui.rects;
    ctx.save();
    ctx.textAlign = 'center';

    if (t.focus === 'tick' && t.tick >= 0) {
      var r = rects[t.tick];
      var puls = 0.5 + 0.5 * Math.sin(tGlobal * 5);
      ctx.strokeStyle = 'rgba(255,255,255,' + (0.2 + 0.4 * puls) + ')';
      ctx.lineWidth = 1;
      ctx.setLineDash([3, 5]);
      ctx.strokeRect(r.x - 5, r.y - 5, r.w + 10, r.h + 10);
      ctx.setLineDash([]);
      var ay = r.y - 16 - puls * 4;
      ctx.fillStyle = 'rgba(255,255,255,' + (0.3 + 0.4 * puls) + ')';
      ctx.beginPath();
      ctx.moveTo(r.x + r.w / 2 - 4, ay);
      ctx.lineTo(r.x + r.w / 2 + 4, ay);
      ctx.lineTo(r.x + r.w / 2, ay + 5);
      ctx.closePath();
      ctx.fill();
    } else if (t.focus === 'void') {
      var cx = W / 2, cy = H * 0.74;
      var puls2 = 0.5 + 0.5 * Math.sin(tGlobal * 3);
      ctx.strokeStyle = 'rgba(255,255,255,' + (0.14 + 0.24 * puls2) + ')';
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.arc(cx, cy, 30 + 12 * puls2, 0, Math.PI * 2); ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,0.4)';
      ctx.beginPath(); ctx.arc(cx, cy, 3, 0, Math.PI * 2); ctx.fill();
    }

    ctx.font = mono(12);
    ctx.fillStyle = 'rgba(255,255,255,0.75)';
    ctx.fillText(t.text, W / 2, 62);
    ctx.fillStyle = 'rgba(255,255,255,0.45)';
    ctx.fillRect(W / 2 - 90, 70, 180, 1);

    var dw = 11, x0 = W / 2 - (t.total - 1) * dw / 2;
    for (var i = 0; i < t.total; i++) {
      ctx.fillStyle = i < t.step ? 'rgba(255,255,255,0.55)'
        : i === t.step ? 'rgba(255,255,255,0.9)'
        : 'rgba(255,255,255,0.2)';
      ctx.fillRect(x0 + i * dw - 1.5, 78, 3, 3);
    }
    ctx.restore();
  }

  function drawWin(view) {
    if (!view.ui.win) return;
    ctx.save();
    ctx.fillStyle = 'rgba(0,0,0,0.58)';
    ctx.fillRect(0, 0, W, H);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = '200 64px ui-monospace, Menlo, Consolas, monospace';
    ctx.fillStyle = 'rgba(255,255,255,0.94)';
    drawSpaced(ctx, 'harmony', W / 2, H / 2 - 14, 22);
    ctx.font = mono(12);
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.fillText(Econ.mmss(view.ui.winTime) + '  \u00b7  360/360  \u00b7  press r', W / 2, H / 2 + 44);
    ctx.restore();
  }

  var ctx = document.getElementById('c').getContext('2d', { alpha: false });

  function frame(view, dt) {
    update(dt, view);

    ctx.setTransform(view.dpr, 0, 0, view.dpr, 0, 0);

    drawBackground(view);

    ctx.save();
    if (shake > 0.05) {
      ctx.translate(rand(-shake, shake), rand(-shake, shake));
    }
    drawMandala(view);
    drawGrid();
    drawScope();
    drawTrails(view);
    drawPendulums(view);
    drawParts();
    drawOverdrive(view);
    ctx.restore();

    ctx.fillStyle = vignette;
    ctx.fillRect(0, 0, W, H);

    if (grainPattern) {
      ctx.save();
      ctx.globalAlpha = 0.35;
      ctx.translate(-((Math.random() * 128) | 0), -((Math.random() * 128) | 0));
      ctx.fillStyle = grainPattern;
      ctx.fillRect(0, 0, W + 128, H + 128);
      ctx.restore();
    }

    drawHUD(view);
    drawStrip(view);
    drawFocus(view);
    drawTut(view);
    drawWin(view);
  }

  return {
    resize: resize, frame: frame, setPhase: setPhase,
    spark: spark, ring: ring, float: float, boom: boom, pop: pop
  };
})();
