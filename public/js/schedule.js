function eventHeadcount(e, packs) {
  const kind = e.kind === "practice" ? "practice" : e.kind === "tournament" || e.kind === "special" ? "tournament" : "league";
  const avail = (packs && packs[kind]) || {};
  const offer = (avail.offers || []).find((o) => o.date === e.date);
  let key;
  if (offer) key = kind === "league" ? offer.day : offer.date || offer.day;
  else if (kind === "league") {
    key = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"][new Date(e.date + "T12:00:00").getDay()];
  } else key = e.date;
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

function calPillBits(e, packs) {
  const title = escapeHtml(e.title);
  return {
    cls: `cal-pill ${e.kind} ${e.status}`,
    title,
    count: eventHeadcount(e, packs),
    path: e.kind === "tournament" || e.kind === "special" ? "tournament" : e.kind === "practice" ? "practice" : "availability",
  };
}

function calDayTags(hits, packs) {
  return hits
    .map((e) => {
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
  const byDay = {};
  for (const e of events) {
    (byDay[e.date] || (byDay[e.date] = [])).push(e);
  }
  const firstDow = start.getDay();
  const daysInMonth = new Date(y, m, 0).getDate();
  const cells = [];
  for (let i = 0; i < firstDow; i += 1) cells.push(`<div class="cal-cell mute"></div>`);
  for (let d = 1; d <= daysInMonth; d += 1) {
    const iso = `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    const hits = byDay[iso] || [];
    const tags = calDayTags(hits, packs);
    const pills = hits.map((e) => calPill(e, packs)).join("");
    if (hits.length === 1 && isTeam()) {
      const e = hits[0];
      const p = calPillBits(e, packs);
      const href = `#/${p.path}?date=${escapeHtml(e.date)}`;
      cells.push(
        `<a class="cal-cell has" href="${href}" style="color:inherit;text-decoration:none;cursor:pointer"><span class="cal-n">${d}</span>${tags}<span class="${p.cls}" title="${p.title}">${p.title}</span></a>`
      );
    } else {
      cells.push(`<div class="cal-cell ${hits.length ? "has" : ""}"><span class="cal-n">${d}</span>${tags}${pills}</div>`);
    }
  }
  const heads = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((h) => `<div class="cal-h">${h}</div>`).join("");
  return `
    <div class="cal-nav">
      <button class="btn ghost" type="button" id="cal-prev">Prev</button>
      <h2 data-month="${escapeHtml(monthKey)}">${escapeHtml(label)}</h2>
      <button class="btn ghost" type="button" id="cal-next">Next</button>
    </div>
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
}
