const LEAGUE = 61713;
const TEAM_ID = 228246;
const SEASONS = [110335, 110274];
const GAME_URL =
  "https://www.mystatsonline.com/ballsports/visitor/league/schedule_scores/game_score.aspx?IDLeague=" +
  LEAGUE +
  "&IDGame=";
const TEAM_URL =
  "https://www.mystatsonline.com/ballsports/visitor/league/stats/team.aspx?IDLeague=" +
  LEAGUE +
  "&IDSeason=";
const MO = "January,February,March,April,May,June,July,August,September,October,November,December".split(",");

let cache = { at: 0, byId: {}, sides: {} };
let fieldCache = {};
const TEAM_IDS = [228246, 131104, 228242, 228245, 228493, 228247, 228239, 130071, 228240, 130404, 229625];

async function fetchHtml(url) {
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), 12000);
  try {
    const res = await fetch(url, { signal: ac.signal, headers: { "user-agent": "WizardsHub/1.0" } });
    if (!res.ok) throw new Error("PLW box " + res.status);
    return await res.text();
  } finally {
    clearTimeout(timer);
  }
}

function plain(html) {
  return String(html || "")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/g, "&")
    .trim();
}

function num(v) {
  const n = Number(String(v || "").replace(/[^\d.-]/g, ""));
  return Number.isFinite(n) ? n : 0;
}

function tableCells(chunk) {
  return [...String(chunk || "").matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi)].map((m) => plain(m[1]));
}

function gameWhen(html) {
  const m = String(html || "").match(
    /(?:Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)\s+([A-Za-z]+)\s+(\d{1,2}),\s+(\d{4})(?:\s+-\s+(\d{1,2}:\d{2}\s*(?:AM|PM)))?/i
  );
  const i = MO.indexOf(m && m[1]);
  if (!m || i < 0) return { date: "", time: "" };
  return {
    date: m[3] + "-" + String(i + 1).padStart(2, "0") + "-" + String(m[2]).padStart(2, "0"),
    time: m[4] ? m[4].toUpperCase().replace(/\s+/g, " ") : "",
  };
}

function lineScore(html) {
  const table = String(html || "").match(/id="maincontent_gvBoxScore"[\s\S]+?<\/table>/i);
  if (!table) return [];
  const rows = [];
  for (const tr of table[0].split(/<tr/i).slice(2)) {
    const cells = tableCells(tr).filter((c) => c !== "");
    if (cells.length < 4) continue;
    const team = cells[0];
    if (!team || /team/i.test(team)) continue;
    rows.push({ team, r: num(cells[cells.length - 3]), h: num(cells[cells.length - 2]), e: num(cells[cells.length - 1]) });
  }
  return rows;
}

function batTotal(html, which) {
  const id = which === "home" ? "gvBattersHome_gvPlayers" : "gvBattersVisitor_gvPlayers";
  const table = String(html || "").match(new RegExp('id="maincontent_' + id + '"[\\s\\S]+?</table>', "i"));
  if (!table) return null;
  for (const tr of table[0].split(/<tr/i)) {
    const cells = tableCells(tr);
    const i = cells.findIndex((c) => c === "TOTAL");
    if (i < 0) continue;
    return { ab: num(cells[i + 4]), h: num(cells[i + 6]), bb: num(cells[i + 14]) };
  }
  return null;
}

function wizSide(rows) {
  const i = rows.findIndex((r) => /wizard/i.test(r.team));
  return i === 0 ? "visitor" : i === 1 ? "home" : "";
}

function parseBox(html, id) {
  const rows = lineScore(html);
  const usRow = rows.find((r) => /wizard/i.test(r.team));
  const themRow = rows.find((r) => r !== usRow);
  if (!usRow || !themRow) return null;
  const side = wizSide(rows);
  const bats = batTotal(html, side) || {};
  const when = gameWhen(html);
  const us = usRow.r;
  const them = themRow.r;
  return {
    id: String(id || ""),
    date: when.date,
    time: when.time,
    opp: themRow.team,
    us,
    them,
    mark: us > them ? "W" : us < them ? "L" : "T",
    ab: bats.ab,
    h: bats.h != null ? bats.h : usRow.h,
    bb: bats.bb,
    e: usRow.e,
    eUs: usRow.e,
    eThem: themRow.e,
  };
}

async function teamGameIds() {
  const pages = await Promise.all(SEASONS.map((s) => fetchHtml(TEAM_URL + s + "&IDTeam=" + TEAM_ID).catch(() => "")));
  return [...new Set(pages.flatMap((html) => [...String(html).matchAll(/IDGame=(\d+)/g)].map((m) => m[1])))];
}

async function loadBoxes(ids) {
  const want = [...new Set((ids || []).map(String).filter(Boolean))];
  if (!want.length) return [];
  const missing = want.filter((id) => cache.sides[id] === undefined && !cache.byId[id]);
  if (missing.length) {
    const pages = await Promise.all(missing.map((id) => fetchHtml(GAME_URL + id).then((html) => ({ id, html })).catch(() => null)));
    for (const row of pages) {
      if (!row) continue;
      cache.sides[row.id] = lineScore(row.html);
      const parsed = parseBox(row.html, row.id);
      if (parsed) cache.byId[row.id] = parsed;
    }
    cache.at = Date.now();
  }
  return want.map((id) => cache.byId[id]).filter(Boolean);
}

function sortGames(list) {
  return (list || []).slice().sort((a, b) => String(a.time || "").localeCompare(String(b.time || "")) || String(a.opp || "").localeCompare(String(b.opp || "")));
}

function sameGames(a, b) {
  return JSON.stringify(a || []) === JSON.stringify(b || []);
}

function fillFromBox(line, box) {
  if (!box) return line;
  return {
    ...line,
    opp: line.opp || box.opp,
    us: box.us,
    them: box.them,
    mark: box.mark,
    ab: box.ab,
    h: box.h,
    bb: box.bb,
    e: box.e,
    eUs: box.eUs != null ? box.eUs : box.e,
    eThem: box.eThem,
    time: line.time || box.time,
    id: line.id || box.id,
  };
}

async function attachGameLines(events, nights) {
  const ids = [];
  for (const n of nights || []) {
    for (const g of n.games || []) {
      if ((g.away === "WIZ" || g.home === "WIZ") && g.id) ids.push(String(g.id));
    }
  }
  for (const e of events || []) {
    for (const g of e.games || []) if (g && g.id) ids.push(String(g.id));
  }
  let boxes = await loadBoxes(ids);
  if (!boxes.length) boxes = await loadBoxes(await teamGameIds());
  const byId = {};
  const byDate = {};
  for (const b of boxes) {
    byId[b.id] = b;
    (byDate[b.date] = byDate[b.date] || []).push(b);
  }
  let changed = false;
  for (const e of events || []) {
    if (!e || !e.date) continue;
    const day = sortGames(byDate[e.date] || []);
    if (!day.length && !(e.games || []).length) continue;
    let next;
    if (e.games && e.games.length) {
      next = e.games.map((g, i) => fillFromBox({ ...g, n: g.n || i + 1 }, (g.id && byId[g.id]) || day[i]));
    } else {
      next = day.map((b, i) => fillFromBox({ n: i + 1 }, b));
    }
    next = next.map((g, i) => ({ ...g, n: i + 1 }));
    if (!sameGames(e.games, next)) {
      e.games = next;
      changed = true;
    }
  }
  return changed;
}

function namedEvent(e) {
  return e && (e.kind === "tournament" || e.kind === "special");
}

function foldPair(a, b) {
  const named = namedEvent(a) ? a : namedEvent(b) ? b : a;
  const played = a.status === "played" ? a : b.status === "played" ? b : named;
  const games = (b.games || []).length >= ((a.games || []).length) ? b.games : a.games;
  return {
    ...named,
    status: played.status,
    when: played.when || named.when,
    wins: played.wins != null ? played.wins : named.wins,
    losses: played.losses != null ? played.losses : named.losses,
    ties: played.ties != null ? played.ties : named.ties,
    result: played.result || named.result,
    record: played.record || named.record,
    games: games || named.games,
    source: played.source || named.source,
  };
}

function foldSameDay(events) {
  const out = [];
  const at = {};
  let changed = false;
  for (const e of events || []) {
    if (!e || !e.date) {
      out.push(e);
      continue;
    }
    const i = at[e.date];
    if (i == null) {
      at[e.date] = out.length;
      out.push(e);
      continue;
    }
    out[i] = foldPair(out[i], e);
    changed = true;
  }
  return { events: out, changed };
}

function foldName(s) {
  return String(s || "")
    .toLowerCase()
    .replace(/^the/, "")
    .replace(/[^a-z0-9]+/g, "");
}

function teamCode(name, names) {
  const n = foldName(name);
  if (!n) return "";
  for (const [code, label] of Object.entries(names || {})) {
    const k = foldName(label);
    if (k && (n === k || n.includes(k) || k.includes(n))) return code;
  }
  return "";
}

async function seasonGameIds(seasonId) {
  const pages = await Promise.all(
    TEAM_IDS.map((id) => fetchHtml(TEAM_URL + seasonId + "&IDTeam=" + id).catch(() => ""))
  );
  return [...new Set(pages.flatMap((html) => [...String(html).matchAll(/IDGame=(\d+)/g)].map((m) => m[1])))];
}

async function loadSides(ids) {
  const want = [...new Set((ids || []).map(String).filter(Boolean))];
  const missing = want.filter((id) => !cache.sides[id]);
  if (missing.length) await loadBoxes(missing);
  return want.map((id) => ({ id, sides: cache.sides[id] || [] }));
}

async function fieldingTotals(seasonId, names, force) {
  const hit = fieldCache[seasonId];
  if (!force && hit && Date.now() - hit.at < 15 * 60 * 1000) return hit.byCode;
  const games = await loadSides(await seasonGameIds(seasonId));
  const byCode = {};
  const rowOf = (code) => byCode[code] || (byCode[code] = { e: 0, g: 0, wins: 0, rsWin: 0, raWin: 0 });
  for (const g of games) {
    const sides = [];
    const seen = {};
    for (const side of g.sides || []) {
      const code = teamCode(side.team, names);
      if (!code || seen[code]) continue;
      seen[code] = true;
      sides.push({ code, r: Number(side.r) || 0, e: Number(side.e) || 0 });
      const row = rowOf(code);
      row.e += Number(side.e) || 0;
      row.g += 1;
    }
    if (sides.length < 2) continue;
    const a = sides[0];
    const b = sides[1];
    if (a.r === b.r) continue;
    const win = a.r > b.r ? a : b;
    const lose = win === a ? b : a;
    const wrow = rowOf(win.code);
    wrow.wins += 1;
    wrow.rsWin += win.r;
    wrow.raWin += lose.r;
  }
  fieldCache[seasonId] = { at: Date.now(), byCode };
  return byCode;
}

function applyFielding(teams, byCode) {
  for (const t of teams || []) {
    const f = byCode && byCode[t.code];
    if (!f) continue;
    t.fieldE = f.e;
    t.fieldG = f.g;
    t.boxWins = f.wins;
    t.boxRsWin = f.rsWin;
    t.boxRaWin = f.raWin;
  }
  return teams;
}

module.exports = { attachGameLines, parseBox, loadBoxes, foldSameDay, fieldingTotals, applyFielding };
