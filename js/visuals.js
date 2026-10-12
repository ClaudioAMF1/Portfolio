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
      entry: surface("entry-canvas"),
    };
    const eye = { x: 0, y: 0, blink: 0 };
    const pointer = {
      x: innerWidth * 0.58,
      y: innerHeight * 0.48,
      seen: false,
    };
    const hands = Array.from({ length: 2 }, () => ({
      x: 0,
      y: 0,
      targetX: 0,
      targetY: 0,
      fingers: Array.from({ length: 5 }, () => ({
        x: 0,
        y: 0,
        targetX: 0,
        targetY: 0,
        until: -1,
      })),
    }));
    const keyPositions = new Map();
    const pressedNodes = new Map();
    const shiftedKeys = {
      "~": "`",
      "!": "1",
      "@": "2",
      "#": "3",
      $: "4",
      "%": "5",
      "^": "6",
      "&": "7",
      "*": "8",
      "(": "9",
      ")": "0",
      _: "-",
      "+": "=",
      "{": "[",
      "}": "]",
      "|": "\\",
      ":": ";",
      '"': "'",
      "<": ",",
      ">": ".",
      "?": "/",
    };
    const fingerKeys = [
      [0, 4, "esc1qaz⇧"],
      [0, 3, "2wsx"],
      [0, 2, "3edc"],
      [0, 1, "45rtfgvb"],
      [1, 1, "67yuhjnm"],
      [1, 2, "8ik,"],
      [1, 3, "9ol."],
      [1, 4, "0-=p[]\\;' /↵←"],
    ];
    let entry = null;
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
      if (surfaces.hands.width) measureKeys();
    }

    function setKey(value) {
      key = value;
      keyAt = clock;
      const base = shiftedKeys[value] || value.toLowerCase();
      const mapped = base === " " ? "space" : base === "\n" ? "↵" : base;
      const position = keyPositions.get(mapped);
      if (!position || !motion()) return;
      const assignment =
        mapped === "space"
          ? [1, 0]
          : fingerKeys.find(([, , keys]) => keys.includes(mapped));
      if (!assignment) return;
      reachKey(assignment[0], assignment[1], position);
      if (
        shiftedKeys[value] ||
        (value.length === 1 && value !== value.toLowerCase())
      ) {
        const other = 1 - assignment[0];
        const shift = keyPositions.get(other ? "shift-right" : "shift-left");
        if (shift) reachKey(other, 4, shift);
      }
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

    function drawEye(time, dt, forceOpen = false) {
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
        !forceOpen && motion() && cycle > 6110
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

    function measureKeys() {
      const layer = surfaces.hands;
      keyPositions.clear();
      const rows = [...document.querySelectorAll(".key-row")];
      rows.forEach((row, rowIndex) => {
        const nodes = [...row.querySelectorAll("span")];
        nodes.forEach((node, index) => {
          let label = node.textContent.trim();
          if (label === "⇧") label = index === 0 ? "shift-left" : "shift-right";
          const bounds = node.getBoundingClientRect();
          const fallbackX =
            layer.width * 0.06 +
            index * layer.width * 0.061 +
            rowIndex * layer.width * 0.018;
          const fallbackY = 12 + rowIndex * 19;
          keyPositions.set(label, {
            x: bounds.width
              ? bounds.left + bounds.width / 2 - layer.left
              : label === "space"
                ? layer.width / 2
                : fallbackX,
            y: bounds.height
              ? bounds.top + bounds.height / 2 - layer.top
              : fallbackY,
            node,
          });
        });
      });
    }

    function handRest(side) {
      const layer = surfaces.hands;
      const scale = clamp(layer.width / 420, 0.65, 1.15);
      const names = side ? ["j", "k", "l", ";"] : ["f", "d", "s", "a"];
      const tips = names.map((name) => keyPositions.get(name));
      if (tips.some((tip) => !tip)) return null;
      const center = tips.reduce((sum, point) => sum + point.x, 0) / 4;
      const home = tips.reduce((sum, point) => sum + point.y, 0) / 4;
      const direction = side ? -1 : 1;
      const wrist = { x: center + direction * 7 * scale, y: home + 91 * scale };
      const thumb = keyPositions.get("space");
      const points = [wrist];
      const thumbTip = {
        x: (thumb?.x || layer.width / 2) - direction * 17 * scale,
        y: (thumb?.y || home + 40) + 13 * scale,
      };
      points.push(
        { x: wrist.x + direction * 9 * scale, y: wrist.y - 22 * scale },
        { x: thumbTip.x - direction * 15 * scale, y: thumbTip.y + 22 * scale },
        { x: thumbTip.x - direction * 6 * scale, y: thumbTip.y + 9 * scale },
        thumbTip,
      );
      tips.forEach((tip, index) => {
        const knuckle = {
          x: tip.x * 0.83 + center * 0.17,
          y: home + 34 * scale - Math.abs(index - 1.3) * 2 * scale,
        };
        points.push(
          knuckle,
          {
            x: knuckle.x + (tip.x - knuckle.x) * 0.43,
            y: knuckle.y + (tip.y - knuckle.y) * 0.5,
          },
          {
            x: knuckle.x + (tip.x - knuckle.x) * 0.78,
            y: knuckle.y + (tip.y - knuckle.y) * 0.82,
          },
          { x: tip.x, y: tip.y + 3 * scale },
        );
      });
      return { points, scale };
    }

    function reachKey(side, finger, position) {
      const rest = handRest(side);
      if (!rest) return;
      const hand = hands[side];
      const tip = rest.points[4 + finger * 4];
      const dx = position.x - tip.x;
      const dy = position.y + 3 * rest.scale - tip.y;
      hand.targetX = dx * 0.22;
      hand.targetY = dy * 0.22;
      const state = hand.fingers[finger];
      state.targetX = dx;
      state.targetY = dy;
      state.until = clock + 145;
      if (position.node) {
        position.node.classList.add("key-pressed");
        pressedNodes.set(position.node, clock + 145);
      }
    }

    function drawHands(time, dt) {
      const layer = surfaces.hands;
      if (!layer.context || !layer.width || workspaceMode) return;
      const { context: ctx, width, height } = layer;
      const colors = palette();
      ctx.clearRect(0, 0, width, height);
      for (const [node, until] of pressedNodes) {
        if (time > until) {
          node.classList.remove("key-pressed");
          pressedNodes.delete(node);
        }
      }
      const bones = [
        [0, 1],
        [1, 2],
        [2, 3],
        [3, 4],
        [0, 5],
        [5, 6],
        [6, 7],
        [7, 8],
        [5, 9],
        [9, 10],
        [10, 11],
        [11, 12],
        [9, 13],
        [13, 14],
        [14, 15],
        [15, 16],
        [13, 17],
        [0, 17],
        [17, 18],
        [18, 19],
        [19, 20],
      ];
      for (let side = 0; side < 2; side++) {
        const rest = handRest(side);
        if (!rest) continue;
        const hand = hands[side];
        const gain = motion() ? 1 - Math.exp(-dt * 27) : 1;
        if (hand.fingers.every((finger) => time > finger.until + 90)) {
          hand.targetX = 0;
          hand.targetY = 0;
        }
        hand.x += (hand.targetX - hand.x) * gain;
        hand.y += (hand.targetY - hand.y) * gain;
        const points = rest.points.map((point) => ({
          x: point.x + hand.x,
          y: point.y + hand.y,
        }));
        for (let finger = 0; finger < 5; finger++) {
          const state = hand.fingers[finger];
          if (time > state.until) {
            state.targetX = hand.targetX;
            state.targetY = hand.targetY;
          }
          state.x += (state.targetX - state.x) * gain;
          state.y += (state.targetY - state.y) * gain;
          const start = 1 + finger * 4;
          for (let joint = 0; joint < 4; joint++) {
            const weight = [0.08, 0.37, 0.73, 1][joint];
            points[start + joint].x += (state.x - hand.x) * weight;
            points[start + joint].y += (state.y - hand.y) * weight;
          }
        }
        ctx.strokeStyle = colors.muted;
        ctx.fillStyle = colors.text;
        ctx.lineWidth = 0.65;
        ctx.globalAlpha = 0.57;
        ctx.beginPath();
        for (const [a, b] of bones) {
          ctx.moveTo(points[a].x, points[a].y);
          ctx.lineTo(points[b].x, points[b].y);
        }
        ctx.stroke();
        points.forEach((point, index) => {
          ctx.globalAlpha = index % 4 === 0 ? 0.9 : 0.48;
          const size = index % 4 === 0 ? 1.6 : 1.15;
          ctx.fillRect(point.x - size / 2, point.y - size / 2, size, size);
        });
        const minX = Math.min(...points.map((point) => point.x)) - 7;
        const maxX = Math.max(...points.map((point) => point.x)) + 7;
        const minY = Math.min(...points.map((point) => point.y)) - 8;
        const maxY = Math.max(...points.map((point) => point.y)) + 7;
        ctx.globalAlpha = 0.28;
        ctx.strokeRect(minX, minY, maxX - minX, maxY - minY);
        ctx.globalAlpha = 0.64;
        ctx.fillStyle = colors.muted;
        ctx.font = `${width < 350 ? 5 : 6}px monospace`;
        ctx.textAlign = side ? "right" : "left";
        ctx.fillText(
          `['hand${side}:u'] ${((layer.left + points[0].x) / innerWidth).toFixed(7)}`,
          side ? width - 2 : 2,
          Math.max(7, minY - 4),
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

    function beginEntry(time, duration = 2400) {
      const layer = surfaces.entry;
      if (!layer.context || !surfaces.eye.context) return false;
      layer.canvas.hidden = false;
      resize();
      const origin = surfaces.eye;
      drawEye(clock, 1 / 60, true);
      const pupilX = origin.width / 2 + eye.x * origin.width * 0.46 * 0.32;
      const pupilY = origin.height * 0.47 + eye.y * origin.height * 0.36 * 0.33;
      entry = {
        started: time,
        duration,
        pupilX,
        pupilY,
        x: origin.left + pupilX,
        y: origin.top + pupilY,
      };
      layer.canvas.dataset.progress = "0";
      return true;
    }

    function endEntry() {
      entry = null;
      const layer = surfaces.entry;
      if (layer.context)
        layer.context.clearRect(0, 0, layer.width, layer.height);
      if (layer.canvas) {
        layer.canvas.hidden = true;
        layer.canvas.removeAttribute("data-progress");
      }
    }

    function drawEntry(time) {
      if (!entry) return;
      const layer = surfaces.entry;
      const { context: ctx, width, height } = layer;
      if (!ctx || !width) return;
      const colors = palette();
      const elapsed = Math.max(0, time - entry.started);
      const progress = clamp(elapsed / entry.duration, 0, 1);
      const smooth = (value) => value * value * (3 - 2 * value);
      const open = smooth(clamp(progress / 0.28, 0, 1));
      const zoom = smooth(clamp((progress - 0.28) / 0.72, 0, 1));
      const centerX = entry.x + (width / 2 - entry.x) * open;
      const centerY = entry.y + (height / 2 - entry.y) * open;
      const reach = Math.hypot(width, height) * 0.65 + 100;
      const startRadius = Math.max(8, surfaces.eye.width * 0.062);
      const radius =
        startRadius * Math.exp(Math.log(reach / startRadius) * zoom);
      const scale = radius / startRadius;
      ctx.clearRect(0, 0, width, height);
      ctx.globalAlpha = 0.78 * open;
      ctx.fillStyle = colors.bg;
      ctx.fillRect(0, 0, width, height);
      ctx.globalAlpha = Math.min(1, 0.4 + open);
      ctx.drawImage(
        surfaces.eye.canvas,
        centerX - entry.pupilX * scale,
        centerY - entry.pupilY * scale,
        surfaces.eye.width * scale,
        surfaces.eye.height * scale,
      );
      if (progress > 0.23) {
        ctx.strokeStyle = colors.text;
        ctx.lineWidth = 0.7;
        const spin = elapsed * 0.00034;
        const outer = reach * 1.45;
        for (let bucket = 0; bucket < 5; bucket++) {
          ctx.globalAlpha = (bucket + 1) * 0.11 * open;
          ctx.beginPath();
          for (let particle = bucket; particle < 900; particle += 5) {
            const speed = 0.4 + noise(particle + 24);
            const phase = (noise(particle * 3) + elapsed * 0.00042 * speed) % 1;
            const distance = radius + 18 + (1 - phase) * (outer - radius);
            const angle = particle * 2.399963 + spin * speed;
            const tail = Math.min(90, 3 + phase * 22 + zoom * 42);
            const cos = Math.cos(angle),
              sin = Math.sin(angle);
            ctx.moveTo(
              centerX + cos * (distance + tail),
              centerY + sin * (distance + tail),
            );
            ctx.lineTo(centerX + cos * distance, centerY + sin * distance);
          }
          ctx.stroke();
        }
        for (const [lineWidth, alpha] of [
          [15, 0.04],
          [7, 0.08],
          [2.4, 0.43],
          [0.8, 0.96],
        ]) {
          ctx.lineWidth = lineWidth;
          ctx.globalAlpha = alpha * open;
          ctx.beginPath();
          ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
          ctx.stroke();
        }
        ctx.globalAlpha = 1;
        ctx.fillStyle = colors.bg;
        ctx.beginPath();
        ctx.arc(centerX, centerY, radius - 0.8, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
      layer.canvas.dataset.progress = progress.toFixed(3);
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
      beginEntry,
      endEntry,
      draw(time, dt, workspace, wheelPosition = 0) {
        clock = time;
        workspaceMode = workspace;
        if (entry) {
          drawEntry(performance.now());
          return;
        }
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
