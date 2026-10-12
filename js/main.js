(() => {
  "use strict";

  const root = document.documentElement;
  const body = document.body;
  const landing = document.getElementById("landing");
  const workspace = document.getElementById("workspace");
  const panels = [...document.querySelectorAll(".content-panel")];
  const wheel = document.getElementById("project-wheel");
  const items = [...wheel.querySelectorAll(".wheel-item")];
  const scroller = document.getElementById("terminal-scroll");
  const commandForm = document.getElementById("command-form");
  const commandInput = document.getElementById("command-input");
  const commandOutput = document.getElementById("command-output");
  const themeDialog = document.getElementById("theme-dialog");
  const motionButton = document.getElementById("motion-button");
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const mobile = window.matchMedia("(max-width: 650px)");
  const storage = {
    read(key) {
      try {
        return window.localStorage.getItem(key);
      } catch {
        return null;
      }
    },
    write(key, value) {
      try {
        window.localStorage.setItem(key, value);
      } catch {
        /* Navigation also works without storage. */
      }
    },
  };
  const themes = ["noite", "fosforo", "papel"];
  const aliases = {
    hero: "about",
    whoami: "about",
    projects: "crypto",
    projetos: "crypto",
    "crypto-pipeline": "crypto",
    "soccer-vision": "soccer",
    "air-quality": "air",
    "carreta-digital": "carreta",
    stack: "skills",
    experiencia: "experience",
    trajetoria: "experience",
    "trajetoria.log": "experience",
    contato: "contact",
    tema: "themes",
  };
  let currentIndex = 0;
  let inWorkspace = false;
  let animationFrame = 0;
  let lastFrame = 0;
  let motionEnabled =
    storage.read("cm-motion") !== "off" && !reducedMotion.matches;
  let palette = {};
  let toastTimer;
  let pointer = { x: 0, y: 0 };

  function showToast(message) {
    const toast = document.getElementById("toast");
    toast.textContent = message;
    toast.classList.add("is-visible");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove("is-visible"), 3500);
  }

  function normalize(value) {
    return value
      .trim()
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "");
  }

  function resolvePanel(value) {
    const key = normalize(value.replace(/^#/, ""));
    const id = aliases[key] || key;
    return panels.some((panel) => panel.id === id) ? id : null;
  }

  function setHash(id) {
    const nextHash = id ? "#" + id : "";
    if (window.location.hash === nextHash) return;
    try {
      history.pushState(
        null,
        "",
        window.location.pathname + window.location.search + nextHash,
      );
    } catch {
      window.location.hash = nextHash;
    }
  }

  function positionWheel() {
    const half = Math.floor(items.length / 2);
    items.forEach((item, index) => {
      let distance = index - currentIndex;
      if (distance > half) distance -= items.length;
      if (distance < -half) distance += items.length;
      const active = index === currentIndex;
      item.classList.toggle("is-active", active);
      if (active) item.setAttribute("aria-current", "page");
      else item.removeAttribute("aria-current");
      const x = Math.abs(distance) ** 1.6 * 5;
      const y = distance * 108 - 49;
      item.style.transform = `translate(${x}px, ${y}px) rotate(${distance * -10}deg) scale(${active ? 1 : 0.86})`;
      item.style.opacity = String(
        active ? 1 : Math.max(0.18, 0.76 - Math.abs(distance) * 0.13),
      );
      item.style.zIndex = String(10 - Math.abs(distance));
    });
    if (mobile.matches && inWorkspace) {
      const item = items[currentIndex];
      wheel.scrollTo({
        left: item.offsetLeft - (wheel.clientWidth - item.offsetWidth) / 2,
        behavior: motionEnabled ? "smooth" : "instant",
      });
    }
  }

  function showPanel(id, options = {}) {
    const panelId = resolvePanel(id) || "about";
    const previousFocus = document.activeElement;
    const focusWasHidden =
      previousFocus &&
      panels.some(
        (panel) => panel.id !== panelId && panel.contains(previousFocus),
      );
    inWorkspace = true;
    body.classList.add("is-workspace");
    landing.hidden = true;
    workspace.hidden = false;
    currentIndex = items.findIndex((item) => item.dataset.panel === panelId);
    panels.forEach((panel) => {
      panel.hidden = panel.id !== panelId;
    });
    const panel = panels.find((entry) => entry.id === panelId);
    document.getElementById("terminal-path").textContent =
      "claudio — " + panel.dataset.path;
    document.getElementById("status-section").textContent =
      items[currentIndex].querySelector(".wheel-title").textContent;
    commandOutput.replaceChildren();
    scroller.scrollTop = 0;
    if (options.history !== false) setHash(panelId);
    positionWheel();
    resizeCanvases();
    paintFrame(performance.now());
    document.getElementById("navigation-announcement").textContent =
      panel.querySelector("h2").textContent;
    if (options.focus || focusWasHidden)
      scroller.focus({ preventScroll: true });
    if (mobile.matches && options.scroll !== false)
      window.scrollTo({ top: 0, behavior: "instant" });
  }

  function showLanding(options = {}) {
    inWorkspace = false;
    body.classList.remove("is-workspace");
    workspace.hidden = true;
    landing.hidden = false;
    if (options.history !== false) setHash("");
    window.scrollTo({ top: 0, behavior: "instant" });
    renderCode();
    if (options.focus)
      document.querySelector(".enter-link").focus({ preventScroll: true });
  }

  function route() {
    if (!window.location.hash || window.location.hash === "#")
      showLanding({ history: false });
    else
      showPanel(resolvePanel(window.location.hash) || "about", {
        history: false,
      });
  }

  function stepPanel(direction) {
    const index = (currentIndex + direction + items.length) % items.length;
    showPanel(items[index].dataset.panel);
  }

  document.addEventListener("click", (event) => {
    const anchor = event.target.closest('a[href^="#"]');
    if (
      !anchor ||
      event.ctrlKey ||
      event.metaKey ||
      event.shiftKey ||
      event.altKey ||
      event.button !== 0
    )
      return;
    const hash = anchor.getAttribute("href");
    if (hash === "#") {
      event.preventDefault();
      showLanding({ focus: true });
    } else {
      const id = resolvePanel(hash);
      if (!id) return;
      event.preventDefault();
      showPanel(id, { focus: !anchor.classList.contains("wheel-item") });
    }
  });
  window.addEventListener("popstate", route);
  window.addEventListener("hashchange", route);
  document
    .getElementById("previous-panel")
    .addEventListener("click", () => stepPanel(-1));
  document
    .getElementById("next-panel")
    .addEventListener("click", () => stepPanel(1));

  let wheelAmount = 0;
  let lastWheelStep = 0;
  wheel.addEventListener(
    "wheel",
    (event) => {
      if (mobile.matches || Math.abs(event.deltaY) < Math.abs(event.deltaX))
        return;
      event.preventDefault();
      const now = performance.now();
      if (now - lastWheelStep < 230) return;
      wheelAmount += event.deltaY;
      if (Math.abs(wheelAmount) >= 35) {
        stepPanel(wheelAmount > 0 ? 1 : -1);
        wheelAmount = 0;
        lastWheelStep = now;
      }
    },
    { passive: false },
  );

  let drag = null;
  let suppressClick = false;
  wheel.addEventListener("pointerdown", (event) => {
    if (mobile.matches || event.button !== 0 || event.pointerType === "touch")
      return;
    drag = { y: event.clientY, start: event.clientY, moved: false };
  });
  window.addEventListener(
    "pointermove",
    (event) => {
      pointer = {
        x: (event.clientX / window.innerWidth - 0.5) * 2,
        y: (event.clientY / window.innerHeight - 0.5) * 2,
      };
      if (!drag) return;
      const difference = event.clientY - drag.y;
      if (Math.abs(event.clientY - drag.start) > 9) drag.moved = true;
      if (Math.abs(difference) > 70) {
        stepPanel(difference > 0 ? -1 : 1);
        drag.y = event.clientY;
      }
    },
    { passive: true },
  );
  window.addEventListener("pointerup", () => {
    suppressClick = Boolean(drag && drag.moved);
    drag = null;
    if (suppressClick)
      setTimeout(() => {
        suppressClick = false;
      }, 0);
  });
  window.addEventListener("pointercancel", () => {
    drag = null;
  });
  wheel.addEventListener("dragstart", (event) => event.preventDefault());
  wheel.addEventListener(
    "click",
    (event) => {
      if (suppressClick) {
        event.preventDefault();
        event.stopPropagation();
        suppressClick = false;
      }
    },
    true,
  );
  wheel.addEventListener("focusin", (event) => {
    const item = event.target.closest(".wheel-item");
    if (item && item.dataset.panel !== panels[currentIndex].id)
      showPanel(item.dataset.panel);
  });

  function readPalette() {
    const styles = getComputedStyle(root);
    ["bg", "text", "accent", "dim", "muted", "warm"].forEach((key) => {
      palette[key] = styles.getPropertyValue("--" + key).trim();
    });
  }

  function selectTheme(theme, persist = true) {
    if (!themes.includes(theme)) return false;
    root.dataset.theme = theme;
    if (persist) storage.write("cm-theme", theme);
    document
      .querySelectorAll("[data-theme-choice]")
      .forEach((button) =>
        button.setAttribute(
          "aria-pressed",
          String(button.dataset.themeChoice === theme),
        ),
      );
    document.getElementById("status-theme").textContent =
      theme === "fosforo" ? "fósforo" : theme;
    readPalette();
    document
      .querySelector('meta[name="theme-color"]')
      .setAttribute("content", palette.bg);
    if (inWorkspace) paintFrame(performance.now());
    return true;
  }

  function openThemes() {
    if (!themeDialog.open) themeDialog.showModal();
  }
  document
    .querySelectorAll(".theme-trigger")
    .forEach((button) => button.addEventListener("click", openThemes));
  document
    .getElementById("close-theme-dialog")
    .addEventListener("click", () => themeDialog.close());
  themeDialog.addEventListener("click", (event) => {
    if (event.target === themeDialog) {
      const rect = themeDialog.getBoundingClientRect();
      if (
        event.clientX < rect.left ||
        event.clientX > rect.right ||
        event.clientY < rect.top ||
        event.clientY > rect.bottom
      )
        themeDialog.close();
    }
  });
  document.querySelectorAll("[data-theme-choice]").forEach((button) =>
    button.addEventListener("click", () => {
      selectTheme(button.dataset.themeChoice);
      if (themeDialog.open) themeDialog.close();
    }),
  );

  const historyEntries = [];
  let historyIndex = 0;
  let inputDraft = "";
  const helpText = [
    "help                 todos os comandos",
    "whoami               sobre mim",
    "ls / projetos        lista de projetos",
    "open crypto          pipeline de criptomoedas",
    "open soccer          análise tática de futebol",
    "open air             qualidade do ar",
    "open carreta         Carreta Digital",
    "stack                tecnologias",
    "experiencia          trajetória e formação",
    "contato              vamos conversar",
    "cv / github / email  mostrar link",
    "tema [noite|fosforo|papel]",
    "clear                limpar respostas",
    "exit                 voltar à entrada",
  ].join("\n");

  function appendOutput(command, response, links = []) {
    const entry = document.createElement("div");
    entry.className = "command-entry";
    const prompt = document.createElement("p");
    prompt.className = "prompt";
    prompt.textContent = "claudio@dev › " + command;
    const text = document.createElement("pre");
    text.textContent = response;
    entry.append(prompt, text);
    if (links.length) {
      const container = document.createElement("div");
      container.className = "inline-links";
      links.forEach((link) => {
        const anchor = document.createElement("a");
        anchor.textContent = link.label;
        anchor.href = link.href;
        if (link.download) anchor.setAttribute("download", "");
        if (/^https:/.test(link.href)) {
          anchor.target = "_blank";
          anchor.rel = "noopener noreferrer";
        }
        container.append(anchor);
      });
      entry.append(container);
    }
    commandOutput.append(entry);
    while (commandOutput.children.length > 15)
      commandOutput.firstElementChild.remove();
    scroller.scrollTop = scroller.scrollHeight;
    if (mobile.matches)
      entry.scrollIntoView({ block: "nearest", behavior: "instant" });
  }

  function runCommand(raw) {
    const value = normalize(raw);
    if (!value) return;
    const [command, ...args] = value.split(/\s+/);
    const argument = args.join(" ");
    const direct = {
      whoami: "about",
      sobre: "about",
      stack: "skills",
      skills: "skills",
      experiencia: "experience",
      trajetoria: "experience",
      contato: "contact",
      contact: "contact",
    };
    if (direct[command]) {
      showPanel(direct[command]);
      return;
    }
    if (command === "open" || command === "cd") {
      const target = resolvePanel(
        argument.replace(/^(~\/)?(projetos\/)?/, "").replace(/\/$/, ""),
      );
      if (target) {
        showPanel(target);
        return;
      }
      appendOutput(raw, "Seção não encontrada. Use ls para ver os projetos.");
      return;
    }
    if (command === "help" || command === "ajuda" || command === "?")
      appendOutput(raw, helpText);
    else if (["ls", "projetos", "projects"].includes(command)) {
      appendOutput(raw, "04 projetos / escolha um arquivo:", [
        { label: "01 crypto-pipeline", href: "#crypto" },
        { label: "02 soccer-vision", href: "#soccer" },
        { label: "03 air-quality", href: "#air" },
        { label: "04 carreta-digital", href: "#carreta" },
      ]);
    } else if (command === "tema" || command === "theme") {
      if (!argument) {
        openThemes();
        return;
      }
      if (selectTheme(argument))
        appendOutput(raw, "Paleta selecionada: " + argument + ".");
      else appendOutput(raw, "Temas disponíveis: noite, fosforo, papel.");
    } else if (command === "cv")
      appendOutput(raw, "Currículo de Claudio Meireles:", [
        {
          label: "baixar currículo ↓",
          href: "assets/Claudio_Meireles_CV.pdf",
          download: true,
        },
      ]);
    else if (command === "github")
      appendOutput(raw, "Meus repositórios no GitHub:", [
        {
          label: "github.com/ClaudioAMF1 ↗",
          href: "https://github.com/ClaudioAMF1",
        },
      ]);
    else if (command === "email")
      appendOutput(raw, "Pode me chamar por aqui:", [
        {
          label: "cmeireles756@gmail.com ↗",
          href: "mailto:cmeireles756@gmail.com",
        },
      ]);
    else if (command === "pwd")
      appendOutput(raw, panels[currentIndex].dataset.path);
    else if (command === "clear" || command === "limpar")
      commandOutput.replaceChildren();
    else if (command === "exit" || command === "sair")
      showLanding({ focus: true });
    else
      appendOutput(
        raw,
        "Comando não encontrado: " + raw + "\nDigite help para ver as opções.",
      );
  }

  commandForm.addEventListener("submit", (event) => {
    event.preventDefault();
    const value = commandInput.value.trim();
    if (!value) return;
    if (historyEntries[historyEntries.length - 1] !== value)
      historyEntries.push(value);
    if (historyEntries.length > 40) historyEntries.shift();
    historyIndex = historyEntries.length;
    inputDraft = "";
    commandInput.value = "";
    runCommand(value);
  });
  commandInput.addEventListener("keydown", (event) => {
    if (event.key === "ArrowUp") {
      event.preventDefault();
      if (historyIndex === historyEntries.length)
        inputDraft = commandInput.value;
      if (historyIndex > 0) commandInput.value = historyEntries[--historyIndex];
    } else if (event.key === "ArrowDown") {
      event.preventDefault();
      if (historyIndex < historyEntries.length - 1)
        commandInput.value = historyEntries[++historyIndex];
      else {
        historyIndex = historyEntries.length;
        commandInput.value = inputDraft;
      }
    } else if (event.key === "Escape") {
      event.preventDefault();
      commandInput.blur();
    } else if (event.key === "Tab") {
      const commands = [
        "help",
        "whoami",
        "projetos",
        "open crypto",
        "open soccer",
        "open air",
        "open carreta",
        "stack",
        "experiencia",
        "contato",
        "cv",
        "github",
        "email",
        "tema",
        "clear",
        "exit",
      ];
      const matches = commands.filter((command) =>
        command.startsWith(normalize(commandInput.value)),
      );
      if (commandInput.value && matches.length === 1) {
        event.preventDefault();
        commandInput.value = matches[0];
      }
    }
  });
  document.getElementById("help-button").addEventListener("click", () => {
    runCommand("help");
    commandInput.focus({ preventScroll: true });
  });
  document.addEventListener("keydown", (event) => {
    if (
      event.defaultPrevented ||
      event.ctrlKey ||
      event.metaKey ||
      event.altKey ||
      themeDialog.open
    )
      return;
    if (
      event.target.closest('input, textarea, select, [contenteditable="true"]')
    )
      return;
    if (
      !inWorkspace &&
      event.key === "Enter" &&
      !event.target.closest("a, button")
    ) {
      event.preventDefault();
      showPanel("about", { focus: true });
    } else if (
      event.key.toLowerCase() === "t" &&
      !event.target.closest("a, button")
    ) {
      event.preventDefault();
      openThemes();
    } else if (inWorkspace && event.key === "Escape") {
      event.preventDefault();
      showLanding({ focus: true });
    } else if (inWorkspace && event.key === "/") {
      event.preventDefault();
      commandInput.focus();
    } else if (
      inWorkspace &&
      ["ArrowUp", "ArrowDown", "Home", "End"].includes(event.key)
    ) {
      if (
        !event.target.closest("#project-wheel") &&
        event.target !== body &&
        event.target !== root
      )
        return;
      event.preventDefault();
      if (event.key === "Home") showPanel("about");
      else if (event.key === "End") showPanel("themes");
      else stepPanel(event.key === "ArrowDown" ? 1 : -1);
      if (event.target.closest("#project-wheel"))
        items[currentIndex].focus({ preventScroll: true });
    }
  });

  const contactForm = document.getElementById("contact-form");
  const messageInput = document.getElementById("message");
  messageInput.addEventListener("input", () => {
    document.getElementById("char-count").textContent = String(
      messageInput.value.length,
    );
  });
  contactForm.addEventListener("submit", (event) => {
    event.preventDefault();
    if (!contactForm.reportValidity()) return;
    const name = document.getElementById("name").value.trim();
    const email = document.getElementById("email").value.trim();
    const message = messageInput.value.trim();
    if (!name || !message) {
      showToast("Preencha o nome e a mensagem.");
      return;
    }
    const subject =
      document.getElementById("subject").value.trim() ||
      "Contato pelo portfólio";
    const content = `Nome: ${name}\nEmail: ${email}\n\n${message}`;
    const href =
      "mailto:cmeireles756@gmail.com?subject=" +
      encodeURIComponent(subject) +
      "&body=" +
      encodeURIComponent(content);
    appendOutput(
      "compose email",
      "Sua mensagem está preparada. Abra o app de email para revisar e enviar.",
      [{ label: "abrir email preparado ↗", href }],
    );
    showToast("Email preparado. Revise no seu app antes de enviar.");
  });

  const snippets = [
    {
      file: "portfolio / claudio.py",
      code: [
        "# Claudio Meireles — código, dados e ideias.",
        "# Backend / Data Engineering / Artificial Intelligence",
        "",
        "from dataclasses import dataclass",
        "from typing import Iterable",
        "",
        "@dataclass",
        "class Developer:",
        '    name: str = "Claudio Meireles"',
        '    location: str = "Brasília, BR"',
        '    focus: tuple = ("backend", "data", "AI")',
        "",
        "    def build(self, idea):",
        "        prototype = self.explore(idea)",
        "        return self.refine(prototype)",
        "",
        "    def explore(self, idea):",
        '        return {"idea": idea, "curiosity": True}',
        "",
        "    def refine(self, prototype):",
        '        prototype["next_step"] = "keep building"',
        "        return prototype",
        "",
        "def pipeline(events: Iterable):",
        "    for event in events:",
        "        if event is not None:",
        "            yield transform(event)",
        "",
        "def transform(event):",
        '    return {"data": event, "processed": True}',
        "",
        "projects = (",
        '    "crypto-pipeline",',
        '    "soccer-vision",',
        '    "air-quality",',
        '    "carreta-digital",',
        ")",
        "",
        "claudio = Developer()",
        "for project in projects:",
        "    claudio.build(project)",
        "",
        "# pequenas ideias. sistemas maiores.",
      ],
    },
    {
      file: "portfolio / pipeline.py",
      code: [
        "# Tudo começa com um evento.",
        "from collections import deque",
        "from dataclasses import dataclass",
        "",
        "@dataclass",
        "class Event:",
        "    source: str",
        "    payload: dict",
        "",
        "class Pipeline:",
        "    def __init__(self):",
        "        self.queue = deque()",
        "        self.processed = 0",
        "",
        "    def ingest(self, event: Event):",
        "        self.queue.append(event)",
        "",
        "    def consume(self):",
        "        while self.queue:",
        "            event = self.queue.popleft()",
        "            yield self.transform(event)",
        "",
        "    def transform(self, event):",
        "        self.processed += 1",
        "        return {",
        '            "source": event.source,',
        '            "data": event.payload,',
        '            "status": "processed",',
        "        }",
        "",
        "pipeline = Pipeline()",
        'pipeline.ingest(Event("portfolio", {"hello": "world"}))',
        "",
        "for result in pipeline.consume():",
        "    print(result)",
        "",
        "# coletar → processar → entender → construir",
      ],
    },
  ];
  let snippetIndex = 0;
  let activeLine = 3;
  let activeCharacter = 0;
  let lastCodeTick = 0;
  let highlightedKey;
  const codeStage = document.getElementById("code-stage");
  const keyboardKeys = [...document.querySelectorAll(".key-row span")];

  function highlightLine(text) {
    const fragment = document.createDocumentFragment();
    const tokens =
      /(#.*$|"[^"]*"|'[^']*'|\b(?:from|import|class|def|return|for|in|if|while|yield|is|not|None|True|False)\b)/g;
    let position = 0;
    for (const match of text.matchAll(tokens)) {
      fragment.append(
        document.createTextNode(text.slice(position, match.index)),
      );
      const span = document.createElement("span");
      span.className = match[0].startsWith("#")
        ? "code-comment"
        : /^["']/.test(match[0])
          ? "code-string"
          : "code-keyword";
      span.textContent = match[0];
      fragment.append(span);
      position = match.index + match[0].length;
    }
    fragment.append(document.createTextNode(text.slice(position)));
    return fragment;
  }

  function renderCode() {
    const snippet = snippets[snippetIndex];
    document.getElementById("source-label").textContent = snippet.file;
    const fragment = document.createDocumentFragment();
    snippet.code.forEach((line, index) => {
      const row = document.createElement("div");
      row.className = "code-row" + (index === activeLine ? " current" : "");
      const number = document.createElement("span");
      number.className = "code-number";
      number.textContent = String(index + 1);
      const source = document.createElement("span");
      source.className = "code-source";
      source.append(
        highlightLine(
          index === activeLine && motionEnabled
            ? line.slice(0, activeCharacter)
            : line,
        ),
      );
      if (index === activeLine) {
        const caret = document.createElement("span");
        caret.className = "code-caret";
        source.append(caret);
      }
      row.append(number, source);
      fragment.append(row);
    });
    codeStage.replaceChildren(fragment);
    document.getElementById("code-position").textContent =
      `${activeLine + 1}:${activeCharacter + 1}`;
  }

  function updateCode(time) {
    if (time - lastCodeTick < 105) return;
    lastCodeTick = time;
    const line = snippets[snippetIndex].code[activeLine];
    activeCharacter += 2;
    if (activeCharacter > line.length + 8) {
      activeCharacter = 0;
      activeLine++;
      const visibleLines = Math.min(
        snippets[snippetIndex].code.length,
        Math.max(14, Math.floor(codeStage.clientHeight / 20)),
      );
      if (activeLine >= visibleLines - 3) {
        snippetIndex = (snippetIndex + 1) % snippets.length;
        activeLine = 3;
      }
    }
    renderCode();
    if (highlightedKey) highlightedKey.classList.remove("key-lit");
    const letter = line
      .charAt(Math.min(activeCharacter, line.length - 1))
      .toLowerCase();
    highlightedKey = keyboardKeys.find((key) => key.textContent === letter);
    if (highlightedKey) highlightedKey.classList.add("key-lit");
  }

  function prepareCanvas(id) {
    const canvas = document.getElementById(id);
    const context = canvas.getContext("2d");
    return { canvas, context, width: 0, height: 0 };
  }
  const branch = prepareCanvas("branch-canvas");
  const orbit = prepareCanvas("orbit-canvas");
  function resizeCanvas(surface) {
    if (!surface.context) return;
    const bounds = surface.canvas.getBoundingClientRect();
    if (!bounds.width || !bounds.height) return;
    const scale = Math.min(window.devicePixelRatio || 1, 2);
    surface.width = bounds.width;
    surface.height = bounds.height;
    surface.canvas.width = Math.round(bounds.width * scale);
    surface.canvas.height = Math.round(bounds.height * scale);
    surface.context.setTransform(scale, 0, 0, scale, 0, 0);
  }
  function resizeCanvases() {
    if (!inWorkspace) return;
    resizeCanvas(branch);
    resizeCanvas(orbit);
  }
  function seeded(index) {
    const value = Math.sin(index * 127.1 + 311.7) * 43758.5453;
    return value - Math.floor(value);
  }
  function drawBranch(time) {
    if (!branch.context || mobile.matches || !branch.width) return;
    const ctx = branch.context;
    const { width, height } = branch;
    ctx.clearRect(0, 0, width, height);
    ctx.strokeStyle = palette.text;
    ctx.lineWidth = 0.6;
    ctx.globalAlpha = 0.55;
    const points = [];
    for (let i = 0; i <= 44; i++) {
      const y = 22 + ((height - 65) * i) / 44;
      const x =
        24 + Math.sin(i * 0.31 + time * 0.00016) * 10 + seeded(i + 1) * 8;
      points.push({ x, y });
    }
    ctx.beginPath();
    points.forEach((point, index) =>
      index ? ctx.lineTo(point.x, point.y) : ctx.moveTo(point.x, point.y),
    );
    ctx.stroke();
    points.forEach((point, index) => {
      if (index % 2) return;
      const spread = 30 + seeded(index + 18) * 35;
      const direction = index % 4 ? 1 : -1;
      for (let ray = 0; ray < 8; ray++) {
        const endpointX =
          point.x + direction * (11 + seeded(index * 8 + ray + 73) * spread);
        const endpointY = point.y + (seeded(index * 11 + ray + 19) - 0.5) * 78;
        const midpointX = point.x + direction * 12;
        const midpointY = point.y + (endpointY - point.y) * 0.36;
        ctx.globalAlpha = 0.13 + seeded(ray + index) * 0.28;
        ctx.beginPath();
        ctx.moveTo(point.x, point.y);
        ctx.lineTo(midpointX, midpointY);
        ctx.lineTo(endpointX, endpointY);
        ctx.stroke();
        ctx.fillStyle = palette.text;
        ctx.globalAlpha = 0.55;
        ctx.fillRect(endpointX, endpointY, 1.3, 1.3);
      }
      ctx.fillRect(point.x - 1, point.y - 1, 2, 2);
    });
    ctx.globalAlpha = 1;
  }
  function drawOrbit(time) {
    if (!orbit.context || !orbit.width || window.innerWidth <= 940) return;
    const ctx = orbit.context;
    const { width, height } = orbit;
    ctx.clearRect(0, 0, width, height);
    const radius = Math.min(width, height) * 0.39;
    const angle = time * 0.00013 + pointer.x * 0.22;
    const tilt = -0.25 + pointer.y * 0.13;
    const dots = [];
    for (let row = 1; row < 18; row++) {
      const latitude = (Math.PI * row) / 18;
      for (let column = 0; column < 30; column++) {
        const longitude = (Math.PI * 2 * column) / 30 + angle;
        const x = Math.sin(latitude) * Math.cos(longitude);
        const y = Math.cos(latitude);
        const z = Math.sin(latitude) * Math.sin(longitude);
        dots.push({
          x,
          y: y * Math.cos(tilt) - z * Math.sin(tilt),
          z: y * Math.sin(tilt) + z * Math.cos(tilt),
          index: row + column,
        });
      }
    }
    dots.sort((a, b) => a.z - b.z);
    ctx.font = "6px monospace";
    dots.forEach((dot) => {
      ctx.globalAlpha = 0.08 + (dot.z + 1) * 0.33;
      ctx.fillStyle = dot.z > 0.6 ? palette.text : palette.muted;
      const x = width / 2 + dot.x * radius;
      const y = height / 2 + dot.y * radius;
      if (dot.index % 5 === 0) ctx.fillText(dot.z > 0 ? ":" : ".", x, y);
      else ctx.fillRect(x, y, 0.9, 0.9);
    });
    ctx.globalAlpha = 1;
    ctx.strokeStyle = palette.dim;
    ctx.lineWidth = 0.5;
    ctx.beginPath();
    ctx.ellipse(
      width / 2,
      height / 2,
      radius * 1.2,
      radius * 0.3,
      -0.4,
      0,
      Math.PI * 2,
    );
    ctx.stroke();
    document.getElementById("orbit-coordinate").textContent =
      `x ${pointer.x.toFixed(3)} / y ${pointer.y.toFixed(3)}`;
  }
  function paintFrame(time) {
    if (inWorkspace) {
      drawBranch(time);
      drawOrbit(time);
    }
  }
  function animate(time) {
    animationFrame = 0;
    if (!motionEnabled || document.hidden) return;
    if (time - lastFrame >= 33) {
      if (inWorkspace) paintFrame(time);
      else updateCode(time);
      lastFrame = time;
    }
    animationFrame = requestAnimationFrame(animate);
  }
  function resumeAnimation() {
    cancelAnimationFrame(animationFrame);
    animationFrame = 0;
    if (motionEnabled && !document.hidden)
      animationFrame = requestAnimationFrame(animate);
  }
  function updateMotion(persist = false) {
    body.classList.toggle("motion-paused", !motionEnabled);
    motionButton.setAttribute("aria-pressed", String(motionEnabled));
    document.getElementById("motion-label").textContent =
      "animação " + (motionEnabled ? "on" : "off");
    if (persist) storage.write("cm-motion", motionEnabled ? "on" : "off");
    renderCode();
    if (!motionEnabled && highlightedKey)
      highlightedKey.classList.remove("key-lit");
    paintFrame(performance.now());
    resumeAnimation();
  }
  motionButton.addEventListener("click", () => {
    motionEnabled = !motionEnabled;
    updateMotion(true);
  });
  reducedMotion.addEventListener("change", (event) => {
    motionEnabled = !event.matches && storage.read("cm-motion") !== "off";
    updateMotion();
  });
  document.addEventListener("visibilitychange", resumeAnimation);
  let resizeFrame;
  window.addEventListener(
    "resize",
    () => {
      cancelAnimationFrame(resizeFrame);
      resizeFrame = requestAnimationFrame(() => {
        positionWheel();
        resizeCanvases();
        paintFrame(performance.now());
      });
    },
    { passive: true },
  );
  const clockFormatter = new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
  function updateClock() {
    if (!document.hidden)
      document.getElementById("clock").textContent = clockFormatter.format(
        new Date(),
      );
  }
  updateClock();
  setInterval(updateClock, 1000);

  const savedTheme = storage.read("cm-theme");
  selectTheme(themes.includes(savedTheme) ? savedTheme : "noite", false);
  commandForm.hidden = false;
  body.classList.add("enhanced");
  renderCode();
  route();
  updateMotion();
})();
