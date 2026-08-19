async function renderAvailability(roster, avail) {
  const savedId = localStorage.getItem("wizardsPlayerId") || roster.players[0].id;
  const mine = (avail.players[savedId] && avail.players[savedId].days) || {};
  const options = roster.players
    .map((p) => `<option value="${p.id}" ${p.id === savedId ? "selected" : ""}>${escapeHtml(playerLabel(p))}</option>`)
    .join("");
  const locked = avail.lockedNight;
  const isManager = (roster.players.find((p) => p.id === savedId) || {}).role === "Co-manager";
  const needed = avail.needed || 6;

  const dayCols = DAYS_META.map(([day, label]) => {
    const entry = mine[day] || { status: "no", windows: [] };
    const byWindow = (avail.windows || []).map((w) => ({ w, t: tallySlot(avail, day, w.id) }));
    const best = byWindow.reduce((a, b) => (b.t.yes > a.t.yes ? b : a), byWindow[0] || { t: { yes: 0, maybe: 0, names: { yes: [], maybe: [] } } });
    const go = best.t.yes >= needed;
    const close = !go && best.t.yes + best.t.maybe >= needed;
    const names = { yes: new Set(), maybe: new Set() };
    for (const row of byWindow) {
      row.t.names.yes.forEach((n) => names.yes.add(n));
      row.t.names.maybe.forEach((n) => names.maybe.add(n));
    }
    const chips = [
      ...[...names.yes].map((n) => `<span class="chip yes">${escapeHtml(n)}</span>`),
      ...[...names.maybe].map((n) => `<span class="chip maybe">${escapeHtml(n)}?</span>`),
    ].join("");
    const counts = byWindow
      .map((row) => {
        const on = best.w && row.w.id === best.w.id ? "on" : "";
        return `<span class="win-count ${on} ${row.t.yes >= needed ? "go" : ""}">${escapeHtml(row.w.label[0])}<b>${row.t.yes}</b>${row.t.maybe ? `<i>+${row.t.maybe}</i>` : ""}</span>`;
      })
      .join("");
    const segs = ["yes", "maybe", "no"]
      .map((s) => `<label class="${entry.status === s ? "on" : ""}"><input type="radio" name="st-${day}" value="${s}" ${entry.status === s ? "checked" : ""}/> ${cap(s)}</label>`)
      .join("");
    const wins = (avail.windows || [])
      .map((w) => `<label><input type="checkbox" name="w-${day}" value="${w.id}" ${entry.windows.includes(w.id) ? "checked" : ""}/> ${escapeHtml(w.hint)}</label>`)
      .join("");
    const lockBtn =
      isManager && go
        ? `<button class="btn" data-lock="${day}" data-window="${best.w.id}" type="button">Lock</button>`
        : "";
    return `
      <article class="day ${go ? "go" : close ? "close" : ""}">
        <h3>${label}</h3>
        <div class="win-line">${counts}</div>
        <div class="seg">${segs}</div>
        <div class="windows">${wins}</div>
        <div class="chips">${chips || '<span class="muted">Empty</span>'}</div>
        ${lockBtn}
      </article>`;
  }).join("");

  return `
    <p class="kicker">Need ${needed} at the same time</p>
    <h1>League night</h1>
    <p class="lede">Mark yourself in each day card. A/E/N is afternoon, evening, night — green at ${needed} yes.</p>
    ${locked ? `<div class="banner">Locked: <strong>${cap(locked.day)} ${escapeHtml(locked.window)}</strong> by ${escapeHtml(locked.lockedBy)}. ${isManager ? '<button class="btn ghost" id="clear-lock" type="button">Clear lock</button>' : ""}</div>` : ""}
    <form id="avail-form">
      <div class="who-bar">
        <label for="player-id">I am</label>
        <select id="player-id" name="playerId">${options}</select>
        <button class="btn" type="submit">Save my week</button>
        <p id="avail-msg" class="muted"></p>
      </div>
      <div class="day-grid">${dayCols}</div>
    </form>
  `;
}

function bindAvailability(roster) {
  const form = document.getElementById("avail-form");
  if (!form) return;
  const select = document.getElementById("player-id");
  select.addEventListener("change", async () => {
    localStorage.setItem("wizardsPlayerId", select.value);
    const [r, a] = await Promise.all([api.get("/api/roster"), api.get("/api/availability")]);
    document.getElementById("app").innerHTML = await renderAvailability(r, a);
    bindAvailability(r);
  });
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const playerId = select.value;
    localStorage.setItem("wizardsPlayerId", playerId);
    const days = {};
    for (const [day] of DAYS_META) {
      const status = (form.querySelector(`input[name="st-${day}"]:checked`) || {}).value || "no";
      let windows = [...form.querySelectorAll(`input[name="w-${day}"]:checked`)].map((i) => i.value);
      if (status !== "no" && windows.length === 0) {
        windows = ["afternoon", "evening", "night"];
      }
      days[day] = { status, windows };
    }
    const msg = document.getElementById("avail-msg");
    try {
      const avail = await api.send("/api/availability/" + playerId, "PUT", { days });
      document.getElementById("app").innerHTML = await renderAvailability(roster, avail);
      bindAvailability(roster);
      document.getElementById("avail-msg").textContent = "Saved.";
    } catch (err) {
      msg.textContent = err.message;
    }
  });
  document.querySelectorAll("[data-lock]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      try {
        const avail = await api.send("/api/lock-night", "POST", {
          playerId: select.value,
          day: btn.dataset.lock,
          window: btn.dataset.window,
        });
        document.getElementById("app").innerHTML = await renderAvailability(roster, avail);
        bindAvailability(roster);
      } catch (err) {
        alert(err.message);
      }
    });
  });
  const clear = document.getElementById("clear-lock");
  if (clear) {
    clear.addEventListener("click", async () => {
      const avail = await api.send("/api/lock-night", "POST", { playerId: select.value, clear: true });
      document.getElementById("app").innerHTML = await renderAvailability(roster, avail);
      bindAvailability(roster);
    });
  }
}
