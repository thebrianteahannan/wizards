const routes = {
  "/": "home",
  "/roster": "roster",
  "/schedule": "schedule",
  "/availability": "availability",
  "/tournament": "tournament",
  "/practice": "practice",
  "/activity": "activity",
  "/board": "board",
  "/media": "media",
  "/gear": "gear",
  "/dues": "dues",
  "/admin": "admin",
  "/league": "league",
  "/strategy": "strategy",
  "/login": "login",
  "/join": "join",
  "/recruits": "recruits",
  "/team": "team",
  "/scout": "scout",
  "/tourney-scout": "tourney-scout",
  "/overview": "overview",
};

async function load() {
  await refreshSession();
  const hash = (location.hash.replace(/^#/, "") || "/").split("?")[0];
  const route = routes[hash] || "home";
  syncGates();
  const teamPages = ["team", "board", "availability", "tournament", "scout", "tourney-scout", "overview", "practice", "gear", "join", "recruits", "dues", "strategy"];
  document.querySelectorAll(".nav a").forEach((a) => {
    const href = a.getAttribute("href");
    const onTeam = href === "#/team" && teamPages.includes(route);
    a.classList.toggle("active", (route === "home" && href === "#/") || href === "#/" + route || onTeam);
  });

  const app = document.getElementById("app");
  clearWhoModal();
  app.innerHTML = "<p class='muted'>Loading…</p>";
  try {
    if (route === "home") {
      const [roster, schedule, avail, fees, tourneyAvail] = await Promise.all([
        api.get("/api/roster"),
        api.get("/api/schedule"),
        api.get("/api/availability?kind=league"),
        isTeam() ? api.get("/api/fees") : Promise.resolve({}),
        api.get("/api/availability?kind=tournament"),
      ]);
      app.innerHTML = renderHome(roster, schedule, avail, fees, tourneyAvail);
      bindRoster(roster, avail, tourneyAvail);
    } else if (route === "roster") {
      const [roster, leagueAvail, tourneyAvail] = await Promise.all([
        api.get("/api/roster"),
        api.get("/api/availability?kind=league"),
        api.get("/api/availability?kind=tournament"),
      ]);
      app.innerHTML = renderRoster(roster, localStorage.getItem("wizardsRosterSquad"), leagueAvail, tourneyAvail);
      bindRoster(roster, leagueAvail, tourneyAvail);
    } else if (route === "schedule") {
      const [schedule, leagueAvail, tourneyAvail, practiceAvail, book] = await Promise.all([
        api.get("/api/schedule"),
        api.get("/api/availability?kind=league"),
        api.get("/api/availability?kind=tournament"),
        api.get("/api/availability?kind=practice"),
        isTeam() ? api.get("/api/plw-league").catch(() => ({ teams: [] })) : Promise.resolve({ teams: [] }),
      ]);
      const packs = { league: leagueAvail, tournament: tourneyAvail, practice: practiceAvail, book: (book && book.teams) || [] };
      app.innerHTML = renderSchedule(schedule, leagueAvail, null, null, packs);
      bindSchedule(schedule, leagueAvail, packs);
    } else if (route === "availability" || route === "tournament" || route === "practice") {
      if (!isTeam()) {
        app.innerHTML = renderLock("team");
        bindPageLock("team");
      } else {
        const kind = route === "availability" ? "league" : route;
        const [roster, avail] = await Promise.all([api.get("/api/roster"), api.get("/api/availability?kind=" + kind)]);
        const me = sessionPlayerId(roster.players);
        app.innerHTML = await renderAvailability(roster, avail, me, kind);
        bindAvailability(roster, !me, kind, avail);
      }
    } else if (route === "activity") {
      if (!isTeam()) {
        app.innerHTML = renderLock("team");
        bindPageLock("team");
      } else {
        const log = await api.get("/api/activity");
        app.innerHTML = renderActivity(log);
      }
    } else if (route === "board") {
      if (!isTeam()) {
        app.innerHTML = renderLock("team");
        bindPageLock("team");
      } else {
        const [roster, board] = await Promise.all([api.get("/api/roster"), api.get("/api/board")]);
        const me = sessionPlayerId(roster.players);
        app.innerHTML = renderBoard(roster, board, me);
        bindBoard(roster, !!me);
      }
    } else if (route === "media") {
      app.innerHTML = renderMedia();
    } else if (route === "gear") {
      if (!isTeam()) {
        app.innerHTML = renderLock("team");
        bindPageLock("team");
      } else {
        const [roster, jerseys] = await Promise.all([api.get("/api/roster"), api.get("/api/jerseys")]);
        const me = sessionPlayerId(roster.players);
        app.innerHTML = renderGear(roster, jerseys, me);
        bindGear(roster, !!me);
      }
    } else if (route === "dues") {
      if (!isTeam()) {
        app.innerHTML = renderLock("team");
        bindPageLock("team");
      } else {
        const [roster, fees] = await Promise.all([api.get("/api/roster"), api.get("/api/fees")]);
        app.innerHTML = renderDues(roster, fees);
        bindDues(roster, fees);
      }
    } else if (route === "admin") {
      if (!isAdmin()) {
        app.innerHTML = renderLock("admin");
        bindPageLock();
      } else {
        const [roster, fees] = await Promise.all([api.get("/api/roster"), api.get("/api/fees")]);
        app.innerHTML = renderAdmin(roster, fees) + '<div id="users-panel"></div>';
        bindAdmin(roster);
        await reloadUsers();
      }
    } else if (route === "strategy") {
      if (!isTeam()) {
        app.innerHTML = renderLock("team");
      } else {
        const data = await api.get("/api/strategy");
        app.innerHTML = renderStrategy(data);
      }
    } else if (route === "login") {
      if (isTeam()) {
        location.hash = "#/";
        return;
      }
      app.innerHTML = renderLogin();
      bindLogin();
    } else if (route === "league") {
      app.innerHTML = renderLeague();
    } else if (route === "team") {
      if (!isTeam()) {
        app.innerHTML = renderLock("team");
        bindPageLock("team");
      } else {
        app.innerHTML = renderTeamHub();
      }
    } else if (route === "scout") {
      if (!isTeam()) {
        app.innerHTML = renderLock("team");
        bindPageLock("team");
      } else {
        const data = await api.get("/api/plw-league");
        const team = new URLSearchParams(location.hash.split("?")[1] || "").get("team");
        app.innerHTML = renderScout(data, team);
        bindScout();
      }
    } else if (route === "tourney-scout") {
      if (!isTeam()) {
        app.innerHTML = renderLock("team");
        bindPageLock("team");
      } else {
        const data = await api.get("/api/plw-tourney");
        const team = new URLSearchParams(location.hash.split("?")[1] || "").get("team");
        app.innerHTML = renderTourneyScout(data, team);
        bindTourneyScout();
      }
    } else if (route === "overview") {
      location.hash = "#/scout";
      return;
    } else if (route === "join") {
      app.innerHTML = renderJoin();
      bindJoin();
    } else if (route === "recruits") {
      if (!isTeam()) {
        app.innerHTML = renderLock("team");
        bindPageLock("team");
      } else {
        const rec = await api.get("/api/recruits");
        app.innerHTML = renderRecruits(rec);
        bindRecruits(rec);
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
