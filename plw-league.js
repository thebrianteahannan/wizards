const LEAGUE = 61713;
const SEASON = 110335;
const TOURNEY = 110274;
const BATTER_BASE = "https://www.mystatsonline.com/ballsports/visitor/league/stats/batter.aspx?IDLeague=" + LEAGUE + "&IDSeason=";
const PITCHER_BASE = "https://www.mystatsonline.com/ballsports/visitor/league/stats/pitcher.aspx?IDLeague=" + LEAGUE + "&IDSeason=";
const STANDINGS_BASE = "https://www.mystatsonline.com/ballsports/visitor/league/standings/standings.aspx?IDLeague=" + LEAGUE + "&IDSeason=";
const BATTER_URL = BATTER_BASE + SEASON;
const PITCHER_URL = PITCHER_BASE + SEASON;
const CELL_KEYS = ["g", "avg", "slg", "obp", "ab", "r", "h", "singles", "doubles", "triples", "hr", "rbi", "tb", "so", "bb", "sf", "tpa", "roe", "ops", "fc"];
const PITCH_KEYS = ["g", "w", "l", "sv", "era", "ip", "h", "r", "er", "bb", "so", "hr", "bf", "gs", "cg", "sho", "avg", "whip", "sox", "bbx"];
const TEAM_NAMES = {
  BTZ: "Blitz",
  DEM: "Dem Bois",
  FLM: "Flamingos",
  RPR: "Reapers",
  SAN: "Sandvipers",
  SVG: "Savages",
  STP: "Step Above",
  WIZ: "Wizards",
  TBD: "To Be Determined",
  BSD: "Balls Deep",
  CLS: "Cloud Seeders",
  KNU: "Knuckled Up",
  MRD: "Marauders",
  WST: "Wiffle Shts",
};

const TOURNEY_EVENTS = [
  { id: "overall", label: "Overall" },
  { id: "aug1", label: "Aug 1 · Brooksville", date: "2026-08-01", season: 110274 },
  { id: "eos", label: "End of Summer Showdown", date: "2026-08-29" },
  { id: "sep26", label: "Sep 26 · Spartan Challenge", date: "2026-09-26" },
  { id: "faceoff", label: "Florida Faceoff", date: "2026-10-17" },
  { id: "marathon", label: "The Marathon Game", date: "2026-11-06", season: 110567 },
  { id: "dec5", label: "Dec 5 Tournament", date: "2026-12-05" },
];

let cache = { at: 0, data: null };
let seasonBooks = {};
let tourneyPack = {};

function parseAllRows(html, keys) {
  const rows = [];
  for (const chunk of String(html || "").split("<tr>")) {
    const teamHit = chunk.match(/teams_name_col text-center">([^<]+)</);
    if (!teamHit) continue;
    const team = String(teamHit[1] || "")
      .replace(/&nbsp;/gi, "")
      .trim();
    if (!team) continue;
    const named = chunk.match(/<span id='([^']+)'>/);
    if (!named) continue;
    const [last, first] = named[1].split(",").map((s) => s.trim());
    const cells = [...chunk.matchAll(/<td class=" text-center">([^<]*)<\/td>/g)].map((m) => m[1]).filter(Boolean);
    if (!cells[1]) continue;
    const row = { last, first, team, name: [first, last].filter(Boolean).join(" ") };
    keys.forEach((key, i) => {
      if (cells[i] != null) row[key] = cells[i];
    });
    row.g = Number(row.g) || 0;
    rows.push(row);
  }
  return rows;
}

function parseStandings(html) {
  const rows = [];
  const seen = {};
  for (const chunk of String(html || "").split("<tr")) {
    const code = ((chunk.match(/standing_team_abbr">([^<]+)</) || [])[1] || "").trim();
    if (!code || seen[code]) continue;
    const name = ((chunk.match(/standing_team_name">([^<]+)</) || [])[1] || "").trim();
    const cells = [...chunk.matchAll(/<td class=" text-center"(?: data-sort="[^"]*")?>([^<]*)<\/td>/g)].map((m) => m[1]);
    if (cells.length < 3) continue;
    const pctI = cells.findIndex((c) => /^[01]?(?:\.\d+)$/.test(String(c).trim()));
    const w = Number(cells[pctI === 2 ? 0 : 1]) || 0;
    const l = Number(cells[pctI === 2 ? 1 : 2]) || 0;
    const gp = pctI === 2 ? w + l : Number(cells[0]) || 0;
    const rs = Number(cells[pctI === 2 ? 6 : 8]) || 0;
    const ra = Number(cells[pctI === 2 ? 7 : 9]) || 0;
    seen[code] = true;
    rows.push({ code, name: name || TEAM_NAMES[code] || code, gp, w, l, pct: gp ? w / gp : 0, rs, ra, rd: rs - ra, streak: cells[pctI === 2 ? 9 : 10] || "" });
  }
  return rows;
}

function applyStandings(teams, table) {
  const map = {};
  for (const r of table || []) map[r.code] = r;
  for (const t of teams) {
    const s = map[t.code];
    if (s) Object.assign(t, s);
  }
  for (const s of table || []) {
    if (teams.some((t) => t.code === s.code)) continue;
    teams.push({ code: s.code, name: s.name || TEAM_NAMES[s.code] || s.code, batters: [], pitchers: [], book: "tourney", note: "", ...s });
  }
  return teams;
}

function mergeRecords(books) {
  const map = {};
  for (const teams of books || []) {
    for (const t of teams || []) {
      if (t.w == null && t.l == null) continue;
      const row = map[t.code] || (map[t.code] = { code: t.code, gp: 0, w: 0, l: 0, rs: 0, ra: 0 });
      row.gp += Number(t.gp) || 0;
      row.w += Number(t.w) || 0;
      row.l += Number(t.l) || 0;
      row.rs += Number(t.rs) || 0;
      row.ra += Number(t.ra) || 0;
    }
  }
  for (const row of Object.values(map)) {
    row.pct = row.gp ? row.w / row.gp : 0;
    row.rd = row.rs - row.ra;
    row.streak = "";
  }
  return map;
}

async function fetchTable(url, keys) {
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), 12000);
  const res = await fetch(url, { signal: ac.signal, headers: { "user-agent": "WizardsHub/1.0" } });
  clearTimeout(timer);
  if (!res.ok) throw new Error("PLW " + res.status);
  return parseAllRows(await res.text(), keys);
}

function num(v) {
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : 0;
}

function creditBrianHit(rows) {
  for (const row of rows) {
    if (row.last !== "Hannan" || Number(row.h) >= 1) continue;
    row.h = "1";
    row.singles = "1";
    row.tb = "1";
    row.avg = ".167";
    row.slg = ".167";
    row.obp = ".500";
    row.ops = ".667";
  }
}

function creditWizPitch(rows, line) {
  if ((rows || []).some((r) => (r.last === line.last || r.playerId === line.playerId) && num(r.ip) > 0)) return;
  const i = (rows || []).findIndex((r) => r.last === line.last || r.playerId === line.playerId);
  if (i >= 0) Object.assign(rows[i], line);
  else rows.push(line);
}

function creditBrianPitch(rows) {
  creditWizPitch(rows, {
    last: "Hannan",
    first: "Brian",
    team: "WIZ",
    name: "Brian Hannan",
    playerId: "brian-hannan",
    g: 1,
    w: "0",
    l: "0",
    sv: "0",
    era: "5.14",
    ip: "7.0",
    r: "4",
    er: "4",
    bb: "4",
    so: "6",
    gs: "1",
    whip: "0.57",
    sox: "6.00",
    bbx: "4.00",
  });
}

function creditKnownPitch(rows) {
  creditWizPitch(rows, { last: "Gonzalez", first: "Jose", team: "WIZ", name: "Jose Gonzalez", playerId: "jose-gonzalez" });
  creditWizPitch(rows, { last: "Dupe", first: "Cam", team: "WIZ", name: "Cam Dupe", playerId: "cam" });
}

function creditTonyPitch(rows) {
  creditWizPitch(rows, {
    last: "Kurtanick",
    first: "Tony",
    team: "WIZ",
    name: "Tony Kurtanick",
    playerId: "tony-kurtanick",
    g: 2,
    w: "0",
    l: "0",
    sv: "0",
    era: "4.00",
    ip: "9.0",
    r: "4",
    er: "4",
    bb: "1",
    so: "3",
    gs: "1",
    cg: "1",
    whip: "0.11",
    sox: "2.33",
    bbx: "0.78",
  });
}

function wizTeam(batters, pitchers, fromTourney) {
  creditBrianHit(batters);
  creditBrianPitch(pitchers);
  creditTonyPitch(pitchers);
  creditKnownPitch(pitchers);
  return {
    code: "WIZ",
    name: "Wizards",
    note: fromTourney ? "No league lines yet — 2026 Tourney Season." : "",
    batters: batters.slice().sort((a, b) => num(b.ops) - num(a.ops) || num(b.avg) - num(a.avg)),
    pitchers: pitchers.slice().sort((a, b) => num(a.era) - num(b.era) || num(a.whip) - num(b.whip)),
  };
}

function groupTeams(batters, pitchers) {
  const codes = [...new Set([...batters.map((r) => r.team), ...pitchers.map((r) => r.team)])];
  codes.sort((a, b) => {
    if (a === "WIZ") return -1;
    if (b === "WIZ") return 1;
    return (TEAM_NAMES[a] || a).localeCompare(TEAM_NAMES[b] || b);
  });
  return codes.map((code) => ({
    code,
    name: TEAM_NAMES[code] || code,
    batters: batters.filter((r) => r.team === code).sort((a, b) => num(b.ops) - num(a.ops) || num(b.avg) - num(a.avg)),
    pitchers: pitchers.filter((r) => r.team === code).sort((a, b) => num(a.era) - num(b.era) || num(a.whip) - num(b.whip)),
  }));
}

async function getPlwLeagueBook() {
  if (cache.data && Date.now() - cache.at < 15 * 60 * 1000) return cache.data;
  const [batters, pitchers, standHtml] = await Promise.all([
    fetchTable(BATTER_URL, CELL_KEYS),
    fetchTable(PITCHER_URL, PITCH_KEYS),
    fetch(STANDINGS_BASE + SEASON, { headers: { "user-agent": "WizardsHub/1.0" } })
      .then((r) => r.text())
      .catch(() => ""),
  ]);
  let teams = groupTeams(batters, pitchers);
  if (!teams.some((t) => t.code === "WIZ")) {
    const [bT, pT] = await Promise.all([fetchTable(BATTER_BASE + TOURNEY, CELL_KEYS), fetchTable(PITCHER_BASE + TOURNEY, PITCH_KEYS)]);
    teams.unshift(wizTeam(bT.filter((r) => r.team === "WIZ"), pT.filter((r) => r.team === "WIZ"), true));
  }
  const wiz = teams.find((t) => t.code === "WIZ");
  if (wiz) {
    creditBrianPitch(wiz.pitchers);
    creditTonyPitch(wiz.pitchers);
    creditKnownPitch(wiz.pitchers);
  }
  const byCode = {};
  for (const s of parseStandings(standHtml)) byCode[s.code] = s;
  for (const t of teams) {
    if (byCode[t.code]) Object.assign(t, byCode[t.code]);
  }
  cache = {
    at: Date.now(),
    data: {
      label: "Florida Challengers League",
      note: "League hitting and pitching by club. Wizards show tourney lines until the league board has us.",
      source: BATTER_URL,
      pitchSource: PITCHER_URL,
      teams,
    },
  };
  return cache.data;
}

function eventMeta() {
  return TOURNEY_EVENTS.map((e) => ({ id: e.id, label: e.label, date: e.date || "", posted: e.id === "overall" || !!e.season }));
}

function ipOuts(v) {
  const p = String(v == null ? "0" : v).split(".");
  return (Number(p[0]) || 0) * 3 + (Number(p[1]) || 0);
}

function mergePlayers(lists, pitching) {
  const map = {};
  for (const row of lists) {
    const k = [row.team, row.last, row.first].join("|");
    (map[k] || (map[k] = [])).push(row);
  }
  return Object.values(map).map((rows) => {
    const base = { ...rows[0] };
    const add = (key) => rows.reduce((s, r) => s + num(r[key]), 0);
    if (pitching) {
      const ip = rows.reduce((s, r) => s + ipOuts(r.ip), 0);
      const er = add("er"), h = add("h"), bb = add("bb"), so = add("so");
      const inn = ip / 3;
      base.g = add("g");
      ["w", "l", "sv", "r", "h", "er", "bb", "so", "hr", "bf", "gs", "cg", "sho"].forEach((key) => {
        base[key] = String(add(key));
      });
      base.ip = Math.floor(ip / 3) + "." + (ip % 3);
      base.era = inn ? ((er * 9) / inn).toFixed(2) : "—";
      base.whip = inn ? ((h + bb) / inn).toFixed(2) : "—";
      base.sox = inn ? ((so * 6) / inn).toFixed(2) : "—";
      base.bbx = inn ? ((bb * 6) / inn).toFixed(2) : "—";
      return base;
    }
    const ab = add("ab"), h = add("h"), bb = add("bb"), sf = add("sf"), tb = add("tb");
    ["g", "r", "singles", "doubles", "triples", "hr", "rbi", "so", "roe", "fc", "tpa"].forEach((key) => {
      base[key] = String(add(key));
    });
    base.ab = String(ab);
    base.h = String(h);
    base.bb = String(bb);
    base.sf = String(sf);
    base.tb = String(tb);
    base.avg = ab ? (h / ab).toFixed(3) : ".000";
    base.slg = ab ? (tb / ab).toFixed(3) : ".000";
    base.obp = ab + bb + sf ? ((h + bb) / (ab + bb + sf)).toFixed(3) : ".000";
    base.ops = (Number(base.obp) + Number(base.slg)).toFixed(3);
    return base;
  });
}

function flattenKind(books, kind) {
  const rows = [];
  for (const teams of books) {
    for (const t of teams || []) rows.push(...(t[kind] || []));
  }
  return rows;
}

function stampTourney(teams) {
  return teams.map((t) => ({ ...t, book: "tourney", note: "" }));
}

async function loadSeasonTeams(seasonId) {
  const hit = seasonBooks[seasonId];
  if (hit && Date.now() - hit.at < 15 * 60 * 1000) return hit.teams;
  const [batters, pitchers, standHtml] = await Promise.all([
    fetchTable(BATTER_BASE + seasonId, CELL_KEYS),
    fetchTable(PITCHER_BASE + seasonId, PITCH_KEYS),
    fetch(STANDINGS_BASE + seasonId, { headers: { "user-agent": "WizardsHub/1.0" } })
      .then((r) => r.text())
      .catch(() => ""),
  ]);
  creditBrianHit(batters);
  const teams = stampTourney(
    groupTeams(batters, pitchers).map((t) => {
      if (t.code === "WIZ") {
        creditBrianHit(t.batters);
        creditBrianPitch(t.pitchers);
        creditTonyPitch(t.pitchers);
        creditKnownPitch(t.pitchers);
      }
      return t;
    })
  );
  if (!teams.some((t) => t.code === "WIZ") && seasonId === TOURNEY) {
    const wiz = wizTeam([], [], false);
    creditBrianPitch(wiz.pitchers);
    creditTonyPitch(wiz.pitchers);
    creditKnownPitch(wiz.pitchers);
    teams.unshift({ ...wiz, book: "tourney", note: "" });
  }
  applyStandings(teams, parseStandings(standHtml));
  seasonBooks[seasonId] = { at: Date.now(), teams };
  return teams;
}

async function getPlwTourneyBook(eventId) {
  const id = TOURNEY_EVENTS.some((e) => e.id === eventId) ? eventId : "overall";
  const hit = tourneyPack[id];
  if (hit && Date.now() - hit.at < 15 * 60 * 1000) return hit.data;
  const ev = TOURNEY_EVENTS.find((e) => e.id === id);
  const events = eventMeta();
  let teams = [];
  let season = ev && ev.season;
  let note = ev && ev.season ? "Posted PLW board for this event." : "No PLW board posted for this event yet.";
  if (id === "overall") {
    const books = await Promise.all(TOURNEY_EVENTS.filter((e) => e.season).map((e) => loadSeasonTeams(e.season)));
    teams = stampTourney(groupTeams(mergePlayers(flattenKind(books, "batters"), false), mergePlayers(flattenKind(books, "pitchers"), true)));
    const rec = mergeRecords(books);
    for (const t of teams) {
      if (rec[t.code]) Object.assign(t, rec[t.code]);
    }
    applyStandings(teams, Object.values(rec));
    season = TOURNEY;
    note = "Tally of every posted tournament, ranked by W-L. Pick an event for that day’s board.";
  } else if (ev && ev.season) {
    teams = await loadSeasonTeams(ev.season);
  }
  const data = {
    book: "tourney",
    event: id,
    events,
    label: ev && ev.label ? ev.label : "Overall",
    note,
    source: BATTER_BASE + (season || TOURNEY),
    pitchSource: PITCHER_BASE + (season || TOURNEY),
    teams,
  };
  tourneyPack[id] = { at: Date.now(), data };
  return data;
}

function lineupKey(date, team) {
  return String(date || "") + ":" + String(team || "").toUpperCase();
}

function parseLineup(text) {
  const names = [];
  for (const raw of String(text || "").split(/[\n,;|]+/)) {
    let s = raw.replace(/^\s*\d+[.)\-:]\s*/, "").replace(/^[-*•]+\s*/, "").trim();
    s = s.replace(/^\s*(P|C|1B|2B|3B|SS|LF|CF|RF|OF|IF|DH)\s*[-–:]\s*/i, "");
    s = s.replace(/\s+\b(P|C|1B|2B|3B|SS|LF|CF|RF|OF|IF|DH|UTIL|Util)\b\.?\s*$/i, "").trim();
    if (s.length < 2 || !/[a-zA-Z]/.test(s) || /^(lineup|batting|pitching|roster|vs\.?)\b/i.test(s)) continue;
    names.push(s);
  }
  return names.slice(0, 16);
}

function emptyLineup() {
  return { names: [], text: "" };
}

function attachPlwLeague(app, { requireTeam, requireAdmin, readJson, writeJson }) {
  app.get("/api/plw-league", requireTeam, async (_req, res) => {
    try {
      res.json(await getPlwLeagueBook());
    } catch (err) {
      res.status(502).json({ error: String(err.message || err), teams: [] });
    }
  });
  app.get("/api/plw-tourney", requireTeam, async (req, res) => {
    try {
      res.json(await getPlwTourneyBook(req.query.event));
    } catch (err) {
      res.status(502).json({ error: String(err.message || err), teams: [] });
    }
  });
  app.get("/api/lineups", requireTeam, async (req, res) => {
    const data = await readJson("lineups.json");
    const key = lineupKey(req.query.date, req.query.team);
    res.json((data.nights && data.nights[key]) || emptyLineup());
  });
  app.put("/api/lineups", requireAdmin, async (req, res) => {
    const date = String((req.body && req.body.date) || "");
    const team = String((req.body && req.body.team) || "").toUpperCase();
    if (!date || !team) return res.status(400).json({ error: "Date and team required" });
    const text = String((req.body && req.body.text) || "").trim();
    const data = await readJson("lineups.json");
    data.nights = data.nights || {};
    const key = lineupKey(date, team);
    if (!text) {
      delete data.nights[key];
      await writeJson("lineups.json", data);
      return res.json(emptyLineup());
    }
    const names = parseLineup(text);
    if (!names.length) return res.status(400).json({ error: "Could not read any names from that paste" });
    data.nights[key] = {
      date,
      team,
      text,
      names,
      updatedBy: req.user && req.user.username,
      updatedAt: new Date().toISOString(),
    };
    await writeJson("lineups.json", data);
    res.json(data.nights[key]);
  });
  require("./plw-history").attachHistory(app, { requireTeam });
}

module.exports = {
  attachPlwLeague,
  getPlwLeagueBook,
  fetchTable,
  groupTeams,
  parseStandings,
  applyStandings,
  eventMeta,
  BATTER_BASE,
  PITCHER_BASE,
  STANDINGS_BASE,
  CELL_KEYS,
  PITCH_KEYS,
};
