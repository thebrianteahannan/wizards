const AVAIL_META = {
  league: {
    kind: "league",
    title: "League",
    lede: "Mark the windows Adam sent. Green at NEED yes.",
    from: "From Adam",
    board: "Windows on the board",
  },
  tournament: {
    kind: "tournament",
    title: "Tournament days",
    lede: "Who can play each tournament. Green at NEED yes.",
    from: "On the calendar",
    board: "Tournament dates",
  },
  practice: {
    kind: "practice",
    title: "Practice sessions",
    lede: "Who can make practice. Green at NEED yes.",
    from: "Practice windows",
    board: "Sessions on the board",
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

function adminRestChips(roster, avail, day, kind) {
  const book = kind === "league" || kind === "tournament" ? kind : "";
  const tags = (roster.players || [])
    .filter((p) => {
      const st = ((((avail.players || {})[p.id] || {}).days || {})[day] || {}).status;
      return st !== "yes" && st !== "maybe" && (!book || typeof onSquad !== "function" || onSquad(p, book));
    })
    .map((p) => `<span class="chip" data-admin-sign="${escapeHtml(p.id)}" style="opacity:0.4;cursor:pointer">${escapeHtml(p.name)}</span>`)
    .join("");
  return tags ? `<div class="chips" data-admin-add style="margin-top:0.3rem">${tags}</div>` : "";
}

function chipName(n) {
  return n && n.name != null ? n.name : String(n || "");
}

function availChips(slot, dayAll) {
  const inSlot = new Set([...(slot.yes || []), ...(slot.maybe || [])].map(chipName));
  return [
    ...(slot.yes || []).map((n) => `<span class="chip yes"${n && n.id ? ` data-admin-drop="${escapeHtml(n.id)}" style="cursor:pointer"` : ""}>${escapeHtml(chipName(n))}</span>`),
    ...(slot.maybe || []).map((n) => `<span class="chip maybe">${escapeHtml(chipName(n))}?</span>`),
    ...(dayAll.yes || []).filter((n) => !inSlot.has(chipName(n))).map((n) => `<span class="chip">${escapeHtml(chipName(n))}</span>`),
    ...(dayAll.maybe || []).filter((n) => !inSlot.has(chipName(n))).map((n) => `<span class="chip">${escapeHtml(chipName(n))}?</span>`),
  ].join("");
}

function lockLabel(day) {
  if (/^\d{4}-\d{2}-\d{2}$/.test(day)) return new Date(day + "T12:00:00").toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
  return cap(day);
}

function availTabs(kind) {
  return `
    <div class="actions" style="margin-top:0">
      <a class="btn ghost${kind === "league" ? " on" : ""}" href="#/availability">League</a>
      <a class="btn ghost${kind === "tournament" ? " on" : ""}" href="#/tournament">Tournament</a>
      <a class="btn ghost${kind === "practice" ? " on" : ""}" href="#/practice">Practice</a>
    </div>
    <p style="margin:0.45rem 0 1rem"><a href="#/activity">Activity log</a></p>`;
}

async function renderAvailability(roster, avail, playerId, kind) {
  const page = availPage(kind);
  const savedId = playerId || "";
  const mine = (savedId && avail.players[savedId] && avail.players[savedId].days) || {};
  const locked = avail.lockedNight;
  const isManager = isAdmin() || (roster.players.find((p) => p.id === savedId) || {}).role === "Co-manager";
  const needed = avail.needed || 6;

  const offers = [...(avail.offers || [])].sort((a, b) => String(a.date || a.day).localeCompare(String(b.date || b.day)));
  let book = [];
  if (page.kind === "league") {
    try {
      book = ((await api.get("/api/plw-league")) || {}).teams || [];
    } catch (err) {
      book = [];
    }
  }
  const dayCard = (offer) => {
    const day = offerKey(offer, page.kind);
    const when = new Date((offer.date || "") + "T12:00:00");
    const ok = !Number.isNaN(when.getTime());
    const label = ok ? when.toLocaleDateString("en-US", { weekday: "short" }) : cap(offer.day);
    const num = ok ? when.getDate() : "";
    const mon = ok ? when.toLocaleDateString("en-US", { month: "short" }).toUpperCase() : "";
    const entry = mine[day] || { status: "no", windows: [] };
    const dayWindows = windowsForOffer(offer, avail.windows || []);
    const byWindow = dayWindows.map((w) => ({ w, t: tallySlot(avail, day, w.id) }));
    const best = byWindow.reduce((a, b) => (b.t.yes > a.t.yes ? b : a), byWindow[0] || { t: { yes: 0, maybe: 0, names: { yes: [], maybe: [] } } });
    const go = best.t.yes >= needed;
    const close = !go && best.t.yes + best.t.maybe >= needed;
    const chips = availChips(best.t ? best.t.names : { yes: [], maybe: [] }, tallySlot(avail, day).names);
    const counts = byWindow
      .map((row) => {
        const on = best.w && row.w.id === best.w.id ? "on" : "";
        return `<span class="win-count ${on} ${row.t.yes >= needed ? "go" : ""}" data-window="${escapeHtml(row.w.id)}">${escapeHtml(/^t-/.test(row.w.id) ? row.w.hint : row.w.label[0])}<b>${row.t.yes}</b>${row.t.maybe ? `<i>+${row.t.maybe}</i>` : ""}</span>`;
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
    const fav = page.kind === "league" && typeof matchupFavor === "function" ? matchupFavor(offer, book) : null;
    const favHtml =
      fav == null
        ? ""
        : `<span class="num" title="Matchup difficulty — higher is harder" style="margin-left:auto;letter-spacing:0;text-align:right;line-height:1.05"><small style="display:block;font-size:0.55rem;font-family:var(--sans,inherit);${typeof favorTone === "function" ? favorTone(fav) : ""}">${typeof favorWord === "function" ? escapeHtml(favorWord(fav)) : ""}</small><b style="font-family:var(--display);font-size:1.15rem;${typeof favorTone === "function" ? favorTone(fav) : ""}">${fav}</b></span>`;
    return `
      <article class="day ${go ? "go" : close ? "close" : ""}" data-day="${day}" data-date="${escapeHtml(offer.date || "")}" style="cursor:pointer">
        <h3>${num ? `<span class="day-num" style="font-family:var(--sport);letter-spacing:0.06em">${escapeHtml(mon)} ${num}</span>` : ""}${label}${favHtml}</h3>
        <p class="day-note">${escapeHtml(offer.note)}</p>
        <div class="win-line">${counts}</div>
        <div class="seg">${segs}</div>
        <div class="windows">${wins}</div>
        <div class="chips">${chips || '<span class="muted">Empty</span>'}</div>
        ${isManager ? adminRestChips(roster, avail, day, page.kind) : ""}
        ${lockBtn}
      </article>`;
  };
  const dayCols = offers.map(dayCard).join("");

  return `
    <p class="kicker">Need ${needed} at the same time</p>
    <h1>${escapeHtml(page.title)}</h1>
    <p class="lede">${escapeHtml(page.lede.replace("NEED", String(needed)))}</p>
    ${availTabs(page.kind)}
    ${page.kind === "practice" ? `
    <section class="card">
      <h2>New session</h2>
      <p class="muted">Any Wizard can post a practice. Others tap Yes / Maybe / No on the card.</p>
      <form id="practice-add">
        <div class="grid-2">
          <div class="form-row">
            <label>Date</label>
            <input name="date" type="date" required />
          </div>
          <div class="form-row">
            <label>Time</label>
            <input name="time" type="time" required />
          </div>
        </div>
        <div class="form-row">
          <label>Location</label>
          <input name="location" required maxlength="80" placeholder="Field, park, or address" />
        </div>
        <button class="btn" type="submit">Add practice</button>
        <p id="practice-add-msg" class="muted"></p>
      </form>
    </section>` : ""}
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
    </section>` : page.kind === "practice" ? "" : `<p class="muted">No dates on the board yet.</p>`}
    ${locked ? `<div class="banner">Locked: <strong>${escapeHtml(lockLabel(locked.day))} ${escapeHtml(locked.window)}</strong> by ${escapeHtml(locked.lockedBy)}. ${isManager ? '<button class="btn ghost" id="clear-lock" type="button">Clear lock</button>' : ""}</div>` : ""}
    <form id="avail-form">
      <p id="avail-msg" class="muted">Tap a date card to see that night's diamond. Radios still save your answer.</p>
      <div class="day-grid">${dayCols}</div>
    </form>
    ${renderEmptyNightDiamond()}
  `;
}

function liveTally(avail, day, windowId, myId, myName, myStatus, myWindows) {
  let yes = 0;
  let maybe = 0;
  const names = { yes: [], maybe: [] };
  const seen = new Set();
  for (const [id, p] of Object.entries((avail && avail.players) || {})) {
    const mine = id === myId;
    const entry = (p.days || {})[day] || {};
    const status = mine ? myStatus : entry.status;
    const windows = mine ? myWindows : entry.windows || [];
    const inWindow = !windowId || windows.includes(windowId) || windows.length === 0;
    seen.add(id);
    if (status === "yes" && inWindow) {
      yes += 1;
      names.yes.push({ id, name: p.name || id });
    } else if (status === "maybe" && inWindow) {
      maybe += 1;
      names.maybe.push({ id, name: p.name || id });
    }
  }
  if (myId && !seen.has(myId) && myName) {
    const inWindow = !windowId || myWindows.includes(windowId) || myWindows.length === 0;
    if (myStatus === "yes" && inWindow) {
      yes += 1;
      names.yes.push({ id: myId, name: myName });
    } else if (myStatus === "maybe" && inWindow) {
      maybe += 1;
      names.maybe.push({ id: myId, name: myName });
    }
  }
  return { yes, maybe, names };
}

function paintLiveDay(card, avail, roster) {
  const day = card.dataset.day;
  card.querySelectorAll(".seg label").forEach((l) => l.classList.toggle("on", l.querySelector("input").checked));
  const status = (card.querySelector(`input[name="st-${day}"]:checked`) || {}).value || "no";
  const boxes = [...card.querySelectorAll(`input[name="w-${day}"]`)];
  if (status !== "no" && boxes.length && !boxes.some((b) => b.checked)) {
    boxes.forEach((b) => {
      b.checked = true;
    });
  }
  const myId = sessionPlayerId(roster.players);
  const myName = sessionPlayerName(roster.players);
  const myWindows = boxes.filter((b) => b.checked).map((b) => b.value);
  card.querySelectorAll(".win-count").forEach((el) => {
    const t = liveTally(avail, day, el.dataset.window, myId, myName, status, myWindows);
    const b = el.querySelector("b");
    const extra = el.querySelector("i");
    if (b) b.textContent = t.yes;
    if (t.maybe) {
      if (extra) extra.textContent = "+" + t.maybe;
      else el.insertAdjacentHTML("beforeend", `<i>+${t.maybe}</i>`);
    } else if (extra) extra.remove();
  });
  const on = card.querySelector(".win-count.on");
  const slot = liveTally(avail, day, on ? on.dataset.window : "", myId, myName, status, myWindows);
  const dayAll = liveTally(avail, day, "", myId, myName, status, myWindows);
  const el = card.querySelector(".chips");
  if (el) el.innerHTML = availChips(slot.names, dayAll.names) || '<span class="muted">Empty</span>';
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
  const me = sessionPlayerId(roster.players);
  const redraw = async (id, skip, focusDate) => {
    const [r, a] = await Promise.all([api.get("/api/roster"), api.get(availApi(page.kind))]);
    document.getElementById("app").innerHTML = await renderAvailability(r, a, id, page.kind);
    bindAvailability(r, skip, page.kind, a);
    const card = focusDate && document.querySelector(`article.day[data-date="${focusDate}"]`);
    if (card) {
      const offer = (a.offers || []).find((o) => offerKey(o, page.kind) === card.dataset.day);
      if (offer) paintAvailDiamond(card, r, a, page.kind, offer, false);
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
  if (me && !skipAsk) promptFirst(me);
  let saveN = 0;
  form.addEventListener("change", (e) => {
    const card = e.target.closest("article.day");
    if (!card) return;
    paintLiveDay(card, avail, roster);
    const playerId = sessionPlayerId(roster.players);
    const msg = document.getElementById("avail-msg");
    if (!playerId) {
      if (msg) msg.textContent = "Your login is not linked to a roster name.";
      return;
    }
    const day = card.dataset.day;
    const status = (card.querySelector(`input[name="st-${day}"]:checked`) || {}).value || "no";
    let windows = [...card.querySelectorAll(`input[name="w-${day}"]:checked`)].map((i) => i.value);
    if (status !== "no" && windows.length === 0) {
      windows = [...card.querySelectorAll(`input[name="w-${day}"]`)].map((i) => i.value);
    }
    const n = ++saveN;
    if (msg) msg.textContent = "Saving…";
    api.send("/api/availability/" + playerId, "PUT", { days: { [day]: { status, windows } }, kind: page.kind })
      .then((next) => {
        if (n !== saveN) return;
        if (next && next.players) avail.players = next.players;
        if (msg) msg.textContent = "Saved.";
        const open = document.getElementById("avail-diamond");
        if (open && open.dataset.day === day) {
          const offer = (avail.offers || []).find((o) => offerKey(o, page.kind) === day);
          if (offer) paintAvailDiamond(card, roster, avail, page.kind, offer, false);
        }
      })
      .catch((err) => {
        if (msg) msg.textContent = err.message;
      });
  });
  form.querySelectorAll("article.day").forEach((card) => paintLiveDay(card, avail, roster));
  form.addEventListener("click", (e) => {
    const act = e.target.closest("[data-admin-sign], [data-admin-drop]");
    if (act) {
      const card = act.closest("article.day");
      const day = card.dataset.day;
      const on = !!act.dataset.adminSign;
      const id = act.dataset.adminSign || act.dataset.adminDrop;
      const windows = on ? [...card.querySelectorAll(`input[name="w-${day}"]`)].map((i) => i.value) : [];
      api.send("/api/availability/" + id, "PUT", { days: { [day]: { status: on ? "yes" : "no", windows } }, kind: page.kind })
        .then(() => redraw(sessionPlayerId(roster.players), true, card.dataset.date))
        .catch((err) => alert(err.message));
      return;
    }
    const win = e.target.closest(".win-count");
    if (win) {
      const card = win.closest("article.day");
      card.querySelectorAll(".win-count").forEach((el) => el.classList.toggle("on", el === win));
      paintLiveDay(card, avail, roster);
      return;
    }
    if (e.target.closest("input, label, button, a, select")) return;
    const card = e.target.closest("article.day");
    if (!card) return;
    const offer = (avail.offers || []).find((o) => offerKey(o, page.kind) === card.dataset.day);
    if (offer) paintAvailDiamond(card, roster, avail, page.kind, offer, true);
  });
  form.addEventListener("submit", (e) => e.preventDefault());
  const add = document.getElementById("practice-add");
  if (add) {
    add.addEventListener("submit", async (e) => {
      e.preventDefault();
      const msg = document.getElementById("practice-add-msg");
      const body = Object.fromEntries(new FormData(add).entries());
      try {
        const next = await api.send("/api/practice", "POST", body);
        document.getElementById("app").innerHTML = await renderAvailability(roster, next, sessionPlayerId(roster.players), "practice");
        bindAvailability(roster, true, "practice", next);
      } catch (err) {
        if (msg) msg.textContent = err.message;
      }
    });
  }
  document.querySelectorAll("[data-lock]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      try {
        const avail = await api.send("/api/lock-night", "POST", {
          kind: page.kind,
          day: btn.dataset.lock,
          window: btn.dataset.window,
        });
        document.getElementById("app").innerHTML = await renderAvailability(roster, avail, sessionPlayerId(roster.players), page.kind);
        bindAvailability(roster, true, page.kind, avail);
      } catch (err) {
        alert(err.message);
      }
    });
  });
  const clear = document.getElementById("clear-lock");
  if (clear) {
    clear.addEventListener("click", async () => {
      const avail = await api.send("/api/lock-night", "POST", { kind: page.kind, clear: true });
      document.getElementById("app").innerHTML = await renderAvailability(roster, avail, sessionPlayerId(roster.players), page.kind);
      bindAvailability(roster, true, page.kind, avail);
    });
  }
  const date = new URLSearchParams((location.hash.split("?")[1] || "")).get("date");
  const next = date ? null : firstWindowOffer(avail);
  const card = (date && document.querySelector(`article.day[data-date="${date}"]`))
    || (next && document.querySelector(`article.day[data-date="${next.date}"]`));
  if (card) {
    const offer = (avail.offers || []).find((o) => offerKey(o, page.kind) === card.dataset.day);
    if (offer) paintAvailDiamond(card, roster, avail, page.kind, offer, false);
    card.scrollIntoView({ behavior: "smooth", block: "center" });
  }
}

function renderActivity(log) {
  const labels = { league: "League", tournament: "Tournament", practice: "Practice" };
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
    <p class="lede">Every League, Tournament, and Practice save. Newest first. This lives in data/ with the rest of the live files.</p>
    ${availTabs("activity")}
    <div class="timeline">${rows || '<p class="muted">No saves logged yet. Once someone hits Save, it shows up here.</p>'}</div>
  `;
}
