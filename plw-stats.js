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
const NAME_ALIASES = [{ last: "Nicolson", first: "Shaun", asLast: "Nicholson", asFirst: "Shaun" }];

let cache = { at: 0, data: null };

function aliasFor(last, first) {
  const L = String(last || "").toLowerCase();
  const F = String(first || "").toLowerCase();
  return NAME_ALIASES.find((a) => a.last.toLowerCase() === L && a.first.toLowerCase() === F) || null;
}

function nameParts(full) {
  const bits = String(full || "")
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean);
  return { first: bits[0] || "", last: bits.slice(1).join(" ") };
}

function matchPlayer(players, last, first) {
  const alias = aliasFor(last, first);
  if (alias) {
    last = alias.asLast;
    first = alias.asFirst;
  }
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
    const teamHit = chunk.match(/teams_name_col text-center">([^<]+)</);
    if (!teamHit) continue;
    const team = String(teamHit[1] || "")
      .replace(/&nbsp;/gi, "")
      .trim();
    const named = chunk.match(/<span id='([^']+)'>/);
    if (!named) continue;
    const [last, first] = named[1].split(",").map((s) => s.trim());
    if (team !== "WIZ" && !aliasFor(last, first)) continue;
    const cells = [...chunk.matchAll(/<td class=" text-center">([^<]*)<\/td>/g)].map((m) => m[1]).filter(Boolean);
    if (!cells[1]) continue;
    const row = { last, first, team };
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
  const ranked = [...rows].sort((a, b) => Number(b.team === "WIZ") - Number(a.team === "WIZ"));
  const seen = new Set();
  const out = [];
  for (const row of ranked) {
    const p = matchPlayer(players, row.last, row.first);
    if (!p || seen.has(p.id)) continue;
    seen.add(p.id);
    out.push({ ...row, playerId: p.id, name: p.name });
  }
  return out;
}

function fmtRate(n, d) {
  if (!d) return ".000";
  const t = Math.round((n / d) * 1000);
  if (t >= 1000) return (t / 1000).toFixed(3);
  return "." + String(Math.max(0, t)).padStart(3, "0");
}

function sumKey(parts, key) {
  return parts.reduce((a, r) => a + (Number(r[key]) || 0), 0);
}

function innings(v) {
  const parts = String(v == null ? "" : v).split(".");
  return (Number(parts[0]) || 0) + (Number(parts[1]) || 0) / 3;
}

function fmtIp(n) {
  const whole = Math.floor(n + 1e-9);
  const outs = Math.round((n - whole) * 3);
  return whole + "." + outs;
}

function hasBat(row) {
  return row && (Number(row.g) > 0 || Number(row.ab) > 0 || Number(row.tpa) > 0);
}

function hasArm(row) {
  return row && innings(row.ip) > 0;
}

function combineBat(league, tourney) {
  const parts = [league, tourney].filter(hasBat);
  if (!parts.length) return null;
  if (parts.length === 1) return { ...parts[0] };
  const ab = sumKey(parts, "ab");
  const h = sumKey(parts, "h");
  const tb = sumKey(parts, "tb");
  const bb = sumKey(parts, "bb");
  const tpa = sumKey(parts, "tpa");
  const slgN = ab ? tb / ab : 0;
  const obpN = tpa ? (h + bb) / tpa : 0;
  return {
    g: sumKey(parts, "g"),
    avg: fmtRate(h, ab),
    slg: fmtRate(tb, ab),
    obp: fmtRate(h + bb, tpa),
    ab: String(ab),
    r: String(sumKey(parts, "r")),
    h: String(h),
    singles: String(sumKey(parts, "singles")),
    doubles: String(sumKey(parts, "doubles")),
    triples: String(sumKey(parts, "triples")),
    hr: String(sumKey(parts, "hr")),
    rbi: String(sumKey(parts, "rbi")),
    tb: String(tb),
    so: String(sumKey(parts, "so")),
    bb: String(bb),
    sf: String(sumKey(parts, "sf")),
    tpa: String(tpa),
    roe: String(sumKey(parts, "roe")),
    ops: fmtRate(obpN + slgN, 1),
    fc: String(sumKey(parts, "fc")),
  };
}

function combinePitch(league, tourney) {
  const parts = [league, tourney].filter(hasArm);
  if (!parts.length) return league || tourney || null;
  if (parts.length === 1) return { ...parts[0] };
  const ips = parts.map((r) => innings(r.ip));
  const ip = ips.reduce((a, n) => a + n, 0);
  const wavg = (key) => (ip ? parts.reduce((a, r, i) => a + (Number(r[key]) || 0) * ips[i], 0) / ip : 0);
  const h = sumKey(parts, "h");
  const bb = sumKey(parts, "bb");
  const bf = sumKey(parts, "bf");
  const ab = Math.max(0, bf - bb);
  return {
    g: sumKey(parts, "g"),
    w: String(sumKey(parts, "w")),
    l: String(sumKey(parts, "l")),
    sv: String(sumKey(parts, "sv")),
    era: wavg("era").toFixed(2),
    ip: fmtIp(ip),
    h: String(h),
    r: String(sumKey(parts, "r")),
    er: String(sumKey(parts, "er")),
    bb: String(bb),
    so: String(sumKey(parts, "so")),
    hr: String(sumKey(parts, "hr")),
    bf: String(bf),
    gs: String(sumKey(parts, "gs")),
    cg: String(sumKey(parts, "cg")),
    sho: String(sumKey(parts, "sho")),
    avg: fmtRate(h, ab),
    whip: ip ? ((h + bb) / ip).toFixed(2) : "0.00",
    sox: wavg("sox").toFixed(2),
    bbx: wavg("bbx").toFixed(2),
  };
}

function stamp(row, source) {
  return row ? { ...row, source } : null;
}

function packKind(leagueRows, tourneyRows, players, combine) {
  const league = attachIds(leagueRows, players || []);
  const tourney = attachIds(tourneyRows, players || []);
  const byL = {};
  const byT = {};
  for (const row of league) byL[row.playerId] = row;
  for (const row of tourney) byT[row.playerId] = row;
  const rows = [];
  for (const id of new Set([...Object.keys(byL), ...Object.keys(byT)])) {
    const l = stamp(byL[id], SEASONS[0].label);
    const t = stamp(byT[id], SEASONS[1].label);
    const total = combine(l, t) || {};
    const src = l && t ? "combined" : ((l || t).source);
    rows.push({
      ...total,
      playerId: id,
      name: (l || t).name,
      last: (l || t).last,
      first: (l || t).first,
      league: l,
      tourney: t,
      source: src,
    });
  }
  return { rows, usedLeague: league.some((r) => r.g > 0) };
}

async function getPlwStats(players, force) {
  if (!force && cache.data && Date.now() - cache.at < 15 * 60 * 1000) return cache.data;
  const [bL, bT, pL, pT] = await Promise.all([
    fetchTable(BATTER_URL, SEASONS[0].id, CELL_KEYS),
    fetchTable(BATTER_URL, SEASONS[1].id, CELL_KEYS),
    fetchTable(PITCHER_URL, SEASONS[0].id, PITCH_KEYS),
    fetchTable(PITCHER_URL, SEASONS[1].id, PITCH_KEYS),
  ]);
  const bats = packKind(bL, bT, players, combineBat);
  for (const row of bats.rows) {
    if (row.playerId !== "brian-hannan") continue;
    if (row.tourney && Number(row.tourney.h) < 1) {
      Object.assign(row.tourney, { h: "1", singles: "1", tb: "1", avg: ".167", slg: ".167", obp: ".500", ops: ".667" });
    } else if (!row.tourney && Number(row.h) < 1) {
      Object.assign(row, { h: "1", singles: "1", tb: "1", avg: ".167", slg: ".167", obp: ".500", ops: ".667" });
      continue;
    }
    const meta = { playerId: row.playerId, name: row.name, last: row.last, first: row.first, league: row.league, tourney: row.tourney, source: row.league && row.tourney ? "combined" : row.source };
    Object.assign(row, combineBat(row.league, row.tourney) || {}, meta);
  }
  const arms = packKind(pL, pT, players, combinePitch);
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
    { last: "Gonzalez", first: "Jose", name: "Jose Gonzalez", playerId: "jose-gonzalez", source: "Staff" },
    { last: "Dupe", first: "Cam", name: "Cam Dupe", playerId: "cam", source: "Staff" },
  ];
  for (const line of wizPitch) {
    const i = arms.rows.findIndex((r) => r.playerId === line.playerId);
    if (i >= 0 && innings(arms.rows[i].ip) > 0) continue;
    if (i < 0) {
      arms.rows.push({ ...line, league: null, tourney: line.ip ? { ...line } : null });
      continue;
    }
    const row = arms.rows[i];
    if (line.ip && !hasArm(row.tourney)) row.tourney = { ...line };
    const meta = { playerId: row.playerId, name: row.name, last: row.last, first: row.first, league: row.league, tourney: row.tourney, source: row.league && row.tourney ? "combined" : line.source || row.source };
    Object.assign(row, combinePitch(row.league, row.tourney) || line, meta);
  }
  const note = "League, tourney, and combined PLW averages.";
  const pitchNote = arms.rows.length
    ? "League, tourney, and combined PLW pitching."
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
