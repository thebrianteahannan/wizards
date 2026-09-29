function gameErrLabel(g, kind) {
  const us = g.eUs != null ? g.eUs : g.e;
  const them = g.eThem;
  if (us == null && them == null) return "";
  if (kind === "short") return " E" + (us != null ? us : "—") + "/" + (them != null ? them : "—");
  return "our E " + (us != null ? us : "—") + " · their E " + (them != null ? them : "—");
}

function eventGamesHtml(e) {
  const rows = ((e && e.games) || []).filter((g) => g && (g.us != null || g.ab != null));
  if (!rows.length) return "";
  return `<ul class="game-box">${rows
    .map((g, i) => {
      const score = g.us != null ? `${g.mark || ""} ${g.us}-${g.them}`.trim() : "";
      const opp = g.opp ? " vs " + escapeHtml(g.opp) : "";
      const bits = [];
      if (g.ab != null && g.ab !== "") bits.push("AB " + g.ab);
      if (g.h != null && g.h !== "") bits.push("H " + g.h);
      if (g.bb != null && g.bb !== "") bits.push("BB " + g.bb);
      const err = gameErrLabel(g);
      if (err) bits.push(err);
      return `<li><b>G${g.n || i + 1}</b> ${escapeHtml(score)}${opp}${bits.length ? " · " + bits.map(escapeHtml).join(" · ") : ""}</li>`;
    })
    .join("")}</ul>`;
}

function eventKind(e) {
  if (e.kind === "open") return "league";
  if (e.kind === "practice") return "practice";
  if (e.kind === "tournament" || e.kind === "special") return "tournament";
  return "league";
}

function schedToday() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

function matchPack(packs) {
  if (typeof mergeMatchAvail === "function") {
    return mergeMatchAvail((packs && packs.league) || {}, (packs && packs.tournament) || {});
  }
  return (packs && packs.league) || {};
}

function offerOnDate(date, packs) {
  return (matchPack(packs).offers || []).find((o) => o && o.date === date);
}

function isAvailNight(e, packs, today) {
  if (!e || !e.date || e.date < today || e.status === "played" || eventKind(e) === "practice") return false;
  if (e.status === "open" || e.kind === "open") return true;
  return !!offerOnDate(e.date, packs);
}

function eventHeadcount(e, packs) {
  const kind = eventKind(e);
  const avail = kind === "practice" ? (packs && packs.practice) || {} : matchPack(packs);
  const offer = (avail.offers || []).find((o) => o.date === e.date);
  const key = (offer && (offer.date || offer.day)) || e.date;
  let yes = 0;
  let maybe = 0;
  for (const p of Object.values(avail.players || {})) {
    const st = ((p.days || {})[key] || {}).status;
    if (st === "yes") yes += 1;
    else if (st === "maybe") maybe += 1;
  }
  const needed = avail.needed || 6;
  return maybe ? `${yes}+${maybe}/${needed}` : `${yes}/${needed}`;
}

function schedOpponent(title) {
  const m = String(title || "").match(/(.+?)\s+vs\.?\s+(.+)/i);
  if (!m) return "";
  const a = m[1].trim();
  const b = m[2].split(/[·|,]/)[0].trim();
  if (/^wizards?$/i.test(a)) return b;
  if (/^wizards?$/i.test(b)) return a;
  return b;
}

function schedFavorHtml(e, book) {
  if (!isTeam() || (e && e.status === "played") || typeof matchupFavor !== "function") return "";
  const name = schedOpponent(e && e.title) || schedOpponent(e && e.note);
  if (!name) return "";
  const fav = matchupFavor({ note: "vs " + name }, book);
  if (fav == null) return "";
  const word = typeof favorWord === "function" ? favorWord(fav) : "";
  return `<span class="num" title="Matchup difficulty — higher is harder" style="display:block;margin-top:0.12rem;line-height:1.05;text-align:left"><small style="display:block;font-size:0.55rem;${typeof favorTone === "function" ? favorTone(fav) : ""}">${escapeHtml(word)}</small><b style="font-size:1.05rem;${typeof favorTone === "function" ? favorTone(fav) : ""}">${fav}</b></span>`;
}

function offerCalTitle(o) {
  const note = String((o && o.note) || "").trim();
  if (!note) return "Open night";
  const cut = note.replace(/\s+·\s+\d{1,2}:\d{2}[\s\S]*$/, "").replace(/\s+·\s+\d{1,2}\s*[AP]M[\s\S]*$/i, "");
  return cut || note;
}

function openMatchDays(events, packs) {
  const today = schedToday();
  const taken = {};
  for (const e of events || []) {
    if (e && e.date) taken[e.date + ":" + eventKind(e)] = true;
  }
  const extra = [];
  for (const o of matchPack(packs).offers || []) {
    if (!o.date || o.date < today) continue;
    const kind = o.source === "tournament" ? "tournament" : "league";
    if (taken[o.date + ":" + kind] || taken[o.date + ":league"] || taken[o.date + ":tournament"]) continue;
    extra.push({
      date: o.date,
      title: offerCalTitle(o),
      kind: kind === "tournament" ? "tournament" : "open",
      status: "open",
      note: o.note,
      path: "availability",
    });
    taken[o.date + ":" + kind] = true;
  }
  for (const o of ((packs && packs.practice) || {}).offers || []) {
    if (!o.date || o.date < today || taken[o.date + ":practice"]) continue;
    extra.push({
      date: o.date,
      title: offerCalTitle(o),
      kind: "practice",
      status: "open",
      note: o.note,
      path: "practice",
    });
    taken[o.date + ":practice"] = true;
  }
  return extra;
}

function upcomingAvailRow(monthKey, packs) {
  const today = schedToday();
  const offers = (matchPack(packs).offers || []).filter((o) => o && o.date && o.date >= today);
  if (!offers.length) return "";
  const buttons = offers
    .map((o) => {
      const mk = o.date.slice(0, 7);
      const when = new Date(o.date + "T12:00:00");
      const label = when.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
      const fake = { date: o.date, kind: o.source === "tournament" ? "tournament" : "open", status: "open", title: offerCalTitle(o) };
      const on = mk === monthKey ? " on" : "";
      return `<button class="btn ghost${on}" type="button" data-jump="${escapeHtml(mk)}" title="${escapeHtml(o.note || "")}">${escapeHtml(label)} · ${escapeHtml(offerCalTitle(o))} · ${escapeHtml(eventHeadcount(fake, packs))}</button>`;
    })
    .join("");
  return `<div class="cal-avail"><p class="kicker">Available match days</p>${buttons}</div>`;
}

function recordFromWhen(e) {
  const pairs = [...String((e && e.when) || "").matchAll(/(\d+)\s*-\s*(\d+)/g)];
  if (!pairs.length) return null;
  const title = String((e && e.title) || "");
  const wizHome = /\bvs\.?\s+Wizards?\s*$/i.test(title);
  const wizAway = /^Wizards?\s+vs\.?\b/i.test(title);
  if (!wizHome && !wizAway) return null;
  let wins = 0;
  let losses = 0;
  let ties = 0;
  for (const m of pairs) {
    const a = Number(m[1]);
    const h = Number(m[2]);
    const us = wizHome ? h : a;
    const them = wizHome ? a : h;
    if (us > them) wins += 1;
    else if (us < them) losses += 1;
    else ties += 1;
  }
  return { wins, losses, ties };
}

function eventRecord(e) {
  if (!e || e.status !== "played") return null;
  let w = e.wins;
  let l = e.losses;
  let t = e.ties || 0;
  if (w == null || l == null) {
    const parsed = recordFromWhen(e);
    if (!parsed) {
      if (e.result && e.record) return { mark: e.result, rec: e.record, label: e.result + " " + e.record };
      return null;
    }
    w = parsed.wins;
    l = parsed.losses;
    t = parsed.ties;
  }
  const rec = t ? w + "-" + l + "-" + t : w + "-" + l;
  const mark = w > l ? "W" : w < l ? "L" : "T";
  return { mark, rec, label: mark + " " + rec };
}

function calPillBits(e, packs) {
  const title = escapeHtml(e.title);
  const count = eventHeadcount(e, packs);
  const kind = eventKind(e);
  const needed = ((kind === "practice" ? packs && packs.practice : matchPack(packs)) || {}).needed || 6;
  const yes = parseInt(count, 10) || 0;
  const rec = typeof eventRecord === "function" ? eventRecord(e) : null;
  const go = e.status !== "played" && yes >= needed;
  const open = isAvailNight(e, packs, schedToday());
  let cls = open || e.kind === "open"
    ? `cal-pill open${go ? " go" : ""}`
    : `cal-pill ${e.kind} ${e.status}${go ? " go" : ""}`;
  if (rec) cls += rec.mark === "W" ? " win" : rec.mark === "L" ? " loss" : " tie";
  return {
    cls,
    title,
    count: rec ? rec.label : count,
    path: e.path || (kind === "practice" ? "practice" : "availability"),
  };
}

function blankScore(g) {
  if (!g || g.us == null) return true;
  const us = Number(g.us) || 0;
  const them = Number(g.them) || 0;
  if (us !== 0 || them !== 0) return false;
  const usE = g.eUs != null ? g.eUs : g.e;
  const themE = g.eThem;
  return (usE == null || Number(usE) === 0) && (themE == null || Number(themE) === 0);
}

function lockedNightTag(date, packs) {
  const locked = (matchPack(packs) || {}).lockedNight;
  if (!locked || String(locked.day) !== String(date)) return "";
  const who = locked.lockedBy ? "Locked in · " + locked.lockedBy : "Locked in";
  return `<span class="tag cal-result locked" title="${escapeHtml(who)}">Locked in</span>`;
}

function scoreTags(e, seen, keepBlank) {
  return (e.games || [])
    .map((g) => {
      if (!g || g.us == null) return "";
      if (!keepBlank && blankScore(g)) return "";
      const key = g.id || g.n + ":" + g.us + "-" + g.them + ":" + g.opp;
      if (seen.has(key)) return "";
      seen.add(key);
      const tone = g.mark === "W" ? "win" : g.mark === "L" ? "loss" : "tie";
      const tip = [g.opp, g.ab != null ? "AB " + g.ab : "", g.h != null ? "H " + g.h : "", g.bb != null ? "BB " + g.bb : "", gameErrLabel(g)]
        .filter(Boolean)
        .join(" · ");
      const ebit = gameErrLabel(g, "short");
      return `<span class="tag cal-result ${tone}" title="${escapeHtml(tip)}">${escapeHtml((g.mark || "") + " " + g.us + "-" + g.them + ebit)}</span>`;
    })
    .join("");
}

function calDayTags(hits, packs) {
  const now = new Date();
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  const seen = new Set();
  return hits
    .map((e) => {
      const rec = eventRecord(e);
      if (e.games && e.games.some((g) => g && g.us != null)) {
        const played = e.status === "played" || (e.date && e.date < today);
        if (played) {
          const tags = scoreTags(e, seen, true);
          if (tags) return tags;
        } else if (e.games.every((g) => !g || g.us == null || blankScore(g))) {
          const lock = lockedNightTag(e.date, packs);
          if (lock) return lock;
        } else {
          const tags = scoreTags(e, seen, false);
          if (tags) return tags;
        }
      }
      if (rec) {
        const tone = rec.mark === "W" ? "win" : rec.mark === "L" ? "loss" : "tie";
        return `<span class="tag cal-result ${tone}" title="${escapeHtml(e.when || rec.label)}">${escapeHtml(rec.label)}</span>`;
      }
      if (e.status === "played" || e.date < today) return "";
      const p = calPillBits(e, packs);
      return `<span class="tag" title="${p.title}">${p.count}</span>`;
    })
    .join("");
}

function calPill(e, packs) {
  const p = calPillBits(e, packs);
  if (isTeam()) {
    return `<a class="${p.cls}" href="#/${p.path}?date=${escapeHtml(e.date)}" title="${p.title}">${p.title}</a>`;
  }
  return `<span class="${p.cls}" title="${p.title}">${p.title}</span>`;
}

function renderCalendarMonth(events, monthKey, packs) {
  const [y, m] = monthKey.split("-").map(Number);
  const start = new Date(y, m - 1, 1);
  const label = start.toLocaleDateString("en-US", { month: "long", year: "numeric" });
  const items = (events || []).concat(openMatchDays(events, packs));
  const byDay = {};
  for (const e of items) {
    (byDay[e.date] || (byDay[e.date] = [])).push(e);
  }
  const now = new Date();
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  const firstDow = start.getDay();
  const daysInMonth = new Date(y, m, 0).getDate();
  const cells = [];
  for (let i = 0; i < firstDow; i += 1) cells.push(`<div class="cal-cell mute"></div>`);
  for (let d = 1; d <= daysInMonth; d += 1) {
    const iso = `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    const hits = byDay[iso] || [];
    const book = packs && packs.book;
    const tags = calDayTags(hits, packs);
    const pills = hits.map((e) => calPill(e, packs) + schedFavorHtml(e, book)).join("");
    const availHits = hits.filter((e) => isAvailNight(e, packs, today));
    const lockedHits = hits.filter((e) => e.status !== "open" && e.kind !== "open" && !isAvailNight(e, packs, today));
    const todayOn = iso === today;
    const dayN = todayOn ? `${d} · Today` : String(d);
    const todayLook = todayOn
      ? "border-color:var(--gold);box-shadow:0 0 14px rgba(240,193,75,0.45);background:rgba(240,193,75,0.1)"
      : "";
    const numStyle = todayOn ? ' style="color:var(--gold);font-weight:700"' : "";
    const cellClass = availHits.length ? "offer" : lockedHits.length ? "has" : hits.length ? "offer" : "";
    if (hits.length === 1 && isTeam()) {
      const e = hits[0];
      const p = calPillBits(e, packs);
      const href = `#/${p.path}?date=${escapeHtml(e.date)}`;
      cells.push(
        `<a class="cal-cell ${cellClass}" href="${href}" style="color:inherit;text-decoration:none;cursor:pointer;${todayLook}"><span class="cal-n"${numStyle}>${dayN}</span>${tags}<span class="${p.cls}" title="${p.title}">${p.title}</span>${schedFavorHtml(e, packs && packs.book)}</a>`
      );
    } else {
      const extra = todayLook ? ` style="${todayLook}"` : "";
      cells.push(`<div class="cal-cell ${cellClass}"${extra}><span class="cal-n"${numStyle}>${dayN}</span>${tags}${pills}</div>`);
    }
  }
  const heads = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((h) => `<div class="cal-h">${h}</div>`).join("");
  return `
    <div class="cal-nav">
      <button class="btn ghost" type="button" id="cal-prev">Prev</button>
      <h2 data-month="${escapeHtml(monthKey)}">${escapeHtml(label)}</h2>
      <button class="btn ghost" type="button" id="cal-next">Next</button>
    </div>
    ${upcomingAvailRow(monthKey, packs)}
    <div class="cal-grid">${heads}${cells.join("")}</div>
  `;
}

function bindSchedule(schedule, avail, packs) {
  const viewBtn = document.getElementById("sched-view");
  if (!viewBtn) return;
  const monthEl = document.querySelector("[data-month]");
  const monthKey = (monthEl && monthEl.dataset.month) || localStorage.getItem("wizardsSchedMonth");
  const redraw = (view, month) => {
    localStorage.setItem("wizardsSchedView", view);
    if (month) localStorage.setItem("wizardsSchedMonth", month);
    document.getElementById("app").innerHTML = renderSchedule(schedule, avail, view, month || monthKey, packs);
    bindSchedule(schedule, avail, packs);
    if (window.bootVisuals) window.bootVisuals();
  };
  viewBtn.addEventListener("click", () => {
    const next = localStorage.getItem("wizardsSchedView") === "calendar" ? "list" : "calendar";
    redraw(next, monthKey);
  });
  const shift = (delta) => {
    const [y, m] = (monthKey || "2026-08").split("-").map(Number);
    const dt = new Date(y, m - 1 + delta, 1);
    const key = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}`;
    redraw("calendar", key);
  };
  const prev = document.getElementById("cal-prev");
  const next = document.getElementById("cal-next");
  if (prev) prev.addEventListener("click", () => shift(-1));
  if (next) next.addEventListener("click", () => shift(1));
  document.querySelectorAll("[data-jump]").forEach((btn) => {
    btn.addEventListener("click", () => redraw("calendar", btn.dataset.jump));
  });
}
