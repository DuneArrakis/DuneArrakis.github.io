(() => {
  "use strict";

  const canvas = document.querySelector(".particle-field");
  const ctx = canvas?.getContext("2d");
  if (!ctx) return;

  const staticMode = matchMedia("(prefers-reduced-motion: reduce), (forced-colors: active), print");
  const prose = document.querySelector("[data-post-content]");
  const colors = ["#567d98", "#538e91", "#73939e", "#bb936d"];
  const tau = 2 * Math.PI;
  const groups = [];
  const strokes = [];
  let width = 0, height = 0, ratio = 0, frame = 0, previous = 0, time = 0;
  let cursor = null, selecting = false, textLeft = 0, textRight = 0;

  function populate(count) {
    groups.length = 0;
    let seed = 92749;
    function random() {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      return seed / 4294967296;
    }
    for (const color of colors) {
      for (const near of [false, true]) groups.push({ color, near, particles: [] });
    }
    // Small groups start on shared streamlines with slightly different speeds.
    for (let i = 0; i < count;) {
      const shoal = random() < 0.12;
      const members = shoal ? 3 + Math.floor(random() * 4) : 1;
      const lane = random() < 0.5 ? -1 : 1;
      const baseline = shoal ? 0.5 + lane * 0.26 + (random() - 0.5) * 0.30 : random();
      const start = random() * width;
      const speed = (shoal ? 30 : 12) + random() * 19;
      for (let j = 0; j < members && i < count; j++, i++) {
        const ink = random();
        const near = shoal || random() < 0.14;
        const group = groups[2 * (ink < 0.36 ? 0 : ink < 0.67 ? 1 : ink < 0.91 ? 2 : 3) + Number(near)];
        group.particles.push({
          x: start + j * 8 + random() * 6, baseline, lane,
          drift: shoal ? (random() - 0.5) * 30 : 0, amplitude: shoal ? 0.16 : 0.055,
          speed: lane * (speed + random() * 6), phase: random() * tau,
          frequency: 0.55 + random() * 0.8, spread: 0.8 + random() * 0.55,
          length: (near ? 1.7 : 0.45) + random() * 1.25,
          quiet: random() < 0.65, offsetX: 0, offsetY: 0, vx: 0, vy: 0
        });
      }
    }
  }

  function resetPointer() { cursor = null; strokes.length = 0; }

  function track(event) {
    if (event.pointerType === "touch" || staticMode.matches || selecting || event.buttons) {
      resetPointer();
      return;
    }
    const sample = { x: event.clientX, y: event.clientY, t: event.timeStamp };
    const start = cursor;
    cursor = sample;
    if (!start || sample.t - start.t > 240) return;
    const dx = sample.x - start.x, dy = sample.y - start.y;
    const distance = Math.hypot(dx, dy);
    if (!distance) return;
    const speed = distance * 1000 / Math.max(1, sample.t - start.t);
    const fast = speed / (speed + 480);
    const radius = (34 + fast * 76) * Math.min(1, width / 540);
    strokes.push({ x: start.x, y: start.y, dx, dy, distance, fast, r: radius });
    if (strokes.length > 32) strokes.shift();
  }

  function applyStroke(p, y, s, gain) {
    // Use the closest point on the swept segment, including for sparse input events.
    const t = Math.max(0, Math.min(1, ((p.x - s.x) * s.dx + (y - s.y) * s.dy) / (s.distance * s.distance)));
    const u = (p.x - s.x - t * s.dx) / s.r, v = (y - s.y - t * s.dy) / s.r;
    if (Math.abs(u) > 4 || Math.abs(v) > 4) return;
    const cross = Math.sin(v * 2.6 + u + time * 0.6);
    const eddy = Math.sin(u * 2.9 - v * 1.4 - time * 0.4);
    const wx = u + 0.19 * cross, wy = v + 0.18 * eddy;
    const weight = Math.exp(-p.spread * (wx * wx + wy * wy)) * gain;
    const impulse = weight * Math.min(s.distance, s.r * 1.5);
    const carry = 0.46 + 2.55 * s.fast;
    p.vx += impulse * (carry * s.dx / s.distance - 0.68 * u + cross * 0.18);
    p.vy += impulse * (carry * s.dy / s.distance - 0.68 * v + eddy * 0.18);
  }

  function draw(dt) {
    time += dt;
    const waveScale = tau / Math.max(600, width * 1.3);
    // Exact critically damped return keeps the same timing at different refresh rates.
    const damping = selecting ? 9 : 4.6;
    const decay = Math.exp(-damping * dt);
    ctx.clearRect(0, 0, width, height);
    for (const group of groups) {
      ctx.beginPath();
      ctx.lineWidth = group.near ? 1.65 : 1.08;
      ctx.globalAlpha = group.near ? 0.53 : 0.32;
      ctx.strokeStyle = group.color;
      for (const p of group.particles) {
        const within = prose ? Math.max(0, Math.min(1, (p.x - textLeft) / 40, (textRight - p.x) / 40)) : 0;
        const driftSpeed = p.speed * (1 - 0.62 * within);
        p.x += driftSpeed * dt;
        if (p.x > width + 45) p.x -= width + 90;
        if (p.x < -45) p.x += width + 90;
        const wave = p.x * waveScale + p.lane * 1.4 + time * 0.11;
        const ripple = time * p.frequency + p.phase;
        const y = (p.baseline + p.amplitude * Math.sin(wave)) * height + p.drift + 8 * Math.sin(ripple);
        const gain = (group.near ? 1 : 0.74) * (1 - 0.84 * within);
        for (const stroke of strokes) applyStroke(p, y, stroke, gain);
        const ax = p.vx + damping * p.offsetX, ay = p.vy + damping * p.offsetY;
        p.offsetX = (p.offsetX + dt * ax) * decay;
        p.offsetY = (p.offsetY + dt * ay) * decay;
        p.vx = (p.vx - damping * dt * ax) * decay;
        p.vy = (p.vy - damping * dt * ay) * decay;
        const length = p.length * (1 - within * (p.quiet ? 1 : 0.24));
        if (length < 0.1) continue;
        const vx = driftSpeed + p.vx;
        const vy = height * p.amplitude * Math.cos(wave) * (driftSpeed * waveScale + 0.11)
          + 8 * p.frequency * Math.cos(ripple) + p.vy;
        const scale = length / Math.max(1, Math.sqrt(vx * vx + vy * vy));
        const x = p.x + p.offsetX, py = y + p.offsetY;
        ctx.moveTo(x - scale * vx, py - scale * vy);
        ctx.lineTo(x + scale * vx, py + scale * vy);
      }
      ctx.stroke();
    }
    strokes.length = 0;
  }

  function resize() {
    const w = canvas.clientWidth, h = canvas.clientHeight;
    if (!w || !h) return;
    if (prose) {
      const rect = prose.getBoundingClientRect();
      textLeft = rect.left;
      textRight = rect.right;
    }
    const dpr = Math.min(window.devicePixelRatio || 1, 1.5, Math.sqrt(2600000 / (w * h)));
    if (w === width && h === height && dpr === ratio) return;
    width = w;
    height = h;
    ratio = dpr;
    canvas.width = Math.round(w * ratio);
    canvas.height = Math.round(h * ratio);
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    ctx.lineCap = "round";
    populate(Math.min(560, Math.max(95, Math.round(w * h / 2700))));
    draw(0);
  }

  function tick(now) {
    draw(Math.max(0, Math.min(now - previous, 50)) / 1000);
    previous = now;
    frame = requestAnimationFrame(tick);
  }

  function sync() {
    cancelAnimationFrame(frame);
    resetPointer();
    if (document.hidden) return;
    if (staticMode.matches) {
      for (const group of groups) {
        for (const p of group.particles) p.offsetX = p.offsetY = p.vx = p.vy = 0;
      }
      draw(0);
    } else {
      previous = performance.now();
      frame = requestAnimationFrame(tick);
    }
  }

  if (prose) document.addEventListener("selectionchange", () => {
    const selection = document.getSelection();
    selecting = !!selection?.rangeCount && !selection.isCollapsed && selection.containsNode(prose, true);
    if (selecting) resetPointer();
  });
  window.addEventListener("pointermove", track, { passive: true });
  document.documentElement.addEventListener("pointerleave", resetPointer);
  window.addEventListener("blur", resetPointer);
  window.addEventListener("resize", resize);
  document.addEventListener("visibilitychange", sync);
  staticMode.addEventListener("change", sync);
  resize();
  sync();
})();
