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
  let wheelPosition = 0;
  let wheelTarget = 0;
  let wheelVelocity = 0;
  let wheelSnapTimer;
  let sceneTime = 0;
  const ENTRY_DURATION = 2400;
  let entering = null;
  let enterTimer;
  let inWorkspace = false;
  let animationFrame = 0;
  let lastFrame = 0;
  // A cena da entrada sempre começa em movimento, como na referência.
  // O botão "movimento" pausa só durante a visita atual.
  let motionEnabled = true;
  let palette = {};
  let toastTimer;

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
    if (!mobile.matches) wheel.scrollTop = 0;
    items.forEach((item, index) => {
      let distance = index - wheelPosition;
      distance -= Math.round(distance / items.length) * items.length;
      const active = index === currentIndex;
      item.classList.toggle("is-active", active);
      if (active) item.setAttribute("aria-current", "page");
      else item.removeAttribute("aria-current");
      const angle = distance * 0.3;
      const x = (1 - Math.cos(angle)) * 365;
      const y = Math.sin(angle) * 365 - 49;
      const scale = Math.max(0.65, 1 - Math.abs(distance) * 0.095);
      item.style.transform = `translate3d(${x}px, ${y}px, ${-Math.abs(distance) * 22}px) rotateZ(${-angle * 48}deg) rotateY(${Math.min(Math.abs(distance), 3) * 6}deg) scale(${scale})`;
      item.style.opacity = String(
        active ? 1 : Math.max(0.18, 0.76 - Math.abs(distance) * 0.13),
      );
      item.style.zIndex = String(10 - Math.round(Math.abs(distance)));
    });
    if (mobile.matches && inWorkspace && !drag) {
      const item = items[currentIndex];
      wheel.scrollTo({
        left: item.offsetLeft - (wheel.clientWidth - item.offsetWidth) / 2,
        behavior: motionEnabled ? "smooth" : "instant",
      });
    }
  }

  function animateWheel(dt) {
    if (mobile.matches || !motionEnabled) {
      wheelPosition = wheelTarget;
      wheelVelocity = 0;
      return;
    }
    const difference = wheelTarget - wheelPosition;
    if (Math.abs(difference) < 0.0005 && Math.abs(wheelVelocity) < 0.002) {
      wheelPosition = wheelTarget;
      wheelVelocity = 0;
      return;
    }
    wheelVelocity += difference * 95 * dt;
    wheelVelocity *= Math.exp(-15 * dt);
    wheelPosition += wheelVelocity * dt;
    positionWheel();
  }

  function selectWheelTarget(target) {
    wheelTarget = target;
    const selected =
      ((Math.round(target) % items.length) + items.length) % items.length;
    if (selected !== currentIndex)
      showPanel(items[selected].dataset.panel, {
        wheelFree: true,
        scroll: false,
      });
    if (!motionEnabled) {
      wheelPosition = target;
      positionWheel();
      paintFrame(sceneTime);
    }
  }

  function settleWheel() {
    selectWheelTarget(Math.round(wheelTarget));
  }

  function cancelEntry() {
    if (!entering) return;
    entering = null;
    clearTimeout(enterTimer);
    visuals.endEntry();
    body.classList.remove("is-entering");
    body.dataset.entryState = "idle";
    landing.removeAttribute("aria-busy");
  }

  function finishEntry() {
    if (!entering) return;
    const id = entering.id;
    cancelEntry();
    showPanel(id);
    items[currentIndex].focus({ preventScroll: true });
  }

  function enterPortfolio(id = "about") {
    if (entering) return;
    if (
      inWorkspace ||
      !motionEnabled ||
      !visuals.beginEntry(performance.now(), ENTRY_DURATION)
    ) {
      showPanel(id, { focus: true });
      return;
    }
    entering = { id, started: performance.now() };
    body.classList.add("is-entering");
    body.dataset.entryState = "zooming";
    landing.setAttribute("aria-busy", "true");
    document.getElementById("navigation-announcement").textContent =
      "Abrindo portfólio";
    paintFrame(sceneTime);
    enterTimer = setTimeout(finishEntry, ENTRY_DURATION + 300);
    resumeAnimation();
  }

  function showPanel(id, options = {}) {
    cancelEntry();
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
    if (!options.wheelFree) {
      wheelTarget =
        currentIndex +
        Math.round((wheelTarget - currentIndex) / items.length) * items.length;
      if (!motionEnabled || options.history === false) {
        wheelPosition = wheelTarget;
        wheelVelocity = 0;
      }
    }
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
    paintFrame(sceneTime);
    document.getElementById("navigation-announcement").textContent =
      panel.querySelector("h2").textContent;
    if (options.focus || focusWasHidden)
      scroller.focus({ preventScroll: true });
    if (mobile.matches && options.scroll !== false)
      window.scrollTo({ top: 0, behavior: "instant" });
  }

  function showLanding(options = {}) {
    cancelEntry();
    inWorkspace = false;
    body.classList.remove("is-workspace");
    workspace.hidden = true;
    landing.hidden = false;
    if (options.history !== false) setHash("");
    window.scrollTo({ top: 0, behavior: "instant" });
    visuals.resize();
    renderCode();
    paintFrame(sceneTime);
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
      if (anchor.classList.contains("enter-link")) enterPortfolio(id);
      else showPanel(id, { focus: !anchor.classList.contains("wheel-item") });
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

  wheel.addEventListener(
    "wheel",
    (event) => {
      if (mobile.matches || Math.abs(event.deltaY) < Math.abs(event.deltaX))
        return;
      event.preventDefault();
      const unit =
        event.deltaMode === 1
          ? 16
          : event.deltaMode === 2
            ? wheel.clientHeight
            : 1;
      const amount = Math.max(-2, Math.min(2, (event.deltaY * unit) / 125));
      selectWheelTarget(wheelTarget + amount);
      clearTimeout(wheelSnapTimer);
      wheelSnapTimer = setTimeout(settleWheel, 170);
    },
    { passive: false },
  );

  let drag = null;
  let suppressClick = false;
  wheel.addEventListener("pointerdown", (event) => {
    if (mobile.matches || event.button !== 0) return;
    clearTimeout(wheelSnapTimer);
    drag = {
      start: event.clientY,
      from: wheelPosition,
      moved: false,
      id: event.pointerId,
      captured: false,
    };
    suppressClick = false;
  });
  window.addEventListener(
    "pointermove",
    (event) => {
      visuals.trackPointer(event);
      if (!motionEnabled) paintFrame(sceneTime);
      if (!drag) return;
      if (typeof drag.id === "number" && event.pointerId !== drag.id) return;
      const difference = event.clientY - drag.start;
      if (!drag.moved && Math.abs(difference) > 9) {
        drag.moved = true;
        wheel.classList.add("is-dragging");
        if (typeof drag.id === "number" && wheel.setPointerCapture) {
          try {
            wheel.setPointerCapture(drag.id);
            drag.captured = true;
          } catch {
            /* Window listeners keep the drag usable. */
          }
        }
      }
      if (drag.moved) selectWheelTarget(drag.from - difference / 110);
    },
    { passive: true },
  );
  window.addEventListener("pointerup", () => {
    suppressClick = Boolean(drag && drag.moved);
    if (drag?.moved) settleWheel();
    if (drag?.captured && wheel.hasPointerCapture?.(drag.id))
      wheel.releasePointerCapture(drag.id);
    drag = null;
    wheel.classList.remove("is-dragging");
    if (suppressClick)
      setTimeout(() => {
        suppressClick = false;
      }, 0);
  });
  window.addEventListener("pointercancel", () => {
    drag = null;
    wheel.classList.remove("is-dragging");
    settleWheel();
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
    if (!drag && item && item.dataset.panel !== panels[currentIndex].id)
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
    paintFrame(sceneTime);
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
    if (entering && event.key === "Escape") {
      event.preventDefault();
      cancelEntry();
      showLanding({ focus: true });
      return;
    }
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
      enterPortfolio("about");
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
  const codeTrack = document.getElementById("code-track");
  const codeScroll = { value: 0, target: 0, manualUntil: 0 };
  let snippetHoldUntil = 0;
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
      const future = motionEnabled && index > activeLine;
      row.className =
        "code-row" +
        (index === activeLine ? " current" : "") +
        (future ? " future" : "");
      const number = document.createElement("span");
      number.className = "code-number";
      number.textContent = String(index + 1);
      const source = document.createElement("span");
      source.className = "code-source";
      source.append(
        highlightLine(
          future
            ? ""
            : index === activeLine && motionEnabled
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
    codeTrack.replaceChildren(fragment);
    document.getElementById("code-position").textContent =
      `${activeLine + 1}:${activeCharacter + 1}`;
  }

  function updateCode(time) {
    if (time < snippetHoldUntil || time - lastCodeTick < 32) return;
    const advances = Math.min(
      3,
      Math.max(1, Math.floor((time - lastCodeTick) / 32)),
    );
    lastCodeTick = time;
    let pressed = " ";
    for (let step = 0; step < advances; step++) {
      const line = snippets[snippetIndex].code[activeLine];
      pressed = line.charAt(activeCharacter) || "↵";
      activeCharacter++;
      if (activeCharacter > line.length) {
        activeCharacter = 0;
        activeLine++;
        if (activeLine >= snippets[snippetIndex].code.length) {
          snippetIndex = (snippetIndex + 1) % snippets.length;
          activeLine = 3;
          codeScroll.value = 0;
          codeScroll.target = 0;
          snippetHoldUntil = time + 450;
          break;
        }
      }
    }
    renderCode();
    visuals.setKey(pressed);
    if (highlightedKey) highlightedKey.classList.remove("key-lit");
    const letter = pressed.toLowerCase();
    highlightedKey = keyboardKeys.find((key) => key.textContent === letter);
    if (highlightedKey) highlightedKey.classList.add("key-lit");
  }

  function updateCodeScroll(dt) {
    const typedLines = motionEnabled
      ? activeLine + 1
      : snippets[snippetIndex].code.length;
    const available = Math.max(
      0,
      typedLines * 15 - codeStage.clientHeight + 45,
    );
    if (sceneTime > codeScroll.manualUntil) codeScroll.target = available;
    codeScroll.target = Math.max(0, Math.min(available, codeScroll.target));
    codeScroll.value +=
      (codeScroll.target - codeScroll.value) *
      (motionEnabled ? 1 - Math.exp(-dt * 10) : 1);
    codeTrack.style.transform = `translate3d(0, ${-codeScroll.value.toFixed(2)}px, 0)`;
  }

  codeStage.addEventListener(
    "wheel",
    (event) => {
      event.preventDefault();
      const unit =
        event.deltaMode === 1
          ? 15
          : event.deltaMode === 2
            ? codeStage.clientHeight
            : 1;
      const max = Math.max(
        0,
        (motionEnabled ? activeLine + 1 : snippets[snippetIndex].code.length) *
          15 -
          codeStage.clientHeight +
          45,
      );
      codeScroll.target = Math.max(
        0,
        Math.min(max, codeScroll.target + event.deltaY * unit),
      );
      codeScroll.manualUntil = sceneTime + 2400;
      if (!motionEnabled) updateCodeScroll(1);
    },
    { passive: false },
  );

  const visuals = window.PortfolioVisuals.create({
    palette: () => palette,
    motion: () => motionEnabled,
  });
  function resizeCanvases() {
    visuals.resize();
  }
  function paintFrame(time = sceneTime, dt = 1 / 60) {
    visuals.draw(time, dt, inWorkspace, wheelPosition);
  }
  function animate(time) {
    animationFrame = 0;
    if (!motionEnabled || document.hidden) return;
    if (time - lastFrame >= 16) {
      const dt = lastFrame ? Math.min(0.05, (time - lastFrame) / 1000) : 1 / 60;
      sceneTime += dt * 1000;
      if (inWorkspace) animateWheel(dt);
      else if (!entering) {
        updateCode(sceneTime);
        updateCodeScroll(dt);
      }
      paintFrame(sceneTime, dt);
      if (entering && time - entering.started >= ENTRY_DURATION) finishEntry();
      lastFrame = time;
    }
    animationFrame = requestAnimationFrame(animate);
  }
  function resumeAnimation() {
    cancelAnimationFrame(animationFrame);
    animationFrame = 0;
    lastFrame = 0;
    if (motionEnabled && !document.hidden)
      animationFrame = requestAnimationFrame(animate);
  }
  function updateMotion() {
    if (!motionEnabled && entering) finishEntry();
    body.classList.toggle("motion-paused", !motionEnabled);
    body.dataset.motion = motionEnabled ? "on" : "off";
    document.querySelectorAll("[data-motion-toggle]").forEach((button) => {
      button.setAttribute("aria-pressed", String(motionEnabled));
      button.setAttribute(
        "aria-label",
        motionEnabled ? "Pausar movimento" : "Ativar movimento",
      );
    });
    document.querySelectorAll("[data-motion-label]").forEach((label) => {
      label.textContent = "movimento " + (motionEnabled ? "on" : "off");
    });
    renderCode();
    if (!motionEnabled && highlightedKey)
      highlightedKey.classList.remove("key-lit");
    if (!motionEnabled) {
      wheelPosition = wheelTarget;
      wheelVelocity = 0;
      positionWheel();
    }
    resizeCanvases();
    updateCodeScroll(1);
    paintFrame(sceneTime);
    resumeAnimation();
  }
  document.querySelectorAll("[data-motion-toggle]").forEach((button) =>
    button.addEventListener("click", () => {
      motionEnabled = !motionEnabled;
      updateMotion();
    }),
  );
  document.addEventListener("visibilitychange", resumeAnimation);
  let resizeFrame;
  window.addEventListener(
    "resize",
    () => {
      cancelAnimationFrame(resizeFrame);
      resizeFrame = requestAnimationFrame(() => {
        positionWheel();
        resizeCanvases();
        paintFrame(sceneTime);
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
