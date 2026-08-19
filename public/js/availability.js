const AVAIL_META = {
  league: {
    kind: "league",
    title: "League night",
    lede: "Mark the windows Adam sent. Green at NEED yes.",
    from: "From Adam",
    board: "Windows on the board",
    save: "Save my week",
    hash: "#/availability",
  },
  tournament: {
    kind: "tournament",
    title: "Tournament days",
    lede: "Who can play each tournament. Green at NEED yes.",
    from: "On the calendar",
    board: "Tournament dates",
    save: "Save my tournaments",
    hash: "#/tournament",
  },
  practice: {
    kind: "practice",
    title: "Practice sessions",
    lede: "Who can make practice. Green at NEED yes.",
    from: "Practice windows",
    board: "Sessions on the board",
    save: "Save my practice",
    hash: "#/practice",
  },
};

function availPage(kind) {
  return AVAIL_META[kind] || AVAIL_META.league;
}

function availApi(kind) {
  return "/api/availability?kind=" + encodeURIComponent(kind);
}

function offerKey(offer, kind) {
  return kind === "league" ? offer.day : offer.date || offer.day;
}

function slugTime(label) {
  return "t-" + String(label).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 24);
}

function parseOfferTimes(note) {
  const text = String(note || "");
  const colon = [...text.matchAll(/\b(\d{1,2}:\d{2})\b/g)].map((m) => m[1]);
  if (colon.length) {
    const ampm = (text.match(/\b(AM|PM)\b/i) || [])[1];
    const suf = ampm ? " " + ampm.toUpperCase() : "";
    return [...new Set(colon.map((t) => t + suf))];
  }
  return [...new Set([...text.matchAll(/\b(\d{1,2}(?::\d{2})?)\s*(am|pm)\b/gi)].map((m) => m[1] + m[2].toLowerCase()))];
}

function windowsForOffer(offer, fallback) {
  const times = (offer.times && offer.times.length ? offer.times : parseOfferTimes(offer.note)).filter(Boolean);
  if (!times.length) return fallback || [];
  return times.map((label) => ({ id: slugTime(label), label, hint: label }));
}

function lockLabel(day) {
  if (/^\d{4}-\d{2}-\d{2}$/.test(day)) {
    return new Date(day + "T12:00:00").toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
    });
  }
  return cap(day);
}

function availTabs(kind) {
  return `
    <div class="actions" style="margin-top:0">
      <a class="btn ghost${kind === "league" ? " on" : ""}" href="#/availability">League Night</a>
      <a class="btn ghost${kind === "tournament" ? " on" : ""}" href="#/tournament">Tournament</a>
      <a class="btn ghost${kind === "practice" ? " on" : ""}" href="#/practice">Practice</a>
    </div>`;
}

async function renderAvailability(roster, avail, playerId, kind) {
  const page = availPage(kind);
  const savedId = playerId || "";
  const mine = (savedId && avail.players[savedId] && avail.players[savedId].days) || {};
  const options = [`<option value="">Who are you?</option>`]
    .concat(roster.players.map((p) => `<option value="${p.id}" ${p.id === savedId ? "selected" : ""}>${escapeHtml(playerLabel(p))}</option>`))
    .join("");
  const locked = avail.lockedNight;
  const isManager = (roster.players.find((p) => p.id === savedId) || {}).role === "Co-manager";
  const needed = avail.needed || 6;

  const offers = [...(avail.offers || [])].sort((a, b) => String(a.date || a.day).localeCompare(String(b.date || b.day)));
  const dayCols = offers.map((offer) => {
    const day = offerKey(offer, page.kind);
    const when = new Date((offer.date || "") + "T12:00:00");
    const label = Number.isNaN(when.getTime())
      ? cap(offer.day)
      : when.toLocaleDateString("en-US", { weekday: "short" });
    const num = Number.isNaN(when.getTime()) ? "" : when.getDate();
    const entry = mine[day] || { status: "no", windows: [] };
    const dayWindows = windowsForOffer(offer, avail.windows || []);
    const byWindow = dayWindows.map((w) => ({ w, t: tallySlot(avail, day, w.id) }));
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
        return `<span class="win-count ${on} ${row.t.yes >= needed ? "go" : ""}">${escapeHtml(/^t-/.test(row.w.id) ? row.w.hint : row.w.label[0])}<b>${row.t.yes}</b>${row.t.maybe ? `<i>+${row.t.maybe}</i>` : ""}</span>`;
      })
      .join("");
    const segs = ["yes", "maybe", "no"]
      .map((s) => `<label class="${entry.status === s ? "on" : ""}"><input type="radio" name="st-${day}" value="${s}" ${entry.status === s ? "checked" : ""}/> ${cap(s)}</label>`)
      .join("");
    const wins = dayWindows
      .map((w) => `<label><input type="checkbox" name="w-${day}" value="${w.id}" ${entry.windows.includes(w.id) ? "checked" : ""}/> ${escapeHtml(w.hint)}</label>`)
      .join("");
    const lockBtn =
      isManager && go
        ? `<button class="btn" data-lock="${day}" data-window="${best.w.id}" type="button">Lock</button>`
        : "";
    return `
      <article class="day ${go ? "go" : close ? "close" : ""}" data-day="${day}" data-date="${escapeHtml(offer.date || "")}">
        <h3>${num ? `<span class="day-num">${num}</span>` : ""}${label}</h3>
        <p class="day-note">${escapeHtml(offer.note)}</p>
        <div class="win-line">${counts}</div>
        <div class="seg">${segs}</div>
        <div class="windows">${wins}</div>
        <div class="chips">${chips || '<span class="muted">Empty</span>'}</div>
        ${lockBtn}
      </article>`;
  }).join("");

  return `
    <p class="kicker">Need ${needed} at the same time</p>
    <h1>${escapeHtml(page.title)}</h1>
    <p class="lede">${escapeHtml(page.lede.replace("NEED", String(needed)))}</p>
    ${availTabs(page.kind)}
    ${offers.length ? `<section class="card adam-offers">
      <p class="kicker">${escapeHtml(page.from)}</p>
      <h2>${escapeHtml(page.board)}</h2>
      <ul class="rules">${offers.map((o) => {
        const d = new Date((o.date || "") + "T12:00:00");
        const label = Number.isNaN(d.getTime())
          ? cap(o.day)
          : d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
        return `<li><strong>${Number.isNaN(d.getTime()) ? "" : d.getDate()}</strong> ${escapeHtml(label)} — ${escapeHtml(o.note)}</li>`;
      }).join("")}</ul>
    </section>` : `<p class="muted">No dates on the board yet.</p>`}
    ${locked ? `<div class="banner">Locked: <strong>${escapeHtml(lockLabel(locked.day))} ${escapeHtml(locked.window)}</strong> by ${escapeHtml(locked.lockedBy)}. ${isManager ? '<button class="btn ghost" id="clear-lock" type="button">Clear lock</button>' : ""}</div>` : ""}
    <form id="avail-form">
      <div class="who-bar">
        <label for="player-id">I am</label>
        <select id="player-id" name="playerId">${options}</select>
        <button class="btn" type="submit">${escapeHtml(page.save)}</button>
        <p id="avail-msg" class="muted"></p>
      </div>
      <div class="day-grid">${dayCols}</div>
    </form>
  `;
}

function bindAvailability(roster, skipAsk, kind) {
  const page = availPage(kind);
  const form = document.getElementById("avail-form");
  if (!form) return;
  const select = document.getElementById("player-id");
  const redraw = async (id, skip) => {
    rememberPlayerId(id);
    const [r, a] = await Promise.all([api.get("/api/roster"), api.get(availApi(page.kind))]);
    document.getElementById("app").innerHTML = await renderAvailability(r, a, id, page.kind);
    bindAvailability(r, skip, page.kind);
  };
  if (!skipAsk) {
    askWho(roster.players, (id) => redraw(id, true));
  }
  select.addEventListener("change", async () => {
    if (!select.value) return;
    await redraw(select.value, true);
  });
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const playerId = select.value;
    if (!playerId) {
      document.getElementById("avail-msg").textContent = "Pick who you are first.";
      return;
    }
    rememberPlayerId(playerId);
    const days = {};
    form.querySelectorAll("article.day[data-day]").forEach((card) => {
      const day = card.dataset.day;
      const status = (form.querySelector(`input[name="st-${day}"]:checked`) || {}).value || "no";
      let windows = [...form.querySelectorAll(`input[name="w-${day}"]:checked`)].map((i) => i.value);
      if (status !== "no" && windows.length === 0) {
        windows = [...form.querySelectorAll(`input[name="w-${day}"]`)].map((i) => i.value);
      }
      days[day] = { status, windows };
    });
    const msg = document.getElementById("avail-msg");
    try {
      const avail = await api.send("/api/availability/" + playerId, "PUT", { days, kind: page.kind });
      document.getElementById("app").innerHTML = await renderAvailability(roster, avail, playerId, page.kind);
      bindAvailability(roster, true, page.kind);
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
          kind: page.kind,
          day: btn.dataset.lock,
          window: btn.dataset.window,
        });
        document.getElementById("app").innerHTML = await renderAvailability(roster, avail, select.value, page.kind);
        bindAvailability(roster, true, page.kind);
      } catch (err) {
        alert(err.message);
      }
    });
  });
  const clear = document.getElementById("clear-lock");
  if (clear) {
    clear.addEventListener("click", async () => {
      const avail = await api.send("/api/lock-night", "POST", { playerId: select.value, kind: page.kind, clear: true });
      document.getElementById("app").innerHTML = await renderAvailability(roster, avail, select.value, page.kind);
      bindAvailability(roster, true, page.kind);
    });
  }
  const date = new URLSearchParams((location.hash.split("?")[1] || "")).get("date");
  const card = date && document.querySelector(`article.day[data-date="${date}"]`);
  if (card) {
    card.classList.add("focus");
    card.scrollIntoView({ behavior: "smooth", block: "center" });
  }
}
