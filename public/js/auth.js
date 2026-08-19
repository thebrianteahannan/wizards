let session = null;

function isTeam() {
  return !!(session && session.active);
}

function isAdmin() {
  return !!(session && session.role === "admin");
}

async function refreshSession() {
  try {
    session = await api.get("/api/auth/me");
  } catch (_) {
    session = null;
  }
  syncGates();
  return session;
}

function syncGates() {
  document.querySelectorAll("[data-need='team']").forEach((el) => {
    el.hidden = !isTeam();
  });
  document.querySelectorAll("[data-need='admin']").forEach((el) => {
    el.hidden = !isAdmin();
  });
  const leave = document.getElementById("team-leave");
  const login = document.getElementById("team-login");
  const who = document.getElementById("team-who");
  if (leave) leave.hidden = !isTeam();
  if (login) login.hidden = isTeam();
  if (who) {
    who.hidden = !isTeam();
    who.textContent = session ? session.username : "";
  }
  const join = document.getElementById("nav-join");
  if (join) join.textContent = isTeam() ? "Recruit" : "Join";
}

function renderLock(kind) {
  const admin = kind === "admin";
  return `
    <section class="card lock-card">
      <p class="kicker">${admin ? "Managers only" : "Wizards only"}</p>
      <h1>Log in</h1>
      <p class="lede">${admin ? "This page is for Brian." : "Each Wizard has a username and password. The old shared password is retired so someone who leaves cannot take the club with them."}</p>
      <div class="actions">
        <a class="btn" href="#/login">Log in</a>
      </div>
    </section>`;
}

function bindPageLock() {}

function bindHeaderGate() {
  const leave = document.getElementById("team-leave");
  if (leave) {
    leave.addEventListener("click", async () => {
      try {
        await api.send("/api/auth/logout", "POST", {});
      } catch (_) {}
      session = null;
      syncGates();
      if (/availability|tournament|practice|activity|board|dues|admin|recruits|gear|strategy|login/.test(location.hash)) {
        location.hash = "#/";
      } else load();
    });
  }
  syncGates();
}
