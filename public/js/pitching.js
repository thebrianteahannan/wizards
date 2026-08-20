const PITCH_LINE = [
  ["era", "ERA"],
  ["whip", "WHIP"],
  ["w", "W"],
  ["l", "L"],
  ["sv", "SV"],
  ["g", "G"],
  ["gs", "GS"],
  ["ip", "IP"],
  ["h", "H"],
  ["r", "R"],
  ["er", "ER"],
  ["bb", "BB"],
  ["so", "SO"],
  ["hr", "HR"],
  ["bf", "BF"],
  ["avg", "AVG"],
  ["sox", "SO/X"],
  ["bbx", "BB/X"],
  ["cg", "CG"],
  ["sho", "SHO"],
];

function pitchNum(v) {
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : 0;
}

function pitchInnings(v) {
  const parts = String(v == null ? "" : v).split(".");
  return (Number(parts[0]) || 0) + (Number(parts[1]) || 0) / 3;
}

function pitcherRow(stats, player) {
  return ((stats && stats.pitchers) || []).find((b) => b.playerId === player.id) || null;
}

function pitchRating(row) {
  const ip = pitchInnings(row && row.ip);
  if (!row || ip <= 0) return null;
  const era = Math.max(0, Math.min(1, 1 - pitchNum(row.era) / 10));
  const whip = Math.max(0, Math.min(1, 1 - pitchNum(row.whip) / 3));
  const so = Math.max(0, Math.min(1, pitchNum(row.so) / ip / 3));
  const bb = Math.max(0, Math.min(1, 1 - pitchNum(row.bb) / ip / 3));
  return Math.max(1, Math.min(99, Math.round(100 * (0.35 * era + 0.3 * whip + 0.2 * so + 0.15 * bb))));
}

function pitchTone(score) {
  if (score >= 70) return "color:var(--go)";
  if (score >= 50) return "color:var(--gold)";
  return "color:var(--muted)";
}

function isArm(player, row) {
  return row || (player.positions || []).includes("P");
}

function pitchLine(row) {
  if (!row) return `<span class="muted">No PLW pitching line yet</span>`;
  return PITCH_LINE.map(([key, label]) => `<span class="tag">${label} ${escapeHtml(row[key] == null || row[key] === "" ? "—" : String(row[key]))}</span>`).join("");
}

function rotationPlayers(roster, stats, customIds) {
  const byId = {};
  for (const p of roster.players) byId[p.id] = p;
  const arms = roster.players.filter((p) => isArm(p, pitcherRow(stats, p)));
  if (customIds && customIds.length) {
    const seen = new Set();
    const list = [];
    for (const id of customIds) {
      if (byId[id] && isArm(byId[id], pitcherRow(stats, byId[id])) && !seen.has(id)) {
        seen.add(id);
        list.push(byId[id]);
      }
    }
    for (const p of arms) {
      if (!seen.has(p.id)) list.push(p);
    }
    return list;
  }
  return arms.slice().sort((a, b) => {
    const ra = pitchRating(pitcherRow(stats, a));
    const rb = pitchRating(pitcherRow(stats, b));
    if (ra == null && rb == null) return a.name.localeCompare(b.name);
    if (ra == null) return 1;
    if (rb == null) return -1;
    return rb - ra || a.name.localeCompare(b.name);
  });
}

function renderPitching(roster, stats, customIds) {
  const admin = isAdmin();
  const rows = rotationPlayers(roster, stats, customIds)
    .map((p, i) => {
      const row = pitcherRow(stats, p);
      const score = pitchRating(row);
      const cols = admin ? "2.2rem 3.2rem minmax(0,1fr) 6.4rem" : "2.2rem 3.2rem minmax(0,1fr)";
      const move = admin
        ? `<span><button type="button" class="btn ghost" data-pit-up="${escapeHtml(p.id)}" style="padding:0.12rem 0.4rem;font-size:0.7rem">↑</button> <button type="button" class="btn ghost" data-pit-down="${escapeHtml(p.id)}" style="padding:0.12rem 0.4rem;font-size:0.7rem">↓</button></span>`
        : "";
      const grade = score == null ? `<span class="muted">—</span>` : `<b style="${pitchTone(score)}">${score}</b>`;
      const hole = i === 0 ? `<small class="muted" style="display:block;font-size:0.62rem">Ace</small>` : "";
      return `<div class="roster-row" data-pitcher-arm="${escapeHtml(p.id)}" style="grid-template-columns:${cols};align-items:start">
        <span class="num">${i + 1}${hole}</span>
        <span class="num" title="Pitch rating">${grade}</span>
        <div>
          <strong>${escapeHtml(p.name)}</strong>
          <div style="margin-top:0.28rem;display:flex;flex-wrap:wrap;gap:0.28rem">${pitchLine(row)}</div>
        </div>
        ${move}
      </div>`;
    })
    .join("");
  const href =
    (stats && stats.pitchSource) ||
    "https://www.mystatsonline.com/ballsports/visitor/league/stats/pitcher.aspx?IDLeague=61713";
  return `
    <div id="pitching-card" class="diamond-card card" style="margin-top:1rem">
      <p class="kicker">Pitching</p>
      <h2 style="margin:0 0 0.35rem">Rotation</h2>
      <p class="muted">${escapeHtml((stats && stats.pitchNote) || "Pitching from PLW.")} Ace is the best pitch rating (ERA, WHIP, strikeouts, walks). <a href="${escapeHtml(href)}" target="_blank" rel="noopener">MyStatsOnline</a></p>
      <div class="roster-list" style="margin-top:0.6rem">${rows || '<p class="muted">No pitchers on the book.</p>'}</div>
      ${admin ? '<p class="muted" id="pit-msg" style="margin:0.45rem 0 0">↑ ↓ saves the rotation.</p>' : ""}
    </div>`;
}

function bindPitching(roster, stats) {
  const save = async (ids) => {
    const msg = document.getElementById("pit-msg");
    try {
      const next = await api.send("/api/roster/batting", "PUT", { pitchingOrder: ids });
      roster.pitchingOrder = next.pitchingOrder;
      roster.players = next.players || roster.players;
      const host = document.getElementById("pitching-card");
      if (host) host.outerHTML = renderPitching(roster, stats, next.pitchingOrder || ids);
      bindPitching(roster, stats);
    } catch (err) {
      if (msg) msg.textContent = err.message;
    }
  };
  const ids = () => [...document.querySelectorAll("#pitching-card [data-pitcher-arm]")].map((el) => el.dataset.pitcherArm);
  document.querySelectorAll("[data-pit-up]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const list = ids();
      const i = list.indexOf(btn.dataset.pitUp);
      if (i > 0) {
        const swap = list[i - 1];
        list[i - 1] = list[i];
        list[i] = swap;
        save(list);
      }
    });
  });
  document.querySelectorAll("[data-pit-down]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const list = ids();
      const i = list.indexOf(btn.dataset.pitDown);
      if (i >= 0 && i < list.length - 1) {
        const swap = list[i + 1];
        list[i + 1] = list[i];
        list[i] = swap;
        save(list);
      }
    });
  });
}
