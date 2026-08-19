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
    </div>
    <p style="margin:0.45rem 0 1rem"><a href="#/activity">Activity log</a></p>`;
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

function firstWindowOffer(avail) {
  const today = new Date().toISOString().slice(0, 10);
  return [...(avail.offers || [])]
    .filter((o) => o.date && o.date >= today)
    .sort((a, b) => a.date.localeCompare(b.date))[0] || null;
}

function askFirstWindow(playerId, offer, avail, kind, onDone) {
  clearWhoModal();
  const day = offerKey(offer, kind);
  const wins = windowsForOffer(offer, (avail && avail.windows) || []);
  const when = new Date(offer.date + "T12:00:00");
  const label = Number.isNaN(when.getTime())
    ? cap(offer.day)
    : when.toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" });
  const winHtml = wins
    .map((w) => `<label><input type="checkbox" name="win" value="${escapeHtml(w.id)}" checked /> ${escapeHtml(w.hint)}</label>`)
    .join("");
  const wrap = document.createElement("div");
  wrap.id = "who-modal";
  wrap.className = "who-modal";
  wrap.innerHTML = `
    <form class="card who-card">
      <p class="kicker">Next window · need 6 ASAP</p>
      <h2>Can you play ${escapeHtml(label)}?</h2>
      <p class="muted">This is the night we need a roster for first. ${escapeHtml(offer.note || "")} You can mark other dates after this.</p>
      <div class="seg">
        <label><input type="radio" name="st" value="yes" required /> Yes</label>
        <label><input type="radio" name="st" value="maybe" /> Maybe</label>
        <label><input type="radio" name="st" value="no" /> No</label>
      </div>
      ${winHtml ? `<div class="windows" style="margin-top:0.65rem">${winHtml}</div>` : ""}
      <p class="muted first-win-msg"></p>
      <button class="btn" type="submit">Save this night</button>
    </form>`;
  document.body.appendChild(wrap);
  const form = wrap.querySelector("form");
  form.querySelectorAll('input[name="st"]').forEach((inp) => {
    inp.addEventListener("change", () => {
      form.querySelectorAll(".seg label").forEach((l) => l.classList.toggle("on", l.querySelector("input").checked));
    });
  });
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const status = String(new FormData(form).get("st") || "no");
    let windows = [...form.querySelectorAll('input[name="win"]:checked')].map((i) => i.value);
    if (status !== "no" && windows.length === 0) {
      windows = [...form.querySelectorAll('input[name="win"]')].map((i) => i.value);
    }
    const msg = form.querySelector(".first-win-msg");
    try {
      await api.send("/api/availability/" + playerId, "PUT", {
        kind,
        days: { [day]: { status, windows: status === "no" ? [] : windows } },
      });
      wrap.remove();
      onDone(offer.date);
    } catch (err) {
      if (msg) msg.textContent = err.message;
    }
  });
}

function bindAvailability(roster, skipAsk, kind, avail) {
  const page = availPage(kind);
  const form = document.getElementById("avail-form");
  if (!form) return;
  const select = document.getElementById("player-id");
  const redraw = async (id, skip, focusDate) => {
    rememberPlayerId(id);
    const [r, a] = await Promise.all([api.get("/api/roster"), api.get(availApi(page.kind))]);
    document.getElementById("app").innerHTML = await renderAvailability(r, a, id, page.kind);
    bindAvailability(r, skip, page.kind, a);
    const card = focusDate && document.querySelector(`article.day[data-date="${focusDate}"]`);
    if (card) {
      card.classList.add("focus");
      card.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  };
  const promptFirst = (id, after) => {
    const first = page.kind === "league" ? firstWindowOffer(avail || {}) : null;
    const day = first && offerKey(first, page.kind);
    const answered = day && ((((avail || {}).players || {})[id] || {}).days || {})[day];
    if (first && !answered) askFirstWindow(id, first, avail, page.kind, (focusDate) => redraw(id, true, focusDate));
    else if (after) after();
  };
  if (!skipAsk) {
    askWho(roster.players, (id) => {
      promptFirst(id, () => redraw(id, true));
    });
  } else if (select.value) {
    promptFirst(select.value);
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
      bindAvailability(roster, true, page.kind, avail);
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
        bindAvailability(roster, true, page.kind, avail);
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
      bindAvailability(roster, true, page.kind, avail);
    });
  }
  const date = new URLSearchParams((location.hash.split("?")[1] || "")).get("date");
  const card = date && document.querySelector(`article.day[data-date="${date}"]`);
  if (card) {
    card.classList.add("focus");
    card.scrollIntoView({ behavior: "smooth", block: "center" });
  }
}

function renderActivity(log) {
  const labels = { league: "League Night", tournament: "Tournament", practice: "Practice" };
  const rows = (log.entries || [])
    .map((e) => {
      const d = new Date(e.at);
      const day = Number.isNaN(d.getTime()) ? "" : d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
      const time = Number.isNaN(d.getTime()) ? "" : d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
      const detail = (e.lines || []).map((line) => escapeHtml(line)).join("<br>");
      return `
      <article class="event">
        <time>${escapeHtml(day)}</time>
        <div>
          <div class="kind">${escapeHtml(time)} · ${escapeHtml(labels[e.kind] || e.kind)} · ${e.action === "set" ? "set" : "updated"}</div>
          <h3>${escapeHtml(e.playerName)}</h3>
          <p>${detail || "Saved."}</p>
        </div>
      </article>`;
    })
    .join("");
  return `
    <p class="kicker">Team only</p>
    <h1>Activity log</h1>
    <p class="lede">Every League Night, Tournament, and Practice save. Newest first. This lives in data/ with the rest of the live files.</p>
    ${availTabs("activity")}
    <div class="timeline">${rows || '<p class="muted">No saves logged yet. Once someone hits Save, it shows up here.</p>'}</div>
  `;
}
