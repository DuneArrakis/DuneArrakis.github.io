(() => {
  "use strict";

  const canvas = document.querySelector(".particle-field");
  const ctx = canvas?.getContext("2d");
  if (!ctx) return;

  const staticMode = matchMedia("(prefers-reduced-motion: reduce), (forced-colors: active), print");
  const colors = ["#567d98", "#538e91", "#73939e", "#bb936d"];
  const tau = 2 * Math.PI;
  const pointer = { x: 0, y: 0, targetX: 0, targetY: 0, strength: 0, lastMove: -Infinity, inside: false };
  const groups = [];
  let width = 0, height = 0, ratio = 0;
  let frame = 0, previous = 0, time = 0;

  function populate(count) {
    // Batch marks of the same ink and weight into a single stroke.
    groups.length = 0;
    let seed = 92749;
    function random() {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      return seed / 4294967296;
    }
    for (const color of colors) {
      for (const near of [false, true]) {
        groups.push({ color, near, particles: [] });
      }
    }
    for (let i = 0; i < count; i++) {
      const stream = random();
      const scatter = stream < 0.30;
      const lane = stream < 0.63 ? -1 : 1;
      const ink = random();
      const group = groups[2 * (ink < 0.36 ? 0 : ink < 0.67 ? 1 : ink < 0.88 ? 2 : 3) + Number(random() < 0.34)];
      const phase = random() * tau;
      group.particles.push({
        x: random() * (width + 40) - 20,
        baseline: scatter ? random() : 0.5 + lane * 0.26 + (random() + random() - 1) * 0.21,
        amplitude: scatter ? 0.04 : 0.16 + random() * 0.055,
        lane, speed: lane * (13 + random() * 26) * (group.near ? 1.4 : 0.82),
        phase, frequency: 0.55 + random() * 0.8, spread: 1.7 + 0.32 * Math.sin(phase),
        length: (group.near ? 2.0 : 0.65) + random() * 1.65,
        offsetX: 0, offsetY: 0
      });
    }
  }

  function draw(dt, now) {
    time += dt;
    const reach = Math.min(180, width * 0.33);
    const ease = 1 - Math.exp(-dt * 8);
    const follow = 1 - Math.exp(-dt * 15);
    pointer.x += (pointer.targetX - pointer.x) * follow;
    pointer.y += (pointer.targetY - pointer.y) * follow;
    const age = Math.max(0, now - pointer.lastMove);
    const activity = pointer.inside ? Math.exp(-age / 390) : 0;
    pointer.strength += (activity - pointer.strength) * (1 - Math.exp(-dt * (activity > pointer.strength ? 15 : 4)));
    // The lag vector stretches the current along the pointer's path.
    const lagX = pointer.targetX - pointer.x, lagY = pointer.targetY - pointer.y;
    const lag = Math.sqrt(lagX * lagX + lagY * lagY);
    const headingX = lagX / (24 + lag), headingY = lagY / (24 + lag);
    const waveScale = tau / Math.max(600, width * 1.3);
    ctx.clearRect(0, 0, width, height);
    for (const group of groups) {
      ctx.beginPath();
      ctx.lineWidth = group.near ? 1.65 : 1.08;
      ctx.globalAlpha = group.near ? 0.54 : 0.34;
      ctx.strokeStyle = group.color;
      for (const p of group.particles) {
        p.x += p.speed * dt;
        if (p.x > width + 20) p.x -= width + 40;
        if (p.x < -20) p.x += width + 40;
        const wave = p.x * waveScale + p.lane * 1.4 + time * 0.11;
        const ripple = time * p.frequency + p.phase;
        const y = p.baseline * height + height * p.amplitude * Math.sin(wave) + 8 * Math.sin(ripple);
        const dx = p.x - pointer.x, dy = y - pointer.y;
        let pushX = 0, pushY = 0;
        if (pointer.strength > 0.001) {
          // Warp the sampling coordinates continuously in space and time.
          // The Gaussian tail has no shared cutoff radius.
          const u = dx / reach, v = dy / reach;
          const crosswind = Math.sin(2.8 * v + 1.4 * u + time * 0.65);
          const eddy = Math.sin(3.2 * u - 1.7 * v - time * 0.48);
          const along = u * headingX + v * headingY;
          const sx = u - 0.48 * along * headingX + 0.21 * crosswind;
          const sy = v - 0.48 * along * headingY + 0.19 * eddy;
          const weight = Math.exp(-p.spread * (sx * sx + sy * sy)) * pointer.strength;
          const force = weight * (group.near ? 1 : 0.7);
          pushX = force * (-0.34 * dx + reach * (0.60 * headingX + 0.18 * crosswind));
          pushY = force * (-0.34 * dy + reach * (0.60 * headingY + 0.18 * eddy));
        }
        p.offsetX += (pushX - p.offsetX) * ease;
        p.offsetY += (pushY - p.offsetY) * ease;
        const x = p.x + p.offsetX;
        const py = y + p.offsetY;
        // Orient each dash along its own instantaneous velocity.
        const vx = p.speed + 8 * (pushX - p.offsetX);
        const vy = height * p.amplitude * Math.cos(wave) * (p.speed * waveScale + 0.11)
          + 8 * p.frequency * Math.cos(ripple) + 8 * (pushY - p.offsetY);
        const scale = p.length / Math.max(1, Math.sqrt(vx * vx + vy * vy));
        ctx.moveTo(x - scale * vx, py - scale * vy);
        ctx.lineTo(x + scale * vx, py + scale * vy);
      }
      ctx.stroke();
    }
  }

  function resize() {
    const w = canvas.clientWidth, h = canvas.clientHeight;
    if (!w || !h) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 1.5, Math.sqrt(2600000 / (w * h)));
    if (w === width && h === height && dpr === ratio) return;
    width = w;
    height = h;
    ratio = dpr;
    canvas.width = Math.round(w * ratio);
    canvas.height = Math.round(h * ratio);
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    ctx.lineCap = "round";
    populate(Math.min(620, Math.max(100, Math.round(w * h / 2400))));
    draw(0, performance.now());
  }

  function tick(now) {
    draw(Math.max(0, Math.min(now - previous, 50)) / 1000, now);
    previous = now;
    frame = requestAnimationFrame(tick);
  }

  function release() { pointer.inside = false; }
  function sync() {
    cancelAnimationFrame(frame);
    release();
    if (!document.hidden && !staticMode.matches) {
      previous = performance.now();
      frame = requestAnimationFrame(tick);
    } else if (!document.hidden) {
      resize();
      pointer.strength = 0;
      for (const group of groups) {
        for (const p of group.particles) p.offsetX = p.offsetY = 0;
      }
      draw(0, performance.now());
    }
  }

  window.addEventListener("pointermove", event => {
    if (event.pointerType === "touch" || staticMode.matches) return;
    if (pointer.inside && pointer.targetX === event.clientX && pointer.targetY === event.clientY) return;
    if (!pointer.inside) {
      pointer.x = event.clientX;
      pointer.y = event.clientY;
    }
    pointer.targetX = event.clientX;
    pointer.targetY = event.clientY;
    pointer.lastMove = performance.now();
    pointer.inside = true;
  }, { passive: true });
  document.documentElement.addEventListener("pointerleave", release);
  window.addEventListener("blur", release);
  window.addEventListener("resize", resize);
  document.addEventListener("visibilitychange", sync);
  staticMode.addEventListener("change", sync);
  resize();
  sync();
})();
