(() => {
  "use strict";

  const maxParticles = 390;

  function canvasBrush(ctx) {
    return {
      kind: "2d",
      resize(canvas, width, height) {
        ctx.setTransform(canvas.width / width, 0, 0, canvas.height / height, 0, 0);
        ctx.lineCap = "round";
      },
      clear(paper, width, height) {
        ctx.globalAlpha = 1;
        ctx.fillStyle = paper;
        ctx.fillRect(0, 0, width, height);
      },
      layer(layer) {
        ctx.globalAlpha = layer.alpha;
        ctx.lineWidth = layer.weight;
      },
      begin(color) {
        ctx.strokeStyle = color.css;
        ctx.beginPath();
      },
      mark(x, y, dx, dy) {
        ctx.moveTo(x - dx, y - dy);
        ctx.lineTo(x + dx, y + dy);
      },
      stroke() { ctx.stroke(); }
    };
  }

  // One point sprite per brush mark. Only the bounding squares of the
  // marks run the fragment shader, even when the marks are far apart.
  function gpuBrush(gl) {
    const program = gl.createProgram();
    function attachShader(type, source) {
      const shader = gl.createShader(type);
      gl.shaderSource(shader, source);
      gl.compileShader(shader);
      gl.attachShader(program, shader);
      gl.deleteShader(shader);
    }
    attachShader(gl.VERTEX_SHADER, `
      attribute vec4 mark;
      attribute vec4 ink;
      attribute float radius;
      uniform vec2 viewport;
      uniform vec2 pixelScale;
      varying mediump vec2 tip;
      varying mediump vec4 color;
      varying mediump float halfWidth;
      varying mediump float size;
      void main() {
        vec2 clip = (mark.xy * pixelScale + 16.0) * 2.0 / viewport - 1.0;
        gl_Position = vec4(clip.x, -clip.y, 0.0, 1.0);
        tip = mark.zw * pixelScale;
        halfWidth = radius * pixelScale.x;
        size = ceil(2.0 * (max(abs(tip.x), abs(tip.y)) + halfWidth + 1.0));
        gl_PointSize = size;
        color = ink;
      }`);
    attachShader(gl.FRAGMENT_SHADER, `
      precision mediump float;
      varying vec2 tip;
      varying vec4 color;
      varying float halfWidth;
      varying float size;
      void main() {
        vec2 p = (gl_PointCoord - 0.5) * size;
        float along = clamp(dot(p, tip) / max(dot(tip, tip), 0.0001), -1.0, 1.0);
        float coverage = clamp(halfWidth + 0.5 - length(p - along * tip), 0.0, 1.0);
        gl_FragColor = vec4(color.rgb, color.a * coverage);
      }`);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error("Particle shader unavailable");
    gl.useProgram(program);
    const viewport = gl.getUniformLocation(program, "viewport");
    const pixelScale = gl.getUniformLocation(program, "pixelScale");
    const wordsPerMark = 6;
    const vertices = new Float32Array(maxParticles * wordsPerMark);
    const bytes = new Uint8Array(vertices.buffer);
    gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
    gl.bufferData(gl.ARRAY_BUFFER, vertices.byteLength, gl.STREAM_DRAW);
    function attribute(name, count, type, offset) {
      const index = gl.getAttribLocation(program, name);
      gl.enableVertexAttribArray(index);
      gl.vertexAttribPointer(index, count, type, type === gl.UNSIGNED_BYTE, wordsPerMark * 4, offset);
    }
    attribute("mark", 4, gl.FLOAT, 0);
    attribute("radius", 1, gl.FLOAT, 16);
    attribute("ink", 4, gl.UNSIGNED_BYTE, 20);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    let paperColor, radius, offset = 0;
    const rgba = new Uint8Array(4);
    const packedColor = new Uint32Array(rgba.buffer);
    const packedVertices = new Uint32Array(vertices.buffer);
    return {
      kind: "webgl",
      resize(canvas, width, height) {
        // Pad the clip volume so strokes crossing the edge stay visible
        // until the whole mark leaves the screen.
        gl.viewport(-16, -16, canvas.width + 32, canvas.height + 32);
        gl.uniform2f(viewport, canvas.width + 32, canvas.height + 32);
        gl.uniform2f(pixelScale, canvas.width / width, canvas.height / height);
      },
      clear(paper) {
        if (paper !== paperColor) {
          const sample = typeof OffscreenCanvas === "function" ? new OffscreenCanvas(1, 1) : document.createElement("canvas");
          const swatch = sample.getContext("2d");
          swatch.fillStyle = paper;
          swatch.fillRect(0, 0, 1, 1);
          const [r, g, b] = swatch.getImageData(0, 0, 1, 1).data;
          gl.clearColor(r / 255, g / 255, b / 255, 1);
          paperColor = paper;
        }
        offset = 0;
        gl.clear(gl.COLOR_BUFFER_BIT);
      },
      layer(layer) {
        rgba[3] = Math.round(layer.alpha * 255);
        radius = layer.weight / 2;
      },
      begin({ rgb }) {
        rgba[0] = rgb >> 16;
        rgba[1] = rgb >> 8;
        rgba[2] = rgb;
      },
      mark(x, y, dx, dy) {
        vertices[offset++] = x;
        vertices[offset++] = y;
        vertices[offset++] = dx;
        vertices[offset++] = dy;
        vertices[offset++] = radius;
        packedVertices[offset++] = packedColor[0];
      },
      finish() {
        if (!offset) return;
        gl.bufferSubData(gl.ARRAY_BUFFER, 0, bytes.subarray(0, offset * 4));
        gl.drawArrays(gl.POINTS, 0, offset / wordsPerMark);
      }
    };
  }

  function createBrush(canvas, onContextLost, staticMode) {
    const gl = !staticMode && canvas.getContext("webgl", {
      alpha: false, depth: false, stencil: false, antialias: false,
      powerPreference: "low-power", failIfMajorPerformanceCaveat: true
    });
    if (gl) {
      // The longest near-field mark, including antialiasing, fits in 24 pixels.
      if (gl.getParameter(gl.ALIASED_POINT_SIZE_RANGE)[1] < 24) return null;
      const brush = gpuBrush(gl);
      canvas.addEventListener("webglcontextlost", onContextLost, { once: true });
      return brush;
    }
    const ctx = canvas.getContext("2d", { alpha: false });
    return ctx && canvasBrush(ctx);
  }

  function createField(canvas, brush, timeOffset = 0) {
    const colors = ["#2864df", "#009e91", "#00a9eb", "#f5a800", "#ff6053"].map(css => ({
      css, rgb: parseInt(css.slice(1), 16)
    }));
    const layers = [
      { depth: 0.14, speed: 13, length: 1.25, weight: 0.92, alpha: 0.36 },
      { depth: 0.48, speed: 29, length: 2.55, weight: 1.32, alpha: 0.65 },
      { depth: 1, speed: 56, length: 4.35, weight: 1.85, alpha: 0.81 }
    ];
    let width = 0, height = 0, ratio = 0, previous = 0, frame = 0, time = 0;
    let pointer = null, lastTip = null, bend = null, cameraX = 0, cameraY = 0;
    let visible = false, reduced = false, dpr = 1;
    let selecting = false, textLeft = 0, textRight = 0;
    // Keep all three depths at each detail level. The pixel cap controls the
    // cost of painting the full viewport; density controls simulation and paths.
    const detail = [
      { pixels: 230400, dpr: 0.75, density: 0.28 },
      { pixels: 360000, dpr: 0.85, density: 0.40 },
      { pixels: 650000, dpr: 1, density: 0.65 },
      { pixels: 1500000, dpr: 1.5, density: 1 }
    ];
    const modestDevice = navigator.hardwareConcurrency <= 4 || navigator.deviceMemory <= 4;
    const minimumLevel = brush.kind === "2d" ? 0 : 1;
    let ceiling = modestDevice ? 2 : 3;
    let level = typeof document !== "undefined" ? Math.min(2, ceiling) : ceiling;
    if (modestDevice && brush.kind === "2d") level = 1;
    let paper, windowStart = 0, frames = 0, late = 0, fast = 0, veryFast = 0;
    let busyMs = 0, lastDrawMs = 0, stableWindows = 0, slowWindows = 0, trial = false;
    let frameBudget = 1000 / 60;
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

    function track(next) {
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
      brush.clear(paper, width, height);
      for (const layer of layers) {
        const shiftX = cameraX * layer.depth, shiftY = cameraY * layer.depth;
        const phaseSpeed = 0.008 + 0.004 * layer.depth;
        const phase = (time * phaseSpeed) % 1;
        const waveSpeed = period * phaseSpeed;
        brush.layer(layer);
        for (let color = 0; color < colors.length; color++) {
          brush.begin(colors[color]);
          let hasPath = false;
          const group = layer.groups[color];
          const count = Math.ceil(group.length * detail[level].density);
          for (let i = 0; i < count; i++) {
            const p = group[i];
            const within = textRight > textLeft ? Math.max(0, Math.min(1, (p.x + shiftX - textLeft) / 40, (textRight - p.x - shiftX) / 40)) : 0;
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
            const px = x + p.offsetX, py = y + p.offsetY;
            const extent = length + layer.weight;
            if (px < -extent || px > width + extent || py < -extent || py > height + extent) continue;
            if (p.awake || speed !== p.lastSpeed) {
              const vx = speed + p.vx;
              const vy = p.slope * (speed + waveSpeed * p.direction) + p.vy;
              const scale = 1 / Math.max(1, Math.sqrt(vx * vx + vy * vy));
              p.tangentX = vx * scale;
              p.tangentY = vy * scale;
              p.lastSpeed = p.awake ? NaN : speed;
            }
            const tipX = p.tangentX * length, tipY = p.tangentY * length;
            brush.mark(px, py, tipX, tipY);
            hasPath = true;
          }
          if (hasPath) brush.stroke?.();
        }
      }
      brush.finish?.();
    }

    function setResolution() {
      const quality = detail[level];
      const next = Math.min(dpr, quality.dpr, Math.sqrt(quality.pixels / (width * height)));
      if (next === ratio && canvas.width === Math.round(width * next) && canvas.height === Math.round(height * next)) return;
      ratio = next;
      canvas.width = Math.round(width * ratio);
      canvas.height = Math.round(height * ratio);
      brush.resize(canvas, width, height);
      return true;
    }

    function resize(viewport) {
      const changed = viewport.width !== width || viewport.height !== height;
      width = viewport.width;
      height = viewport.height;
      dpr = viewport.dpr;
      paper = viewport.paper;
      if (!width || !height) return;
      if (changed) {
        populate(Math.min(maxParticles, Math.max(80, Math.round(width * height / 3600))));
      }
      return setResolution();
    }

    function resetWindow(now) {
      windowStart = now;
      frames = late = fast = veryFast = busyMs = 0;
    }

    function trackCadence(now, interval, drawMs) {
      if (interval <= 0) return;
      frames++;
      busyMs += drawMs;
      if (interval < 12.5) fast++;
      if (interval < 9.5) veryFast++;
      if (interval > frameBudget * 1.45) late++;
      if (now - windowStart < 1000) return;
      if (veryFast >= 6) frameBudget = 1000 / 120;
      else if (fast >= 6) frameBudget = Math.min(frameBudget, 1000 / 90);
      const averageWork = busyMs / frames;
      const meanInterval = (now - windowStart) / frames;
      const overloaded = meanInterval > frameBudget * 1.22 || late > frames * 0.16 || averageWork > frameBudget * 0.55;
      slowWindows = overloaded ? slowWindows + 1 : 0;
      const stable = meanInterval <= frameBudget * 1.12 && late <= frames * 0.03 && averageWork < frameBudget * 0.28;
      stableWindows = stable ? stableWindows + 1 : 0;
      if (slowWindows >= 2 && level > minimumLevel) {
        level--;
        if (trial) ceiling = level;
        trial = false;
        slowWindows = stableWindows = 0;
      } else if (stableWindows >= 12 && level < ceiling) {
        level++;
        trial = true;
        stableWindows = 0;
      } else if (stableWindows >= 12) {
        trial = false;
      }
      resetWindow(now);
    }

    function tick(timestamp) {
      const now = timestamp + timeOffset;
      const interval = now - previous;
      const oldLevel = level;
      trackCadence(now, interval, lastDrawMs);
      const started = performance.now();
      // Resizing clears the canvas, so always draw in the same callback.
      if (oldLevel !== level) setResolution();
      draw(Math.max(0, Math.min(interval, 50)) / 1000, now);
      lastDrawMs = performance.now() - started;
      previous = now;
      frame = requestAnimationFrame(tick);
    }

    function update(state) {
      const resized = state.viewport && resize(state.viewport);
      if (state.text) [textLeft, textRight] = state.text;
      if (state.selecting !== undefined) selecting = state.selecting;
      if (state.reset) resetPointer();
      if (state.first) track(state.first);
      if (state.last) track(state.last);

      if (state.visible !== undefined) visible = state.visible;
      if (state.reduced !== undefined) reduced = state.reduced;
      if (!visible || reduced || !width || !height) {
        cancelAnimationFrame(frame);
        frame = 0;
        if (!visible || !width || !height) return;
        cameraX = cameraY = 0;
        for (const layer of layers) {
          for (const group of layer.groups) {
            for (const p of group) {
              p.offsetX = p.offsetY = p.vx = p.vy = 0;
              p.awake = false;
            }
          }
        }
        draw(0, performance.now() + timeOffset);
      } else if (!frame) {
        previous = performance.now() + timeOffset;
        resetWindow(previous);
        frameBudget = 1000 / 60;
        lastDrawMs = 0;
        slowWindows = stableWindows = 0;
        draw(0, previous);
        frame = requestAnimationFrame(tick);
      } else if (resized) {
        draw(0, performance.now() + timeOffset);
      }
    }

    return update;
  }

  function attach(initialCanvas, scriptURL) {
    let canvas = initialCanvas;
    const prose = document.querySelector("[data-post-content]");
    const staticMode = matchMedia("(prefers-reduced-motion: reduce), (forced-colors: active), print");
    let worker, timeout, transferred = false, send, flushFrame = 0;
    let measureViewport = true, measureText = true, selecting = false, pointerActive = false, pending = {};

    function flush() {
      flushFrame = 0;
      if (!send) return;
      const state = pending;
      pending = {};
      if (measureViewport) {
        state.viewport = {
          width: canvas.clientWidth, height: canvas.clientHeight,
          dpr: window.devicePixelRatio || 1,
          paper: getComputedStyle(document.body).backgroundColor
        };
        measureViewport = false;
      }
      if (measureText && prose) {
        const rect = prose.getBoundingClientRect();
        state.text = [rect.left, rect.right];
        measureText = false;
      }
      send(state);
    }

    function schedule() {
      if (send && !flushFrame) flushFrame = requestAnimationFrame(flush);
    }

    function resetPointer() {
      if (!pointerActive) return;
      pointerActive = false;
      pending.first = pending.last = undefined;
      pending.reset = true;
      schedule();
    }

    function sync() {
      pending.visible = !document.hidden;
      pending.reduced = staticMode.matches;
      resetPointer();
      measureViewport = measureText = true;
      // A hidden tab may never run its pending animation frame.
      cancelAnimationFrame(flushFrame);
      flush();
    }

    function replaceCanvas() {
      const replacement = canvas.cloneNode(false);
      canvas.replaceWith(replacement);
      canvas = replacement;
      transferred = false;
    }

    function recoverCanvas2D() {
      send?.({ visible: false });
      replaceCanvas();
      const ctx = canvas.getContext("2d", { alpha: false });
      send = ctx && createField(canvas, canvasBrush(ctx));
      sync();
    }

    function useMainThread() {
      clearTimeout(timeout);
      worker?.terminate();
      worker = null;
      send = null;
      if (transferred) {
        // A failed worker may already own the only context on the element.
        recoverCanvas2D();
        return;
      }
      let brush;
      try {
        brush = createBrush(canvas, recoverCanvas2D, staticMode.matches);
      } catch {
        // An element with a failed WebGL program needs a fresh 2D surface.
      }
      if (!brush) return recoverCanvas2D();
      send = createField(canvas, brush);
      sync();
    }

    if (scriptURL && typeof Worker === "function" && canvas.transferControlToOffscreen) {
      try {
        worker = new Worker(scriptURL);
        worker.addEventListener("error", useMainThread, { once: true });
        worker.addEventListener("message", ({ data }) => {
          if (!worker) return;
          if (data === "unavailable") useMainThread();
          if (data === "supported") {
            try {
              const offscreen = canvas.transferControlToOffscreen();
              transferred = true;
              worker.postMessage({ canvas: offscreen, timeOrigin: performance.timeOrigin, reduced: staticMode.matches }, [offscreen]);
            } catch {
              useMainThread();
            }
          }
          if (data === "ready") {
            clearTimeout(timeout);
            send = state => worker.postMessage(state);
            sync();
          }
        });
        timeout = setTimeout(useMainThread, 2000);
      } catch {
        useMainThread();
      }
    } else {
      useMainThread();
    }

    window.addEventListener("pointermove", event => {
      if (event.pointerType === "touch" || event.buttons || selecting || staticMode.matches) {
        resetPointer();
        return;
      }
      const point = { x: event.clientX, y: event.clientY, t: event.timeStamp };
      pointerActive = true;
      if (!pending.first) pending.first = point;
      else pending.last = point;
      schedule();
    }, { passive: true });
    document.documentElement.addEventListener("pointerleave", resetPointer);
    window.addEventListener("blur", resetPointer);
    window.addEventListener("resize", () => {
      measureViewport = measureText = true;
      schedule();
    });
    document.addEventListener("visibilitychange", sync);
    staticMode.addEventListener("change", sync);

    if (prose) {
      if (typeof ResizeObserver === "function") {
        new ResizeObserver(() => {
          measureText = true;
          schedule();
        }).observe(prose);
      }
      document.addEventListener("selectionchange", () => {
        const selection = document.getSelection();
        const next = !!selection?.rangeCount && !selection.isCollapsed && selection.containsNode(prose, true);
        if (next === selecting) return;
        selecting = pending.selecting = next;
        if (selecting) resetPointer();
        schedule();
      });
    }
  }

  if (typeof document === "undefined") {
    let update;
    self.addEventListener("message", ({ data }) => {
      if (update) {
        update(data);
        return;
      }
      const canvas = data.canvas;
      let brush;
      try {
        brush = createBrush(canvas, () => self.postMessage("unavailable"), data.reduced);
      } catch {
        // The page replaces a transferred canvas if its context cannot start.
      }
      if (!brush) {
        self.postMessage("unavailable");
        return;
      }
      update = createField(canvas, brush, performance.timeOrigin - data.timeOrigin);
      self.postMessage("ready");
    });
    self.postMessage(typeof requestAnimationFrame === "function" ? "supported" : "unavailable");
  } else {
    const canvas = document.querySelector(".particle-field");
    if (canvas) attach(canvas, document.currentScript?.src);
  }
})();
