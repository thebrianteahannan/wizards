const SCOUT_BAT = [
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

const SCOUT_PIT = [
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

const BAT_DIR = { avg: 1, obp: 1, slg: 1, ops: 1, h: 1, singles: 1, doubles: 1, triples: 1, hr: 1, rbi: 1, r: 1, bb: 1, tb: 1, so: -1, sf: -1, roe: -1, fc: -1 };
const PIT_DIR = { w: 1, sv: 1, so: 1, sox: 1, cg: 1, sho: 1, era: -1, whip: -1, l: -1, h: -1, r: -1, er: -1, bb: -1, hr: -1, avg: -1, bbx: -1 };

function scoutNum(v) {
  if (v == null || v === "" || v === "—") return null;
  const n = parseFloat(String(v).replace(/^\./, "0."));
  return Number.isFinite(n) ? n : null;
}

function scoutMeanStd(rows, key) {
  const vals = (rows || []).map((r) => scoutNum(r[key])).filter((n) => n != null);
  if (vals.length < 2) return null;
  const mean = vals.reduce((a, b) => a + b, 0) / vals.length;
  const std = Math.sqrt(vals.reduce((a, b) => a + (b - mean) * (b - mean), 0) / vals.length);
  if (std < 1e-9) return null;
  return { mean, std };
}

function scoutExtremes(row, keys, dir, pool) {
  const scored = [];
  for (const [key] of keys) {
    const sign = dir[key];
    if (!sign) continue;
    const n = scoutNum(row[key]);
    const ms = scoutMeanStd(pool, key);
    if (n == null || !ms) continue;
    scored.push({ key, z: (sign * (n - ms.mean)) / ms.std });
  }
  return {
    best: new Set(scored.filter((s) => s.z > 0).sort((a, b) => b.z - a.z).slice(0, 3).map((s) => s.key)),
    worst: new Set(scored.filter((s) => s.z < 0).sort((a, b) => a.z - b.z).slice(0, 3).map((s) => s.key)),
  };
}

function scoutTags(row, keys, marks) {
  return keys
    .map(([key, label]) => {
      const text = `${label} ${escapeHtml(row[key] == null || row[key] === "" ? "—" : String(row[key]))}`;
      if (marks && marks.best.has(key)) return `<span style="color:var(--go);font-weight:700">${text}</span>`;
      if (marks && marks.worst.has(key)) return `<span style="color:#fb7185;font-weight:700">${text}</span>`;
      return text;
    })
    .join(" · ");
}

function scoutSort(rows, scoreOf) {
  return rows.slice().sort((a, b) => {
    const ra = scoreOf(a);
    const rb = scoreOf(b);
    if (ra == null && rb == null) return 0;
    if (ra == null) return 1;
    if (rb == null) return -1;
    return rb - ra;
  });
}

function tourneyStar(team, row) {
  if (team && team.book === "tourney") return false;
  return (team && team.code === "WIZ" && team.note) || /tourney/i.test(String((row && row.source) || ""));
}

function scoutRated(rows, scoreOf, toneOf, keys, empty, title, dir, pool, team, active) {
  if (!rows.length) return `<p class="muted">${escapeHtml(empty)}</p>`;
  return scoutSort(rows, scoreOf)
    .map((row) => {
      const score = scoreOf(row);
      const grade = score == null ? `<span class="muted">—</span>` : `<b style="${toneOf(score)}">${score}${tourneyStar(team, row) ? "*" : ""}</b>`;
      const marks = scoutExtremes(row, keys, dir, pool || rows);
      const dim = active && active.length && !oursHit(row, active) ? ";opacity:0.4" : "";
      return `<div class="roster-row" style="grid-template-columns:3.2rem 8.4rem minmax(0,1fr);align-items:center${dim}">
        <span class="num" title="${escapeHtml(title)}">${grade}</span>
        <strong>${escapeHtml(row.name || [row.first, row.last].filter(Boolean).join(" "))}</strong>
        <div class="muted" style="overflow-x:auto;white-space:nowrap;font-size:0.72rem">${scoutTags(row, keys, marks)}</div>
      </div>`;
    })
    .join("");
}

function rankedTeams(teams) {
  const pitFill = leaguePitAvg(teams);
  return (teams || [])
    .slice()
    .sort((a, b) => (teamMarks(b, pitFill).all || 0) - (teamMarks(a, pitFill).all || 0) || a.name.localeCompare(b.name));
}

function scoutMenu(teams, code) {
  const overOn = !code || code === "overview" ? "" : " ghost";
  const over = `<button class="btn${overOn}" type="button" data-scout-team="overview">Overview</button>`;
  return (
    over +
    teams
      .map((t) => {
        const on = t.code === code ? "" : " ghost";
        return `<button class="btn${on}" type="button" data-scout-team="${escapeHtml(t.code)}">${escapeHtml(t.name)}</button>`;
      })
      .join("")
  );
}

function scoutPane(team, pitFill, book, onlyNames, active) {
  if (!team) return `<p class="muted">No league lines posted yet.</p>`;
  const marks = teamMarks(team, pitFill);
  const bats = [];
  const arms = [];
  for (const t of book || []) {
    bats.push(...(t.batters || []));
    arms.push(...(t.pitchers || []));
  }
  const note = marks.starBat || marks.starPit
    ? "Tourney hitting and pitching until PLW posts league lines."
    : team.note || "";
  return `
    <div class="diamond-card card">
      <p class="kicker">${escapeHtml(team.code)}</p>
      <div style="display:flex;flex-wrap:wrap;align-items:flex-end;justify-content:space-between;gap:0.7rem;margin:0 0 0.55rem">
        <h2 style="margin:0">${escapeHtml(team.name)}</h2>
        <div style="display:flex;gap:0.9rem">
          <span class="num" title="Hitting"><small class="muted" style="display:block;font-size:0.62rem">BAT</small>${markCell(marks.bat, marks.starBat)}</span>
          <span class="num" title="Pitching"><small class="muted" style="display:block;font-size:0.62rem">PIT</small>${markCell(marks.pit, marks.starPit)}</span>
          <span class="num" title="Overall"><small class="muted" style="display:block;font-size:0.62rem">ALL</small>${markCell(marks.all)}</span>
        </div>
      </div>
      ${note ? `<p class="muted" style="margin:0 0 0.55rem">${escapeHtml(note)}</p>` : ""}
      <p class="kicker" style="margin:0 0 0.35rem">Hitting</p>
      <div class="roster-list">${scoutRated(onlyNames ? (team.batters || []).filter((r) => oursHit(r, onlyNames)) : team.batters || [], hitterRating, ratingTone, SCOUT_BAT, "No hitting lines posted.", "Hit rating", BAT_DIR, bats, team, onlyNames ? null : active)}</div>
      <p class="kicker" style="margin:1rem 0 0.35rem">Pitching</p>
      <div class="roster-list">${scoutRated(onlyNames ? (team.pitchers || []).filter((r) => oursHit(r, onlyNames)) : team.pitchers || [], pitchRating, pitchTone, SCOUT_PIT, "No pitching lines posted.", "Pitch rating", PIT_DIR, arms, team, onlyNames ? null : active)}</div>
      <p class="muted" style="margin:0.55rem 0 0">Green is a top skill vs the league. Pink is a weak one. Up to three of each.</p>
    </div>`;
}

function renderScout(data, code) {
  const pitFill = leaguePitAvg((data && data.teams) || []);
  const teams = rankedTeams((data && data.teams) || []);
  const pick = code && code !== "overview" ? teams.find((t) => t.code === code) : null;
  const href = (data && data.source) || "https://www.mystatsonline.com/ballsports/visitor/league/stats/batter.aspx?IDLeague=61713&IDSeason=110335";
  const menu = scoutMenu(teams, pick ? pick.code : "overview");
  return `
    <p class="kicker">Locker room</p>
    <h1>League rankings</h1>
    <p class="lede">${escapeHtml((data && data.note) || "Florida Challengers League stats by team.")} Hitting is weighted by at-bats. Pitching is weighted by innings. Overall is 55% bats / 45% arms. * Wizards: tourney bats and arms. <a href="#/tourney-scout?event=historical">Historical leagues</a>. <a href="${escapeHtml(href)}" target="_blank" rel="noopener">MyStatsOnline</a></p>
    <div class="actions" data-scout-menu style="margin-top:0.7rem">${menu}</div>
    <div id="scout-pane" style="margin-top:1rem">${pick ? scoutPane(pick, pitFill, data && data.teams) : overviewPane(data)}</div>
    <div class="actions" data-scout-menu style="margin-top:1rem">${menu}</div>
  `;
}

function bindScout() {
  document.querySelectorAll("[data-scout-team]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const code = btn.dataset.scoutTeam;
      location.hash = code === "overview" ? "#/scout" : "#/scout?team=" + encodeURIComponent(code);
    });
  });
}

function weightedScore(rows, scoreOf, weightOf) {
  let total = 0;
  let weight = 0;
  for (const row of rows || []) {
    const score = scoreOf(row);
    const w = Number(weightOf(row)) || 0;
    if (score == null || w <= 0) continue;
    total += score * w;
    weight += w;
  }
  if (!weight) return null;
  return Math.round(total / weight);
}

function leaguePitAvg(teams) {
  const arms = [];
  for (const t of teams || []) {
    if (t.code === "WIZ") continue;
    for (const row of t.pitchers || []) arms.push(row);
  }
  return weightedScore(arms, pitchRating, (r) => pitchInnings(r.ip));
}

function teamMarks(team, pitFill) {
  const bat = weightedScore(team.batters, hitterRating, (r) => r.ab);
  let pit = weightedScore(team.pitchers, pitchRating, (r) => pitchInnings(r.ip));
  const leagueWiz = team.code === "WIZ" && team.book !== "tourney";
  const starBat = leagueWiz && !!team.note;
  const fillPit = leagueWiz && pit == null && pitFill != null;
  if (fillPit) pit = pitFill;
  const starPit = leagueWiz && (!!team.note || fillPit);
  const all = bat != null && pit != null ? Math.round(0.55 * bat + 0.45 * pit) : bat != null ? bat : pit;
  return { bat, pit, all, starBat, starPit };
}

function markCell(n, star) {
  if (n == null) return `<span class="muted">—</span>`;
  return `<b style="${ratingTone(n)}">${n}${star ? "*" : ""}</b>`;
}

function topLeaders(teams, kind, scoreOf, toneOf) {
  const all = [];
  for (const t of teams || []) {
    for (const r of t[kind] || []) {
      const s = scoreOf(r);
      if (s != null) all.push({ r, s, team: t });
    }
  }
  all.sort((a, b) => b.s - a.s);
  const top = all.slice(0, 10);
  const cut = top[9];
  const next = all.find((x) => x.team.code === "WIZ" && !top.includes(x));
  if (next) {
    next.how = cut && next.s >= cut.s - 2 ? "close" : "far";
    top.push(next);
  }
  const cols = "2.2rem 2.8rem minmax(0,1fr) 6.4rem";
  return (
    top
      .map((x) => {
        const n = x.r.name || [x.r.first, x.r.last].filter(Boolean).join(" ");
        const us = x.team.code === "WIZ";
        const glow = !us ? "" : x.how === "far" ? ";border-style:dashed;border-color:rgba(154,168,199,0.35)" : x.how === "close" ? ";border-color:var(--gold);box-shadow:0 0 10px rgba(240,193,75,0.22)" : ";border-color:var(--cyan);box-shadow:0 0 14px rgba(34,211,238,0.28)";
        const name = !us ? "" : x.how === "far" ? ' style="color:var(--muted)"' : x.how === "close" ? ' style="color:var(--gold)"' : ' style="color:var(--cyan)"';
        return `<div class="roster-row" style="grid-template-columns:${cols}${glow}"><span class="num">${all.indexOf(x) + 1}</span><span class="num"><b style="${toneOf(x.s)}">${x.s}${tourneyStar(x.team, x.r) ? "*" : ""}</b></span><strong${name}>${escapeHtml(n)}</strong><span class="muted">${escapeHtml(x.team.name)}</span></div>`;
      })
      .join("") || `<p class="muted">—</p>`
  );
}

function overviewPane(data) {
  const list = (data && data.teams) || [];
  const pitFill = leaguePitAvg(list);
  const teams = rankedTeams(list).map((t) => ({ team: t, marks: teamMarks(t, pitFill) }));
  const cols = "2.2rem minmax(0,1fr) 3.2rem 3.2rem 3.2rem";
  const head = `<div class="roster-row" style="grid-template-columns:${cols}">
    <span class="muted">#</span><span class="muted" style="text-align:left">Team</span><span class="num muted">BAT</span><span class="num muted">PIT</span><span class="num muted">ALL</span>
  </div>`;
  const rows = teams
    .map((row, i) => {
      const t = row.team;
      const us = t.code === "WIZ";
      const glow = us ? ";border-color:var(--cyan);box-shadow:0 0 14px rgba(34,211,238,0.28)" : "";
      return `<a class="roster-row" href="#/scout?team=${encodeURIComponent(t.code)}" style="grid-template-columns:${cols};text-decoration:none;color:inherit${glow}">
        <span class="num">${i + 1}</span>
        <span style="text-align:left"><strong${us ? ' style="color:var(--cyan)"' : ""}>${escapeHtml(t.name)}</strong></span>
        <span class="num" title="Hitting">${markCell(row.marks.bat, row.marks.starBat)}</span>
        <span class="num" title="Pitching">${markCell(row.marks.pit, row.marks.starPit)}</span>
        <span class="num" title="Overall">${markCell(row.marks.all)}</span>
      </a>`;
    })
    .join("");
  return `
    <div class="diamond-card card">
      <p class="kicker">Board</p>
      <h2 style="margin:0 0 0.55rem">Overview</h2>
      <div class="grid-3">
        <div><p class="kicker" style="margin:0 0 0.35rem">Clubs</p><div class="roster-list">${head}${rows || '<p class="muted">No league lines posted yet.</p>'}</div></div>
        <div><p class="kicker" style="margin:0 0 0.35rem">Top bats</p><div class="roster-list">${topLeaders(list, "batters", hitterRating, ratingTone)}</div></div>
        <div><p class="kicker" style="margin:0 0 0.35rem">Top arms</p><div class="roster-list">${topLeaders(list, "pitchers", pitchRating, pitchTone)}</div></div>
      </div>
      ${typeof winTrackHtml === "function" ? winTrackHtml(list) : ""}
      <p class="muted" style="margin:0.55rem 0 0">* Wizards: tourney hitting and pitching. Cyan made the top 10. We always tack on our next bat and arm. Gold is tied or within 2 of 10th. Dim dashed is further back.</p>
    </div>
  `;
}

function matchupFavor(offer, book) {
  const name = opponentName(offer);
  if (!name || !book || !book.length) return null;
  const pitFill = leaguePitAvg(book);
  const us = book.find((t) => t.code === "WIZ");
  const them = matchScoutTeam(book, name);
  if (!us || !them) return null;
  return favorScore(teamMarks(us, pitFill), teamMarks(them, pitFill));
}

function opponentName(offer) {
  const m = String((offer && offer.note) || "").match(/\bvs\.?\s+(.+)/i);
  if (!m) return "";
  const name = m[1].split(/[·|,]/)[0].trim();
  return /^wizards?$/i.test(name) ? "" : name;
}

function foldName(s) { return String(s || "").toLowerCase().replace(/[^a-z0-9]+/g, ""); }
function nameHit(a, b) { const n = foldName(a), k = foldName(b); return n && k && (n === k || n.includes(k) || k.includes(n)); }
function matchScoutTeam(teams, name) {
  return (teams || []).find((t) => nameHit(t.name, name));
}
function oursHit(row, names) {
  const label = row.name || [row.first, row.last].filter(Boolean).join(" ");
  return (names || []).some((x) => nameHit(label, x));
}

function bookPool(book) {
  const bats = [];
  const arms = [];
  for (const t of book || []) {
    bats.push(...(t.batters || []));
    arms.push(...(t.pitchers || []));
  }
  return { bats, arms };
}

function weakKeys(rows, keys, dir, pool) {
  const counts = {};
  for (const row of rows || []) {
    for (const k of scoutExtremes(row, keys, dir, pool).worst) counts[k] = (counts[k] || 0) + 1;
  }
  return Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .map(([k]) => k);
}

function beatTips(us, them, um, tm, usRank, themRank, book, extra) {
  return typeof beatPlan === "function" ? beatPlan(us, them, um, tm, usRank, themRank, book, extra) : [];
}

function favorScore(um, tm) {
  if (um.bat == null && um.pit == null) return null;
  const bats = (um.bat || 50) - (tm.pit || 50);
  const arms = (um.pit || 50) - (tm.bat || 50);
  return Math.max(1, Math.min(99, Math.round(50 + 0.55 * bats + 0.45 * arms)));
}

function favorWord(n) { return n >= 70 ? "Favorable" : n >= 50 ? "Even" : "Tough"; }

function vsPick(rows, fn) {
  return (rows || []).map((r) => ({ r, s: fn(r) })).sort((a, b) => (a.s == null) - (b.s == null) || (b.s || 0) - (a.s || 0)).slice(0, 6);
}
function vsBoard(label, ours, theirs, fn, us, themName, theirNames) {
  const L = vsPick(ours, fn), R = theirNames && theirNames.length && typeof vsPickLineup === "function" ? vsPickLineup(theirs, fn, theirNames, label === "bats") : vsPick(theirs, fn), cols = "minmax(0,1fr) 2.4rem 2.4rem 2.4rem minmax(0,1fr)";
  const mark = (x, star) => (!x || x.s == null ? `<span class="muted">—</span>` : `<b style="${ratingTone(x.s)}">${x.s}${star && tourneyStar(us, x.r) ? "*" : ""}</b>`);
  const nm = (x, end) => `<strong style="text-align:${end}">${x && x.r ? escapeHtml(x.r.name) : ""}</strong>`;
  const rows = [0, 1, 2, 3, 4, 5].map((i) => {
    const a = L[i], b = R[i], d = a && b && a.s != null && b.s != null ? a.s - b.s : null;
    const dx = d == null ? `<span class="muted">—</span>` : `<b style="${d > 0 ? "color:var(--go)" : d < 0 ? "color:#fb7185" : ""}">${d > 0 ? "+" : ""}${d}</b>`;
    return `<div class="roster-row" style="grid-template-columns:${cols}">${nm(a, "left")}<span class="num">${mark(a, true)}</span><span class="num">${dx}</span><span class="num">${mark(b, false)}</span>${nm(b, "right")}</div>`;
  }).join("");
  return `<div style="margin-top:0.7rem"><div style="display:grid;grid-template-columns:${cols};gap:0.5rem;padding:0 0.65rem 0.2rem"><span class="kicker" style="margin:0">Our ${escapeHtml(label)}</span><span></span><span class="num muted">+/-</span><span></span><span class="kicker" style="margin:0;text-align:right">${escapeHtml(themName)} ${escapeHtml(label)}</span></div><div class="roster-list">${rows}</div></div>`;
}

function renderMatchup(us, them, usRank, themRank, pitFill, book, oursNames, lineup, offer) {
  const um = teamMarks(us, pitFill);
  const tm = teamMarks(them, pitFill);
  const fav = favorScore(um, tm);
  const posted = (lineup && lineup.names) || [];
  const tips = beatTips(us, them, um, tm, usRank, themRank, book, { lineup: posted, oursNames })
    .map((t) => `<li>${escapeHtml(t)}</li>`)
    .join("");
  const cols = "6.5rem 3.4rem 3.4rem 3.4rem 2.6rem";
  const line = (name, m, rank, star) =>
    `<div class="roster-row" style="grid-template-columns:${cols};justify-content:start;max-width:24rem">
      <strong>${escapeHtml(name)}</strong>
      <span class="num">${markCell(m.bat, star && m.starBat)}</span>
      <span class="num">${markCell(m.pit, star && m.starPit)}</span>
      <span class="num">${markCell(m.all)}</span>
      <span class="num muted">#${rank}</span>
    </div>`;
  const favHtml = fav == null ? "" : `<span class="num" title="Matchup favorability" style="text-align:right"><small class="muted" style="display:block;font-size:0.62rem">${escapeHtml(favorWord(fav))}</small><b style="${ratingTone(fav)}">${fav}</b></span>`;
  return `
    <div class="diamond-card card" style="margin-top:1rem">
      <p class="kicker">Matchup</p>
      <div style="display:flex;flex-wrap:wrap;align-items:flex-end;justify-content:space-between;gap:0.7rem;margin:0 0 0.55rem">
        <h2 style="margin:0">How we beat ${escapeHtml(them.name)}</h2>
        ${favHtml}
      </div>
      <div style="display:flex;flex-wrap:wrap;align-items:flex-start;gap:0.85rem 1.4rem"><div class="roster-list">
        <div class="roster-row" style="grid-template-columns:${cols};justify-content:start;max-width:24rem">
          <span class="muted">Club</span><span class="num muted">BAT</span><span class="num muted">PIT</span><span class="num muted">ALL</span><span class="num muted">RK</span>
        </div>
        ${line("Wizards", um, usRank, true)}
        ${line(them.name, tm, themRank, false)}
      </div><ul class="rules" style="margin:0;flex:1 1 16rem">${tips || "<li>Play clean. Make them beat us.</li>"}</ul></div>
      ${typeof renderLineupBox === "function" ? renderLineupBox(them, offer, lineup) : ""}
      ${vsBoard("bats", (us.batters || []).filter((r) => oursHit(r, oursNames)), them.batters, hitterRating, us, them.name, posted)}
      ${vsBoard("arms", (us.pitchers || []).filter((r) => oursHit(r, oursNames)), them.pitchers, pitchRating, us, them.name, posted)}
    </div>`;
}

async function loadNightMatchup(offer, oursNames) {
  const host = document.getElementById("night-scout-host");
  if (!host) return;
  const name = opponentName(offer);
  if (!name) {
    host.innerHTML = "";
    const empty = document.getElementById("night-opp-host");
    if (empty) empty.innerHTML = "";
    return;
  }
  host.innerHTML = `<div class="diamond-card card" style="margin-top:1rem"><p class="kicker">Opponent</p><p class="muted">Loading ${escapeHtml(name)} from League rankings…</p></div>`;
  try {
    const data = await api.get("/api/plw-league");
    const book = (data && data.teams) || [];
    const pitFill = leaguePitAvg(book);
    const ranked = rankedTeams(book);
    const them = matchScoutTeam(ranked, name);
    const us = ranked.find((t) => t.code === "WIZ");
    if (!them) {
      host.innerHTML = `<div class="diamond-card card" style="margin-top:1rem"><p class="kicker">Opponent</p><p class="muted">No League rankings card for ${escapeHtml(name)}.</p></div>`;
      return;
    }
    const themRank = ranked.findIndex((t) => t.code === them.code) + 1;
    const usRank = us ? ranked.findIndex((t) => t.code === "WIZ") + 1 : "—";
    const lineup = await api.get("/api/lineups?date=" + encodeURIComponent(offer.date || offer.day || "") + "&team=" + encodeURIComponent(them.code)).catch(() => ({ names: [], text: "" }));
    const posted = (lineup && lineup.names) || [];
    host.innerHTML = us ? renderMatchup(us, them, usRank, themRank, pitFill, book, oursNames || [], lineup, offer) : "";
    if (typeof bindOppLineup === "function") bindOppLineup(() => loadNightMatchup(offer, oursNames));
    const opp = document.getElementById("night-opp-host");
    if (opp) {
      opp.innerHTML =
        `<p class="kicker" style="margin:1rem 0 0.4rem">Opponent · #${themRank} ${escapeHtml(them.name)}</p>` +
        scoutPane(them, pitFill, book, null, posted) +
        (us ? `<p class="kicker" style="margin:1rem 0 0.4rem">Wizards · #${usRank}</p>` + scoutPane(us, pitFill, book, oursNames || []) : "");
    }
  } catch (err) {
    host.innerHTML = `<div class="diamond-card card" style="margin-top:1rem"><p class="kicker">Opponent</p><p class="muted">${escapeHtml(err.message || "Could not load League rankings.")}</p></div>`;
  }
}
