(() => {
  "use strict";

  const clamp = (value, low, high) => Math.max(low, Math.min(high, value));
  const noise = (seed) => {
    const value = Math.sin(seed * 91.73 + 17.42) * 42731.19;
    return value - Math.floor(value);
  };

  function create({ palette, motion, focus = () => null }) {
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
    const eye = { x: 0, y: 0, blink: 0, px: 0, py: 0, open: 1, state: "" };
    const pointer = {
      x: innerWidth * 0.58,
      y: innerHeight * 0.48,
      seen: false,
      at: -1e9,
      dx: 0,
      dy: 0,
    };
    // Where the eye is looking, in screen coordinates.
    const sight = { x: innerWidth * 0.5, y: innerHeight * 0.4, ready: false };
    const mouse = { x: 0, y: 0, ox: 0, oy: 0, ready: false };
    let eyeText = "claudio meireles backend data ai ";
    let focusKey = null;
    let lastKeyLabel = "None";
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
      if (assignment[0] === 1 && mouseActive()) return;
      reachKey(assignment[0], assignment[1], position);
      focusKey = { node: position.node, until: performance.now() + 700 };
      lastKeyLabel = mapped;
      if (
        shiftedKeys[value] ||
        (value.length === 1 && value !== value.toLowerCase())
      ) {
        const other = 1 - assignment[0];
        const shift = keyPositions.get(other ? "shift-right" : "shift-left");
        if (shift) reachKey(other, 4, shift);
      }
    }
    function mouseActive() {
      return performance.now() - pointer.at < 1400;
    }
    function trackPointer(event) {
      if (pointer.seen) {
        pointer.dx = event.clientX - pointer.x;
        pointer.dy = event.clientY - pointer.y;
        mouse.ox = clamp(mouse.ox + pointer.dx * 0.05, -16, 16);
        mouse.oy = clamp(mouse.oy + pointer.dy * 0.05, -10, 10);
      }
      pointer.x = event.clientX;
      pointer.y = event.clientY;
      pointer.seen = true;
      pointer.at = performance.now();
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

    function setEyeText(text) {
      const clean = String(text || "").replace(/\s+/g, " ").trim();
      eyeText = (clean || "claudio meireles") + "  ";
    }

    function eyeGeometry(layer) {
      const { width: W, height: H } = layer;
      const cx = W * 0.42;
      const cy = H * 0.6;
      const rx = W * 0.4;
      const ry = H * 0.33;
      return { cx, cy, rx, ry, iris: ry * 0.66 };
    }

    // Decide what the eye looks at: the visitor's mouse while it moves,
    // otherwise whatever the page is "doing" (caret, pressed key, card).
    function updateSight(dt) {
      const now = performance.now();
      let target = null;
      let state = "focused";
      if (pointer.seen && now - pointer.at < 2200) {
        target = { x: pointer.x, y: pointer.y };
        state = "tracking";
      } else if (focusKey && now < focusKey.until && focusKey.node) {
        const r = focusKey.node.getBoundingClientRect();
        if (r.width) target = { x: r.left + r.width / 2, y: r.top + r.height / 2 };
      }
      if (!target) target = focus();
      if (!target) {
        target = {
          x: innerWidth * (0.45 + Math.sin(clock * 0.0004) * 0.2),
          y: innerHeight * (0.45 + Math.cos(clock * 0.0003) * 0.15),
        };
        state = "idle";
      }
      const gain = motion() && sight.ready ? 1 - Math.exp(-dt * 9) : 1;
      sight.x += (target.x - sight.x) * gain;
      sight.y += (target.y - sight.y) * gain;
      sight.ready = true;
      return state;
    }

    function drawEye(time, dt, forceOpen = false) {
      const layer = surfaces.eye;
      if (!layer.context || !layer.width) return;
      const { context: ctx, width, height } = layer;
      const colors = palette();
      const { cx, cy, rx, ry, iris } = eyeGeometry(layer);
      let state = updateSight(dt);
      const gx = clamp((sight.x - layer.left - cx) / Math.max(240, innerWidth * 0.36), -1, 1);
      const gy = clamp((sight.y - layer.top - cy) / Math.max(200, innerHeight * 0.4), -1, 1);
      const smoothing = motion() ? 1 - Math.exp(-dt * 14) : 1;
      eye.x += (gx - eye.x) * smoothing;
      eye.y += (gy - eye.y) * smoothing;
      const cycle = (time + 1000) % 6400;
      eye.blink =
        !forceOpen && motion() && cycle > 6110
          ? Math.sin(((cycle - 6110) / 290) * Math.PI) ** 2
          : 0;
      if (eye.blink > 0.4) state = "blink";
      if (!motion()) state = "still";
      const open = Math.max(0.03, 1 - eye.blink);
      eye.open = open;
      const px = cx + eye.x * rx * 0.5;
      const py = cy + eye.y * ry * 0.42;
      eye.px = px;
      eye.py = py;
      const box = iris * 0.42;

      const fs = clamp(width / 44, 4.4, 7);
      const cellX = fs * 0.62;
      const cellY = fs * 1.2;
      const cols = Math.ceil((rx * 2) / cellX) + 1;
      const length = eyeText.length;
      const drift = motion() ? Math.floor(time / 170) : 0;
      const faint = [];
      const bright = [];
      const bold = [];
      for (let row = 0, y = -ry; y <= ry; row++, y += cellY) {
        for (let column = 0, x = -rx; x <= rx; column++, x += cellX) {
          const lid =
            ry * Math.pow(Math.max(0, 1 - Math.abs(x / rx) ** 2), 0.62) * open;
          if (Math.abs(y) > lid) continue;
          const ch = eyeText[(row * cols + column + drift) % length];
          if (ch === " ") continue;
          const sx = cx + x;
          const sy = cy + y;
          const dx = sx - px;
          const dy = (sy - py) / Math.max(0.2, open);
          const distance = Math.hypot(dx, dy);
          if (distance < box * 1.15) continue;
          if (distance < iris) {
            const ring = distance > iris * 0.78;
            (ring ? bold : bright).push(
              ch,
              sx,
              sy,
              ring ? 0.95 : 0.62 + (1 - distance / iris) * 0.3,
            );
          } else {
            const edge = Math.abs(y) / Math.max(1, lid);
            faint.push(
              ch,
              sx,
              sy,
              Math.max(0.16, 0.56 - (distance / rx) * 0.3 - edge * 0.16),
            );
          }
        }
      }
      ctx.clearRect(0, 0, width, height);
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      const paint = (list, font, color) => {
        ctx.font = font;
        ctx.fillStyle = color;
        for (let i = 0; i < list.length; i += 4) {
          ctx.globalAlpha = list[i + 3];
          ctx.fillText(list[i], list[i + 1], list[i + 2]);
        }
      };
      paint(faint, `${fs}px monospace`, colors.muted);
      paint(bright, `${fs}px monospace`, colors.text);
      paint(bold, `bold ${fs}px monospace`, colors.text);

      ctx.strokeStyle = colors.text;
      ctx.lineWidth = 0.8;
      if (open > 0.25) {
        ctx.globalAlpha = 0.85;
        ctx.beginPath();
        ctx.ellipse(px, py, box * 1.05, box * 1.05 * open, 0, 0, Math.PI * 2);
        ctx.stroke();
        // Catch-light: a tiny square glint inside the pupil.
        ctx.globalAlpha = 0.7;
        ctx.strokeRect(px - box * 0.5, py - box * 0.55 * open, box * 0.3, box * 0.3 * open);
      }

      // Telemetry label, tied to the eye by a leader line.
      const labelSize = clamp(width / 36, 5, 8);
      ctx.font = `${labelSize}px monospace`;
      const labelWidth = ctx.measureText("['pupil:u'] 0.0000000").width;
      const lx = Math.min(width * 0.66, width - labelWidth - 2);
      const ly = labelSize * 1.2;
      const distance = Math.hypot(sight.x - layer.left - px, sight.y - layer.top - py);
      const lines = [
        `['pupil:u'] ${((eye.x + 1) / 2).toFixed(7)}`,
        ((eye.y + 1) / 2).toFixed(7),
        (distance / Math.hypot(innerWidth, innerHeight)).toFixed(10),
        lastKeyLabel,
      ];
      ctx.globalAlpha = 0.55;
      ctx.lineWidth = 0.6;
      ctx.beginPath();
      ctx.moveTo(cx + rx * 0.5, cy - ry * 0.62);
      ctx.lineTo(lx - 3, ly + labelSize * 4.2);
      ctx.lineTo(lx - 3, ly - labelSize * 0.4);
      ctx.stroke();
      ctx.globalAlpha = 0.85;
      ctx.fillStyle = colors.text;
      ctx.font = `${labelSize}px monospace`;
      ctx.textAlign = "left";
      ctx.textBaseline = "top";
      lines.forEach((line, index) =>
        ctx.fillText(line, lx, ly - labelSize * 0.5 + index * labelSize * 1.25),
      );
      ctx.globalAlpha = 1;
      if (state !== eye.state) {
        eye.state = state;
        const label = document.getElementById("eye-state");
        if (label) label.textContent = state;
      }
    }

    // The eye's line of sight: dashed ray from the pupil to a small reticle.
    function drawSight(ctx, colors) {
      const layer = surfaces.eye;
      if (!layer.width || eye.open < 0.25 || !sight.ready) return;
      const fromX = layer.left + eye.px;
      const fromY = layer.top + eye.py;
      const toX = sight.x;
      const toY = sight.y;
      const length = Math.hypot(toX - fromX, toY - fromY);
      if (length < 40) return;
      ctx.save();
      ctx.strokeStyle = colors.text;
      ctx.lineWidth = 0.7;
      ctx.globalAlpha = 0.42;
      ctx.setLineDash([3, 4]);
      ctx.lineDashOffset = -clock * 0.02;
      ctx.beginPath();
      ctx.moveTo(fromX, fromY);
      ctx.lineTo(toX, toY);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.globalAlpha = 0.75;
      ctx.strokeRect(Math.round(toX - 12) + 0.5, Math.round(toY - 8) + 0.5, 24, 16);
      ctx.restore();
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
          keyPositions.set(label === "space" ? "space" : label, {
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
      let right = 0;
      let homeY = 0;
      for (const [label, position] of keyPositions) {
        right = Math.max(right, position.x);
        if (label === "j") homeY = position.y;
      }
      mouse.x = right + 52;
      mouse.y = homeY + 30;
      mouse.ready = right > 0;
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
      if (!layer.context || !layer.width) return;
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
      const onMouse = mouseActive() && mouse.ready;
      if (!onMouse) {
        mouse.ox *= 0.92;
        mouse.oy *= 0.92;
      }
      const mouseX = mouse.x + mouse.ox;
      const mouseY = mouse.y + mouse.oy;
      if (mouse.ready) {
        ctx.strokeStyle = colors.muted;
        ctx.lineWidth = 0.7;
        ctx.globalAlpha = 0.6;
        ctx.beginPath();
        ctx.roundRect
          ? ctx.roundRect(mouseX - 11, mouseY - 12, 22, 34, 11)
          : ctx.rect(mouseX - 11, mouseY - 12, 22, 34);
        ctx.moveTo(mouseX, mouseY - 12);
        ctx.lineTo(mouseX, mouseY - 1);
        ctx.stroke();
        ctx.strokeRect(mouseX - 1.5, mouseY - 9, 3, 5);
        if (onMouse) {
          ctx.fillStyle = colors.muted;
          ctx.globalAlpha = 0.64;
          ctx.font = `${width < 350 ? 5 : 6}px monospace`;
          ctx.textAlign = "left";
          ctx.fillText(
            `['mouse:u'] ${(pointer.x / innerWidth).toFixed(7)}`,
            mouseX + 16,
            mouseY - 4,
          );
          ctx.fillText((pointer.y / innerHeight).toFixed(7), mouseX + 16, mouseY + 4);
        }
      }
      for (let side = 0; side < 2; side++) {
        const rest = handRest(side);
        if (!rest) continue;
        const hand = hands[side];
        const gain = motion() ? 1 - Math.exp(-dt * (side && onMouse ? 10 : 27)) : 1;
        if (side && onMouse) {
          const tips = [8, 12, 16, 20].map((index) => rest.points[index]);
          const tipX = tips.reduce((sum, point) => sum + point.x, 0) / 4;
          const tipY = tips.reduce((sum, point) => sum + point.y, 0) / 4;
          hand.targetX = mouseX - tipX;
          hand.targetY = mouseY - 12 - tipY;
        } else if (hand.fingers.every((finger) => time > finger.until + 90)) {
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
      ctx.lineCap = "round";
      const roots = [];
      for (let index = 0; index < 70; index++) {
        const y = 18 + ((height - 43) * index) / 69;
        const sway =
          Math.sin(index * 0.12 + time * 0.00038 + wheelPosition * 0.28) * 13;
        roots.push({
          x: 82 + sway + Math.sin(index * 0.39 + wheelPosition * 0.2) * 4,
          y,
        });
      }
      // Trunk: thicker in the middle, tapering at both ends.
      for (let index = 1; index < roots.length; index++) {
        const t = index / roots.length;
        ctx.globalAlpha = 0.8;
        ctx.lineWidth = 0.8 + Math.sin(t * Math.PI) * 2.2;
        ctx.beginPath();
        ctx.moveTo(roots[index - 1].x, roots[index - 1].y);
        ctx.lineTo(roots[index].x, roots[index].y);
        ctx.stroke();
      }
      roots.forEach((root, index) => {
        const cluster = (Math.sin(index * 0.29 - wheelPosition * 0.21) + 1) / 2;
        if (cluster < 0.55 || index % 2) return;
        const count = 9 + Math.floor(cluster * 16);
        for (let ray = 0; ray < count; ray++) {
          const seed = index * 51 + ray;
          const direction = noise(seed) > 0.32 ? -1 : 1;
          const length = 8 + noise(seed + 90) ** 1.6 * 78 * cluster;
          const angle =
            (noise(seed + 21) - 0.5) * 1.5 + Math.sin(time * 0.0006 + ray) * 0.04;
          const endX = root.x + Math.cos(angle) * length * direction;
          const endY = root.y + Math.sin(angle) * length;
          const midX = root.x + (endX - root.x) * 0.45;
          const midY = root.y + (endY - root.y) * 0.45 - 2;
          ctx.globalAlpha = 0.35 + noise(seed + 7) * 0.5;
          ctx.lineWidth = 1.7;
          ctx.beginPath();
          ctx.moveTo(root.x, root.y);
          ctx.lineTo(midX, midY);
          ctx.stroke();
          ctx.lineWidth = 0.6;
          ctx.beginPath();
          ctx.moveTo(midX, midY);
          ctx.lineTo(endX, endY);
          ctx.stroke();
          if (noise(seed + 3) > 0.45) {
            ctx.globalAlpha = 0.85;
            ctx.beginPath();
            ctx.arc(endX, endY, 0.6 + noise(seed + 5) * 1.6, 0, Math.PI * 2);
            ctx.fill();
          }
        }
        // Ink blot where the cluster leaves the stem.
        ctx.globalAlpha = 0.9;
        ctx.beginPath();
        for (let step = 0; step <= 12; step++) {
          const a = (step / 12) * Math.PI * 2;
          const r = 2.5 + cluster * 4 + noise(index * 13 + step) * 3;
          const x = root.x + Math.cos(a) * r;
          const y = root.y + Math.sin(a) * r * 0.8;
          step ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
        }
        ctx.fill();
      });
      ctx.globalAlpha = 1;
    }

    // Contribution "terrain": one ridge per week, one bump per day.
    let contributions = null;
    let contributionsShownAt = -1;
    function setContributions(data) {
      if (!data || !data.days) return;
      const from = new Date(data.from + "T12:00:00");
      const to = new Date(data.to + "T12:00:00");
      // Align rows to Mondays so each ridge is a real calendar week.
      const first = new Date(from);
      first.setDate(first.getDate() - ((first.getDay() + 6) % 7));
      const weeks = [];
      let total = 0;
      let activeDays = 0;
      let best = { date: "", count: 0 };
      let streak = 0;
      let bestStreak = 0;
      for (let day = new Date(first); day <= to; day.setDate(day.getDate() + 1)) {
        const key = day.toISOString().slice(0, 10);
        const count = day < from ? 0 : data.days[key] || 0;
        const index = Math.floor((day - first) / 864e5 / 7);
        (weeks[index] ||= { start: new Date(day), days: [] }).days.push(count);
        total += count;
        if (count) activeDays++;
        streak = count ? streak + 1 : 0;
        bestStreak = Math.max(bestStreak, streak);
        if (count > best.count) best = { date: key, count };
      }
      let peakWeek = 0;
      weeks.forEach((week, index) => {
        week.total = week.days.reduce((sum, value) => sum + value, 0);
        if (week.total > weeks[peakWeek].total) peakWeek = index;
      });
      contributions = {
        weeks,
        total,
        activeDays,
        best,
        bestStreak,
        peakWeek,
        max: Math.max(1, ...weeks.flatMap((week) => week.days)),
        label: data.label || "commits",
        allTime: data.allTime,
        source: data.source,
        from,
        to,
      };
      contributionsShownAt = -1;
      whoamiShownAt = -1;
    }

    // ---------- whoami: "CM grown toward N points" ----------
    // 1) A ridgeline terrain rises in the shape of the letters.
    // 2) The section A–A follows the pointer and lights the ridges it cuts.
    // 3) A tree grows from the root by space colonization toward one point
    //    per commit scattered inside the letters; the terrain fades as it fills.
    let growth = null;
    const seeded = (seed) => () => {
      seed = (seed * 16807) % 2147483647;
      return (seed - 1) / 2147483646;
    };

    function buildGrowth(w, h, pointsWanted) {
      const key = `${Math.round(w)}x${Math.round(h)}x${pointsWanted}`;
      if (growth && growth.key === key) return growth;
      const off = document.createElement("canvas");
      off.width = Math.max(1, Math.round(w));
      off.height = Math.max(1, Math.round(h));
      const octx = off.getContext("2d");
      octx.fillStyle = "#fff";
      octx.textAlign = "center";
      octx.textBaseline = "middle";
      const size = Math.round(Math.min(h * 0.86, w * 0.6));
      octx.font = `bold ${size}px monospace`;
      octx.fillText("CM", off.width * 0.55, off.height * 0.42);
      // Heavier strokes, closer to a logo than to a typeface.
      octx.strokeStyle = "#fff";
      octx.lineWidth = size * 0.075;
      octx.lineJoin = "round";
      octx.strokeText("CM", off.width * 0.55, off.height * 0.42);
      const pixels = octx.getImageData(0, 0, off.width, off.height).data;
      const cols = off.width;
      const rows = off.height;
      const mask = new Float32Array(cols * rows);
      const inside = [];
      let minX = cols, maxX = 0, maxY = 0;
      for (let i = 0; i < mask.length; i++) {
        mask[i] = pixels[i * 4 + 3] / 255;
        if (mask[i] > 0.6) {
          inside.push(i);
          const x = i % cols;
          minX = Math.min(minX, x);
          maxX = Math.max(maxX, x);
          maxY = Math.max(maxY, Math.floor(i / cols));
        }
      }
      // Attraction points: one per commit, inside the letters.
      const random = seeded(4242);
      const points = [];
      for (let n = 0; n < pointsWanted && inside.length; n++) {
        const i = inside[Math.floor(random() * inside.length)];
        points.push({ x: i % cols + random() - 0.5, y: Math.floor(i / cols) + random() - 0.5, node: -1, dist: Infinity, reachedAt: -1 });
      }
      // Space colonization.
      const step = Math.max(2.4, w / 160);
      const influence = step * 8;
      const kill = step * 1.6;
      const nodes = [{ x: minX + (maxX - minX) * 0.06, y: rows - 2, parent: -1, depth: 0, iter: 0 }];
      // Spatial hash so two branches never sprout on top of each other.
      const cell = step * 0.7;
      const grid = new Map();
      const cellKey = (x, y) => `${Math.floor(x / cell)},${Math.floor(y / cell)}`;
      const occupied = (x, y) => {
        const cx = Math.floor(x / cell);
        const cy = Math.floor(y / cell);
        for (let i = -1; i <= 1; i++)
          for (let j = -1; j <= 1; j++)
            for (const n of grid.get(`${cx + i},${cy + j}`) || [])
              if (Math.hypot(n.x - x, n.y - y) < step * 0.55) return true;
        return false;
      };
      const addNode = (node) => {
        if (occupied(node.x, node.y)) return false;
        nodes.push(node);
        const k = cellKey(node.x, node.y);
        if (!grid.has(k)) grid.set(k, []);
        grid.get(k).push(node);
        return true;
      };
      grid.set(cellKey(nodes[0].x, nodes[0].y), [nodes[0]]);
      let trunk = 0;
      let reachedSoFar = 0;
      let stale = 0;
      const assign = (from) => {
        for (const point of points) {
          if (point.reachedAt >= 0) continue;
          for (let j = from; j < nodes.length; j++) {
            const d = Math.hypot(nodes[j].x - point.x, nodes[j].y - point.y);
            if (d < point.dist) {
              point.dist = d;
              point.node = j;
            }
          }
        }
      };
      assign(0);
      let iter = 0;
      let idle = 0;
      while (iter < 1200 && idle < 30 && stale < 40) {
        iter++;
        const pull = new Map();
        let open = 0;
        for (const point of points) {
          if (point.reachedAt >= 0) continue;
          open++;
          if (point.dist > influence) continue;
          const node = nodes[point.node];
          const v = pull.get(point.node) || { x: 0, y: 0 };
          v.x += (point.x - node.x) / point.dist;
          v.y += (point.y - node.y) / point.dist;
          pull.set(point.node, v);
        }
        if (!open) break;
        const before = nodes.length;
        if (!pull.size) {
          // Nothing in reach yet: the trunk climbs straight up from the root.
          const node = nodes[trunk];
          const sway = Math.sin(iter * 0.35) * 0.08;
          if (addNode({ x: node.x + sway * step, y: node.y - step, parent: trunk, depth: node.depth + 1, iter }))
            trunk = nodes.length - 1;
        } else {
          for (const [index, v] of pull) {
            const length = Math.hypot(v.x, v.y);
            if (length < 0.15) continue;
            const node = nodes[index];
            const jitter = (random() - 0.5) * 0.3;
            const dx = v.x / length + jitter;
            const dy = v.y / length - jitter * 0.5;
            const norm = Math.hypot(dx, dy) || 1;
            addNode({ x: node.x + (dx / norm) * step, y: node.y + (dy / norm) * step, parent: index, depth: node.depth + 1, iter });
          }
        }
        assign(before);
        let reachedNow = 0;
        for (const point of points) {
          if (point.reachedAt < 0 && point.dist < kill) point.reachedAt = iter;
          if (point.reachedAt >= 0) reachedNow++;
        }
        stale = reachedNow > reachedSoFar || !pull.size ? 0 : stale + 1;
        reachedSoFar = reachedNow;
        idle = nodes.length === before ? idle + 1 : 0;
      }
      const reachedIters = points.map((p) => p.reachedAt).filter((v) => v >= 0).sort((x, y) => x - y);
      growth = { key, cols, rows, mask, nodes, points, reachedIters, iterations: iter, step };
      return growth;
    }
    function maskValue(g, x, y) {
      const col = Math.min(g.cols - 1, Math.max(0, Math.round(x)));
      const row = Math.min(g.rows - 1, Math.max(0, Math.round(y)));
      return g.mask[row * g.cols + col];
    }

    function drawWalkers(ctx, colors, x, y, w, h, time) {
      ctx.strokeStyle = colors.text;
      ctx.lineWidth = 0.8;
      const people = [1, 0.62];
      people.forEach((size, i) => {
        const span = w * 0.45;
        const px = x + 10 + ((time * 0.012 + i * 14) % span) + i * 12;
        const body = h * 0.62 * size;
        const base = y + h - 3;
        const swing = Math.sin(time * 0.011 + i * 1.7) * 3.2 * size;
        ctx.globalAlpha = 0.9;
        ctx.beginPath();
        ctx.arc(px, base - body - 2.6 * size, 2.4 * size, 0, Math.PI * 2);
        ctx.moveTo(px, base - body);
        ctx.lineTo(px, base - body * 0.42);
        ctx.lineTo(px - swing, base);
        ctx.moveTo(px, base - body * 0.42);
        ctx.lineTo(px + swing, base);
        ctx.moveTo(px - 3.5 * size, base - body * 0.72 + swing * 0.2);
        ctx.lineTo(px, base - body * 0.85);
        ctx.lineTo(px + 3.5 * size, base - body * 0.72 - swing * 0.2);
        ctx.stroke();
      });
    }

    let whoamiShownAt = -1;
    function setContributionsShown() {
      whoamiShownAt = -1;
    }
    const fmt = (n) => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, "'");

    function drawMesh(time) {
      const layer = surfaces.mesh;
      if (
        !layer.context ||
        !layer.width ||
        !workspaceMode ||
        !contributions ||
        document.getElementById("about").hidden
      ) {
        whoamiShownAt = -1;
        return;
      }
      const { context: ctx, width, height } = layer;
      const bounds = layer.canvas.getBoundingClientRect();
      layer.left = bounds.left;
      layer.top = bounds.top;
      const colors = palette();
      const data = contributions;
      if (whoamiShownAt < 0) whoamiShownAt = time;
      const elapsed = motion() ? time - whoamiShownAt : 1e9;
      const pointsTotal = data.allTime?.points || data.total;
      const plotW = width * 0.6;
      const left = 14;
      const right = plotW - 6;
      const top = 46;
      const bottom = height - 20;
      const g = buildGrowth(right - left, bottom - top, pointsTotal);

      // Timeline: terrain rises (0–1.6 s), tree grows (1.6–6 s).
      const rise = Math.min(1, elapsed / 1600);
      const riseEase = 1 - (1 - rise) ** 3;
      const growT = clamp((elapsed - 1600) / 4400, 0, 1);
      const iterNow = growT * g.iterations;
      let reached = 0;
      while (reached < g.reachedIters.length && g.reachedIters[reached] <= iterNow) reached++;
      const fill = reached / Math.max(1, g.points.length);

      // Section A–A: follows the pointer over the plot, else rests mid-letters.
      const px = pointer.x - layer.left;
      const py = pointer.y - layer.top;
      const atPointer =
        pointer.seen && performance.now() - pointer.at < 4000 &&
        px > left && px < right && py > top && py < bottom;
      const restY = top + (bottom - top) * 0.42;
      eye.sectionY = eye.sectionY ?? restY;
      eye.sectionY += ((atPointer ? py : restY) - eye.sectionY) * (motion() ? 0.18 : 1);
      const sectionY = eye.sectionY;

      ctx.clearRect(0, 0, width, height);
      ctx.lineCap = "round";
      ctx.lineJoin = "round";

      // Header and dimension line.
      ctx.textAlign = "left";
      ctx.textBaseline = "alphabetic";
      ctx.globalAlpha = 0.95;
      ctx.fillStyle = colors.text;
      ctx.font = "bold 10px monospace";
      ctx.fillText("CM", left, 13);
      ctx.font = "8px monospace";
      ctx.fillText(`cresceu até ${fmt(pointsTotal)} pontos`, left + 22, 13);
      ctx.fillStyle = colors.muted;
      ctx.font = "7px monospace";
      ctx.fillText(
        `1 ponto = 1 commit · ${data.allTime?.since || data.from.getFullYear()}–${data.to.getFullYear()}`,
        left + 22,
        23,
      );
      if (rise > 0.6) {
        const dimA = left + (right - left) * 0.12;
        const dimB = left + (right - left) * 0.94;
        const dimY = 34;
        const mm = ((dimB - dimA) * 0.2646).toFixed(1);
        ctx.strokeStyle = colors.muted;
        ctx.globalAlpha = 0.7;
        ctx.lineWidth = 0.6;
        ctx.beginPath();
        ctx.moveTo(dimA, dimY);
        ctx.lineTo(dimB, dimY);
        ctx.moveTo(dimA, dimY - 3);
        ctx.lineTo(dimA, dimY + 24);
        ctx.moveTo(dimB, dimY - 3);
        ctx.lineTo(dimB, dimY + 24);
        ctx.moveTo(dimA + 5, dimY - 2);
        ctx.lineTo(dimA, dimY);
        ctx.lineTo(dimA + 5, dimY + 2);
        ctx.moveTo(dimB - 5, dimY - 2);
        ctx.lineTo(dimB, dimY);
        ctx.lineTo(dimB - 5, dimY + 2);
        ctx.stroke();
        ctx.fillStyle = colors.surface || colors.bg;
        ctx.globalAlpha = 1;
        ctx.fillRect((dimA + dimB) / 2 - 22, dimY - 5, 44, 9);
        ctx.fillStyle = colors.text;
        ctx.textAlign = "center";
        ctx.fillText(`${mm} mm`, (dimA + dimB) / 2, dimY + 2.5);
      }

      // Terrain.
      const ridgeRows = 46;
      const ridgeStep = (bottom - top - 6) / ridgeRows;
      const samples = 120;
      let profile = [];
      let nearest = Infinity;
      for (let row = 0; row < ridgeRows; row++) {
        const baseY = top + 8 + row * ridgeStep;
        const appear = clamp(rise * 1.6 - (1 - row / ridgeRows) * 0.6, 0, 1);
        if (appear <= 0) continue;
        const near = Math.abs(baseY - sectionY);
        const lit = Math.max(0, 1 - near / (ridgeStep * 3.5));
        const pts = [];
        for (let sample = 0; sample <= samples; sample++) {
          const u = sample / samples;
          const lift = maskValue(g, u * (g.cols - 1), baseY - top) * ridgeStep * 2.6;
          pts.push([left + u * (right - left), baseY - lift * appear * riseEase]);
          if (near < nearest - 0.01 && sample === 0) {
            nearest = near;
            profile = [];
          }
          if (near <= nearest) profile[sample] = lift / (ridgeStep * 2.6);
        }
        ctx.globalAlpha = 1;
        ctx.fillStyle = colors.surface || colors.bg;
        ctx.beginPath();
        pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
        ctx.lineTo(right, baseY + 1);
        ctx.lineTo(left, baseY + 1);
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = colors.text;
        ctx.lineWidth = 0.5 + lit * 0.9;
        ctx.globalAlpha = (0.26 + lit * 0.65 + (row / ridgeRows) * 0.16) * (1 - fill * 0.6) * appear;
        ctx.beginPath();
        pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
        ctx.stroke();
      }

      // Tree.
      const visible = [];
      for (let i = 0; i < g.nodes.length && g.nodes[i].iter <= iterNow; i++) visible.push(g.nodes[i]);
      const carry = new Float32Array(visible.length).fill(1);
      const children = new Uint16Array(visible.length);
      for (let i = visible.length - 1; i > 0; i--) {
        const parent = visible[i].parent;
        carry[parent] += carry[i];
        children[parent]++;
      }
      let tips = 0;
      let junctions = 0;
      let length = 0;
      let apex = 0;
      let cuts = 0;
      ctx.strokeStyle = colors.text;
      for (let i = 1; i < visible.length; i++) {
        const node = visible[i];
        const parent = visible[node.parent];
        const x1 = left + parent.x;
        const y1 = top + parent.y;
        const x2 = left + node.x;
        const y2 = top + node.y;
        length += g.step;
        if ((y1 - sectionY) * (y2 - sectionY) <= 0) cuts++;
        ctx.lineWidth = Math.min(3.4, 0.45 + Math.sqrt(carry[i]) * 0.11);
        ctx.globalAlpha = Math.min(0.95, 0.45 + Math.sqrt(carry[i]) * 0.05);
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.stroke();
        if (node.y < visible[apex].y) apex = i;
      }
      for (let i = 0; i < visible.length; i++) {
        if (children[i] === 0) tips++;
        else if (children[i] > 1) junctions++;
      }
      const members = visible.length > 1 ? visible.length : 0;
      // Labels for apex and root.
      ctx.font = "7px monospace";
      ctx.textAlign = "left";
      const label = (x, y, text, dx) => {
        ctx.globalAlpha = 0.75;
        ctx.strokeStyle = colors.muted;
        ctx.lineWidth = 0.6;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x + dx - 3, y);
        ctx.stroke();
        const wText = ctx.measureText(text).width;
        ctx.globalAlpha = 1;
        ctx.fillStyle = colors.surface || colors.bg;
        ctx.fillRect(x + dx - 1, y - 6, wText + 4, 9);
        ctx.fillStyle = colors.text;
        ctx.fillText(text, x + dx + 1, y + 2);
      };
      if (members) {
        const top0 = visible[apex];
        label(left + top0.x, top + top0.y, `ápice ${top0.depth} passos`, 18);
        label(left + visible[0].x, top + visible[0].y, `raiz carrega ${fmt(members)}`, 26);
      }

      // Section line with A markers.
      ctx.globalAlpha = 0.85;
      ctx.strokeStyle = colors.text;
      ctx.lineWidth = 0.7;
      ctx.setLineDash([8, 3, 1.5, 3]);
      ctx.beginPath();
      ctx.moveTo(left, sectionY);
      ctx.lineTo(right, sectionY);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = colors.text;
      ctx.textAlign = "center";
      ctx.font = "7px monospace";
      [left + 3, right - 3].forEach((x) => {
        ctx.fillText("A", x, sectionY - 11);
        ctx.beginPath();
        ctx.moveTo(x, sectionY - 7);
        ctx.lineTo(x, sectionY + 2);
        ctx.moveTo(x - 3, sectionY + 2);
        ctx.lineTo(x + 3, sectionY + 2);
        ctx.stroke();
      });

      // Axis.
      ctx.globalAlpha = 0.5;
      ctx.fillStyle = colors.muted;
      ctx.font = "6px monospace";
      for (let tick = 1; tick <= 8; tick++) {
        const x = left + ((tick - 0.5) / 8) * (width - left - 10);
        ctx.fillText(String(tick), x, height - 5);
        ctx.fillRect(x, height - 16, 0.6, 3);
      }

      // Right column: section, numeric twin, scale.
      const panelX = plotW + 12;
      const panelW = width - panelX - 8;
      ctx.globalAlpha = 0.95;
      ctx.textAlign = "left";
      ctx.font = "8px monospace";
      ctx.fillStyle = colors.text;
      ctx.fillText("seção A–A", panelX, 13);
      ctx.textAlign = "right";
      ctx.fillStyle = colors.muted;
      ctx.fillText(atPointer ? "eco no ponteiro" : "eco em repouso", panelX + panelW, 13);
      const boxY = 20;
      const boxH = 42;
      ctx.strokeStyle = colors.dim;
      ctx.strokeRect(panelX + 0.5, boxY + 0.5, panelW, boxH);
      ctx.fillStyle = colors.text;
      ctx.globalAlpha = 0.8;
      ctx.beginPath();
      ctx.moveTo(panelX + 3, boxY + boxH - 3);
      profile.forEach((value, index) => {
        const x = panelX + 3 + (index / samples) * (panelW - 6);
        ctx.lineTo(x, boxY + boxH - 3 - (value || 0) * (boxH - 10) * riseEase);
      });
      ctx.lineTo(panelX + panelW - 3, boxY + boxH - 3);
      ctx.fill();
      ctx.globalAlpha = 0.6;
      for (let i = 0; i < 24; i++) ctx.fillRect(panelX + 4 + (i / 24) * (panelW - 8), boxY + boxH - 2, 0.6, 3);
      ctx.fillStyle = colors.muted;
      ctx.textAlign = "left";
      ctx.font = "7px monospace";
      ctx.fillText(`cortes ${cuts} membros`, panelX, boxY + boxH + 13);
      const grown = (growT * 4.4).toFixed(1);
      const table = [
        ["gêmeo numérico", "em contagens"],
        ["membros", fmt(members)],
        ["pontas", fmt(members ? tips : 0)],
        ["junções", fmt(junctions)],
        ["comprimento", `${fmt(length * 0.2646)} mm`],
        ["crescido", `${grown} s`],
        ["alcançados", `${fmt(reached)} / ${fmt(g.points.length)}`],
      ];
      table.forEach(([key, value], index) => {
        const y = boxY + boxH + 30 + index * 12.5;
        ctx.globalAlpha = 0.9;
        ctx.textAlign = "left";
        ctx.fillStyle = index ? colors.muted : colors.text;
        ctx.fillText(key, panelX, y);
        ctx.textAlign = "right";
        ctx.fillStyle = index ? colors.text : colors.muted;
        ctx.fillText(value, panelX + panelW, y);
        if (index) {
          ctx.globalAlpha = 0.3;
          ctx.strokeStyle = colors.dim;
          ctx.beginPath();
          ctx.moveTo(panelX, y + 4);
          ctx.lineTo(panelX + panelW, y + 4);
          ctx.stroke();
        }
      });
      const walkH = 30;
      const walkY = height - walkH - 26;
      ctx.globalAlpha = 0.9;
      ctx.strokeStyle = colors.dim;
      ctx.strokeRect(panelX + 0.5, walkY + 0.5, panelW, walkH + 12);
      ctx.beginPath();
      ctx.moveTo(panelX, walkY + 12.5);
      ctx.lineTo(panelX + panelW, walkY + 12.5);
      ctx.stroke();
      ctx.fillStyle = colors.text;
      ctx.textAlign = "left";
      ctx.fillText("ClaudioAMF1", panelX + 4, walkY + 9);
      ctx.textAlign = "right";
      ctx.fillStyle = colors.muted;
      ctx.fillText("escala 1:1", panelX + panelW - 4, walkY + 9);
      drawWalkers(ctx, colors, panelX, walkY + 12, panelW, walkH, time);
      if (growT >= 1) {
        ctx.textAlign = "right";
        ctx.fillStyle = colors.muted;
        ctx.fillText("tech lead · estudante", panelX + panelW - 4, walkY + 25);
        ctx.fillText("Brasília, DF", panelX + panelW - 4, walkY + 35);
      }
      ctx.globalAlpha = 1;
    }

    function beginEntry(time, duration = 2400) {
      const layer = surfaces.entry;
      if (!layer.context || !surfaces.eye.context) return false;
      layer.canvas.hidden = false;
      resize();
      const origin = surfaces.eye;
      drawEye(clock, 1 / 60, true);
      const pupilX = eye.px;
      const pupilY = eye.py;
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

    // Entry: fly into the pupil. The eye fades, the pupil becomes a black
    // disk with a glowing rim, streaks rush past, then the disk fills the screen.
    function drawEntry(time) {
      if (!entry) return;
      const layer = surfaces.entry;
      const { context: ctx, width, height } = layer;
      if (!ctx || !width) return;
      const colors = palette();
      const elapsed = Math.max(0, time - entry.started);
      const progress = clamp(elapsed / entry.duration, 0, 1);
      const smooth = (value) => value * value * (3 - 2 * value);
      const open = smooth(clamp(progress / 0.18, 0, 1));
      const grow = smooth(clamp((progress - 0.1) / 0.55, 0, 1));
      const fill = smooth(clamp((progress - 0.72) / 0.28, 0, 1));
      const cx = entry.x + (width / 2 - entry.x) * open;
      const cy = entry.y + (height / 2 - entry.y) * open;
      const startRadius = Math.max(6, surfaces.eye.height * 0.1);
      const holdRadius = Math.min(width, height) * 0.36;
      const reach = Math.hypot(width, height) * 0.62 + 40;
      const radius =
        startRadius +
        (holdRadius - startRadius) * grow +
        (reach - holdRadius) * fill;
      const disk =
        document.documentElement.dataset.theme === "papel" ? colors.text : "#000";

      ctx.clearRect(0, 0, width, height);
      ctx.globalAlpha = open;
      ctx.fillStyle = colors.bg;
      ctx.fillRect(0, 0, width, height);
      if (progress < 0.3) {
        const scale = radius / startRadius;
        ctx.globalAlpha = 1 - progress / 0.3;
        ctx.drawImage(
          surfaces.eye.canvas,
          cx - entry.pupilX * scale,
          cy - entry.pupilY * scale,
          surfaces.eye.width * scale,
          surfaces.eye.height * scale,
        );
      }
      // Soft glow around the rim.
      const glow = ctx.createRadialGradient(cx, cy, radius * 0.95, cx, cy, radius * 2.4);
      glow.addColorStop(0, colors.text);
      glow.addColorStop(1, "rgba(0, 0, 0, 0)");
      ctx.globalAlpha = 0.13 * open;
      ctx.fillStyle = glow;
      ctx.fillRect(0, 0, width, height);

      // Streaks.
      const outer = Math.hypot(width, height) * 0.75;
      ctx.strokeStyle = colors.text;
      ctx.lineCap = "round";
      for (let bucket = 0; bucket < 6; bucket++) {
        ctx.lineWidth = bucket > 3 ? 1.1 : 0.7;
        ctx.globalAlpha = (0.12 + bucket * 0.11) * open * (1 - fill * 0.6);
        ctx.beginPath();
        for (let particle = bucket; particle < 1800; particle += 6) {
          const speed = 0.35 + noise(particle + 24) * 0.9;
          const phase = (noise(particle * 3) + elapsed * 0.00055 * speed) % 1;
          const distance = radius + 4 + phase ** 1.4 * (outer - radius);
          const angle = particle * 2.399963 + noise(particle + 9) * 0.02;
          const tail = 4 + phase * (30 + 60 * grow);
          const cos = Math.cos(angle);
          const sin = Math.sin(angle);
          ctx.moveTo(cx + cos * distance, cy + sin * distance);
          ctx.lineTo(cx + cos * (distance + tail), cy + sin * (distance + tail));
        }
        ctx.stroke();
      }
      // Rim and disk.
      for (const [lineWidth, alpha] of [
        [18, 0.05],
        [8, 0.1],
        [3, 0.4],
        [1, 0.95],
      ]) {
        ctx.lineWidth = lineWidth;
        ctx.globalAlpha = alpha * open;
        ctx.beginPath();
        ctx.arc(cx, cy, radius, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.globalAlpha = Math.max(open, 0.6);
      ctx.fillStyle = disk;
      ctx.beginPath();
      ctx.arc(cx, cy, radius - 1, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
      layer.canvas.dataset.progress = progress.toFixed(3);
    }

    function drawCursor(time) {
      const layer = surfaces.cursor;
      if (!layer.context || !layer.width) return;
      const { context: ctx, width, height } = layer;
      ctx.clearRect(0, 0, width, height);
      const colors = palette();
      drawSight(ctx, colors);
      if (!motion()) {
        trail.length = 0;
        return;
      }
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
      setEyeText,
      setContributions,
      mouseActive,
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
