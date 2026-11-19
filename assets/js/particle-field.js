(() => {
  "use strict";

  const canvas = document.querySelector(".particle-field");
  const ctx = canvas?.getContext("2d", { alpha: false });
  if (!ctx) return;

  const staticMode = matchMedia("(prefers-reduced-motion: reduce), (forced-colors: active), print");
  const prose = document.querySelector("[data-post-content]");
  const colors = ["#2864df", "#009e91", "#00a9eb", "#f5a800", "#ff6053"];
  const layers = [
    { depth: 0.14, speed: 13, length: 1.25, weight: 0.92, alpha: 0.36 },
    { depth: 0.48, speed: 29, length: 2.55, weight: 1.32, alpha: 0.65 },
    { depth: 1, speed: 56, length: 4.35, weight: 1.85, alpha: 0.81 }
  ];
  let width = 0, height = 0, ratio = 0, previous = 0, frame = 0, time = 0;
  let pointer = null, lastTip = null, bend = null, cameraX = 0, cameraY = 0;
  let selecting = false, textLeft = 0, textRight = 0;
  let paper, pixelScale = 1, windowStart = 0, fastFrames = 0, missedFrames = 0, stableWindows = 0;
  const frameBudget = 1000 / 120;
  const margin = 64;

  // Sample a looping, twisting ribbon once. Neighbouring particles follow its
  // centre and spread, and use the same tangent to orient their brush marks.
  const samples = 256;
  const profile = Array.from({ length: samples + 1 }, (_, i) => {
    const a = i * Math.PI * 2 / samples;
    return {
      center: 0.13 * Math.sin(a) + 0.035 * Math.sin(2 * a + 0.8),
      spread: 0.075 + 0.12 * Math.cos(a - 0.4),
      centerSlope: 0.13 * Math.cos(a) + 0.07 * Math.cos(2 * a + 0.8),
      spreadSlope: -0.12 * Math.sin(a - 0.4)
    };
  });

  function populate(count) {
    let seed = 92749;
    function random() {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      return seed / 4294967296;
    }
    for (const layer of layers) layer.groups = colors.map(() => []);
    for (let i = 0; i < count; i++) {
      const z = random();
      const layer = layers[z < 0.38 ? 0 : z < 0.83 ? 1 : 2];
      const ink = random();
      const color = ink < 0.35 ? 0 : ink < 0.66 ? 1 : ink < 0.86 ? 2 : ink < 0.95 ? 3 : 4;
      const direction = random() < 0.5 ? 1 : -1;
      const diffuse = random() < 0.32;
      layer.groups[color].push({
        x: random() * (width + 2 * margin) - margin,
        base: diffuse ? random() : (direction > 0 ? 0.29 : 0.72) + (random() - 0.5) * 0.07,
        strand: (random() + random() - 1) * (diffuse ? 1.9 : 1),
        phase: (direction > 0 ? 0 : 0.48) + 0.15 * layer.depth,
        direction, speed: direction * layer.speed * (0.80 + random() * 0.42),
        length: layer.length * (0.65 + random() * 0.70),
        quiet: random() < 0.65, offsetX: 0, offsetY: 0, vx: 0, vy: 0, awake: false,
        cell: -1, cellY: 0, cellRise: 0, slope: 0, lastSpeed: NaN, tangentX: 0, tangentY: 0
      });
    }
  }

  function resetPointer() { pointer = lastTip = bend = null; }

  function track(event) {
    if (event.pointerType === "touch" || event.buttons || selecting || staticMode.matches) {
      resetPointer();
      return;
    }
    const next = { x: event.clientX, y: event.clientY, t: event.timeStamp };
    if (!pointer || next.t - pointer.t > 240) {
      lastTip = next;
      bend = null;
    } else if (!bend && pointer !== lastTip) {
      bend = pointer;
    }
    pointer = next;
  }

  function segment(start, end) {
    if (!start || !end || start === end) return null;
    const dx = end.x - start.x, dy = end.y - start.y;
    const distance2 = dx * dx + dy * dy;
    if (distance2 < 0.25) return null;
    const distance = Math.sqrt(distance2);
    const speed = distance * 1000 / Math.max(1, end.t - start.t);
    const fast = speed / (speed + 480);
    const radius = (64 + 70 * fast) * Math.min(1, width / 540);
    const extent = 1.8 * radius;
    return { x: start.x, y: start.y, dx, dy, inverseLength2: 1 / distance2,
      left: Math.min(start.x, end.x) - extent, right: Math.max(start.x, end.x) + extent,
      top: Math.min(start.y, end.y) - extent, bottom: Math.max(start.y, end.y) + extent,
      inverseExtent: 1 / extent, impulse: Math.min(distance, 1.5 * radius),
      carryX: dx / distance * (0.35 + 1.75 * fast), carryY: dy / distance * (0.35 + 1.75 * fast) };
  }

  function sweep(p, x, y, s, gain) {
    if (!s || x < s.left || x > s.right || y < s.top || y > s.bottom) return;
    const dx = x - s.x, dy = y - s.y;
    const along = Math.max(0, Math.min(1, (dx * s.dx + dy * s.dy) * s.inverseLength2));
    const u = (dx - along * s.dx) * s.inverseExtent, v = (dy - along * s.dy) * s.inverseExtent;
    const falloff = 1 - u * u - v * v;
    if (falloff <= 0) return;
    const impulse = falloff * falloff * s.impulse * gain;
    p.vx += impulse * (s.carryX - 2.4 * u);
    p.vy += impulse * (s.carryY - 2.4 * v);
    p.awake = true;
  }

  function draw(dt, now) {
    time += dt;
    const first = segment(lastTip, bend || pointer), second = segment(bend, pointer);
    lastTip = pointer;
    bend = null;
    const ease = 1 - Math.exp(-4 * dt);
    cameraX += ((pointer ? pointer.x / width - 0.5 : 0) * 34 - cameraX) * ease;
    cameraY += ((pointer ? pointer.y / height - 0.5 : 0) * 24 - cameraY) * ease;
    const reach = Math.min(180, width * 0.30);
    const attraction = pointer ? Math.exp(-Math.max(0, now - pointer.t - 90) / 300) : 0;
    const damping = selecting ? 10 : 7, decay = Math.exp(-damping * dt);
    const period = Math.max(630, width * 1.32), anglePerPixel = Math.PI * 2 / period;
    // The fixed field already covers the paper. An opaque backing store can
    // be composited directly underneath the page.
    ctx.globalAlpha = 1;
    ctx.fillStyle = paper;
    ctx.fillRect(0, 0, width, height);
    for (const layer of layers) {
      const shiftX = cameraX * layer.depth, shiftY = cameraY * layer.depth;
      const phaseSpeed = 0.008 + 0.004 * layer.depth;
      const phase = (time * phaseSpeed) % 1;
      const waveSpeed = period * phaseSpeed;
      ctx.lineWidth = layer.weight;
      ctx.globalAlpha = layer.alpha;
      for (let color = 0; color < colors.length; color++) {
        ctx.strokeStyle = colors[color];
        ctx.beginPath();
        for (const p of layer.groups[color]) {
          const within = prose ? Math.max(0, Math.min(1, (p.x + shiftX - textLeft) / 40, (textRight - p.x - shiftX) / 40)) : 0;
          const speed = p.speed * (1 - 0.62 * within);
          p.x += speed * dt;
          if (p.x > width + margin) p.x -= width + 2 * margin;
          if (p.x < -margin) p.x += width + 2 * margin;
          const length = p.length * (1 - within * (p.quiet ? 1 : 0.50));
          if (length < 0.1 && !p.awake) continue;
          const sample = (p.x / period + p.phase + phase * p.direction + 2) * samples;
          const index = Math.floor(sample), cell = index & (samples - 1);
          // The sampled ribbon is linear inside each cell. Its position still
          // advances every display frame, even when its tangent can be reused.
          if (cell !== p.cell) {
            const a = profile[cell], b = profile[cell + 1];
            p.cellY = (p.base + a.center + a.spread * p.strand) * height;
            p.cellRise = (b.center - a.center + (b.spread - a.spread) * p.strand) * height;
            p.slope = (a.centerSlope + a.spreadSlope * p.strand) * height * anglePerPixel;
            p.cell = cell;
            p.lastSpeed = NaN;
          }
          const x = p.x + shiftX, y = p.cellY + (sample - index) * p.cellRise + shiftY;
          const gain = (0.4 + layer.depth * 0.65) * (1 - 0.84 * within);
          if (first) sweep(p, x, y, first, gain);
          if (second) sweep(p, x, y, second, gain);
          let targetX = 0, targetY = 0;
          if (attraction > 0.002 && Math.abs(pointer.x - x) < reach && Math.abs(pointer.y - y) < reach) {
            const dx = pointer.x - x, dy = pointer.y - y;
            const falloff = 1 - (dx * dx + dy * dy) / (reach * reach);
            if (falloff > 0) {
              const pull = attraction * gain * falloff * falloff;
              targetX = dx * pull;
              targetY = dy * pull;
              p.awake = true;
            }
          }
          if (p.awake) {
            const ex = p.offsetX - targetX, ey = p.offsetY - targetY;
            const ax = p.vx + damping * ex, ay = p.vy + damping * ey;
            p.offsetX = targetX + (ex + dt * ax) * decay;
            p.offsetY = targetY + (ey + dt * ay) * decay;
            p.vx = (p.vx - damping * dt * ax) * decay;
            p.vy = (p.vy - damping * dt * ay) * decay;
            if (!targetX && !targetY && Math.abs(p.offsetX) + Math.abs(p.offsetY) + Math.abs(p.vx) + Math.abs(p.vy) < 0.05) {
              p.offsetX = p.offsetY = p.vx = p.vy = 0;
              p.awake = false;
            }
          }
          if (length < 0.1) continue;
          if (p.awake || speed !== p.lastSpeed) {
            const vx = speed + p.vx;
            const vy = p.slope * (speed + waveSpeed * p.direction) + p.vy;
            const scale = 1 / Math.max(1, Math.sqrt(vx * vx + vy * vy));
            p.tangentX = vx * scale;
            p.tangentY = vy * scale;
            p.lastSpeed = p.awake ? NaN : speed;
          }
          const px = x + p.offsetX, py = y + p.offsetY;
          const tipX = p.tangentX * length, tipY = p.tangentY * length;
          ctx.moveTo(px - tipX, py - tipY);
          ctx.lineTo(px + tipX, py + tipY);
        }
        ctx.stroke();
      }
    }
  }

  function measureText() {
    if (!prose) return;
    const rect = prose.getBoundingClientRect();
    textLeft = rect.left;
    textRight = rect.right;
  }

  function setResolution() {
    const base = Math.min(window.devicePixelRatio || 1, 1.5, Math.sqrt(1500000 / (width * height)));
    const next = base * pixelScale;
    if (next === ratio && canvas.width === Math.round(width * next) && canvas.height === Math.round(height * next)) return;
    ratio = next;
    canvas.width = Math.round(width * ratio);
    canvas.height = Math.round(height * ratio);
    ctx.setTransform(canvas.width / width, 0, 0, canvas.height / height, 0, 0);
    ctx.lineCap = "round";
  }

  function resize() {
    const w = canvas.clientWidth, h = canvas.clientHeight;
    if (!w || !h) return;
    measureText();
    const changed = w !== width || h !== height;
    width = w;
    height = h;
    paper = getComputedStyle(document.body).backgroundColor;
    if (changed) {
      pixelScale = 1;
      populate(Math.min(390, Math.max(80, Math.round(w * h / 3600))));
    }
    setResolution();
    resetPointer();
    draw(0, performance.now());
  }

  function trackCadence(now, interval) {
    if (interval > 0 && interval <= frameBudget * 1.2) fastFrames++;
    if (interval > frameBudget * 1.6) missedFrames++;
    if (now - windowStart < 1000) return;
    // Only tune after observing high-refresh callbacks. Ordinary 60 Hz
    // screens and isolated long tasks should retain their full resolution.
    if (fastFrames >= 12 && missedFrames >= 12 && pixelScale === 1) {
      pixelScale = 0.8;
      setResolution();
    }
    stableWindows = fastFrames >= 90 && missedFrames <= 2 ? stableWindows + 1 : 0;
    if (pixelScale < 1 && stableWindows >= 12) {
      pixelScale = 1;
      setResolution();
    }
    fastFrames = missedFrames = 0;
    windowStart = now;
  }

  function tick(now) {
    const interval = now - previous;
    trackCadence(now, interval);
    draw(Math.max(0, Math.min(interval, 50)) / 1000, now);
    previous = now;
    frame = requestAnimationFrame(tick);
  }

  function sync() {
    cancelAnimationFrame(frame);
    resetPointer();
    if (document.hidden) return;
    if (!width || !height) resize();
    if (!width || !height) return;
    if (staticMode.matches) {
      cameraX = cameraY = 0;
      for (const layer of layers) {
        for (const group of layer.groups) {
          for (const p of group) {
            p.offsetX = p.offsetY = p.vx = p.vy = 0;
            p.awake = false;
          }
        }
      }
      if (width && height) draw(0, performance.now());
    } else {
      previous = windowStart = performance.now();
      fastFrames = missedFrames = stableWindows = 0;
      frame = requestAnimationFrame(tick);
    }
  }

  if (prose) {
    if (typeof ResizeObserver !== "undefined") new ResizeObserver(measureText).observe(prose);
    document.addEventListener("selectionchange", () => {
      const selection = document.getSelection();
      selecting = !!selection?.rangeCount && !selection.isCollapsed && selection.containsNode(prose, true);
      if (selecting) resetPointer();
    });
  }
  window.addEventListener("pointermove", track, { passive: true });
  document.documentElement.addEventListener("pointerleave", resetPointer);
  window.addEventListener("blur", resetPointer);
  window.addEventListener("resize", resize);
  document.addEventListener("visibilitychange", sync);
  staticMode.addEventListener("change", sync);
  resize();
  sync();
})();
