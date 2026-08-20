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

function lineupPlayers(roster, stats, customIds) {
  if (customIds && customIds.length) return lineupFromIds(roster, customIds);
  return classicBattingOrder(roster, stats);
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
  return BAT_LINE.map(([key, label]) => `<span class="tag">${label} ${escapeHtml(hit[key] == null || hit[key] === "" ? "—" : String(hit[key]))}</span>`).join("");
}

const HOLE = ["Lead", "2", "3", "Cleanup", "5"];

function renderOffense(roster, stats, customIds) {
  const admin = isAdmin();
  const rows = lineupPlayers(roster, stats, customIds)
    .map((p, i) => {
      const hit = batterRow(stats, p);
      const score = hitterRating(hit);
      const cols = admin ? "2.2rem 3.2rem minmax(0,1fr) 6.4rem" : "2.2rem 3.2rem minmax(0,1fr)";
      const move = admin
        ? `<span><button type="button" class="btn ghost" data-bat-up="${escapeHtml(p.id)}" style="padding:0.12rem 0.4rem;font-size:0.7rem">↑</button> <button type="button" class="btn ghost" data-bat-down="${escapeHtml(p.id)}" style="padding:0.12rem 0.4rem;font-size:0.7rem">↓</button></span>`
        : "";
      const grade = score == null ? `<span class="muted">—</span>` : `<b style="${ratingTone(score)}">${score}</b>`;
      const hole = HOLE[i] ? `<small class="muted" style="display:block;font-size:0.62rem">${HOLE[i]}</small>` : "";
      return `<div class="roster-row" data-batter="${escapeHtml(p.id)}" style="grid-template-columns:${cols};align-items:start">
        <span class="num">${i + 1}${hole}</span>
        <span class="num" title="Hit rating">${grade}</span>
        <div>
          <strong>${escapeHtml(p.name)}</strong>
          <div style="margin-top:0.28rem;display:flex;flex-wrap:wrap;gap:0.28rem">${batterLine(hit)}</div>
        </div>
        ${move}
      </div>`;
    })
    .join("");
  const href = (stats && stats.source) || "https://www.mystatsonline.com/ballsports/visitor/league/home/home.aspx?IDLeague=61713";
  return `
    <div id="offense-card" class="diamond-card card" style="margin-top:1rem">
      <p class="kicker">Offense</p>
      <h2 style="margin:0 0 0.35rem">Batting order</h2>
      <p class="muted">${escapeHtml((stats && stats.note) || "Averages from PLW.")} Stacked like a baseball card: 1 gets on, 2 puts the ball in play, 3 is the best bat, 4 is cleanup power, 5 is the next RBI bat, then hit rating. <a href="${escapeHtml(href)}" target="_blank" rel="noopener">MyStatsOnline</a></p>
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
      if (host) host.outerHTML = renderOffense(roster, stats, next.battingOrder || ids);
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

async function loadOffense(roster) {
  const host = document.getElementById("offense-host");
  if (!host) return;
  host.innerHTML = `<div class="diamond-card card" style="margin-top:1rem"><p class="kicker">Offense</p><p class="muted">Loading PLW averages…</p></div>`;
  try {
    const stats = await api.get("/api/plw-stats");
    host.innerHTML = renderOffense(roster, stats);
    bindOffense(roster, stats);
    const pit = document.getElementById("pitching-host");
    if (pit && typeof renderPitching === "function") {
      pit.innerHTML = renderPitching(roster, stats, roster.pitchingOrder);
      bindPitching(roster, stats);
    }
  } catch (err) {
    host.innerHTML = `<div class="diamond-card card" style="margin-top:1rem"><p class="kicker">Offense</p><p class="muted">${escapeHtml(err.message || "Could not load PLW averages.")}</p></div>`;
  }
}
