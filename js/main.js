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
    projects: "aegis",
    projetos: "aegis",
    soc: "aegis",
    "vm-clinica": "clinica",
    clinica: "clinica",
    vm: "clinica",
    "camf-boletos": "camf",
    boletos: "camf",
    scout: "scoutlink",
    tcc: "pesquisa",
    "tcc-pesquisa": "pesquisa",
    research: "pesquisa",
    "crypto-pipeline": "crypto",
    "soccer-vision": "soccer",
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
  const ENTRY_DURATION = 2800;
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

  const SCRAMBLE_DURATION = 650;
  const GLYPHS = "!<>-_\\/[]{}—=+*^?#01ABCDEFXYZ$%&";
  function scrambleCode(progress) {
    codeTrack.querySelectorAll(".code-source").forEach((source) => {
      let out = "";
      for (const character of source.textContent)
        out +=
          character !== " " && Math.random() < progress
            ? GLYPHS[(Math.random() * GLYPHS.length) | 0]
            : character;
      source.textContent = out;
    });
  }
  // Enter: the code glitches into noise, then the camera dives into the pupil.
  function enterPortfolio(id = "about") {
    if (entering) return;
    if (inWorkspace || !motionEnabled) {
      showPanel(id, { focus: true });
      return;
    }
    finishBoot();
    entering = { id, started: performance.now(), phase: "scramble" };
    landing.setAttribute("aria-busy", "true");
    document.getElementById("navigation-announcement").textContent =
      "Abrindo portfólio";
    enterTimer = setTimeout(finishEntry, SCRAMBLE_DURATION + ENTRY_DURATION + 600);
    resumeAnimation();
  }
  function updateEntry(time) {
    if (!entering) return;
    const elapsed = time - entering.started;
    if (entering.phase === "scramble") {
      scrambleCode(Math.min(1, elapsed / SCRAMBLE_DURATION) * 0.9);
      if (elapsed < SCRAMBLE_DURATION) return;
      if (!visuals.beginEntry(performance.now(), ENTRY_DURATION)) {
        finishEntry();
        return;
      }
      entering.phase = "warp";
      entering.started = time;
      body.classList.add("is-entering");
      body.dataset.entryState = "zooming";
    } else if (elapsed >= ENTRY_DURATION) finishEntry();
  }

  function emitView(view) {
    document.dispatchEvent(new CustomEvent("portfolio:view", { detail: view }));
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
    placeDesk(workspace);
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
      "fish — " + (panel.dataset.title || panel.dataset.path.replace("~/projetos", "~/p"));
    document.getElementById("status-section").textContent =
      items[currentIndex].querySelector(".wheel-title").textContent;
    visuals.setEyeText(panel.textContent);
    resetGhost(panel);
    emitView(panelId);
    const film = films.find((entry) => panel.contains(entry.element));
    if (film) showShot(film, 0);
    updateStats(panel);
    commandOutput.replaceChildren();
    scroller.scrollTop = 0;
    scroller.classList.remove("is-switching");
    void scroller.offsetWidth;
    scroller.classList.add("is-switching");
    if (options.history !== false) setHash(panelId);
    positionWheel();
    resizeCanvases();
    paintFrame(sceneTime);
    document.getElementById("navigation-announcement").textContent =
      panel.querySelector("h2").textContent;
    if (options.focus || focusWasHidden)
      scroller.focus({ preventScroll: true });
    if (!mobile.matches || options.scroll !== false)
      window.scrollTo({ top: 0, behavior: "instant" });
  }

  // One keyboard for both views: below the editor on the landing,
  // below the status bar in the workspace.
  const desk = document.querySelector(".desk");
  function placeDesk(target, before = null) {
    if (desk.parentElement !== target || desk.nextElementSibling !== before)
      target.insertBefore(desk, before);
  }

  // Intro: an empty shell types the command that opens the editor.
  const boot = { command: "nvim ~/portfolio/claudio.py", char: 0, next: 0, active: false };
  function startBoot() {
    if (!motionEnabled) return finishBoot();
    boot.active = true;
    boot.char = 0;
    boot.next = sceneTime + 600;
    document.getElementById("boot-typed").textContent = "";
    landing.classList.add("booting");
  }
  function finishBoot() {
    boot.active = false;
    landing.classList.remove("booting");
  }
  function updateBoot(time) {
    if (time < boot.next) return;
    const character = boot.command[boot.char];
    if (character === undefined) {
      visuals.setKey("\n");
      finishBoot();
      renderCode();
      return;
    }
    document.getElementById("boot-typed").textContent += character;
    boot.char++;
    visuals.setKey(character);
    boot.next = time + (character === " " ? 150 : 55 + Math.random() * 75);
  }

  function showLanding(options = {}) {
    cancelEntry();
    finishSession();
    placeDesk(landing, landing.querySelector(".landing-footer"));
    inWorkspace = false;
    body.classList.remove("is-workspace");
    workspace.hidden = true;
    landing.hidden = false;
    if (options.history !== false) setHash("");
    window.scrollTo({ top: 0, behavior: "instant" });
    visuals.resize();
    visuals.setEyeText(snippets[snippetIndex].code.join(" "));
    setGhostState("idle");
    renderCode();
    startBoot();
    emitView("landing");
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
  window.addEventListener(
    "scroll",
    () => {
      if (inWorkspace && !mobile.matches && window.scrollY) window.scrollTo(0, 0);
    },
    { passive: true },
  );
  // Opening a #section link should show the panel, not jump to the anchor.
  if ("scrollRestoration" in history) history.scrollRestoration = "manual";
  window.addEventListener("load", () => {
    // The browser jumps to the #fragment after load; undo it once.
    setTimeout(() => {
      if (inWorkspace) window.scrollTo(0, 0);
    }, 60);
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
    ["bg", "surface", "text", "accent", "dim", "muted", "warm"].forEach((key) => {
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
    "open aegis           defesa cibernética (SOC + IA)",
    "open clinica         gestão clínica (VM Medicina)",
    "open camf            contas a receber (boletos)",
    "open scoutlink       escoteiros do DF",
    "open legitrack       projetos de lei",
    "open crypto          pipeline de criptomoedas",
    "open soccer          análise tática de futebol",
    "open tcc             pesquisa: rastreamento em apps do governo",
    "stack                tecnologias",
    "experiencia          trajetória e formação",
    "contato              vamos conversar",
    "cv / github / email  mostrar link",
    "tema [noite|fosforo|papel]",
    "clear                limpar respostas",
    "exit                 voltar à entrada",
    "",
    "claudinho [pet|feed|dance|say|off|on]",
    "neofetch · fortune · coffee · hire · achievements · matrix",
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
      appendOutput(raw, "07 projetos + 01 pesquisa / escolha um arquivo:", [
        { label: "01 aegis", href: "#aegis" },
        { label: "02 vm-clinica", href: "#clinica" },
        { label: "03 camf-boletos", href: "#camf" },
        { label: "04 scoutlink", href: "#scoutlink" },
        { label: "05 legitrack", href: "#legitrack" },
        { label: "06 crypto-pipeline", href: "#crypto" },
        { label: "07 soccer-vision", href: "#soccer" },
        { label: "08 tcc-pesquisa", href: "#pesquisa" },
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
    else {
      const extra = window.PortfolioExtras?.command(command, argument, raw);
      if (extra) appendOutput(raw, extra.text, extra.links || []);
      else
        appendOutput(
          raw,
          "Comando não encontrado: " + raw + "\nDigite help para ver as opções.",
        );
    }
  }

  window.PortfolioTerminal = { run: runCommand, show: showPanel };
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
        "open aegis",
        "open clinica",
        "open camf",
        "open scoutlink",
        "open legitrack",
        "open crypto",
        "open soccer",
        "open tcc",
        "stack",
        "experiencia",
        "contato",
        "cv",
        "github",
        "email",
        "tema",
        "clear",
        "exit",
        "claudinho",
        "neofetch",
        "fortune",
        "achievements",
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
      !inWorkspace &&
      !entering &&
      (event.key.length === 1 || event.key === "Backspace") &&
      !event.target.closest("a, button")
    ) {
      event.preventDefault();
      typeOnLanding(event.key);
    } else if (
      event.key.toLowerCase() === "t" &&
      !event.target.closest("a, button")
    ) {
      event.preventDefault();
      openThemes();
    } else if (inWorkspace && event.key === "Escape") {
      event.preventDefault();
      showLanding({ focus: true });
    } else if (
      inWorkspace &&
      (event.key === "ArrowLeft" || event.key === "ArrowRight") &&
      currentFilm()
    ) {
      event.preventDefault();
      const film = currentFilm();
      showShot(film, film.index + (event.key === "ArrowRight" ? 1 : -1));
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
      file: "~/portfolio/claudio.py",
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
        '    "aegis",',
        '    "vm-clinica",',
        '    "camf-boletos",',
        '    "scoutlink",',
        '    "legitrack",',
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
      file: "~/portfolio/pipeline.py",
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
  let savedMessage = "";
  let userTypingUntil = 0;
  const keyboardKeys = [...document.querySelectorAll(".key-row span")];

  function highlightLine(text) {
    const fragment = document.createDocumentFragment();
    const tokens =
      /(#.*$|"[^"]*"|'[^']*'|\b\d+\b|\b(?:from|import|class|def|return|for|in|if|while|yield|is|not|None|True|False|self)\b)/g;
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
          : /^\d/.test(match[0])
            ? "code-number-literal"
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
    document.getElementById("source-path").textContent = snippet.file;
    document.getElementById("source-label").textContent =
      "// " + snippet.file.replace("~/", "");
    // Footer: tagline while the shell boots, vim's ":w" after a file,
    // otherwise file:line. The badge follows vim's modes.
    const holding = sceneTime < snippetHoldUntil;
    document.getElementById("landing-file").textContent = boot.active
      ? "// código, dados e ideias."
      : holding && savedMessage
        ? savedMessage
        : snippet.file.replace("~/", "") + ":" + (activeLine + 1);
    document.querySelector(".mode-badge").textContent =
      !boot.active && (sceneTime < userTypingUntil || (motionEnabled && !holding))
        ? "INSERT"
        : "NORMAL";
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
      const typing = index === activeLine && motionEnabled;
      source.append(highlightLine(typing ? line.slice(0, activeCharacter) : line));
      if (index === activeLine) {
        const caret = document.createElement("span");
        caret.className = "code-caret";
        source.append(caret);
        if (typing && activeCharacter < line.length) {
          const rest = document.createElement("span");
          rest.className = "code-rest";
          rest.textContent = line.slice(activeCharacter + 1);
          source.append(rest);
        }
      }
      row.append(number, source);
      fragment.append(row);
    });
    codeTrack.replaceChildren(fragment);
    const percent = Math.round(((activeLine + 1) / snippet.code.length) * 100);
    document.getElementById("code-position").textContent =
      `${activeLine + 1}:${activeCharacter + 1}  ${percent}%`;
  }

  // The visitor types into the editor: the text lands at the caret,
  // the hands press the same keys and the autotyper waits a moment.
  function typeOnLanding(key) {
    if (boot.active) finishBoot();
    const lines = snippets[snippetIndex].code;
    const line = lines[activeLine];
    if (key === "Backspace") {
      if (activeCharacter > 0) {
        lines[activeLine] =
          line.slice(0, activeCharacter - 1) + line.slice(activeCharacter);
        activeCharacter--;
      }
    } else {
      lines[activeLine] =
        line.slice(0, activeCharacter) + key + line.slice(activeCharacter);
      activeCharacter++;
    }
    snippetHoldUntil = sceneTime + 2600;
    userTypingUntil = snippetHoldUntil;
    savedMessage = "";
    visuals.setKey(key === "Backspace" ? "←" : key);
    renderCode();
    if (!motionEnabled) paintFrame(sceneTime);
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
          const saved = snippets[snippetIndex];
          savedMessage = `:w  "${saved.file.split("/").pop()}" ${saved.code.length}L escrito`;
          snippetIndex = (snippetIndex + 1) % snippets.length;
          visuals.setEyeText(snippets[snippetIndex].code.join(" "));
          activeLine = 3;
          codeScroll.value = 0;
          codeScroll.target = 0;
          snippetHoldUntil = time + 1600;
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

  function rowHeight() {
    return codeTrack.firstElementChild?.offsetHeight || 15;
  }
  function maxCodeScroll() {
    return Math.max(
      0,
      snippets[snippetIndex].code.length * rowHeight() - codeStage.clientHeight + 30,
    );
  }
  function updateCodeScroll(dt) {
    // Keep the line being typed a little above the middle, like a real editor.
    const available = Math.min(
      maxCodeScroll(),
      Math.max(0, activeLine * rowHeight() - codeStage.clientHeight * 0.42),
    );
    if (sceneTime > codeScroll.manualUntil) codeScroll.target = available;
    codeScroll.target = Math.max(0, Math.min(maxCodeScroll(), codeScroll.target));
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
      const max = maxCodeScroll();
      codeScroll.target = Math.max(
        0,
        Math.min(max, codeScroll.target + event.deltaY * unit),
      );
      codeScroll.manualUntil = sceneTime + 2400;
      if (!motionEnabled) updateCodeScroll(1);
    },
    { passive: false },
  );

  function centerOf(element) {
    if (!element) return null;
    const rect = element.getBoundingClientRect();
    if (!rect.width && !rect.height) return null;
    return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
  }
  const visuals = window.PortfolioVisuals.create({
    palette: () => palette,
    motion: () => motionEnabled,
    // When the visitor's mouse is still, the eye watches the work:
    // the caret on the landing, the selected card in the workspace.
    focus: () =>
      inWorkspace
        ? centerOf(sessionCaret() || items[currentIndex])
        : centerOf(
            landing.classList.contains("booting")
              ? document.querySelector("#boot-line .term-caret")
              : codeTrack.querySelector(".code-caret"),
          ),
  });
  visuals.setEyeText(snippets[snippetIndex].code.join(" "));
  fetch("assets/data/contributions.json")
    .then((response) => (response.ok ? response.json() : null))
    .then((data) => {
      if (!data) return;
      visuals.setContributions(data);
      const days = Object.values(data.days);
      const total = days.reduce((sum, value) => sum + value, 0);
      document.getElementById("contrib-summary").textContent =
        `${total} ${data.label} entre ${data.from} e ${data.to}, em ${days.length} dias ativos.`;
    })
    .catch(() => {});

  // Film: screenshot carousel inside project panels (↔ to change shot).
  const SHOT_DURATION = 5200;
  const films = [...document.querySelectorAll("[data-film]")].map((element) => ({
    element,
    shots: [...element.querySelectorAll(".shot")],
    tabs: [...element.querySelectorAll(".film-tabs button")],
    bar: element.querySelector(".film-progress i"),
    index: 0,
    since: 0,
  }));
  function showShot(film, index) {
    film.index = (index + film.shots.length) % film.shots.length;
    film.since = sceneTime;
    film.shots.forEach((shot, i) => shot.classList.toggle("is-current", i === film.index));
    film.tabs.forEach((tab, i) => tab.setAttribute("aria-pressed", String(i === film.index)));
    film.element.querySelector("[data-film-index]").textContent = String(film.index + 1);
    const current = film.shots[film.index];
    const name = film.element.querySelector("[data-film-name]");
    if (name)
      name.textContent = current.tagName === "IMG"
        ? current.getAttribute("src").split("/").pop()
        : "arquitetura.svg";
    film.element.querySelector(".film-caption").textContent =
      film.shots[film.index].dataset.caption || "";
  }
  function currentFilm() {
    return films.find((film) => !film.element.closest(".content-panel").hidden);
  }
  function updateFilms(time) {
    const film = currentFilm();
    if (!film) return;
    const progress = Math.min(1, (time - film.since) / SHOT_DURATION);
    film.bar.style.width = (progress * 100).toFixed(1) + "%";
    if (progress >= 1) showShot(film, film.index + 1);
  }
  // Full-screen view of the current shot.
  const lightbox = document.createElement("div");
  lightbox.className = "lightbox";
  lightbox.hidden = true;
  lightbox.innerHTML =
    '<figure><div class="lightbox-frame"></div><figcaption></figcaption></figure>' +
    '<button type="button" class="text-button lightbox-close">esc ✕</button>';
  body.append(lightbox);
  function openLightbox(film) {
    const shot = film.shots[film.index].cloneNode(true);
    shot.classList.add("is-current");
    lightbox.querySelector(".lightbox-frame").replaceChildren(shot);
    lightbox.querySelector("figcaption").textContent =
      `${film.index + 1}/${film.shots.length} · ${film.shots[film.index].dataset.caption || ""}`;
    lightbox.hidden = false;
  }
  function closeLightbox() {
    lightbox.hidden = true;
  }
  lightbox.addEventListener("click", closeLightbox);
  document.addEventListener(
    "keydown",
    (event) => {
      if (!lightbox.hidden && event.key === "Escape") {
        event.preventDefault();
        event.stopImmediatePropagation();
        closeLightbox();
      }
    },
    true,
  );
  films.forEach((film) => {
    const expand = document.createElement("button");
    expand.type = "button";
    expand.className = "film-expand";
    expand.textContent = "⛶";
    expand.setAttribute("aria-label", "Ampliar imagem");
    expand.addEventListener("click", () => openLightbox(film));
    film.element.querySelector(".film-tabs").append(expand);
    film.element
      .querySelector(".film-frame")
      .addEventListener("click", () => openLightbox(film));
    showShot(film, 0);
    film.tabs.forEach((tab, i) => tab.addEventListener("click", () => showShot(film, i)));
  });

  // Ghost session: opening a panel replays it as a terminal session.
  // Each prompt's command is typed (the hands press the keys, the eye
  // follows the caret), then that command's output appears, line by line.
  // Any click, scroll or key inside the terminal shows everything at once.
  const ghost = { state: "", session: null };
  function setGhostState(state) {
    if (ghost.state === state) return;
    ghost.state = state;
    document.getElementById("ghost-state").textContent = state;
  }
  function commandNodes(prompt) {
    const arrow = prompt.querySelector(".prompt-arrow");
    const nodes = [];
    for (let node = arrow?.nextSibling; node; node = node.nextSibling) nodes.push(node);
    return nodes;
  }
  function finishSession() {
    const session = ghost.session;
    if (!session) return;
    session.steps.forEach((step) => {
      step.prompt.classList.remove("session-hidden");
      step.output.forEach((element) => element.classList.remove("session-hidden"));
      if (step.typed) {
        step.typed.remove();
        step.caret.remove();
        step.nodes.forEach((node) => step.prompt.append(node));
      }
    });
    ghost.session = null;
    setGhostState("idle");
  }
  function resetGhost(panel) {
    finishSession();
    if (!motionEnabled) return;
    const steps = [];
    let current = null;
    for (const element of panel.children) {
      if (element.classList.contains("prompt")) {
        current = { prompt: element, output: [], nodes: commandNodes(element) };
        current.command = current.nodes
          .map((node) => node.textContent)
          .join("")
          .replace(/\s+/g, " ")
          .trim();
        steps.push(current);
      } else if (current) current.output.push(element);
    }
    if (!steps.length) return;
    steps.forEach((step) => {
      step.prompt.classList.add("session-hidden");
      step.output.forEach((element) => element.classList.add("session-hidden"));
    });
    // whoami waits for the CM tree to finish growing before typing on.
    const delay = panel.id === "about" ? 5600 : 350;
    ghost.session = { panel, steps, index: 0, phase: "show", next: sceneTime + delay, char: 0 };
  }
  function followOutput() {
    // Like the reference: keep the line being typed in view; output may
    // run past the bottom edge until the next command needs the space.
    const session = ghost.session;
    const prompt = session?.steps[session.index]?.prompt;
    if (!prompt || prompt.classList.contains("session-hidden")) return;
    const view = scroller.getBoundingClientRect();
    const box = prompt.getBoundingClientRect();
    if (box.bottom > view.bottom - 6) scroller.scrollTop += box.bottom - view.bottom + 30;
  }

  function updateGhost(time) {
    const session = ghost.session;
    if (!session) return;
    if (time < session.next) return;
    const step = session.steps[session.index];
    if (!step) {
      ghost.session = null;
      setGhostState("idle");
      return;
    }
    if (session.phase === "show") {
      step.prompt.classList.remove("session-hidden");
      step.nodes.forEach((node) => node.remove());
      step.typed = document.createElement("span");
      step.caret = document.createElement("span");
      step.caret.className = "term-caret";
      step.prompt.append(" ", step.typed, step.caret);
      session.phase = "type";
      session.char = 0;
      session.next = time + 260;
      followOutput();
    } else if (session.phase === "type") {
      const character = step.command[session.char];
      if (character === undefined) {
        visuals.setKey("\n");
        session.phase = "output";
        session.next = time + 260;
        return;
      }
      step.typed.textContent += character;
      session.char++;
      visuals.setKey(character);
      setGhostState("typing");
      session.next =
        time + (character === " " ? 120 + Math.random() * 80 : 45 + Math.random() * 70);
    } else if (session.phase === "output") {
      step.typed.remove();
      step.caret.remove();
      step.typed = null;
      step.nodes.forEach((node) => step.prompt.append(node));
      const element = step.output.find((entry) => entry.classList.contains("session-hidden"));
      if (element) {
        element.classList.remove("session-hidden");
        session.phase = "reveal";
        session.next = time + 120;
      } else {
        session.index++;
        session.phase = "show";
        session.next = time + 420;
      }
      setGhostState("idle");
      followOutput();
    } else if (session.phase === "reveal") {
      const element = step.output.find((entry) => entry.classList.contains("session-hidden"));
      if (element) {
        element.classList.remove("session-hidden");
        session.next = time + 140;
      } else {
        session.index++;
        session.phase = "show";
        session.next = time + 450;
      }
      followOutput();
    }
  }
  function sessionCaret() {
    const step = ghost.session?.steps[ghost.session.index];
    return step?.caret?.isConnected ? step.caret : null;
  }
  ["wheel", "pointerdown", "touchstart"].forEach((type) =>
    scroller.addEventListener(type, finishSession, { passive: true }),
  );
  commandInput.addEventListener("focus", finishSession);


  // Real numbers from GitHub for the status bar.
  const github = { user: null, repos: null, loading: null };
  function loadGithub() {
    if (github.loading) return github.loading;
    try {
      const cached = JSON.parse(sessionStorage.getItem("cm-github") || "null");
      if (cached && Date.now() - cached.at < 30 * 60 * 1000) {
        Object.assign(github, cached);
        github.loading = Promise.resolve();
        return github.loading;
      }
    } catch {
      /* No cache available. */
    }
    github.loading = Promise.all([
      fetch("https://api.github.com/users/ClaudioAMF1").then((r) =>
        r.ok ? r.json() : null,
      ),
      fetch("https://api.github.com/users/ClaudioAMF1/repos?per_page=100").then(
        (r) => (r.ok ? r.json() : null),
      ),
    ])
      .then(([user, repos]) => {
        github.user = user;
        github.repos = Array.isArray(repos) ? repos : null;
        try {
          sessionStorage.setItem(
            "cm-github",
            JSON.stringify({ at: Date.now(), user, repos: github.repos }),
          );
        } catch {
          /* Cache is optional. */
        }
      })
      .catch(() => {});
    return github.loading;
  }
  function setStats(entries) {
    ["a", "b", "c"].forEach((key, index) => {
      document.getElementById("stat-" + key + "-label").textContent =
        entries[index][0];
      document.getElementById("stat-" + key).textContent = entries[index][1];
    });
  }
  function format(number) {
    return typeof number === "number"
      ? number.toLocaleString("pt-BR").replace(/\./g, "'")
      : "—";
  }
  function fillFetch() {
    const values = {
      followers: format(github.user?.followers),
      repos: format(github.user?.public_repos),
      stars: format(
        github.repos?.reduce(
          (sum, entry) => sum + (entry.fork ? 0 : entry.stargazers_count),
          0,
        ),
      ),
      languages: github.repos
        ? Object.entries(
            github.repos.reduce((count, entry) => {
              if (entry.language && !entry.fork)
                count[entry.language] = (count[entry.language] || 0) + 1;
              return count;
            }, {}),
          )
            .sort((a, b) => b[1] - a[1])
            .slice(0, 4)
            .map(([name, total]) => `${name.toLowerCase()} ${total}`)
            .join(" · ")
        : "—",
    };
    document.querySelectorAll("[data-fetch]").forEach((cell) => {
      cell.textContent = values[cell.dataset.fetch] || "—";
    });
  }
  function updateStats(panel) {
    fillFetch();
    const custom = window.PortfolioPanels?.stats(panel);
    if (custom) {
      setStats(custom);
      return;
    }
    const repoName = panel.dataset.repo;
    if (repoName === "private") {
      setStats([
        ["stars", "—"],
        ["forks", "—"],
        ["repo", "privado"],
      ]);
      return;
    }
    if (repoName) {
      const repo = github.repos?.find(
        (entry) => entry.name.toLowerCase() === repoName.toLowerCase(),
      );
      setStats([
        ["stars", format(repo?.stargazers_count)],
        ["forks", format(repo?.forks_count)],
        ["lang", repo?.language?.toLowerCase() || "—"],
      ]);
    } else {
      const stars = github.repos?.reduce(
        (sum, entry) => sum + (entry.fork ? 0 : entry.stargazers_count),
        0,
      );
      setStats([
        ["repos", format(github.user?.public_repos)],
        ["stars", format(stars)],
        ["followers", format(github.user?.followers)],
      ]);
    }
    if (!github.user && !github.repos)
      loadGithub().then(() => {
        fillFetch();
        if (inWorkspace && panels.find((entry) => !entry.hidden) === panel)
          updateStats(panel);
      });
  }
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
      if (inWorkspace) {
        animateWheel(dt);
        updateGhost(sceneTime);
        updateFilms(sceneTime);
      }
      else if (!entering) {
        if (boot.active) updateBoot(sceneTime);
        else {
          updateCode(sceneTime);
          updateCodeScroll(dt);
        }
      }
      paintFrame(sceneTime, dt);
      updateEntry(time);
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
    if (!motionEnabled) {
      finishSession();
      finishBoot();
    }
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
