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
      return workspaceMode && performance.now() - pointer.at < 1400;
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
          if (Math.abs(dx) < box && Math.abs(dy) < box) {
            bold.push(ch, sx, sy, 0.95);
            continue;
          }
          const distance = Math.hypot(dx, dy);
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
        ctx.globalAlpha = 0.9;
        ctx.strokeRect(px - box, py - box * open, box * 2, box * 2 * open);
        ctx.globalAlpha = 0.55;
        const inner = box * 0.38;
        ctx.strokeRect(
          px - inner + eye.x * box * 0.35,
          py - inner * open + eye.y * box * 0.35,
          inner * 2,
          inner * 2 * open,
        );
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
      if (!layer.context || !layer.width || !workspaceMode) return;
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
        source: data.source,
        from,
        to,
      };
      contributionsShownAt = -1;
    }

    function drawMesh(time) {
      const layer = surfaces.mesh;
      if (
        !layer.context ||
        !layer.width ||
        !workspaceMode ||
        !contributions ||
        document.getElementById("about").hidden
      )
        return;
      const { context: ctx, width, height } = layer;
      const colors = palette();
      const data = contributions;
      if (contributionsShownAt < 0) contributionsShownAt = time;
      const grow = motion()
        ? Math.min(1, (time - contributionsShownAt) / 1600)
        : 1;
      const ease = 1 - (1 - grow) ** 3;
      ctx.clearRect(0, 0, width, height);
      const plotW = width * 0.6;
      const left = 18;
      const right = plotW - 6;
      const top = 44;
      const bottom = height - 22;
      const rows = data.weeks.length;
      const step = (bottom - top - 26) / rows;
      const amplitude = Math.min(46, step * 9);
      const samples = 84;
      const months = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

      ctx.font = "7px monospace";
      ctx.textBaseline = "alphabetic";
      ctx.fillStyle = colors.text;
      ctx.globalAlpha = 0.9;
      ctx.textAlign = "left";
      ctx.font = "bold 9px monospace";
      ctx.fillText("CM", left, 14);
      ctx.font = "8px monospace";
      ctx.fillText(`cresceu até ${data.total} pontos`, left + 22, 14);
      ctx.fillStyle = colors.muted;
      ctx.font = "7px monospace";
      ctx.fillText(
        `1 ponto = 1 ${data.source === "github" ? "contribuição" : "commit"} · ${months[data.from.getMonth()]} ${data.from.getFullYear()} — ${months[data.to.getMonth()]} ${data.to.getFullYear()}`,
        left + 22,
        24,
      );

      let lastMonth = -1;
      data.weeks.forEach((week, row) => {
        const baseY = top + 26 + row * step;
        const points = [];
        for (let sample = 0; sample <= samples; sample++) {
          const u = sample / samples;
          const dayPosition = u * 6.999;
          let value = 0;
          week.days.forEach((count, day) => {
            value += count * Math.exp(-(((dayPosition - day) / 0.55) ** 2));
          });
          const wobble = Math.sin(u * 13 + row * 0.7 + time * 0.0006) * 0.6;
          const y =
            baseY - (Math.sqrt(value / data.max) * amplitude + wobble) * ease;
          points.push([left + u * (right - left), y]);
        }
        // Fill under the ridge so nearer weeks hide the ones behind them.
        ctx.globalAlpha = 1;
        ctx.fillStyle = colors.surface || colors.bg;
        ctx.beginPath();
        points.forEach(([x, y], index) =>
          index ? ctx.lineTo(x, y) : ctx.moveTo(x, y),
        );
        ctx.lineTo(right, baseY + 2);
        ctx.lineTo(left, baseY + 2);
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = row === data.peakWeek ? colors.accent : colors.text;
        ctx.lineWidth = row === data.peakWeek ? 1 : 0.55;
        ctx.globalAlpha = row === data.peakWeek ? 0.95 : 0.3 + (row / rows) * 0.5;
        ctx.beginPath();
        points.forEach(([x, y], index) =>
          index ? ctx.lineTo(x, y) : ctx.moveTo(x, y),
        );
        ctx.stroke();
        const month = week.start.getMonth();
        if (month !== lastMonth && week.start.getDate() <= 7) {
          lastMonth = month;
          ctx.globalAlpha = 0.65;
          ctx.fillStyle = colors.muted;
          ctx.font = "6px monospace";
          ctx.textAlign = "right";
          ctx.fillText(months[month], left - 3, baseY);
        }
      });

      // Section A–A across the busiest week.
      const peakY = top + 26 + data.peakWeek * step;
      ctx.globalAlpha = 0.7;
      ctx.strokeStyle = colors.text;
      ctx.lineWidth = 0.6;
      ctx.setLineDash([6, 3, 1, 3]);
      ctx.beginPath();
      ctx.moveTo(left, peakY + 3);
      ctx.lineTo(right, peakY + 3);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = colors.text;
      ctx.font = "7px monospace";
      ctx.textAlign = "center";
      ctx.fillText("A", left + 2, peakY - 3);
      ctx.fillText("A", right - 2, peakY - 3);
      const weekdays = ["seg", "ter", "qua", "qui", "sex", "sáb", "dom"];
      ctx.globalAlpha = 0.55;
      ctx.font = "6px monospace";
      ctx.textAlign = "center";
      weekdays.forEach((name, day) =>
        ctx.fillText(name, left + ((day + 0.5) / 7) * (right - left), height - 8),
      );

      // Right column: section A–A profile and the numeric twin.
      const panelX = plotW + 14;
      const panelW = width - panelX - 8;
      ctx.globalAlpha = 0.9;
      ctx.fillStyle = colors.text;
      ctx.font = "8px monospace";
      ctx.textAlign = "left";
      ctx.fillText("seção A–A", panelX, 14);
      ctx.textAlign = "right";
      ctx.fillStyle = colors.muted;
      ctx.fillText(
        `${panelW > 170 ? "semana de pico · " : ""}${data.weeks[data.peakWeek].total}`,
        panelX + panelW,
        14,
      );
      const boxY = 22;
      const boxH = 46;
      ctx.strokeStyle = colors.dim;
      ctx.globalAlpha = 0.9;
      ctx.strokeRect(panelX + 0.5, boxY + 0.5, panelW, boxH);
      const peak = data.weeks[data.peakWeek].days;
      const peakMax = Math.max(1, ...peak);
      ctx.fillStyle = colors.text;
      ctx.globalAlpha = 0.75;
      ctx.beginPath();
      ctx.moveTo(panelX + 4, boxY + boxH - 3);
      for (let sample = 0; sample <= 60; sample++) {
        const u = sample / 60;
        let value = 0;
        peak.forEach((count, day) => {
          value += count * Math.exp(-(((u * 6.999 - day) / 0.55) ** 2));
        });
        ctx.lineTo(
          panelX + 4 + u * (panelW - 8),
          boxY + boxH - 3 - Math.min(1, value / peakMax) * (boxH - 10) * ease,
        );
      }
      ctx.lineTo(panelX + panelW - 4, boxY + boxH - 3);
      ctx.fill();

      const best = data.best.date.split("-").reverse().slice(0, 2).join("/");
      const rowsText = [
        ["gêmeo numérico", "em números"],
        ["pontos", String(data.total)],
        ["dias ativos", String(data.activeDays)],
        ["maior sequência", `${data.bestStreak} dias`],
        ["dia mais forte", `${best} · ${data.best.count}`],
        ["média / dia ativo", (data.total / Math.max(1, data.activeDays)).toFixed(1)],
      ];
      rowsText.forEach(([key, value], index) => {
        const y = boxY + boxH + 20 + index * 15;
        ctx.globalAlpha = index ? 0.85 : 0.95;
        ctx.font = "7px monospace";
        ctx.textAlign = "left";
        ctx.fillStyle = index ? colors.muted : colors.text;
        ctx.fillText(key, panelX, y);
        ctx.textAlign = "right";
        ctx.fillStyle = colors.text;
        ctx.fillText(value, panelX + panelW, y);
        if (index) {
          ctx.globalAlpha = 0.35;
          ctx.strokeStyle = colors.dim;
          ctx.beginPath();
          ctx.moveTo(panelX, y + 4.5);
          ctx.lineTo(panelX + panelW, y + 4.5);
          ctx.stroke();
        }
      });
      const footY = height - 8;
      ctx.globalAlpha = 0.6;
      ctx.fillStyle = colors.muted;
      ctx.font = "6px monospace";
      ctx.textAlign = "left";
      ctx.fillText(data.label, panelX, footY);
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
