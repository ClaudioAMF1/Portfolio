(() => {
  "use strict";

  // Claudinho: a tiny mascot that walks along the edge of the terminal,
  // chases the pointer, comments on each panel, naps when nobody is around
  // and celebrates achievements. Plus a few terminal easter eggs.

  const body = document.body;
  const store = {
    read(key, fallback) {
      try {
        return JSON.parse(localStorage.getItem(key)) ?? fallback;
      } catch {
        return fallback;
      }
    },
    write(key, value) {
      try {
        localStorage.setItem(key, JSON.stringify(value));
      } catch {
        /* Optional. */
      }
    },
  };
  const pick = (list) => list[Math.floor(Math.random() * list.length)];
  const moving = () => !body.classList.contains("motion-paused");

  // ---------- sprite ----------
  const mascot = document.createElement("div");
  mascot.className = "claudinho";
  mascot.setAttribute("role", "button");
  mascot.setAttribute("tabindex", "0");
  mascot.setAttribute("aria-label", "Claudinho, o mascote. Clique para conversar.");
  mascot.innerHTML = `
    <div class="cl-bubble" aria-live="polite"></div>
    <span class="cl-zzz" aria-hidden="true">z<i>z</i><b>z</b></span>
    <svg class="cl-sprite" viewBox="0 0 16 15" aria-hidden="true" shape-rendering="crispEdges">
      <g class="cl-spark"><rect x="7" y="0" width="2" height="1"/><rect x="6" y="1" width="1" height="1"/><rect x="9" y="1" width="1" height="1"/><rect x="7.5" y="1" width="1" height="2"/></g>
      <rect class="cl-body" x="2" y="3" width="12" height="8"/>
      <rect class="cl-body" x="3" y="2" width="10" height="1"/>
      <rect class="cl-arm cl-arm-l" x="0" y="6" width="2" height="2"/>
      <rect class="cl-arm cl-arm-r" x="14" y="6" width="2" height="2"/>
      <g class="cl-eyes"><rect x="5" y="5" width="2" height="2"/><rect x="9" y="5" width="2" height="2"/></g>
      <rect class="cl-mouth" x="7" y="8" width="2" height="1"/>
      <rect class="cl-leg cl-leg-a" x="4" y="11" width="2" height="3"/>
      <rect class="cl-leg cl-leg-b" x="10" y="11" width="2" height="3"/>
    </svg>`;
  body.append(mascot);
  const bubble = mascot.querySelector(".cl-bubble");
  const eyes = mascot.querySelector(".cl-eyes");

  const state = {
    x: innerWidth * 0.5,
    y: 0,
    vy: 0,
    target: innerWidth * 0.5,
    facing: 1,
    mode: "walk",
    lastInput: performance.now(),
    pointerAt: -1e9,
    pointerX: 0,
    pointerY: 0,
    wanderAt: 0,
    talkUntil: 0,
    clicks: [],
    view: "landing",
    party: 0,
  };

  function ground() {
    const mobile = innerWidth <= 650;
    const anchor = mobile
      ? null
      : body.classList.contains("is-workspace")
        ? document.querySelector(".status-bar")
        : document.querySelector(".landing-footer");
    const rect = anchor?.getBoundingClientRect();
    if (!rect || !rect.width) return { y: innerHeight - 6, left: 12, right: innerWidth - 12 };
    return { y: rect.top + 1, left: rect.left + 8, right: rect.right - 8 };
  }

  // ---------- speech ----------
  function say(text, ms = 4200) {
    bubble.textContent = text;
    mascot.classList.add("is-talking");
    state.talkUntil = performance.now() + ms;
    wake();
  }
  function wake() {
    state.lastInput = performance.now();
    if (state.mode === "sleep") {
      state.mode = "walk";
      mascot.classList.remove("is-sleeping");
    }
  }

  const LINES = {
    landing: [
      "oi! sou o claudinho ✳ aperte enter pra entrar",
      "pode digitar aqui, o editor é seu",
      "psst: o olho tá te seguindo, não eu",
    ],
    about: ["esse é o Claudio! a árvore cresce com os commits dele", "passa o mouse no gráfico: o corte A–A segue você"],
    clinica: ["sistema de verdade, numa clínica de verdade 🏥", "dados de paciente? só com perfil, auditoria e LGPD"],
    camf: ["boleto com dígito errado não passa por mim", "módulo 10, módulo 11… eu confiro tudo"],
    scoutlink: ["sempre alerta! ⚜", "app + painel + API, tudo conversando"],
    legitrack: ["acompanhando a Câmara pra você 🏛", "um worker vigia os projetos de lei"],
    crypto: ["to the moon? não, to the Kafka 📈"],
    soccer: ["gooool! … quer dizer, detecção com YOLOv8 ⚽"],
    pesquisa: ["quem mais está dentro do app? 👀", "396 apps do governo na lupa"],
    more: ["os projetos menores também contam!"],
    skills: ["olha a escada de linguagens subindo", "python lidera com folga 🐍"],
    experience: ["tech lead aos 20 e poucos, nada mal"],
    contact: ["manda um oi! ele responde rápido", "dica: digite `hire` no terminal"],
    themes: ["eu fico bonito em qualquer tema ✨"],
  };
  const CLICK_LINES = [
    "oi! ✳",
    "me chamo claudinho: Claudio + Claude",
    "tô de olho no código (literalmente)",
    "já tentou digitar `neofetch`?",
    "eu como bugs no café da manhã 🐛",
    "commit pequeno, commit feliz",
    "digite `claudinho dance` 🕺",
  ];

  // ---------- achievements ----------
  const ACHIEVEMENTS = {
    hello: "olá, mundo · abriu o portfólio",
    explorer: "explorador · viu todos os projetos",
    tourist: "turista · passou por todas as seções",
    friend: "amigo do claudinho · fez carinho nele",
    hacker: "hacker · usou o terminal",
    konami: "↑↑↓↓←→←→BA · achou o segredo",
    insomniac: "insone · acordou o claudinho",
  };
  const PROJECTS = ["clinica", "camf", "scoutlink", "legitrack", "crypto", "soccer"];
  const unlocked = new Set(store.read("cm-achievements", []));
  const visited = new Set(store.read("cm-visited", []));
  const toast = document.createElement("div");
  toast.className = "cl-toast";
  toast.setAttribute("role", "status");
  body.append(toast);
  let toastTimer;
  function unlock(id) {
    if (unlocked.has(id) || !ACHIEVEMENTS[id]) return;
    unlocked.add(id);
    store.write("cm-achievements", [...unlocked]);
    toast.innerHTML = `<span class="cl-toast-k">achievement ${unlocked.size}/${Object.keys(ACHIEVEMENTS).length}</span>${ACHIEVEMENTS[id]}`;
    toast.classList.add("is-visible");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove("is-visible"), 4200);
    celebrate(900);
  }
  function celebrate(ms) {
    state.party = performance.now() + ms;
    mascot.classList.add("is-party");
  }

  document.addEventListener("portfolio:view", (event) => {
    const view = event.detail;
    state.view = view;
    if (view !== "landing") {
      visited.add(view);
      store.write("cm-visited", [...visited]);
      if (PROJECTS.every((id) => visited.has(id))) unlock("explorer");
      const all = [...document.querySelectorAll(".content-panel")].map((panel) => panel.id);
      if (all.every((id) => visited.has(id))) unlock("tourist");
    }
    if (LINES[view] && Math.random() < 0.75) setTimeout(() => say(pick(LINES[view])), 700);
  });
  setTimeout(() => unlock("hello"), 2500);

  // ---------- input ----------
  addEventListener(
    "pointermove",
    (event) => {
      state.pointerAt = performance.now();
      state.pointerX = event.clientX;
      state.pointerY = event.clientY;
      wake();
    },
    { passive: true },
  );
  addEventListener("keydown", wake, { passive: true });
  function poke() {
    const now = performance.now();
    if (state.mode === "sleep") unlock("insomniac");
    state.clicks = state.clicks.filter((time) => now - time < 1500);
    state.clicks.push(now);
    if (state.y >= ground().y - 1) state.vy = -210;
    if (state.clicks.length >= 5) {
      say("ei! isso faz cócegas 😆");
      state.clicks = [];
    } else say(pick(CLICK_LINES));
    unlock("friend");
  }
  mascot.addEventListener("click", poke);
  mascot.addEventListener("keydown", (event) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      poke();
    }
  });

  const KONAMI = ["ArrowUp", "ArrowUp", "ArrowDown", "ArrowDown", "ArrowLeft", "ArrowRight", "ArrowLeft", "ArrowRight", "b", "a"];
  let konami = 0;
  addEventListener("keydown", (event) => {
    const key = event.key.length === 1 ? event.key.toLowerCase() : event.key;
    konami = key === KONAMI[konami] ? konami + 1 : key === KONAMI[0] ? 1 : 0;
    if (konami === KONAMI.length) {
      konami = 0;
      unlock("konami");
      say("+30 vidas! 🎮", 3500);
      celebrate(3500);
      rain(3200);
    }
  });

  // ---------- glyph rain (konami / `matrix`) ----------
  function rain(ms) {
    if (!moving()) return;
    const canvas = document.createElement("canvas");
    canvas.className = "cl-rain";
    canvas.width = innerWidth;
    canvas.height = innerHeight;
    body.append(canvas);
    const ctx = canvas.getContext("2d");
    const color = getComputedStyle(document.documentElement).getPropertyValue("--accent").trim() || "#7fae93";
    const size = 14;
    const drops = Array.from({ length: Math.ceil(innerWidth / size) }, () => Math.random() * -40);
    const glyphs = "claudinho01✳{}[]<>/=;:";
    const start = performance.now();
    const frame = (now) => {
      const t = now - start;
      ctx.fillStyle = "rgba(0,0,0,0.12)";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = color;
      ctx.font = `${size}px monospace`;
      drops.forEach((y, i) => {
        ctx.fillText(glyphs[(Math.random() * glyphs.length) | 0], i * size, y * size);
        drops[i] = y * size > canvas.height && Math.random() > 0.96 ? 0 : y + 1;
      });
      canvas.style.opacity = String(Math.min(1, (ms - t) / 600));
      if (t < ms) requestAnimationFrame(frame);
      else canvas.remove();
    };
    requestAnimationFrame(frame);
  }

  // ---------- loop ----------
  let last = performance.now();
  function step(now) {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    const floor = ground();
    const idleFor = now - state.lastInput;

    if (idleFor > 28000 && state.mode !== "sleep" && now > state.talkUntil) {
      state.mode = "sleep";
      mascot.classList.add("is-sleeping");
    }
    if (now > state.talkUntil) mascot.classList.remove("is-talking");
    if (now > state.party) mascot.classList.remove("is-party");

    if (state.mode !== "sleep" && moving()) {
      if (now - state.pointerAt < 2200) {
        state.target = state.pointerX;
      } else if (now > state.wanderAt) {
        state.target = floor.left + Math.random() * (floor.right - floor.left);
        state.wanderAt = now + 4000 + Math.random() * 6000;
      }
      state.target = Math.max(floor.left, Math.min(floor.right - 30, state.target));
      const gap = state.target - state.x;
      const speed = now - state.pointerAt < 2200 ? 120 : 45;
      const walking = Math.abs(gap) > 4;
      if (walking) {
        state.x += Math.sign(gap) * Math.min(Math.abs(gap), speed * dt);
        state.facing = Math.sign(gap);
      }
      mascot.classList.toggle("is-walking", walking);
    } else mascot.classList.remove("is-walking");

    // Gravity: jumps, and the floor moves between views.
    state.vy += 700 * dt;
    state.y += state.vy * dt;
    if (state.y >= floor.y) {
      state.y = floor.y;
      state.vy = 0;
    }
    state.x = Math.max(floor.left, Math.min(floor.right - 30, state.x));

    // Eyes look at the pointer.
    const dx = Math.max(-1, Math.min(1, (state.pointerX - state.x) / 200));
    const dy = Math.max(-1, Math.min(1, (state.pointerY - state.y) / 200));
    eyes.setAttribute("transform", `translate(${(dx * 0.8 * state.facing).toFixed(2)} ${(dy * 0.6).toFixed(2)})`);
    mascot.style.transform = `translate3d(${state.x.toFixed(1)}px, ${(state.y - 30).toFixed(1)}px, 0)`;
    mascot.querySelector(".cl-sprite").style.transform = `scaleX(${state.facing})`;
    // Keep the bubble inside the screen.
    mascot.classList.toggle("bubble-left", state.x > innerWidth - 220);
    requestAnimationFrame(step);
  }
  state.y = ground().y;
  requestAnimationFrame(step);

  // ---------- terminal commands ----------
  const FORTUNES = [
    "Funciona na minha máquina. — todo dev, sempre",
    "Primeiro resolva o problema. Depois escreva o código. — John Johnson",
    "Simplicidade é pré-requisito para confiabilidade. — Dijkstra",
    "Código é lido muito mais vezes do que é escrito.",
    "Não existe nuvem, é só o computador de outra pessoa.",
    "Todo bug é uma feature que ainda não tem documentação.",
    "Faça funcionar, faça certo, faça rápido — nessa ordem. — Kent Beck",
    "git commit -m 'agora vai' (não foi)",
  ];
  const started = Date.now();
  function uptime() {
    const seconds = Math.floor((Date.now() - started) / 1000);
    return `${Math.floor(seconds / 60)} min ${seconds % 60} s`;
  }
  function neofetch() {
    const theme = document.documentElement.dataset.theme || "noite";
    return [
      "   ██████ ███    ███     claudio@dev",
      "  ██      ████  ████     -----------",
      "  ██      ██ ████ ██     os         portfolio (html · css · js puro)",
      "  ██      ██  ██  ██     host       vercel",
      "   ██████ ██      ██     uptime     " + uptime(),
      "                         shell      fish (de mentirinha)",
      "                         tema       " + theme,
      "                         mascote    claudinho ✳",
      "                         foco       backend · dados · IA",
      "                         local      Brasília, BR",
      "                         conquistas " + unlocked.size + "/" + Object.keys(ACHIEVEMENTS).length,
    ].join("\n");
  }

  window.PortfolioExtras = {
    command(command, argument) {
      unlock("hacker");
      switch (command) {
        case "claudinho":
        case "mascote": {
          const [action, ...rest] = argument.split(" ");
          if (action === "pet" || action === "carinho") {
            say("hehe 🥰");
            celebrate(800);
            unlock("friend");
            return { text: "claudinho ronrona. (sim, mascote de código ronrona)" };
          }
          if (action === "feed" || action === "comer") {
            say("nham nham… um bug crocante 🐛");
            return { text: "você deu um bug pro claudinho. ele adorou." };
          }
          if (action === "dance" || action === "dança") {
            celebrate(3000);
            say("♪ ┏(・o・)┛ ♪", 3000);
            return { text: "♪ ┏(・o・)┛ ♪ ┗(・o・)┓ ♪" };
          }
          if (action === "sleep" || action === "dormir") {
            state.mode = "sleep";
            state.lastInput = -1e9;
            mascot.classList.add("is-sleeping");
            return { text: "claudinho foi tirar um cochilo. zzz" };
          }
          if (action === "say" || action === "fala") {
            say(rest.join(" ") || "…");
            return { text: "claudinho disse: " + (rest.join(" ") || "…") };
          }
          say(pick(CLICK_LINES));
          return {
            text: "claudinho ✳ — Claudio + Claude\nmascote oficial, comedor de bugs e fiscal de commits.\n\nuso: claudinho [pet | feed | dance | sleep | say <texto>]",
          };
        }
        case "neofetch":
          return { text: neofetch() };
        case "fortune":
          return { text: pick(FORTUNES) };
        case "coffee":
        case "cafe":
        case "café":
          say("☕ saindo um expresso!");
          return { text: "    ( (\n     ) )\n  ........\n  |      |]\n  \\      /\n   `----'\nclaudinho buscou café. bora codar." };
        case "hire":
        case "contrate":
        case "contratar":
          say("boa escolha! 💼");
          return {
            text: "Claudio está aberto a oportunidades em backend, dados e IA.",
            links: [
              { label: "email ↗", href: "mailto:cmeireles756@gmail.com" },
              { label: "linkedin ↗", href: "https://www.linkedin.com/in/cgfm1" },
              { label: "currículo ↓", href: "assets/Claudio_Meireles_CV.pdf", download: true },
            ],
          };
        case "achievements":
        case "conquistas":
          return {
            text: Object.entries(ACHIEVEMENTS)
              .map(([id, label]) => `${unlocked.has(id) ? "[x]" : "[ ]"} ${unlocked.has(id) ? label : label.split(" · ")[0].replace(/./g, "?") + " · ???"}`)
              .join("\n"),
          };
        case "sudo":
          say("🚨 opa opa");
          return { text: "claudio não está no arquivo sudoers.\neste incidente será reportado ao claudinho." };
        case "rm":
          say("NÃO! 😱");
          return { text: "rm: permissão negada. o claudinho protege este sistema." };
        case "matrix":
          rain(4000);
          return { text: "wake up, neo…" };
        case "uptime":
          return { text: "no ar há " + uptime() + " · programando desde 2022" };
        case "vim":
        case "nvim":
          return { text: "você entrou no vim. boa sorte para sair. (dica: :q)" };
        case ":q":
        case ":wq":
          return { text: "viu? nem doeu." };
        case "hello":
        case "oi":
        case "ola":
          say("oiii! 👋");
          return { text: "olá! digite help para ver tudo que dá pra fazer." };
        default:
          return null;
      }
    },
  };
})();
