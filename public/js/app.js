const routes = {
  "/": "home",
  "/roster": "roster",
  "/schedule": "schedule",
  "/availability": "availability",
  "/board": "board",
  "/media": "media",
  "/gear": "gear",
  "/dues": "dues",
  "/admin": "admin",
  "/league": "league",
  "/join": "join",
  "/recruits": "recruits",
};

async function load() {
  const hash = location.hash.replace(/^#/, "") || "/";
  const route = routes[hash] || "home";
  syncGates();
  document.querySelectorAll(".nav a").forEach((a) => {
    const href = a.getAttribute("href");
    a.classList.toggle("active", (route === "home" && href === "#/") || href === "#/" + route);
  });

  const app = document.getElementById("app");
  app.innerHTML = "<p class='muted'>Loading…</p>";
  try {
    if (route === "home") {
      const [roster, schedule, avail, fees] = await Promise.all([
        api.get("/api/roster"),
        api.get("/api/schedule"),
        isTeam() ? api.get("/api/availability") : Promise.resolve({}),
        isTeam() ? api.get("/api/fees") : Promise.resolve({}),
      ]);
      app.innerHTML = renderHome(roster, schedule, avail, fees);
    } else if (route === "roster") {
      const roster = await api.get("/api/roster");
      app.innerHTML = renderRoster(roster, localStorage.getItem("wizardsRosterSquad"));
      bindRoster(roster);
    } else if (route === "schedule") {
      const [schedule, avail] = await Promise.all([
        api.get("/api/schedule"),
        isTeam() ? api.get("/api/availability") : Promise.resolve({}),
      ]);
      app.innerHTML = renderSchedule(schedule, avail);
      bindSchedule(schedule, avail);
    } else if (route === "availability") {
      if (!isTeam()) {
        app.innerHTML = renderLock("team");
        bindPageLock("team");
      } else {
        const [roster, avail] = await Promise.all([api.get("/api/roster"), api.get("/api/availability")]);
        app.innerHTML = await renderAvailability(roster, avail);
        bindAvailability(roster);
      }
    } else if (route === "board") {
      if (!isTeam()) {
        app.innerHTML = renderLock("team");
        bindPageLock("team");
      } else {
        const [roster, board] = await Promise.all([api.get("/api/roster"), api.get("/api/board")]);
        app.innerHTML = renderBoard(roster, board);
        bindBoard(roster);
      }
    } else if (route === "media") {
      app.innerHTML = renderMedia();
    } else if (route === "gear") {
      const [roster, jerseys] = await Promise.all([api.get("/api/roster"), api.get("/api/jerseys")]);
      app.innerHTML = renderGear(roster, jerseys);
      bindGear(roster);
    } else if (route === "dues") {
      if (!isTeam()) {
        app.innerHTML = renderLock("team");
        bindPageLock("team");
      } else {
        const [roster, fees] = await Promise.all([api.get("/api/roster"), api.get("/api/fees")]);
        app.innerHTML = renderDues(roster, fees);
      }
    } else if (route === "admin") {
      if (!isAdmin()) {
        app.innerHTML = renderLock("admin");
        bindPageLock("admin");
      } else {
        const [roster, fees] = await Promise.all([api.get("/api/roster"), api.get("/api/fees")]);
        app.innerHTML = renderAdmin(roster, fees);
        bindAdmin(roster);
      }
    } else if (route === "league") {
      app.innerHTML = renderLeague();
    } else if (route === "join") {
      app.innerHTML = renderJoin();
      bindJoin();
    } else if (route === "recruits") {
      if (!isTeam()) {
        app.innerHTML = renderLock("team");
        bindPageLock("team");
      } else {
        app.innerHTML = renderRecruits(await api.get("/api/recruits"));
      }
    }
  } catch (err) {
    app.innerHTML = `<p class="notice">Could not load this page. ${escapeHtml(err.message)}</p>`;
  }
  if (window.bootVisuals) window.bootVisuals();
}

document.querySelector(".nav-toggle").addEventListener("click", () => {
  document.querySelector(".nav").classList.toggle("open");
});
document.querySelector(".nav").addEventListener("click", () => {
  document.querySelector(".nav").classList.remove("open");
});
window.addEventListener("hashchange", load);
bindHeaderGate();
load();
