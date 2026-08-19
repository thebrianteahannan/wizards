function renderLogin() {
  return `
    <p class="kicker">Team access</p>
    <h1>Log in</h1>
    <p class="lede">Use your roster name. No email. If you leave the Wizards, Brian can revoke this login so you cannot take strategy with you.</p>
    <div class="grid-2" style="margin-top:1rem;align-items:start">
      <section class="card">
        <h2>I have a login</h2>
        <form id="login-form">
          <div class="form-row">
            <label>Name</label>
            <select name="username" required>
              <option value="">Loading names…</option>
            </select>
          </div>
          <div class="form-row">
            <label>Password</label>
            <input name="password" type="password" required minlength="6" autocomplete="current-password" />
          </div>
          <button class="btn" type="submit">Log in</button>
          <p class="muted login-msg"></p>
        </form>
      </section>
      <section class="card">
        <h2>First time</h2>
        <p class="muted">Pick your name from the roster. Ask Brian for the invite code. First account on a new site does not need a code and becomes admin.</p>
        <form id="register-form">
          <div class="form-row">
            <label>Name</label>
            <select name="playerId" required>
              <option value="">Loading roster…</option>
            </select>
          </div>
          <div class="form-row">
            <label>Password</label>
            <input name="password" type="password" required minlength="6" autocomplete="new-password" />
          </div>
          <div class="form-row">
            <label>Invite code</label>
            <input name="invite" maxlength="12" autocomplete="off" placeholder="From Brian" />
          </div>
          <button class="btn" type="submit">Create login</button>
          <p class="muted register-msg"></p>
        </form>
      </section>
      <section class="card">
        <h2>Forgot password</h2>
        <p class="muted">No email reset. This pings Brian. He will set a new password and tell you.</p>
        <form id="reset-form">
          <div class="form-row">
            <label>Name</label>
            <select name="username" required>
              <option value="">Loading names…</option>
            </select>
          </div>
          <button class="btn ghost" type="submit">Ask for a reset</button>
          <p class="muted reset-msg"></p>
        </form>
      </section>
    </div>
  `;
}

function bindLogin() {
  const login = document.getElementById("login-form");
  const register = document.getElementById("register-form");
  const reset = document.getElementById("reset-form");
  if (login) {
    fillClaimedPlayers(login);
    login.addEventListener("submit", async (e) => {
      e.preventDefault();
      const msg = login.querySelector(".login-msg");
      const body = Object.fromEntries(new FormData(login).entries());
      try {
        await api.send("/api/auth/login", "POST", body);
        await refreshSession();
        location.hash = "#/";
      } catch (err) {
        msg.textContent = err.message;
      }
    });
  }
  if (register) {
    fillOpenPlayers(register);
    register.addEventListener("submit", async (e) => {
      e.preventDefault();
      const msg = register.querySelector(".register-msg");
      const body = Object.fromEntries(new FormData(register).entries());
      try {
        const out = await api.send("/api/auth/register", "POST", body);
        await refreshSession();
        if (out.inviteCode) {
          msg.textContent = "You are admin. Invite code for the rest of the club: " + out.inviteCode;
          return;
        }
        location.hash = "#/";
      } catch (err) {
        msg.textContent = err.message;
      }
    });
  }
  if (reset) {
    fillClaimedPlayers(reset);
    reset.addEventListener("submit", async (e) => {
      e.preventDefault();
      const msg = reset.querySelector(".reset-msg");
      const body = Object.fromEntries(new FormData(reset).entries());
      try {
        await api.send("/api/auth/reset-request", "POST", body);
        msg.textContent = "Logged. A manager will set a new password and tell you.";
      } catch (err) {
        msg.textContent = err.message;
      }
    });
  }
}

async function fillClaimedPlayers(form) {
  const sel = form.querySelector("select[name='username']");
  const btn = form.querySelector("button[type='submit']");
  if (!sel) return;
  try {
    const data = await api.get("/api/auth/claimed-players");
    const players = data.players || [];
    if (!players.length) {
      sel.innerHTML = `<option value="">Nobody has a login yet</option>`;
      sel.disabled = true;
      if (btn) btn.disabled = true;
      return;
    }
    sel.innerHTML = [`<option value="">Pick your name</option>`]
      .concat(
        players.map(
          (p) =>
            `<option value="${escapeHtml(p.username)}">${escapeHtml(p.number != null ? p.name + " #" + p.number : p.name)}</option>`
        )
      )
      .join("");
  } catch (_) {
    sel.innerHTML = `<option value="">Could not load names</option>`;
    if (btn) btn.disabled = true;
  }
}

async function fillOpenPlayers(form) {
  const sel = form.querySelector("select[name='playerId']");
  const btn = form.querySelector("button[type='submit']");
  if (!sel) return;
  try {
    const data = await api.get("/api/auth/open-players");
    const players = data.players || [];
    if (!players.length) {
      sel.innerHTML = `<option value="">Everyone on the roster already has a login</option>`;
      sel.disabled = true;
      if (btn) btn.disabled = true;
      return;
    }
    sel.innerHTML = [`<option value="">Pick your name</option>`]
      .concat(players.map((p) => `<option value="${escapeHtml(p.id)}">${escapeHtml(playerLabel(p))}</option>`))
      .join("");
  } catch (_) {
    sel.innerHTML = `<option value="">Could not load roster</option>`;
    if (btn) btn.disabled = true;
  }
}

function renderUsers(admin) {
  const resets = (admin.resets || [])
    .map(
      (r) => `
      <article class="event">
        <time>Reset</time>
        <div>
          <div class="kind">${escapeHtml(r.createdAt ? r.createdAt.slice(0, 16).replace("T", " ") : "")}${r.known ? "" : " · unknown name"}</div>
          <h3>${escapeHtml(r.username)}</h3>
          <p>
            <button class="btn" type="button" data-setpw="${escapeHtml(r.username)}">Set password</button>
            <button class="btn ghost" type="button" data-dismiss="${escapeHtml(r.id)}">Dismiss</button>
          </p>
        </div>
      </article>`
    )
    .join("");
  const rows = (admin.users || [])
    .map((u) => {
      const status = u.active ? "Active" : "Revoked";
      return `
      <article class="event">
        <time>${escapeHtml(u.role)}</time>
        <div>
          <div class="kind">${status}</div>
          <h3>${escapeHtml(u.username)}</h3>
          <p>
            ${u.active
              ? `<button class="btn ghost" type="button" data-revoke="${escapeHtml(u.id)}">Revoke</button>`
              : `<button class="btn" type="button" data-restore="${escapeHtml(u.id)}">Restore</button>`}
            <button class="btn ghost" type="button" data-setid="${escapeHtml(u.id)}" data-setpw="${escapeHtml(u.username)}">Set password</button>
            ${u.role === "admin"
              ? `<button class="btn ghost" type="button" data-role="${escapeHtml(u.id)}" data-next="team">Make player</button>`
              : `<button class="btn ghost" type="button" data-role="${escapeHtml(u.id)}" data-next="admin">Make admin</button>`}
          </p>
        </div>
      </article>`;
    })
    .join("");
  return `
    <section class="card" style="margin-top:1rem">
      <p class="kicker">Access</p>
      <h2>Logins</h2>
      <p>Invite code for new Wizards: <strong id="invite-code">${escapeHtml(admin.inviteCode || "—")}</strong>
        <button class="btn ghost" type="button" id="copy-invite">Copy</button>
        <button class="btn ghost" type="button" id="rotate-invite">New code</button></p>
      <p class="muted">Text the code to someone when they join. Rotate it if a code leaked. Revoke a login if they go to another team.</p>
      <p id="users-msg" class="muted"></p>
    </section>
    ${resets ? `<h2 style="margin-top:1.2rem">Password reset requests</h2><div class="timeline">${resets}</div>` : ""}
    <h2 style="margin-top:1.2rem">People</h2>
    <div class="timeline">${rows || '<p class="muted">Nobody yet.</p>'}</div>
  `;
}

async function reloadUsers() {
  const admin = await api.get("/api/auth/admin");
  const host = document.getElementById("users-panel");
  if (!host) return;
  host.innerHTML = renderUsers(admin);
  bindUsers();
}

function bindUsers() {
  const msg = document.getElementById("users-msg");
  const rotate = document.getElementById("rotate-invite");
  const copy = document.getElementById("copy-invite");
  if (copy) {
    copy.addEventListener("click", async () => {
      const code = document.getElementById("invite-code");
      const text = code ? String(code.textContent || "").trim() : "";
      if (!text || text === "—") {
        if (msg) msg.textContent = "No invite code yet.";
        return;
      }
      try {
        await navigator.clipboard.writeText(text);
        if (msg) msg.textContent = "Copied.";
      } catch (_) {
        if (msg) msg.textContent = "Could not copy. Select the code and copy it.";
      }
    });
  }
  if (rotate) {
    rotate.addEventListener("click", async () => {
      try {
        const out = await api.send("/api/auth/invite", "POST", {});
        const code = document.getElementById("invite-code");
        if (code) code.textContent = out.inviteCode;
        if (msg) msg.textContent = "New invite code. Old one is dead.";
      } catch (err) {
        if (msg) msg.textContent = err.message;
      }
    });
  }
  document.querySelectorAll("[data-revoke]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      try {
        await api.send("/api/auth/revoke", "POST", { userId: btn.dataset.revoke });
        await reloadUsers();
      } catch (err) {
        if (msg) msg.textContent = err.message;
      }
    });
  });
  document.querySelectorAll("[data-restore]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      try {
        await api.send("/api/auth/restore", "POST", { userId: btn.dataset.restore });
        await reloadUsers();
      } catch (err) {
        if (msg) msg.textContent = err.message;
      }
    });
  });
  document.querySelectorAll("[data-role]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      try {
        await api.send("/api/auth/role", "POST", { userId: btn.dataset.role, role: btn.dataset.next });
        await reloadUsers();
      } catch (err) {
        if (msg) msg.textContent = err.message;
      }
    });
  });
  document.querySelectorAll("[data-dismiss]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      try {
        await api.send("/api/auth/dismiss-reset", "POST", { id: btn.dataset.dismiss });
        await reloadUsers();
      } catch (err) {
        if (msg) msg.textContent = err.message;
      }
    });
  });
  document.querySelectorAll("[data-setpw]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const password = window.prompt("New password for " + btn.dataset.setpw + " (tell them in person or by text)");
      if (!password) return;
      const userId = btn.dataset.setid || (await findUserId(btn.dataset.setpw));
      if (!userId) {
        if (msg) msg.textContent = "No login with that username.";
        return;
      }
      try {
        await api.send("/api/auth/set-password", "POST", { userId, password });
        await reloadUsers();
        if (msg) msg.textContent = "Password set. Tell them, then they log in.";
      } catch (err) {
        if (msg) msg.textContent = err.message;
      }
    });
  });
}

async function findUserId(username) {
  const admin = await api.get("/api/auth/admin");
  const hit = (admin.users || []).find((u) => u.username === String(username || "").toLowerCase());
  return hit ? hit.id : "";
}
