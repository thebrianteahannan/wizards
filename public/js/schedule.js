function renderCalendarMonth(events, monthKey) {
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
    const pills = hits
      .map((e) => `<span class="cal-pill ${e.kind} ${e.status}" title="${escapeHtml(e.title)}">${escapeHtml(e.title)}</span>`)
      .join("");
    cells.push(`<div class="cal-cell ${hits.length ? "has" : ""}"><span class="cal-n">${d}</span>${pills}</div>`);
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

function bindSchedule(schedule, avail) {
  const viewBtn = document.getElementById("sched-view");
  if (!viewBtn) return;
  const monthEl = document.querySelector("[data-month]");
  const monthKey = (monthEl && monthEl.dataset.month) || localStorage.getItem("wizardsSchedMonth");
  const redraw = (view, month) => {
    localStorage.setItem("wizardsSchedView", view);
    if (month) localStorage.setItem("wizardsSchedMonth", month);
    document.getElementById("app").innerHTML = renderSchedule(schedule, avail, view, month || monthKey);
    bindSchedule(schedule, avail);
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
