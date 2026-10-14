(() => {
  "use strict";

  // Claudinho (Claudio + Claude): a small line-drawn terminal creature that
  // lives on the edge of the status bar. Spring physics for every move,
  // squash and stretch on landings, eyes that follow the pointer, typed
  // speech, a nap when the visitor is away, and you can pick it up and drop it.

  const body = document.body;
  const SIZE = 44;
  const store = {
    get(key, fallback) {
      try {
        return JSON.parse(localStorage.getItem(key)) ?? fallback;
      } catch {
        return fallback;
      }
    },
    set(key, value) {
      try {
        localStorage.setItem(key, JSON.stringify(value));
      } catch {
        /* Optional. */
      }
    },
  };
  const still = () => body.classList.contains("motion-paused");
  const pick = (list) => list[Math.floor(Math.random() * list.length)];
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

  const el = document.createElement("div");
  el.className = "mascot";
  el.setAttribute("role", "button");
  el.tabIndex = 0;
  el.setAttribute("aria-label", "Claudinho, o mascote. Clique para conversar ou arraste.");
  el.innerHTML = `
    <div class="mascot-bubble" aria-live="polite"><span class="mascot-who">claudinho ›</span> <span class="mascot-text"></span><i class="mascot-caret"></i></div>
    <span class="mascot-tag">claudinho</span>
    <svg class="mascot-svg" viewBox="0 0 44 44" aria-hidden="true">
      <ellipse class="m-shadow" cx="22" cy="41.5" rx="10" ry="1.6"/>
      <g class="m-rig">
        <g class="m-legs">
          <path class="m-leg m-leg-l" d="M17 33 L16 39"/>
          <path class="m-leg m-leg-r" d="M27 33 L28 39"/>
        </g>
        <g class="m-antenna">
          <path class="m-stalk" d="M22 13 Q22 9 23 6"/>
          <g class="m-spark" transform="translate(23 5)">
            <path d="M0 -2.6V2.6M-2.6 0H2.6M-1.8 -1.8L1.8 1.8M-1.8 1.8L1.8 -1.8"/>
          </g>
        </g>
        <path class="m-arm m-arm-l" d="M10 24 Q6 25 6 29"/>
        <path class="m-arm m-arm-r" d="M34 24 Q38 25 38 29"/>
        <rect class="m-body" x="9" y="12.5" width="26" height="21" rx="8"/>
        <rect class="m-screen" x="13" y="16.5" width="18" height="12" rx="3.2"/>
        <g class="m-face">
          <rect class="m-eye m-eye-l" x="16.4" y="19.6" width="2.6" height="4" rx="1.3"/>
          <rect class="m-eye m-eye-r" x="25" y="19.6" width="2.6" height="4" rx="1.3"/>
          <circle class="m-glint" cx="18.3" cy="20.4" r="0.55"/>
          <circle class="m-glint" cx="26.9" cy="20.4" r="0.55"/>
          <path class="m-mouth" d="M20.4 25.6 Q22 26.9 23.6 25.6"/>
          <rect class="m-cursor" x="21" y="25" width="2" height="1.6"/>
          <circle class="m-cheek" cx="15" cy="26.3" r="1"/>
          <circle class="m-cheek" cx="29" cy="26.3" r="1"/>
        </g>
      </g>
      <g class="m-zzz"><text x="34" y="10">z</text><text x="38" y="5">z</text></g>
    </svg>`;
  body.append(el);
  const $ = (selector) => el.querySelector(selector);
  const rig = $(".m-rig");
  const face = $(".m-face");
  const eyes = [...el.querySelectorAll(".m-eye")];
  const glints = [...el.querySelectorAll(".m-glint")];
  const legs = [$(".m-leg-l"), $(".m-leg-r")];
  const arms = [$(".m-arm-l"), $(".m-arm-r")];
  const spark = $(".m-spark");
  const shadow = $(".m-shadow");
  const bubble = $(".mascot-bubble");
  const bubbleText = $(".mascot-text");

  const s = {
    x: innerWidth * 0.62,
    y: 0,
    vx: 0,
    vy: 0,
    target: innerWidth * 0.62,
    facing: 1,
    squash: 0,
    squashV: 0,
    grounded: false,
    mode: "idle", // idle | walk | sleep | held
    nextThought: performance.now() + 9000,
    lastInput: performance.now(),
    blinkAt: performance.now() + 2500,
    blink: 0,
    gx: 0,
    gy: 0,
    pointer: { x: innerWidth / 2, y: innerHeight / 2, at: 0 },
    hover: false,
    wave: 0,
    dance: 0,
    happy: 0,
    hidden: store.get("cm-mascot-off", false),
    drag: null,
    talkUntil: 0,
    typing: null,
  };
  el.hidden = s.hidden;

  // ---------- where it stands ----------
  function floor() {
    const mobile = innerWidth <= 650;
    if (mobile) return { y: innerHeight - 10, left: innerWidth - 70, right: innerWidth - 16, mobile };
    const anchor = body.classList.contains("is-workspace")
      ? document.querySelector(".status-bar")
      : document.querySelector(".landing .editor-mode") || document.querySelector(".landing-footer");
    const r = anchor?.getBoundingClientRect();
    if (!r || !r.width) return { y: innerHeight - 10, left: 20, right: innerWidth - 20, mobile };
    return { y: r.top + 1, left: r.left + 6, right: r.right - 6, mobile };
  }

  // ---------- speech: typed like a terminal ----------
  function say(text, hold = 2600) {
    if (s.hidden) return;
    wake();
    clearInterval(s.typing);
    bubbleText.textContent = "";
    el.classList.add("is-talking");
    let i = 0;
    const chars = [...text];
    const speed = still() ? 0 : 26;
    const step = () => {
      bubbleText.textContent = chars.slice(0, ++i).join("");
      if (i >= chars.length) {
        clearInterval(s.typing);
        s.talkUntil = performance.now() + hold + chars.length * 25;
      }
    };
    s.talkUntil = Infinity;
    if (!speed) {
      i = chars.length - 1;
      step();
    } else s.typing = setInterval(step, speed);
  }
  function wake() {
    s.lastInput = performance.now();
    if (s.mode === "sleep") {
      s.mode = "idle";
      el.classList.remove("is-sleeping");
      s.vy = -120;
      document.dispatchEvent(new CustomEvent("mascot:woke"));
    }
  }

  const PANEL_LINES = {
    landing: ["oi, sou o claudinho. aperta enter pra entrar ✳", "pode digitar, o editor é seu"],
    about: ["essa árvore cresce com cada commit dele", "passa o mouse no gráfico: o corte segue você"],
    aegis: ["monitorando tudo por aqui 🛡", "alerta crítico? eu peço aprovação antes"],
    clinica: ["dado de paciente só com perfil e auditoria", "sistema de verdade, numa clínica de verdade"],
    camf: ["boleto com dígito errado não passa", "módulo 10, módulo 11, conferido"],
    scoutlink: ["sempre alerta ⚜"],
    legitrack: ["de olho na Câmara pra você"],
    crypto: ["to the moon? não, to the Kafka"],
    soccer: ["YOLO, mas do jeito certo ⚽"],
    pesquisa: ["quem mais está dentro do app? 👀"],
    more: ["os pequenos também contam"],
    skills: ["python lidera com folga"],
    experience: ["de monitor de cálculo a tech lead"],
    contact: ["dica: digite `hire` no terminal"],
    themes: ["eu combino com todos os temas"],
  };
  const THOUGHTS = [
    "commit pequeno, commit feliz",
    "já tentou `neofetch`?",
    "↑↑↓↓←→←→BA…",
    "café? digita `coffee`",
    "funciona na minha máquina",
    "me arrasta, eu deixo",
  ];
  const POKES = ["oi! ✳", "hehe", "Claudio + Claude = claudinho", "tô de olho no código", "eu como bugs no café da manhã"];
  const greeted = new Set();
  document.addEventListener("portfolio:view", (event) => {
    const view = event.detail;
    if (greeted.has(view) || !PANEL_LINES[view]) return;
    greeted.add(view);
    setTimeout(() => say(pick(PANEL_LINES[view])), 900);
    // Walk toward the middle of the floor when a new panel opens.
    const f = floor();
    s.target = f.left + (f.right - f.left) * (0.45 + Math.random() * 0.2);
  });

  // ---------- input ----------
  addEventListener(
    "pointermove",
    (event) => {
      s.pointer = { x: event.clientX, y: event.clientY, at: performance.now() };
      wake();
      if (s.drag) {
        const dx = event.clientX - s.drag.startX;
        const dy = event.clientY - s.drag.startY;
        if (!s.drag.moved && Math.hypot(dx, dy) > 5) {
          s.drag.moved = true;
          s.mode = "held";
          el.classList.add("is-held");
        }
      }
    },
    { passive: true },
  );
  addEventListener("keydown", () => wake(), { passive: true });

  function poke() {
    s.vy = -230;
    s.grounded = false;
    s.happy = performance.now() + 1500;
    say(pick(POKES));
    document.dispatchEvent(new CustomEvent("mascot:pet"));
  }
  el.addEventListener("pointerdown", (event) => {
    if (event.button !== 0) return;
    event.preventDefault();
    el.setPointerCapture?.(event.pointerId);
    s.drag = { startX: event.clientX, startY: event.clientY, moved: false, offX: event.clientX - s.x, offY: event.clientY - s.y };
  });
  el.addEventListener("pointerup", () => {
    const drag = s.drag;
    s.drag = null;
    el.classList.remove("is-held");
    if (!drag) return;
    if (drag.moved) {
      s.mode = "idle";
      s.grounded = false;
      say(pick(["uou!", "de novo!", "segura firme da próxima"]), 1400);
    } else poke();
  });
  el.addEventListener("keydown", (event) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      poke();
    }
  });
  el.addEventListener("pointerenter", () => {
    s.hover = true;
    el.classList.add("is-hover");
  });
  el.addEventListener("pointerleave", () => {
    s.hover = false;
    el.classList.remove("is-hover");
  });

  // ---------- animation ----------
  let last = performance.now();
  function frame(now) {
    const dt = Math.min(0.04, (now - last) / 1000);
    last = now;
    if (s.hidden) return requestAnimationFrame(frame);
    const f = floor();
    const frozen = still();

    // Moods.
    if (s.mode !== "sleep" && s.mode !== "held" && now - s.lastInput > 40000 && now > s.talkUntil) {
      s.mode = "sleep";
      el.classList.add("is-sleeping");
    }
    if (now > s.talkUntil) el.classList.remove("is-talking");
    el.classList.toggle("is-happy", now < s.happy || now < s.dance);

    // Occasional stroll and thought.
    if (!frozen && s.mode === "idle" && now > s.nextThought && !f.mobile) {
      s.nextThought = now + 14000 + Math.random() * 16000;
      s.target = f.left + 20 + Math.random() * (f.right - f.left - 60);
      if (Math.random() < 0.35 && now > s.talkUntil) say(pick(THOUGHTS));
    }

    if (s.mode === "held" && s.drag) {
      // Follow the hand with a soft spring and dangle.
      const tx = s.pointer.x - s.drag.offX;
      const ty = s.pointer.y - s.drag.offY;
      s.vx += ((tx - s.x) * 260 - s.vx * 22) * dt;
      s.vy += ((ty - s.y) * 260 - s.vy * 22) * dt;
      s.x += s.vx * dt;
      s.y += s.vy * dt;
      s.grounded = false;
    } else {
      // Horizontal spring toward the target (critically damped feel).
      if (f.mobile) s.target = f.right - SIZE;
      s.target = clamp(s.target, f.left, f.right - SIZE);
      const gap = s.target - s.x;
      if (!frozen && s.mode !== "sleep") {
        const accel = gap * 9 - s.vx * 6.2;
        s.vx += clamp(accel, -900, 900) * dt;
        s.vx = clamp(s.vx, -170, 170);
      } else s.vx *= 0.8;
      s.x += s.vx * dt;
      if (Math.abs(s.vx) > 4) s.facing = Math.sign(s.vx);
      // Gravity toward the floor.
      const ground = f.y - SIZE + 3;
      if (frozen) {
        s.y = ground;
        s.vy = 0;
      } else {
        s.vy += 1500 * dt;
        s.y += s.vy * dt;
        if (s.y >= ground) {
          if (!s.grounded && s.vy > 120) s.squashV -= Math.min(9, s.vy / 70);
          s.y = ground;
          s.vy = 0;
          s.grounded = true;
        } else if (s.y < ground - 1) s.grounded = false;
      }
      s.mode = s.mode === "sleep" ? "sleep" : Math.abs(s.vx) > 12 && s.grounded ? "walk" : "idle";
    }
    s.x = clamp(s.x, 0, innerWidth - SIZE);
    s.y = clamp(s.y, 0, innerHeight - SIZE);

    // Squash and stretch spring.
    const stretch = s.grounded ? 0 : clamp(-s.vy / 900, -0.18, 0.22);
    s.squashV += ((stretch - s.squash) * 260 - s.squashV * 14) * dt;
    s.squash += s.squashV * dt;
    const sq = frozen ? 0 : s.squash;

    // Body motion.
    const t = now / 1000;
    const walking = s.mode === "walk" && !frozen;
    const breathe = s.mode === "sleep" ? Math.sin(t * 2.2) * 0.04 : Math.sin(t * 2.6) * 0.015;
    const bob = walking ? Math.abs(Math.sin(t * 13)) * -1.4 : 0;
    const dance = now < s.dance ? Math.sin(t * 10) * 8 : 0;
    const lean = clamp(s.vx / 170, -1, 1) * 6 + dance;
    const sx = (1 + sq * 0.6 - breathe) * s.facing;
    const sy = 1 - sq + breathe;
    rig.setAttribute(
      "transform",
      `translate(22 41) rotate(${lean.toFixed(2)}) scale(${sx.toFixed(3)} ${sy.toFixed(3)}) translate(-22 ${(-41 + bob).toFixed(2)})`,
    );
    shadow.setAttribute("rx", (10 * (1 - clamp((f.y - SIZE + 3 - s.y) / 160, 0, 0.7))).toFixed(2));
    shadow.style.opacity = s.mode === "held" ? "0" : "";

    // Legs and arms.
    const step = walking ? Math.sin(t * 13) * 18 : s.mode === "held" ? Math.sin(t * 7) * 14 : 0;
    legs[0].setAttribute("transform", `rotate(${step.toFixed(1)} 17 33)`);
    legs[1].setAttribute("transform", `rotate(${(-step).toFixed(1)} 27 33)`);
    const waving = now < s.wave || el.classList.contains("is-talking") || now < s.dance;
    const armL = s.mode === "held" ? -55 : now < s.dance ? Math.sin(t * 10) * 40 - 30 : 0;
    const armR = s.mode === "held" ? 55 : waving ? -40 + Math.sin(t * 12) * 22 : walking ? Math.sin(t * 13) * 10 : 0;
    arms[0].setAttribute("transform", `rotate(${armL.toFixed(1)} 10 24)`);
    arms[1].setAttribute("transform", `rotate(${armR.toFixed(1)} 34 24)`);
    spark.setAttribute("transform", `translate(23 5) rotate(${((t * 40) % 360).toFixed(1)}) scale(${(1 + Math.sin(t * 3) * 0.12).toFixed(3)})`);

    // Eyes: follow the pointer, blink now and then.
    const cx = s.x + SIZE / 2;
    const cy = s.y + 22;
    const px = (s.pointer.x - cx) / 220;
    const py = (s.pointer.y - cy) / 220;
    s.gx += (clamp(px, -1, 1) * s.facing - s.gx) * 0.18;
    s.gy += (clamp(py, -1, 1) - s.gy) * 0.18;
    if (now > s.blinkAt) {
      s.blink = 1;
      s.blinkAt = now + 2600 + Math.random() * 3800;
    }
    s.blink = Math.max(0, s.blink - dt * 7);
    const closed = s.mode === "sleep" ? 0.85 : Math.sin(s.blink * Math.PI) * 0.9;
    const happy = el.classList.contains("is-happy");
    face.setAttribute("transform", `translate(${(s.gx * 1.6).toFixed(2)} ${(s.gy * 1.1).toFixed(2)})`);
    eyes.forEach((eye) => {
      const h = happy ? 1.4 : 4 * (1 - closed);
      eye.setAttribute("height", Math.max(0.5, h).toFixed(2));
      eye.setAttribute("y", (19.6 + (4 - Math.max(0.5, h)) / 2).toFixed(2));
    });
    glints.forEach((g) => (g.style.opacity = closed > 0.4 || happy ? "0" : ""));

    el.style.transform = `translate3d(${s.x.toFixed(1)}px, ${s.y.toFixed(1)}px, 0)`;
    el.classList.toggle("bubble-left", s.x > innerWidth - 260);
    requestAnimationFrame(frame);
  }
  s.y = floor().y - SIZE + 3;
  s.grounded = true;
  requestAnimationFrame(frame);
  setTimeout(() => {
    if (!body.classList.contains("is-workspace")) say(PANEL_LINES.landing[0]);
    greeted.add("landing");
  }, 3500);

  window.PortfolioMascot = {
    say,
    pet() {
      s.happy = performance.now() + 2200;
      s.vy = -180;
      say("hehe 🥰");
    },
    feed() {
      s.happy = performance.now() + 1800;
      say("nham… um bug crocante 🐛");
    },
    dance() {
      s.dance = performance.now() + 3200;
      say("♪ ┏(・o・)┛ ♪", 1800);
    },
    sleep() {
      s.mode = "sleep";
      s.lastInput = -1e9;
      el.classList.add("is-sleeping");
    },
    toggle(on) {
      s.hidden = !on;
      el.hidden = s.hidden;
      store.set("cm-mascot-off", s.hidden);
      if (on) {
        s.y = 0;
        s.vy = 0;
        s.grounded = false;
        setTimeout(() => say("voltei! ✳"), 500);
      }
    },
    get hidden() {
      return s.hidden;
    },
  };
})();
