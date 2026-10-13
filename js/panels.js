(() => {
  "use strict";

  // Builds the terminal-style panels (fetch blocks, stack, calendar, git
  // graph) before main.js reads the DOM, then fills them with real data:
  // assets/data/*.json (computed from the repositories) and the GitHub API.

  const panels = [...document.querySelectorAll(".content-panel")];
  const shortPath = (path) => (path || "~").replace("~/projetos", "~/p");
  const userSpan = '<span>claudio<span class="muted">@dev</span></span>';

  function prompt(path, command, branch = false) {
    const element = document.createElement("p");
    element.className = "prompt";
    element.innerHTML = `${userSpan} <span class="path">${shortPath(path)}</span>${
      branch ? ' <span class="branch">(main)</span>' : ""
    } <span class="prompt-arrow">›</span> ${command}`;
    return element;
  }

  // Two-line prompts: every prompt gets its path (and branch on projects).
  panels.forEach((panel) => {
    const branch = Boolean(panel.dataset.repo);
    panel.querySelectorAll(".prompt").forEach((element) => {
      if (!element.querySelector(".path")) {
        const path = document.createElement("span");
        path.className = "path";
        path.textContent = shortPath(panel.dataset.path);
        element.firstElementChild.after(" ", path);
      } else {
        const path = element.querySelector(".path");
        path.textContent = shortPath(path.textContent);
      }
      if (branch && !element.querySelector(".branch")) {
        const tag = document.createElement("span");
        tag.className = "branch";
        tag.textContent = "(main)";
        element.querySelector(".path").after(" ", tag);
      }
    });
  });

  // Projects: fetch → ls shots/ → cat README.md → open github → empty prompt.
  const projectPanels = panels.filter((panel) => panel.dataset.repo);
  projectPanels.forEach((panel) => {
    const repo = panel.dataset.repo === "private" ? null : panel.dataset.repo;
    const local = panel.dataset.local || repo;
    const prompts = [...panel.querySelectorAll(":scope > .prompt")];
    const command = (element) => element.textContent.split("›").pop().trim();
    const cat = prompts.find((element) => command(element).startsWith("cat"));
    const figure = panel.querySelector(":scope > figure");
    const shotsPrompt = figure?.previousElementSibling;
    const repoPrompt = prompts.find((element) => command(element) === "open repo");
    const repoLink = panel.querySelector(":scope > .repo-link");
    const eyebrow = panel.querySelector(":scope > .eyebrow");
    const title = panel.querySelector(":scope > h2");
    const readme = [];
    for (let node = cat?.nextElementSibling; node && node !== shotsPrompt; node = node.nextElementSibling)
      if (node !== eyebrow && node !== title) readme.push(node);
    const tech = panel.querySelector(":scope > .tech-list");
    const trailing = [];
    for (let node = figure?.nextElementSibling; node; node = node.nextElementSibling)
      if (node !== tech && node !== repoPrompt && node !== repoLink) trailing.push(node);

    const name = repo || local || panel.id;
    const fetchPrompt = prompt(panel.dataset.path, `fetch ${name}`, true);
    const fetchOut = document.createElement("div");
    fetchOut.className = "fetch-out";
    if (title) {
      title.classList.add("fetch-name");
      fetchOut.append(title);
    }
    if (eyebrow) {
      const tagline = document.createElement("p");
      tagline.className = "fetch-tagline";
      tagline.textContent = eyebrow.textContent.replace(/^\d+\s*\/\s*/, "").toLowerCase();
      fetchOut.append(tagline);
      eyebrow.remove();
    }
    const facts = document.createElement("dl");
    facts.className = "terminal-facts repo-fetch";
    facts.dataset.repoFetch = repo || "";
    facts.dataset.local = local || "";
    fetchOut.append(facts);

    if (shotsPrompt && figure) {
      const isFilm = figure.matches("[data-film]");
      const arrow = shotsPrompt.querySelector(".prompt-arrow");
      while (arrow.nextSibling) arrow.nextSibling.remove();
      arrow.after(isFilm ? " ls shots/" : " open arquitetura.svg");
    }
    const tail = [];
    if (cat) tail.push(cat, ...readme);
    if (tech) tail.push(tech);
    let open;
    if (repo) {
      open = prompt(panel.dataset.path, "open ", true);
      const link = document.createElement("a");
      link.href = `https://github.com/ClaudioAMF1/${repo}`;
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      link.className = "command-link";
      link.textContent = `github.com/ClaudioAMF1/${repo}`;
      open.append(link);
    } else {
      open = prompt(panel.dataset.path, "git remote -v", true);
    }
    const remote = document.createElement("p");
    remote.className = "term-note";
    remote.textContent = repo
      ? ""
      : "origin  repositório privado · o código fica fechado para proteger dados";
    const idle = prompt(panel.dataset.path, "", true);
    idle.classList.add("idle-prompt");
    idle.append(Object.assign(document.createElement("span"), { className: "term-caret" }));
    repoPrompt?.remove();
    repoLink?.remove();

    const order = [fetchPrompt, fetchOut];
    if (shotsPrompt && figure) order.push(shotsPrompt, figure);
    order.push(...tail, open);
    if (!repo) order.push(remote);
    order.push(...trailing, idle);
    panel.prepend(...order);
  });

  // ---------- data ----------
  const fmt = (value) =>
    typeof value === "number" ? String(value).replace(/\B(?=(\d{3})+(?!\d))/g, "'") : "—";
  const month = (value) => (value ? String(value).slice(0, 7) : "—");
  let stack = null;
  let github = null;

  function starBar(value, total) {
    const share = total ? Math.round((value / total) * 100) : 0;
    return `<span class="num">${fmt(value)}</span><span class="share-bar"><i style="width:${share}%"></i></span><span class="muted">${share}% de todas as stars</span>`;
  }
  function fillProjects() {
    const totalStars = github?.repos?.reduce((sum, entry) => sum + entry.stargazers_count, 0) || 0;
    document.querySelectorAll("[data-repo-fetch]").forEach((facts) => {
      const repoName = facts.dataset.repoFetch;
      const remote = repoName
        ? github?.repos?.find((entry) => entry.name.toLowerCase() === repoName.toLowerCase())
        : null;
      const evidence = stack?.repos?.[facts.dataset.local] || {};
      const rows = [
        ["stars", repoName ? starBar(remote?.stargazers_count ?? 0, totalStars) : '<span class="muted">privado</span>'],
        ["forks", `<span class="num">${repoName ? fmt(remote?.forks_count ?? 0) : "—"}</span>`],
        ["commits", `<span class="num">${fmt(evidence.commits)}</span>`],
        ["arquivos", `<span class="num">${fmt(evidence.files)}</span>`],
        ["lang", (remote?.language || evidence.languages?.[0] || "—").toLowerCase()],
        [
          "desde",
          `${month(remote?.created_at || evidence.since)}  <span class="muted">push</span> ${month(remote?.pushed_at || evidence.pushed)}`,
        ],
      ];
      facts.innerHTML = rows.map(([key, value]) => `<div><dt>${key}</dt><dd>${value}</dd></div>`).join("");
    });
  }

  const LANG_ICON = {
    Python: "Py", HTML: "<>", CSS: "#", JavaScript: "JS", Shell: "$_", C: "C",
    "Jupyter Notebook": "Ju", TypeScript: "TS", "C++": "++", TeX: "Tx", Dart: "Da",
    Kotlin: "Kt", Swift: "Sw", Java: "Jv", SQL: "SQ",
  };
  const TOOL_ICON = {
    Git: "⎇", GitHub: "◉", Docker: "▣", PostgreSQL: "◆", Flask: "⚗", NumPy: "∑",
    pandas: "▤", SQLAlchemy: "⛁", "Node.js": "⬡", React: "⚛", FastAPI: "⚡", Vite: "▼",
    "scikit-learn": "◎", Streamlit: "◣", Alembic: "↯", Redis: "◈", Kafka: "⫶",
    "Power BI": "▥", Flutter: "◢", Celery: "✿", OpenCV: "◐", "GitHub Actions": "↻",
  };
  function fillStack() {
    if (!stack) return;
    const chart = document.querySelector("[data-lang-chart]");
    const languages = stack.languages.slice(0, 9);
    const max = Math.max(...languages.map(([, count]) => count));
    chart.innerHTML = languages
      .map(
        ([name, count], index) =>
          `<i class="glyph box">${LANG_ICON[name] || name.slice(0, 2)}</i><span class="lang-name">${name}</span>` +
          `<span class="lang-track"><i class="lang-fill" style="width:${(count / max) * 100}%;animation-delay:${index * 70}ms"></i></span>` +
          `<span class="num">${count}</span><span class="muted">${count === 1 ? "repo" : "repos"}</span>`,
      )
      .join("");
    const tools = stack.tools.filter(([name]) => name !== "GitHub Actions").slice(0, 15);
    document.querySelector("[data-tool-grid]").innerHTML = tools
      .map(
        ([name, count]) =>
          `<span class="tool"><i class="glyph">${TOOL_ICON[name] || "·"}</i>${name}</span><span class="num">${count}</span>`,
      )
      .join("");
  }

  const MORE = [
    ["Artigo-Compiladores", "LLMs para otimizar código Python: limites e possibilidades em linguagens dinâmicas.", "artigo"],
    ["Inteligencia-de-negocio", "BI aplicado: Power BI, série histórica do World Bank, VPL e TIR em Python.", "dados"],
    ["Ambiente", "Scripts que preparam o ambiente de dev: WSL, GDB/GEF, pwntools, Docker.", "infra"],
    ["Trabalho-Pratico-Programacao-Concorrente", "Keep Solving and Nobody Explodes: simulador de desarme de bombas com concorrência.", "concorrência"],
    ["air-quality-pipeline", "Pipeline de qualidade do ar em tempo real: Kafka, Celery, Redis e alertas.", "big data"],
    ["football_prediction", "Previsão de resultados do Brasileirão com machine learning.", "ml"],
  ];
  function fillMore() {
    const graph = document.querySelector("[data-more-graph]");
    if (!graph) return;
    const items = MORE.map(([name, description, tag]) => {
      const remote = github?.repos?.find((entry) => entry.name === name);
      const evidence = stack?.repos?.[name] || {};
      return {
        name,
        description,
        tag,
        stars: remote?.stargazers_count ?? 0,
        language: remote?.language || evidence.languages?.[0] || "—",
        pushed: month(remote?.pushed_at || evidence.pushed),
        since: month(remote?.created_at || evidence.since),
      };
    }).sort((a, b) => b.pushed.localeCompare(a.pushed));
    const groups = new Map();
    items.forEach((item) => {
      if (!groups.has(item.pushed)) groups.set(item.pushed, []);
      groups.get(item.pushed).push(item);
    });
    graph.innerHTML = [...groups]
      .map(
        ([date, list]) =>
          `<section class="graph-group"><p class="graph-date">${date} · ${list.length}</p><div class="graph-cards">${list
            .map(
              (item) =>
                `<a class="graph-card" href="https://github.com/ClaudioAMF1/${item.name}" target="_blank" rel="noopener noreferrer">` +
                `<span class="card-cover"><b>${item.name.replace(/[-_]/g, " ").toUpperCase()}</b><i>${item.tag}</i></span>` +
                `<strong>${item.name}</strong><span class="card-desc">${item.description}</span>` +
                `<span class="card-meta"><span>stars <b class="badge">${item.stars}</b></span><span>${item.language} · ${item.since}</span></span></a>`,
            )
            .join("")}</div></section>`,
      )
      .join("");
    const group = document.querySelector("[data-group-fetch]");
    const stars = items.reduce((sum, item) => sum + item.stars, 0);
    const total = github?.repos?.reduce((sum, entry) => sum + entry.stargazers_count, 0) || 0;
    const since = items.map((item) => item.since).sort()[0];
    const pushed = items.map((item) => item.pushed).sort().pop();
    group.innerHTML = [
      ["stars", starBar(stars, total)],
      ["projetos", `<span class="num">${items.length}</span>`],
      ["desde", `${since}  <span class="muted">push</span> ${pushed}`],
    ]
      .map(([key, value]) => `<div><dt>${key}</dt><dd>${value}</dd></div>`)
      .join("");
  }

  // ---------- calendar: node calendar.mjs 2026 ----------
  const calendar = { days: null, byMonth: {}, started: -1, built: false, cells: [], weeks: 0 };
  const LEVELS = [0, 1, 3, 6, 11];
  function buildCalendar(data) {
    const element = document.querySelector("[data-calendar]");
    if (!element || !data) return;
    calendar.days = data.days;
    const year = 2026;
    const first = new Date(Date.UTC(year, 0, 1));
    const start = new Date(first);
    start.setUTCDate(start.getUTCDate() - ((first.getUTCDay() + 6) % 7));
    const end = new Date(data.to + "T00:00:00Z");
    calendar.weeks = Math.ceil((end - start) / 864e5 / 7) + 1;
    const months = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
    let html = '<span class="cal-corner"></span>';
    let lastMonth = -1;
    for (let week = 0; week < calendar.weeks; week++) {
      const day = new Date(start.getTime() + week * 7 * 864e5 + 3 * 864e5);
      const m = day.getUTCMonth();
      html += `<span class="cal-month" style="grid-column:${week + 2}">${m !== lastMonth ? months[m] : ""}</span>`;
      lastMonth = m;
    }
    ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"].forEach((name, row) => {
      html += `<span class="cal-day" style="grid-row:${row + 2}">${name}</span>`;
    });
    calendar.cells = [];
    for (let week = 0; week < calendar.weeks; week++) {
      for (let row = 0; row < 7; row++) {
        const date = new Date(start.getTime() + (week * 7 + row) * 864e5);
        const key = date.toISOString().slice(0, 10);
        const count = date.getUTCFullYear() === year && date <= end ? data.days[key] || 0 : -1;
        const level = count < 0 ? -1 : LEVELS.filter((min) => count >= min && min > 0).length;
        calendar.cells.push({ week, key, level });
        html += `<span class="cal-cell" data-level="${level}" data-week="${week}" style="grid-column:${week + 2};grid-row:${row + 2}" title="${key}: ${Math.max(0, count)} commits"></span>`;
      }
    }
    for (let week = 0; week < calendar.weeks; week += 4)
      html += `<span class="cal-week" style="grid-column:${week + 2}">W${String(week + 1).padStart(2, "0")}</span>`;
    html += '<span class="cal-legend">nenhum <i data-level="0"></i><i data-level="1"></i><i data-level="2"></i><i data-level="3"></i><i data-level="4"></i></span>';
    element.style.setProperty("--weeks", calendar.weeks);
    element.innerHTML = html;
    calendar.built = true;
  }
  function renderMonthLine(monthKey, typed) {
    const repos = Object.entries(stack?.byMonthRepo?.[monthKey] || {}).slice(0, 3);
    const body = repos.length ? repos.map(([name, count]) => `"${name}": ${count}`).join(", ") : "";
    const full = `renderMonth("${monthKey}", { ${body} }); // commits`;
    return full.slice(0, typed);
  }
  function tickCalendar(now) {
    const block = document.querySelector("[data-calendar-block]");
    if (!calendar.built || !block) return;
    const visible = block.offsetParent !== null && !block.classList.contains("session-hidden");
    if (!visible) {
      calendar.started = -1;
      return;
    }
    if (calendar.started < 0) calendar.started = now;
    const still = document.body.dataset.motion === "off";
    const elapsed = still ? 1e9 : now - calendar.started;
    const week = Math.min(calendar.weeks, Math.floor(elapsed / 90));
    const cells = block.querySelectorAll(".cal-cell");
    cells.forEach((cell) => {
      const shown = Number(cell.dataset.week) < week;
      cell.classList.toggle("is-shown", shown);
      cell.classList.toggle("is-current", Number(cell.dataset.week) === week - 1 && week < calendar.weeks);
    });
    const done = week >= calendar.weeks;
    const index = Math.max(0, Math.min(calendar.cells.length - 1, week * 7 - 1));
    const monthKey = calendar.cells[index]?.key.slice(0, 7) || "2026-01";
    const line = block.querySelector("[data-render-month]");
    const text = renderMonthLine(monthKey, done ? 999 : Math.floor((elapsed % 1200) / 18));
    const highlighted = text
      .replace(/^(renderMonth\()/, '<span class="code-fn">$1</span>')
      .replace(/(\/\/ commits)$/, '<span class="muted">$1</span>');
    if (line.dataset.text !== text) {
      line.dataset.text = text;
      line.innerHTML = highlighted;
    }
  }
  function loop(now) {
    tickCalendar(now);
    requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);

  // ---------- load data ----------
  function loadGithub() {
    try {
      const cached = JSON.parse(sessionStorage.getItem("cm-github") || "null");
      if (cached && Date.now() - cached.at < 30 * 60 * 1000) return Promise.resolve(cached);
    } catch {
      /* No cache. */
    }
    return Promise.all([
      fetch("https://api.github.com/users/ClaudioAMF1").then((r) => (r.ok ? r.json() : null)),
      fetch("https://api.github.com/users/ClaudioAMF1/repos?per_page=100").then((r) => (r.ok ? r.json() : null)),
    ]).then(([user, repos]) => {
      const data = { at: Date.now(), user, repos: Array.isArray(repos) ? repos : null };
      try {
        sessionStorage.setItem("cm-github", JSON.stringify(data));
      } catch {
        /* Cache is optional. */
      }
      return data;
    });
  }
  function refresh() {
    fillProjects();
    fillStack();
    fillMore();
  }
  refresh();
  fetch("assets/data/stack.json")
    .then((response) => (response.ok ? response.json() : null))
    .then((data) => {
      stack = data;
      refresh();
    })
    .catch(() => {});
  fetch("assets/data/contributions.json")
    .then((response) => (response.ok ? response.json() : null))
    .then(buildCalendar)
    .catch(() => {});
  loadGithub()
    .then((data) => {
      github = data;
      refresh();
    })
    .catch(() => {});

  window.PortfolioPanels = {
    stats(panel) {
      if (panel.id === "skills" && stack)
        return [
          ["langs", String(stack.languages.length)],
          ["tools", String(stack.tools.length)],
          ["ai", "3"],
        ];
      if (panel.id === "more")
        return [
          ["projetos", String(MORE.length)],
          ["stars", fmt(MORE.reduce((sum, [name]) => sum + (github?.repos?.find((r) => r.name === name)?.stargazers_count || 0), 0))],
          ["repos", fmt(github?.user?.public_repos)],
        ];
      if (panel.id === "themes") return [["temas", "3"], ["claros", "1"], ["escuros", "2"]];
      return null;
    },
  };
})();
