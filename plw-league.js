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
    creditKnownPitch(wiz.pitchers);
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
      creditKnownPitch(t.pitchers);
    }
    return { ...t, book: "tourney", note: "" };
  });
  if (!teams.some((t) => t.code === "WIZ")) {
    const wiz = wizTeam([], [], false);
    creditBrianPitch(wiz.pitchers);
    creditTonyPitch(wiz.pitchers);
    creditKnownPitch(wiz.pitchers);
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
  app.get("/api/plw-tourney", requireTeam, async (_req, res) => {
    try {
      res.json(await getPlwTourneyBook());
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
}

module.exports = { attachPlwLeague, getPlwLeagueBook };
