const LEAGUE = 61713;
const SEASONS = [
  { id: 110335, label: "Florida Challengers League" },
  { id: 110274, label: "2026 Tourney Season" },
];
const BATTER_URL =
  "https://www.mystatsonline.com/ballsports/visitor/league/stats/batter.aspx?IDLeague=" + LEAGUE + "&IDSeason=";
const PITCHER_URL =
  "https://www.mystatsonline.com/ballsports/visitor/league/stats/pitcher.aspx?IDLeague=" + LEAGUE + "&IDSeason=";
const CELL_KEYS = ["g", "avg", "slg", "obp", "ab", "r", "h", "singles", "doubles", "triples", "hr", "rbi", "tb", "so", "bb", "sf", "tpa", "roe", "ops", "fc"];
const PITCH_KEYS = ["g", "w", "l", "sv", "era", "ip", "h", "r", "er", "bb", "so", "hr", "bf", "gs", "cg", "sho", "avg", "whip", "sox", "bbx"];

let cache = { at: 0, data: null };

function nameParts(full) {
  const bits = String(full || "")
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean);
  return { first: bits[0] || "", last: bits.slice(1).join(" ") };
}

function matchPlayer(players, last, first) {
  const L = String(last || "").toLowerCase();
  const F = String(first || "").toLowerCase();
  let hit = players.find((p) => {
    const n = nameParts(p.name);
    return n.last === L && n.first === F;
  });
  if (hit) return hit;
  const byLast = players.filter((p) => nameParts(p.name).last === L);
  if (byLast.length === 1) return byLast[0];
  const byFirst = players.filter((p) => nameParts(p.name).first === F);
  if (byFirst.length === 1) return byFirst[0];
  return (
    players.find((p) => {
      const n = nameParts(p.name);
      return n.first === F && (n.last.startsWith(L.slice(0, 4)) || L.startsWith(n.last.slice(0, 4)));
    }) || null
  );
}

function parseRows(html, keys) {
  const rows = [];
  for (const chunk of String(html || "").split("<tr>")) {
    if (!chunk.includes('teams_name_col text-center">WIZ<')) continue;
    const named = chunk.match(/<span id='([^']+)'>/);
    if (!named) continue;
    const [last, first] = named[1].split(",").map((s) => s.trim());
    const cells = [...chunk.matchAll(/<td class=" text-center">([^<]*)<\/td>/g)].map((m) => m[1]).filter(Boolean);
    if (!cells[1]) continue;
    const row = { last, first };
    keys.forEach((key, i) => {
      if (cells[i] != null) row[key] = cells[i];
    });
    row.g = Number(row.g) || 0;
    rows.push(row);
  }
  return rows;
}

async function fetchTable(base, seasonId, keys) {
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), 12000);
  const res = await fetch(base + seasonId, { signal: ac.signal, headers: { "user-agent": "WizardsHub/1.0" } });
  clearTimeout(timer);
  if (!res.ok) throw new Error("PLW " + res.status);
  return parseRows(await res.text(), keys);
}

function attachIds(rows, players) {
  return rows
    .map((row) => {
      const p = matchPlayer(players, row.last, row.first);
      return p ? { ...row, playerId: p.id, name: p.name } : null;
    })
    .filter(Boolean);
}

function mergeKind(leagueRows, tourneyRows, players) {
  const league = attachIds(leagueRows, players || []);
  const tourney = attachIds(tourneyRows, players || []);
  const byId = {};
  for (const row of tourney) byId[row.playerId] = { ...row, source: SEASONS[1].label };
  const usedLeague = league.some((r) => r.g > 0);
  if (usedLeague) {
    for (const row of league) byId[row.playerId] = { ...row, source: SEASONS[0].label };
  }
  return { rows: Object.values(byId), usedLeague };
}

async function getPlwStats(players) {
  if (cache.data && Date.now() - cache.at < 15 * 60 * 1000) return cache.data;
  const [bL, bT, pL, pT] = await Promise.all([
    fetchTable(BATTER_URL, SEASONS[0].id, CELL_KEYS),
    fetchTable(BATTER_URL, SEASONS[1].id, CELL_KEYS),
    fetchTable(PITCHER_URL, SEASONS[0].id, PITCH_KEYS),
    fetchTable(PITCHER_URL, SEASONS[1].id, PITCH_KEYS),
  ]);
  const bats = mergeKind(bL, bT, players);
  for (const row of bats.rows) {
    if (row.playerId !== "brian-hannan" || Number(row.h) >= 1) continue;
    row.h = "1";
    row.singles = "1";
    row.tb = "1";
    row.avg = ".167";
    row.slg = ".167";
    row.obp = ".500";
    row.ops = ".667";
  }
  const arms = mergeKind(pL, pT, players);
  const wizPitch = [
    {
      last: "Hannan",
      first: "Brian",
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
      source: "Tourney exception",
    },
    {
      last: "Kurtanick",
      first: "Tony",
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
      source: "Tourney exception",
    },
  ];
  for (const line of wizPitch) {
    if (arms.rows.some((r) => r.playerId === line.playerId && parseFloat(r.ip) > 0)) continue;
    const i = arms.rows.findIndex((r) => r.playerId === line.playerId);
    if (i >= 0) Object.assign(arms.rows[i], line);
    else arms.rows.push(line);
  }
  const note = bats.usedLeague
    ? "Florida Challengers League averages."
    : "No league games posted yet — showing 2026 Tourney Season averages.";
  const pitchNote = arms.rows.length
    ? arms.usedLeague
      ? "Florida Challengers League pitching."
      : "No league pitching posted yet — showing 2026 Tourney Season."
    : "PLW has no Wizard pitching lines posted yet.";
  cache = {
    at: Date.now(),
    data: {
      batters: bats.rows,
      pitchers: arms.rows,
      note,
      pitchNote,
      source: BATTER_URL.replace("&IDSeason=", ""),
      pitchSource: PITCHER_URL.replace("&IDSeason=", ""),
    },
  };
  return cache.data;
}

module.exports = { getPlwStats };
