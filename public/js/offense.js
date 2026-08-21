function lineupFromIds(roster, ids) {
  const byId = {};
  for (const p of roster.players) byId[p.id] = p;
  const seen = new Set();
  const list = [];
  for (const id of ids || []) {
    if (byId[id] && !seen.has(id)) {
      seen.add(id);
      list.push(byId[id]);
    }
  }
  for (const p of roster.players) {
    if (!seen.has(p.id)) list.push(p);
  }
  return list;
}

function batterDims(stats, player) {
  const hit = batterRow(stats, player);
  if (!hit || statNum(hit.tpa) < 1) return { has: false, on: -1, contact: -1, power: -1, all: -1 };
  return {
    has: true,
    on: statNum(hit.obp),
    contact: statNum(hit.avg) + statNum(hit.obp) * 0.25,
    power: statNum(hit.slg) + statNum(hit.hr) * 0.1 + statNum(hit.rbi) * 0.02,
    all: hitterRating(hit) || 0,
  };
}

function takeBest(pool, score) {
  let best = null;
  let top = -Infinity;
  for (const p of pool) {
    const n = score(p);
    if (n > top) {
      top = n;
      best = p;
    }
  }
  if (!best) return null;
  pool.splice(pool.indexOf(best), 1);
  return best;
}

function classicBattingOrder(roster, stats) {
  const pool = roster.players.slice();
  const d = (p) => batterDims(stats, p);
  const cleanup = takeBest(pool, (p) => d(p).power);
  const three = takeBest(pool, (p) => d(p).all);
  const lead = takeBest(pool, (p) => d(p).on);
  const two = takeBest(pool, (p) => d(p).contact);
  const five = takeBest(pool, (p) => d(p).power);
  const rest = pool.slice().sort((a, b) => d(b).all - d(a).all || a.name.localeCompare(b.name));
  return [lead, two, three, cleanup, five, ...rest].filter(Boolean);
}

function ratingOrder(roster, stats) {
  return roster.players.slice().sort((a, b) => {
    const ra = hitterRating(batterRow(stats, a));
    const rb = hitterRating(batterRow(stats, b));
    if (ra == null && rb == null) return a.name.localeCompare(b.name);
    if (ra == null) return 1;
    if (rb == null) return -1;
    return rb - ra || a.name.localeCompare(b.name);
  });
}

function lineupPlayers(roster, stats, customIds, mode) {
  if (mode === "lineup") {
    if (customIds && customIds.length) return lineupFromIds(roster, customIds);
    return classicBattingOrder(roster, stats);
  }
  return ratingOrder(roster, stats);
}

const BAT_LINE = [
  ["avg", "AVG"],
  ["obp", "OBP"],
  ["slg", "SLG"],
  ["ops", "OPS"],
  ["g", "G"],
  ["ab", "AB"],
  ["h", "H"],
  ["singles", "1B"],
  ["doubles", "2B"],
  ["triples", "3B"],
  ["hr", "HR"],
  ["rbi", "RBI"],
  ["r", "R"],
  ["bb", "BB"],
  ["so", "SO"],
  ["tb", "TB"],
  ["sf", "SF"],
  ["tpa", "TPA"],
  ["roe", "ROE"],
  ["fc", "FC"],
];

function batterRow(stats, player) {
  return ((stats && stats.batters) || []).find((b) => b.playerId === player.id) || null;
}

function statNum(v) {
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : 0;
}

function hitterRating(hit) {
  if (!hit || statNum(hit.tpa) < 1) return null;
  const tpa = statNum(hit.tpa);
  const disc = Math.max(-0.25, Math.min(0.4, (statNum(hit.bb) - statNum(hit.so)) / tpa));
  const raw = 0.38 * statNum(hit.obp) + 0.32 * statNum(hit.slg) + 0.15 * statNum(hit.avg) + 0.15 * disc;
  return Math.max(1, Math.min(99, Math.round(raw * 170)));
}

function ratingTone(score) {
  if (score >= 70) return "color:var(--go)";
  if (score >= 50) return "color:var(--gold)";
  return "color:var(--muted)";
}

function batterLine(hit) {
  if (!hit) return `<span class="muted">No PLW line yet</span>`;
  return BAT_LINE.map(([key, label]) => `${label} ${escapeHtml(hit[key] == null || hit[key] === "" ? "—" : String(hit[key]))}`).join(" · ");
}

const HOLE = ["Lead", "2", "3", "Cleanup", "5"];

function renderOffense(roster, stats, customIds, mode) {
  const lineup = mode === "lineup";
  const admin = lineup && isAdmin();
  const rows = lineupPlayers(roster, stats, customIds, mode)
    .map((p, i) => {
      const hit = batterRow(stats, p);
      const score = hitterRating(hit);
      const cols = admin ? "2.2rem 3.2rem 8.4rem minmax(0,1fr) 6.4rem" : "2.2rem 3.2rem 8.4rem minmax(0,1fr)";
      const move = admin
        ? `<span><button type="button" class="btn ghost" data-bat-up="${escapeHtml(p.id)}" style="padding:0.12rem 0.4rem;font-size:0.7rem">↑</button> <button type="button" class="btn ghost" data-bat-down="${escapeHtml(p.id)}" style="padding:0.12rem 0.4rem;font-size:0.7rem">↓</button></span>`
        : "";
      const grade = score == null ? `<span class="muted">—</span>` : `<b style="${ratingTone(score)}">${score}${/tourney/i.test(String((hit && hit.source) || "")) ? "*" : ""}</b>`;
      const hole = lineup && HOLE[i] ? `<small class="muted" style="display:block;font-size:0.62rem">${HOLE[i]}</small>` : "";
      return `<div class="roster-row" data-batter="${escapeHtml(p.id)}" style="grid-template-columns:${cols};align-items:center">
        <span class="num">${i + 1}${hole}</span>
        <span class="num" title="Hit rating">${grade}</span>
        <strong>${escapeHtml(p.name)}</strong>
        <div class="muted" style="overflow-x:auto;white-space:nowrap;font-size:0.72rem">${batterLine(hit)}</div>
        ${move}
      </div>`;
    })
    .join("");
  const href = (stats && stats.source) || "https://www.mystatsonline.com/ballsports/visitor/league/home/home.aspx?IDLeague=61713";
  const blurb = lineup
    ? "Stacked like a baseball card: 1 gets on, 2 puts the ball in play, 3 is the best bat, 4 is cleanup power, 5 is the next RBI bat, then hit rating."
    : "Sorted by hit rating, high to low.";
  return `
    <div id="offense-card" class="diamond-card card" style="margin-top:1rem">
      <p class="kicker">Offense</p>
      <h2 style="margin:0 0 0.35rem">${lineup ? "Batting order" : "Hitting"}</h2>
      <p class="muted">${escapeHtml((stats && stats.note) || "Averages from PLW.")} ${blurb} <a href="${escapeHtml(href)}" target="_blank" rel="noopener">MyStatsOnline</a></p>
      <div class="roster-list" style="margin-top:0.6rem">${rows}</div>
      ${admin ? '<p class="muted" id="bat-msg" style="margin:0.45rem 0 0">↑ ↓ saves the order.</p>' : ""}
    </div>`;
}

function bindOffense(roster, stats) {
  const save = async (ids) => {
    const msg = document.getElementById("bat-msg");
    try {
      const next = await api.send("/api/roster/batting", "PUT", { battingOrder: ids });
      roster.battingOrder = next.battingOrder;
      roster.players = next.players || roster.players;
      const host = document.getElementById("offense-card");
      if (host) host.outerHTML = renderOffense(roster, stats, next.battingOrder || ids, "lineup");
      bindOffense(roster, stats);
    } catch (err) {
      if (msg) msg.textContent = err.message;
    }
  };
  const ids = () => [...document.querySelectorAll("#offense-card [data-batter]")].map((el) => el.dataset.batter);
  document.querySelectorAll("[data-bat-up]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const list = ids();
      const i = list.indexOf(btn.dataset.batUp);
      if (i > 0) {
        const swap = list[i - 1];
        list[i - 1] = list[i];
        list[i] = swap;
        save(list);
      }
    });
  });
  document.querySelectorAll("[data-bat-down]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const list = ids();
      const i = list.indexOf(btn.dataset.batDown);
      if (i >= 0 && i < list.length - 1) {
        const swap = list[i + 1];
        list[i + 1] = list[i];
        list[i] = swap;
        save(list);
      }
    });
  });
}

async function loadOffense(roster, opts) {
  const hostId = (opts && opts.host) || "offense-host";
  const mode = (opts && opts.mode) || "rating";
  const host = document.getElementById(hostId);
  if (!host) return;
  host.innerHTML = `<div class="diamond-card card" style="margin-top:1rem"><p class="kicker">Offense</p><p class="muted">Loading PLW averages…</p></div>`;
  try {
    const stats = await api.get("/api/plw-stats");
    host.innerHTML = renderOffense(roster, stats, mode === "lineup" ? roster.battingOrder : null, mode);
    if (mode === "lineup") bindOffense(roster, stats);
    const pit = document.getElementById("pitching-host");
    if (hostId === "offense-host" && pit && typeof renderPitching === "function") {
      pit.innerHTML = renderPitching(roster, stats, roster.pitchingOrder);
      bindPitching(roster, stats);
    }
  } catch (err) {
    host.innerHTML = `<div class="diamond-card card" style="margin-top:1rem"><p class="kicker">Offense</p><p class="muted">${escapeHtml(err.message || "Could not load PLW averages.")}</p></div>`;
  }
}

function nightGrade(n, title, star) {
  return n == null ? `<span class="muted">—</span>` : `<b style="${ratingTone(n)}" title="${title}">${n}${star ? "*" : ""}</b>`;
}

function nightPlayerRow(p, marks, hole, bat, pit, batStar, pitStar) {
  const pos = (p.positions || []).join(", ") || "Util";
  const holeHtml = hole ? `<small class="muted" style="display:block;font-size:0.62rem">${escapeHtml(hole)}</small>` : "";
  return `<div class="roster-row" style="grid-template-columns:4.6rem 2.4rem 2.4rem minmax(0,1fr) 2.8rem 4.4rem 3.2rem">
    <span class="num">${holeHtml}</span>
    <span class="num">${nightGrade(bat, "Hit rating", batStar)}</span>
    <span class="num">${nightGrade(pit, "Pitch rating", pitStar)}</span>
    <strong>${escapeHtml(p.name)}</strong>
    <span class="num">${p.number != null ? "#" + p.number : "—"}</span>
    <span class="tag">${escapeHtml(pos)}</span>
    <span class="muted">${marks[p.id] === "maybe" ? "maybe" : "yes"}</span>
  </div>`;
}

async function paintNightLineup(players, marks) {
  const list = document.getElementById("night-lineup-list");
  if (!list || !players.length) return;
  try {
    const stats = await api.get("/api/plw-stats");
    const ranked = players.slice().sort((a, b) => {
      const ya = marks[a.id] === "yes" ? 1 : 0;
      const yb = marks[b.id] === "yes" ? 1 : 0;
      if (yb !== ya) return yb - ya;
      const ra = hitterRating(batterRow(stats, a));
      const rb = hitterRating(batterRow(stats, b));
      if (ra == null && rb == null) return a.name.localeCompare(b.name);
      if (ra == null) return 1;
      if (rb == null) return -1;
      return rb - ra;
    });
    const starters = ranked.slice(0, 6);
    const bench = ranked.slice(6);
    const ordered = classicBattingOrder({ players: starters }, stats);
    const holes = ["Lead", "2", "3", "Cleanup", "5", "6"];
    const cols = "4.6rem 2.4rem 2.4rem minmax(0,1fr) 2.8rem 4.4rem 3.2rem";
    const rowOf = (p, hole) => {
      const hit = batterRow(stats, p);
      const arm = typeof pitcherRow === "function" ? pitcherRow(stats, p) : null;
      const fromTourney = (row) => /tourney/i.test(String((row && row.source) || ""));
      return nightPlayerRow(p, marks, hole, hitterRating(hit), typeof pitchRating === "function" ? pitchRating(arm) : null, fromTourney(hit), fromTourney(arm));
    };
    let html = `<div class="roster-row" style="grid-template-columns:${cols}"><span></span><span class="num muted" style="font-size:0.62rem">BAT</span><span class="num muted" style="font-size:0.62rem">PIT</span><span></span><span></span><span></span><span></span></div>`;
    html += ordered.map((p, i) => rowOf(p, holes[i] || String(i + 1))).join("");
    if (bench.length) {
      html += `<div style="border-top:1px solid var(--line);margin:0.55rem 0 0.4rem"></div><p class="kicker" style="margin:0 0 0.3rem">Bench</p>`;
      html += bench.map((p) => rowOf(p, "")).join("");
    }
    list.innerHTML = html;
  } catch (err) {}
}
