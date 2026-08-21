const {
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
} = require("./plw-league");

const HIST_LEAGUES = [
  { id: 97640, label: "Season 6" },
  { id: 89497, label: "Season 5" },
  { id: 84669, label: "Season 4" },
  { id: 82792, label: "Season 3" },
  { id: 80841, label: "Season 2" },
  { id: 79406, label: "Season 1" },
  { id: 80840, label: "Challengers" },
];

const cache = {};

async function loadLeagueSeason(seasonId) {
  const key = "L" + seasonId;
  const hit = cache[key];
  if (hit && Date.now() - hit.at < 30 * 60 * 1000) return hit.teams;
  const [batters, pitchers, standHtml] = await Promise.all([
    fetchTable(BATTER_BASE + seasonId, CELL_KEYS),
    fetchTable(PITCHER_BASE + seasonId, PITCH_KEYS),
    fetch(STANDINGS_BASE + seasonId, { headers: { "user-agent": "WizardsHub/1.0" } })
      .then((r) => r.text())
      .catch(() => ""),
  ]);
  const teams = applyStandings(groupTeams(batters, pitchers), parseStandings(standHtml));
  cache[key] = { at: Date.now(), teams };
  return teams;
}

async function getPlwHistory(seasonKey) {
  const key = !seasonKey || seasonKey === "all" ? "all" : String(seasonKey);
  const packKey = "H" + key;
  const hit = cache[packKey];
  if (hit && Date.now() - hit.at < 30 * 60 * 1000) return hit.data;
  const seasons = key === "all" ? HIST_LEAGUES : HIST_LEAGUES.filter((s) => String(s.id) === key);
  if (!seasons.length) {
    return { book: "history", season: key, seasons: HIST_LEAGUES, events: eventMeta(), label: "Historical", note: "Unknown season.", teams: [] };
  }
  const books = await Promise.all(
    seasons.map(async (s) => ({ ...s, teams: await loadLeagueSeason(s.id) }))
  );
  let teams = [];
  if (key === "all") {
    for (const b of books) {
      for (const t of b.teams || []) {
        teams.push({ ...t, code: t.code + "-" + b.id, name: (t.name || t.code) + " · " + b.label, histSeason: String(b.id) });
      }
    }
  } else {
    teams = books[0].teams || [];
  }
  const data = {
    book: "history",
    season: key,
    seasons: HIST_LEAGUES.map((s) => ({ id: String(s.id), label: s.label })),
    events: eventMeta(),
    label: key === "all" ? "All previous leagues" : seasons[0].label,
    note: "Past PLW league seasons (1–6 and Challengers). All previous pools every club-season.",
    source: BATTER_BASE + (seasons[0] && seasons[0].id),
    teams,
  };
  cache[packKey] = { at: Date.now(), data };
  return data;
}

function attachHistory(app, { requireTeam }) {
  app.get("/api/plw-history", requireTeam, async (req, res) => {
    try {
      res.json(await getPlwHistory(req.query.season));
    } catch (err) {
      res.status(502).json({ error: String(err.message || err), teams: [] });
    }
  });
}

module.exports = { attachHistory, getPlwHistory };
