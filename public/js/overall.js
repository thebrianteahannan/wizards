function outsOf(v) {
  const p = String(v == null ? "0" : v).split(".");
  return (Number(p[0]) || 0) * 3 + (Number(p[1]) || 0);
}

function addKey(rows, key) {
  return rows.reduce((s, r) => s + (Number(String(r[key] == null ? "" : r[key]).replace(/[^\d.-]/g, "")) || 0), 0);
}

function mergeSide(rows, pitching) {
  const map = {};
  for (const row of rows || []) {
    const k = [row.team, row.last, row.first, row.name].join("|");
    (map[k] || (map[k] = [])).push(row);
  }
  return Object.keys(map).map((k) => {
    const group = map[k];
    if (group.length === 1) return group[0];
    const base = Object.assign({}, group[0]);
    if (pitching) {
      const ip = group.reduce((s, r) => s + outsOf(r.ip), 0);
      const er = addKey(group, "er");
      const h = addKey(group, "h");
      const bb = addKey(group, "bb");
      const so = addKey(group, "so");
      const inn = ip / 3;
      ["w", "l", "sv", "r", "h", "er", "bb", "so", "hr", "bf", "gs", "cg", "sho", "g"].forEach((key) => {
        base[key] = String(addKey(group, key));
      });
      base.ip = Math.floor(ip / 3) + "." + (ip % 3);
      base.era = inn ? ((er * 9) / inn).toFixed(2) : "—";
      base.whip = inn ? ((h + bb) / inn).toFixed(2) : "—";
      base.sox = inn ? ((so * 6) / inn).toFixed(2) : "—";
      base.bbx = inn ? ((bb * 6) / inn).toFixed(2) : "—";
      return base;
    }
    const ab = addKey(group, "ab");
    const h = addKey(group, "h");
    const bb = addKey(group, "bb");
    const sf = addKey(group, "sf");
    const tb = addKey(group, "tb");
    ["g", "r", "singles", "doubles", "triples", "hr", "rbi", "so", "roe", "fc", "tpa"].forEach((key) => {
      base[key] = String(addKey(group, key));
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

function sideRows(leagueTeam, tourneyTeam, kind) {
  const leagueRows = (leagueTeam && leagueTeam[kind]) || [];
  const tourneyRows = (tourneyTeam && tourneyTeam[kind]) || [];
  if (leagueTeam && leagueTeam.note) return tourneyRows.length ? tourneyRows : leagueRows;
  return leagueRows.concat(tourneyRows);
}

function mergeBooks(league, tourney) {
  const by = {};
  for (const t of league || []) by[t.code] = { league: t };
  for (const t of tourney || []) (by[t.code] || (by[t.code] = {})).tourney = t;
  return Object.keys(by).map((code) => {
    const row = by[code];
    const src = row.league || row.tourney;
    return {
      code: code,
      name: src.name,
      book: "overall",
      note: "",
      batters: mergeSide(sideRows(row.league, row.tourney, "batters"), false),
      pitchers: mergeSide(sideRows(row.league, row.tourney, "pitchers"), true),
    };
  });
}

function overallHash(code) {
  return code && code !== "overview" ? "#/overall-scout?team=" + encodeURIComponent(code) : "#/overall-scout";
}

function renderOverallScout(league, tourney, code) {
  const data = {
    teams: mergeBooks(league && league.teams, tourney && tourney.teams),
    note: "League and tournament lines added together.",
  };
  const pitFill = leaguePitAvg(data.teams);
  const teams = rankedTeams(data.teams);
  const pick = code && code !== "overview" ? teams.find((t) => t.code === code) : null;
  const menu = scoutMenu(teams, pick ? pick.code : "overview");
  const pane = pick ? scoutPane(pick, pitFill, data.teams) : overviewPane(data, overallHash);
  return `
    <p class="kicker">Locker room</p>
    <h1>Overall Stats &amp; Analysis</h1>
    <p class="lede">${escapeHtml(data.note)} 6, 9, and 12 are the hitting grade of the best hitters at that depth. Open roster spots count as 40. <a href="#/scout">League</a>. <a href="#/tourney-scout">Tournaments</a>.</p>
    <div class="actions" data-overall-menu style="margin-top:0.7rem">${menu}</div>
    <div id="scout-pane" style="margin-top:1rem">${pane}</div>
    <div class="actions" data-overall-menu style="margin-top:1rem">${menu}</div>
  `;
}

function bindOverall() {
  document.querySelectorAll("[data-scout-team]").forEach((btn) => {
    btn.addEventListener("click", () => {
      location.hash = overallHash(btn.dataset.scoutTeam);
    });
  });
  if (typeof bindLeaderToggle === "function") bindLeaderToggle();
  if (typeof bindClubSheets === "function") bindClubSheets();
  if (typeof loadGameLog === "function") loadGameLog();
}
