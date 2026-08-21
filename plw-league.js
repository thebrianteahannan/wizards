const LEAGUE = 61713;
const SEASON = 110335;
const TOURNEY = 110274;
const BATTER_BASE = "https://www.mystatsonline.com/ballsports/visitor/league/stats/batter.aspx?IDLeague=" + LEAGUE + "&IDSeason=";
const PITCHER_BASE = "https://www.mystatsonline.com/ballsports/visitor/league/stats/pitcher.aspx?IDLeague=" + LEAGUE + "&IDSeason=";
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

let cache = { at: 0, data: null };
let tourneyCache = { at: 0, data: null };

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
  const [batters, pitchers] = await Promise.all([fetchTable(BATTER_URL, CELL_KEYS), fetchTable(PITCHER_URL, PITCH_KEYS)]);
  let teams = groupTeams(batters, pitchers);
  if (!teams.some((t) => t.code === "WIZ")) {
    const [bT, pT] = await Promise.all([fetchTable(BATTER_BASE + TOURNEY, CELL_KEYS), fetchTable(PITCHER_BASE + TOURNEY, PITCH_KEYS)]);
    teams.unshift(wizTeam(bT.filter((r) => r.team === "WIZ"), pT.filter((r) => r.team === "WIZ"), true));
  }
  const wiz = teams.find((t) => t.code === "WIZ");
  if (wiz) {
    creditBrianPitch(wiz.pitchers);
    creditTonyPitch(wiz.pitchers);
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

async function getPlwTourneyBook() {
  if (tourneyCache.data && Date.now() - tourneyCache.at < 15 * 60 * 1000) return tourneyCache.data;
  const [batters, pitchers] = await Promise.all([
    fetchTable(BATTER_BASE + TOURNEY, CELL_KEYS),
    fetchTable(PITCHER_BASE + TOURNEY, PITCH_KEYS),
  ]);
  creditBrianHit(batters);
  const teams = groupTeams(batters, pitchers).map((t) => {
    if (t.code === "WIZ") {
      creditBrianHit(t.batters);
      creditBrianPitch(t.pitchers);
      creditTonyPitch(t.pitchers);
    }
    return { ...t, book: "tourney", note: "" };
  });
  if (!teams.some((t) => t.code === "WIZ")) {
    const wiz = wizTeam([], [], false);
    creditBrianPitch(wiz.pitchers);
    creditTonyPitch(wiz.pitchers);
    teams.unshift({ ...wiz, book: "tourney", note: "" });
  }
  tourneyCache = {
    at: Date.now(),
    data: {
      book: "tourney",
      label: "2026 Tourney Season",
      note: "All clubs from the 2026 Tourney Season.",
      source: BATTER_BASE + TOURNEY,
      pitchSource: PITCHER_BASE + TOURNEY,
      teams,
    },
  };
  return tourneyCache.data;
}

function attachPlwLeague(app, { requireTeam }) {
  app.get("/api/plw-league", requireTeam, async (_req, res) => {
    try {
      res.json(await getPlwLeagueBook());
    } catch (err) {
      res.status(502).json({ error: String(err.message || err), teams: [] });
    }
  });
  app.get("/api/plw-tourney", requireTeam, async (_req, res) => {
    try {
      res.json(await getPlwTourneyBook());
    } catch (err) {
      res.status(502).json({ error: String(err.message || err), teams: [] });
    }
  });
}

module.exports = { attachPlwLeague, getPlwLeagueBook };
