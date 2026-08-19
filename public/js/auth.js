function isTeam() {
  return localStorage.getItem("wizardsTeam") === "1";
}

function isAdmin() {
  return isTeam() && localStorage.getItem("wizardsAdmin") === "1";
}

function setTeam(on) {
  if (on) localStorage.setItem("wizardsTeam", "1");
  else {
    localStorage.removeItem("wizardsTeam");
    localStorage.removeItem("wizardsAdmin");
  }
}

function setAdmin(on) {
  if (on) {
    localStorage.setItem("wizardsTeam", "1");
    localStorage.setItem("wizardsAdmin", "1");
  } else localStorage.removeItem("wizardsAdmin");
}

function syncGates() {
  document.querySelectorAll("[data-need='team']").forEach((el) => {
    el.hidden = !isTeam();
  });
  document.querySelectorAll("[data-need='admin']").forEach((el) => {
    el.hidden = !isAdmin();
  });
  const leave = document.getElementById("team-leave");
  const form = document.getElementById("team-gate");
  if (leave) leave.hidden = !isTeam();
  if (form) form.hidden = isTeam();
}

function renderLock(kind) {
  const admin = kind === "admin";
  return `
    <section class="card lock-card">
      <p class="kicker">${admin ? "Managers only" : "Wizards only"}</p>
      <h1>${admin ? "Admin lock" : "Team lock"}</h1>
      <p class="lede">${admin ? "Enter the admin password to change dues and club settings." : "Enter the team password to open League Night, announcements, and dues."}</p>
      <form id="page-lock" class="lock-form">
        <input name="password" type="password" autocomplete="off" placeholder="Password" required />
        <button class="btn" type="submit">Unlock</button>
        <p class="lock-msg muted"></p>
      </form>
    </section>
  `;
}

function bindPageLock(kind) {
  const form = document.getElementById("page-lock");
  if (!form) return;
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const password = String(new FormData(form).get("password") || "").trim();
    const msg = form.querySelector(".lock-msg");
    if (kind === "admin" && password === "2323") {
      setAdmin(true);
      syncGates();
      location.hash = "#/admin";
      load();
      return;
    }
    if (kind !== "admin" && (password.toLowerCase() === "pineapple" || password === "2323")) {
      if (password === "2323") setAdmin(true);
      else setTeam(true);
      syncGates();
      load();
      return;
    }
    msg.textContent = "Wrong password.";
  });
}

function bindHeaderGate() {
  const form = document.getElementById("team-gate");
  const leave = document.getElementById("team-leave");
  if (form) {
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      const password = String(new FormData(form).get("password") || "").trim();
      const msg = document.getElementById("gate-msg");
      if (password === "2323") {
        setAdmin(true);
        syncGates();
        load();
        return;
      }
      if (password.toLowerCase() === "pineapple") {
        setTeam(true);
        syncGates();
        load();
        return;
      }
      if (msg) msg.textContent = "Nope.";
    });
  }
  if (leave) {
    leave.addEventListener("click", () => {
      setTeam(false);
      syncGates();
      if (/availability|tournament|practice|board|dues|admin|recruits/.test(location.hash)) location.hash = "#/";
      else load();
    });
  }
  syncGates();
}
