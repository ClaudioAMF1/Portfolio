(() => {
  "use strict";

  const clamp = (value, low, high) => Math.max(low, Math.min(high, value));
  const noise = (seed) => {
    const value = Math.sin(seed * 91.73 + 17.42) * 42731.19;
    return value - Math.floor(value);
  };

  function create({ palette, motion }) {
    function surface(id) {
      const canvas = document.getElementById(id);
      let context = null;
      try {
        context = canvas?.getContext("2d") || null;
      } catch {
        /* Static content remains available. */
      }
      return { canvas, context, width: 0, height: 0, left: 0, top: 0 };
    }
    const surfaces = {
      eye: surface("eye-canvas"),
      hands: surface("hands-canvas"),
      branch: surface("branch-canvas"),
      mesh: surface("identity-canvas"),
      cursor: surface("cursor-canvas"),
    };
    const eye = { x: 0, y: 0, blink: 0 };
    const pointer = {
      x: innerWidth * 0.58,
      y: innerHeight * 0.48,
      seen: false,
    };
    const fingers = Array.from({ length: 2 }, () =>
      Array.from({ length: 5 }, () => ({ x: 0, y: 0 })),
    );
    const trail = [];
    let key = "";
    let keyAt = -1000;
    let clock = 0;
    let workspaceMode = false;
    let lastEyeState = "";
    let lastCoordinate = "";

    function resize() {
      const scale = Math.min(devicePixelRatio || 1, 2);
      document.body.classList.toggle(
        "hands-ready",
        Boolean(surfaces.hands.context),
      );
      document.body.classList.toggle(
        "visuals-ready",
        Boolean(surfaces.mesh.context),
      );
      for (const layer of Object.values(surfaces)) {
        if (!layer.context || !layer.canvas) continue;
        const bounds = layer.canvas.getBoundingClientRect();
        layer.left = bounds.left;
        layer.top = bounds.top;
        if (!bounds.width || !bounds.height) {
          layer.width = 0;
          continue;
        }
        if (
          layer.width === bounds.width &&
          layer.height === bounds.height &&
          layer.scale === scale
        )
          continue;
        layer.width = bounds.width;
        layer.height = bounds.height;
        layer.scale = scale;
        layer.canvas.width = Math.round(bounds.width * scale);
        layer.canvas.height = Math.round(bounds.height * scale);
        layer.context.setTransform(scale, 0, 0, scale, 0, 0);
      }
    }

    function setKey(value) {
      key = value.toLowerCase();
      keyAt = clock;
    }
    function trackPointer(event) {
      pointer.x = event.clientX;
      pointer.y = event.clientY;
      pointer.seen = true;
      if (motion()) {
        const last = trail.at(-1);
        if (!last || Math.hypot(last.x - pointer.x, last.y - pointer.y) > 7) {
          trail.push({
            x: pointer.x,
            y: pointer.y,
            born: clock,
            glyph: "·:;<>/{}[]"[trail.length % 10],
          });
          if (trail.length > 28) trail.shift();
        }
      }
    }

    function drawEye(time, dt) {
      const layer = surfaces.eye;
      if (!layer.context || !layer.width) return;
      const { context: ctx, width, height } = layer;
      const colors = palette();
      const cx = width / 2;
      const cy = height * 0.47;
      const rx = width * 0.46;
      const ry = height * 0.36;
      const targetX = pointer.seen
        ? clamp(
            (pointer.x - layer.left - cx) / Math.max(220, innerWidth * 0.42),
            -0.9,
            0.9,
          )
        : -0.27 + Math.sin(time * 0.0004) * 0.16;
      const targetY = pointer.seen
        ? clamp(
            (pointer.y - layer.top - cy) / Math.max(180, innerHeight * 0.42),
            -0.7,
            0.7,
          )
        : 0.05 + Math.cos(time * 0.0003) * 0.1;
      const smoothing = motion() ? 1 - Math.exp(-dt * 12) : 1;
      eye.x += (targetX - eye.x) * smoothing;
      eye.y += (targetY - eye.y) * smoothing;
      const cycle = (time + 1000) % 6400;
      eye.blink =
        motion() && cycle > 6110
          ? Math.sin(((cycle - 6110) / 290) * Math.PI) ** 2
          : 0;
      const open = Math.max(0.025, 1 - eye.blink);
      const pupilX = eye.x * rx * 0.32;
      const pupilY = eye.y * ry * 0.33;
      const iris = Math.min(width * 0.12, height * 0.19);
      const cellX = width > 110 ? 3.7 : 3;
      const cellY = width > 110 ? 5.7 : 4;
      const glyphs = "claudio.data_backend/{}[]:;<>01";
      ctx.clearRect(0, 0, width, height);
      ctx.font = `${width > 110 ? 5.5 : 4}px monospace`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      for (let row = 0, y = -ry; y <= ry; row++, y += cellY) {
        for (let column = 0, x = -rx; x <= rx; column++, x += cellX) {
          const lid =
            ry *
            Math.pow(Math.max(0, 1 - Math.abs(x / rx) ** 1.8), 0.63) *
            open;
          if (Math.abs(y) > lid) continue;
          const distance = Math.hypot(
            x - pupilX,
            (y - pupilY) / Math.max(0.22, open),
          );
          if (distance < iris * 0.52) continue;
          const edge = Math.abs(distance - iris);
          const outline = edge < cellX * 0.7;
          const light = Math.max(0, 1 - Math.hypot(x / rx, y / ry));
          ctx.globalAlpha = outline
            ? 0.88
            : distance < iris * 1.4
              ? 0.34
              : 0.08 + light * 0.12;
          ctx.fillStyle = outline ? colors.text : colors.muted;
          const offset = Math.floor(time / 240) + row * 7 + column * 3;
          ctx.fillText(
            glyphs[((offset % glyphs.length) + glyphs.length) % glyphs.length],
            cx + x,
            cy + y,
          );
        }
      }
      ctx.globalAlpha = 0.65;
      ctx.strokeStyle = colors.text;
      ctx.lineWidth = 0.6;
      if (open > 0.2) {
        ctx.beginPath();
        ctx.ellipse(
          cx + pupilX,
          cy + pupilY,
          iris * 0.55,
          iris * 0.55 * open,
          0,
          0,
          Math.PI * 2,
        );
        ctx.stroke();
      } else {
        ctx.beginPath();
        ctx.moveTo(cx - rx * 0.8, cy);
        ctx.lineTo(cx + rx * 0.8, cy);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
      const coordinate = `['pupil:u'] ${((eye.x + 1) / 2).toFixed(6)}\n${((eye.y + 1) / 2).toFixed(6)}`;
      if (coordinate !== lastCoordinate) {
        document.getElementById("eye-coordinate").textContent = coordinate;
        lastCoordinate = coordinate;
      }
      const state = !motion()
        ? "still"
        : eye.blink > 0.4
          ? "blink"
          : "tracking";
      if (state !== lastEyeState) {
        document.getElementById("eye-state").textContent = state;
        lastEyeState = state;
      }
    }

    function drawHands(time, dt) {
      const layer = surfaces.hands;
      if (!layer.context || !layer.width || workspaceMode) return;
      const { context: ctx, width, height } = layer;
      const colors = palette();
      ctx.clearRect(0, 0, width, height);
      ctx.strokeStyle = colors.muted;
      ctx.fillStyle = colors.text;
      ctx.lineWidth = 0.65;
      const leftKeys = ["qaz1", "wsx2", "edc3", "rfvtgb45", " "];
      const rightKeys = ["p0[];'", "ol9", "ik8", "yhnujm67", " "];
      const pressed = motion() && time - keyAt < 155;
      for (let side = 0; side < 2; side++) {
        const center = width * (side ? 0.71 : 0.29);
        const flip = side ? -1 : 1;
        const spread = width * 0.22;
        const wrist = { x: center + flip * spread * 0.04, y: height * 0.88 };
        const targets = side ? rightKeys : leftKeys;
        const active = targets.findIndex(
          (group) => group.includes(key) && key.length === 1,
        );
        const points = [];
        for (let finger = 0; finger < 5; finger++) {
          const restX =
            center +
            flip * spread * (finger === 4 ? 0.56 : (finger - 1.6) * 0.24);
          const restY =
            height *
            (finger === 4 ? 0.43 : 0.11 + Math.abs(finger - 1.8) * 0.055);
          const target =
            pressed && finger === active
              ? {
                  x:
                    flip *
                    (finger === 4 ? 4 : ((key.charCodeAt(0) % 5) - 2) * 2.2),
                  y: -11 - (key.charCodeAt(0) % 3) * 3,
                }
              : { x: 0, y: 0 };
          const joint = fingers[side][finger];
          const gain = motion() ? 1 - Math.exp(-dt * 22) : 1;
          joint.x += (target.x - joint.x) * gain;
          joint.y += (target.y - joint.y) * gain;
          const tip = { x: restX + joint.x, y: restY + joint.y };
          const knuckle = {
            x: center + (restX - center) * 0.63,
            y: height * 0.43,
          };
          const middle = {
            x: knuckle.x + (tip.x - knuckle.x) * 0.63,
            y: knuckle.y + (tip.y - knuckle.y) * 0.56,
          };
          points.push(tip, middle, knuckle);
          ctx.globalAlpha = finger === active && pressed ? 0.9 : 0.42;
          ctx.beginPath();
          ctx.moveTo(wrist.x, wrist.y);
          ctx.lineTo(knuckle.x, knuckle.y);
          ctx.lineTo(middle.x, middle.y);
          ctx.lineTo(tip.x, tip.y);
          ctx.stroke();
          for (const point of [tip, middle, knuckle])
            ctx.fillRect(point.x - 0.75, point.y - 0.75, 1.5, 1.5);
        }
        ctx.globalAlpha = 0.27;
        ctx.strokeRect(center - spread * 0.57, 0, spread * 1.17, height * 0.94);
        ctx.beginPath();
        points
          .filter((_, index) => index % 3 === 2)
          .forEach((point, index) =>
            index ? ctx.lineTo(point.x, point.y) : ctx.moveTo(point.x, point.y),
          );
        ctx.stroke();
        ctx.globalAlpha = 0.65;
        ctx.fillStyle = colors.muted;
        ctx.font = "6px monospace";
        ctx.textAlign = "center";
        ctx.fillText(
          `['hand:${side}'] ${(center / width).toFixed(4)}`,
          center,
          height - 1,
        );
      }
      ctx.globalAlpha = 1;
    }

    function drawBranch(time, wheelPosition) {
      const layer = surfaces.branch;
      if (!layer.context || !layer.width || innerWidth <= 650 || !workspaceMode)
        return;
      const { context: ctx, width, height } = layer;
      const colors = palette();
      ctx.clearRect(0, 0, width, height);
      ctx.strokeStyle = colors.text;
      ctx.fillStyle = colors.text;
      ctx.lineWidth = 0.7;
      const roots = [];
      for (let index = 0; index < 70; index++) {
        const y = 18 + ((height - 43) * index) / 69;
        const sway =
          Math.sin(index * 0.12 + time * 0.00038 + wheelPosition * 0.28) * 15;
        roots.push({
          x: 75 + sway + Math.sin(index * 0.39 + wheelPosition * 0.2) * 4,
          y,
        });
      }
      ctx.globalAlpha = 0.67;
      ctx.beginPath();
      roots.forEach((point, index) =>
        index ? ctx.lineTo(point.x, point.y) : ctx.moveTo(point.x, point.y),
      );
      ctx.stroke();
      roots.forEach((root, index) => {
        const cluster = (Math.sin(index * 0.29 - wheelPosition * 0.21) + 1) / 2;
        if (cluster < 0.54 || index % 2) return;
        const count = 7 + Math.floor(cluster * 12);
        for (let ray = 0; ray < count; ray++) {
          const phase = noise(index * 51 + ray);
          const direction = phase > 0.38 ? -1 : 1;
          const length = 12 + noise(index * 7 + ray + 90) * 68 * cluster;
          const endX = root.x + length * direction;
          const endY = root.y + (noise(index * 61 + ray + 21) - 0.5) * 75;
          const bendX = root.x + direction * length * 0.3;
          const bendY =
            root.y +
            (endY - root.y) * 0.32 +
            Math.sin(time * 0.00055 + ray) * 1.4;
          ctx.globalAlpha = 0.15 + noise(ray * 11 + index) * 0.35;
          ctx.beginPath();
          ctx.moveTo(root.x, root.y);
          ctx.lineTo(bendX, bendY);
          ctx.lineTo(endX, endY);
          ctx.stroke();
          ctx.globalAlpha = 0.65;
          ctx.fillRect(endX, endY, 1.1, 1.1);
          if (ray % 3 === 0) {
            ctx.globalAlpha = 0.18;
            ctx.beginPath();
            ctx.moveTo(endX, endY);
            ctx.lineTo(root.x + direction * length * 0.68, endY - 15);
            ctx.stroke();
          }
        }
        ctx.globalAlpha = 0.74;
        ctx.fillRect(root.x - 1, root.y - 1, 2, 2);
      });
      ctx.globalAlpha = 1;
    }

    function drawMesh(time) {
      const layer = surfaces.mesh;
      if (
        !layer.context ||
        !layer.width ||
        !workspaceMode ||
        document.getElementById("about").hidden
      )
        return;
      const { context: ctx, width, height } = layer;
      const colors = palette();
      ctx.clearRect(0, 0, width, height);
      ctx.lineWidth = 0.55;
      ctx.strokeStyle = colors.accent;
      for (let row = 0; row < 15; row++) {
        ctx.globalAlpha = 0.16 + row / 38;
        ctx.beginPath();
        for (let column = 0; column < 62; column++) {
          const u = column / 61;
          const x = 12 + u * (width - 24);
          const wave =
            Math.exp(
              -(((u - 0.31 - Math.sin(time * 0.00016) * 0.09) * 7) ** 2),
            ) *
              Math.sin(row * 0.24 + time * 0.00035) *
              27 +
            Math.exp(-(((u - 0.68) * 9) ** 2)) * 16;
          const y =
            height * 0.27 +
            row * 4.3 -
            wave * (1 - row / 25) +
            Math.sin(u * 16 + row * 0.35 + time * 0.00025) * 2;
          column ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
        }
        ctx.stroke();
      }
      ctx.globalAlpha = 0.4;
      ctx.strokeStyle = colors.dim;
      ctx.beginPath();
      ctx.moveTo(12, height - 21);
      ctx.lineTo(width - 12, height - 21);
      ctx.stroke();
      ctx.font = "7px monospace";
      ctx.fillStyle = colors.muted;
      ctx.textAlign = "left";
      ctx.fillText("CM / código em movimento", 12, height - 8);
      ctx.textAlign = "right";
      ctx.fillText("data → code → ideas", width - 12, height - 8);
      ctx.globalAlpha = 1;
    }

    function drawCursor(time) {
      const layer = surfaces.cursor;
      if (!layer.context || !layer.width) return;
      const { context: ctx, width, height } = layer;
      ctx.clearRect(0, 0, width, height);
      if (!motion()) {
        trail.length = 0;
        return;
      }
      const colors = palette();
      while (trail.length && time - trail[0].born > 650) trail.shift();
      ctx.fillStyle = colors.accent;
      ctx.font = "8px monospace";
      ctx.textAlign = "center";
      for (const point of trail) {
        const age = (time - point.born) / 650;
        ctx.globalAlpha = (1 - age) * 0.32;
        ctx.fillText(point.glyph, point.x, point.y + age * 9);
      }
      ctx.globalAlpha = 1;
    }

    return {
      resize,
      setKey,
      trackPointer,
      draw(time, dt, workspace, wheelPosition = 0) {
        clock = time;
        workspaceMode = workspace;
        drawEye(time, dt);
        drawHands(time, dt);
        drawBranch(time, wheelPosition);
        drawMesh(time);
        drawCursor(time);
      },
    };
  }
  window.PortfolioVisuals = { create };
})();
