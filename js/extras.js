(() => {
  "use strict";

  // Achievements, the Konami code and a few terminal easter eggs.

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

  // ---------- achievements ----------
  const ACHIEVEMENTS = {
    hello: "olá, mundo · abriu o portfólio",
    explorer: "explorador · viu todos os projetos",
    tourist: "turista · passou por todas as seções",
    hacker: "hacker · usou o terminal",
    konami: "↑↑↓↓←→←→BA · achou o segredo",
  };
  const PROJECTS = ["aegis", "clinica", "camf", "scoutlink", "legitrack", "crypto", "soccer"];
  const unlocked = new Set(store.read("cm-achievements", []).filter((id) => id in ACHIEVEMENTS));
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
  }

  document.addEventListener("portfolio:view", (event) => {
    const view = event.detail;
    if (view !== "landing") {
      visited.add(view);
      store.write("cm-visited", [...visited]);
      if (PROJECTS.every((id) => visited.has(id))) unlock("explorer");
      const all = [...document.querySelectorAll(".content-panel")].map((panel) => panel.id);
      if (all.every((id) => visited.has(id))) unlock("tourist");
    }
  });
  setTimeout(() => unlock("hello"), 2500);

  const KONAMI = ["ArrowUp", "ArrowUp", "ArrowDown", "ArrowDown", "ArrowLeft", "ArrowRight", "ArrowLeft", "ArrowRight", "b", "a"];
  let konami = 0;
  addEventListener("keydown", (event) => {
    const key = event.key.length === 1 ? event.key.toLowerCase() : event.key;
    konami = key === KONAMI[konami] ? konami + 1 : key === KONAMI[0] ? 1 : 0;
    if (konami === KONAMI.length) {
      konami = 0;
      unlock("konami");
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
    const glyphs = "claudio01{}[]<>/=;:";
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
            "                         foco       backend · dados · IA",
      "                         local      Brasília, BR",
      "                         conquistas " + unlocked.size + "/" + Object.keys(ACHIEVEMENTS).length,
    ].join("\n");
  }

  window.PortfolioExtras = {
    command(command, argument) {
      unlock("hacker");
      switch (command) {
        case "neofetch":
          return { text: neofetch() };
        case "fortune":
          return { text: pick(FORTUNES) };
        case "coffee":
        case "cafe":
        case "café":
          return { text: "    ( (\n     ) )\n  ........\n  |      |]\n  \\      /\n   `----'\ncafé pronto. bora codar." };
        case "hire":
        case "contrate":
        case "contratar":
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
          return { text: "claudio não está no arquivo sudoers.\neste incidente será reportado." };
        case "rm":
          return { text: "rm: permissão negada. este portfólio é protegido contra acidentes." };
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
          return { text: "olá! digite help para ver tudo que dá pra fazer." };
        default:
          return null;
      }
    },
  };
})();
