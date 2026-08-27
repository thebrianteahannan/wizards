function tourneyHash(code, event) {
  const q = [];
  if (event && event !== "overall") q.push("event=" + encodeURIComponent(event));
  if (code && code !== "overview") q.push("team=" + encodeURIComponent(code));
  return "#/tourney-scout" + (q.length ? "?" + q.join("&") : "");
}

function tourneyEventMenu(data) {
  const hist = data && data.book === "history";
  const cur = (data && data.event) || "overall";
  const buttons = ((data && data.events) || [])
    .map((e) => {
      const on = !hist && e.id === cur ? "" : " ghost";
      const dim = e.posted || (!hist && e.id === cur) ? "" : ";opacity:0.55";
      return `<button class="btn${on}" type="button" data-tourney-event="${escapeHtml(e.id)}" style="${dim}">${escapeHtml(e.label)}</button>`;
    })
    .join("");
  return buttons + `<button class="btn${hist ? "" : " ghost"}" type="button" data-tourney-event="historical">Historical</button>`;
}

function recordPct(t) {
  const gp = (Number(t && t.w) || 0) + (Number(t && t.l) || 0);
  return gp ? (Number(t.w) || 0) / gp : -1;
}

function rankByRecord(teams) {
  return (teams || []).slice().sort((a, b) => {
    const pa = recordPct(a), pb = recordPct(b);
    if (pb !== pa) return pb - pa;
    if ((b.w || 0) !== (a.w || 0)) return (b.w || 0) - (a.w || 0);
    const rda = (a.rs || 0) - (a.ra || 0), rdb = (b.rs || 0) - (b.ra || 0);
    if (rdb !== rda) return rdb - rda;
    return String(a.name || "").localeCompare(String(b.name || ""));
  });
}

function wlCell(t) {
  if (t.w == null && t.l == null) return `<span class="muted">—</span>`;
  return `${t.w || 0}-${t.l || 0}`;
}

function tourneyOverview(data) {
  const list = (data && data.teams) || [];
  const event = (data && data.event) || "overall";
  const pitFill = leaguePitAvg(list);
  const pack = winCorrelates(list);
  const teams = rankByRecord(list).map((t) => ({ team: t, marks: teamMarks(t, pitFill) }));
  const cols = "2.2rem minmax(6.5rem,1.4fr) 3.4rem 3rem 2.8rem 2.8rem 2.8rem";
  const head = `<div class="roster-row" style="grid-template-columns:${cols}">
    <span class="muted">#</span><span class="muted" style="text-align:left">Team</span><span class="num muted">W-L</span><span class="num muted">PCT</span>${winHead("BAT", "bat", pack)}${winHead("PIT", "pit", pack)}${winHead("ALL", "all", pack)}
  </div>`;
  const rows = teams
    .map((row, i) => {
      const t = row.team;
      const us = t.code === "WIZ";
      const glow = us ? ";border-color:var(--cyan);box-shadow:0 0 14px rgba(34,211,238,0.28)" : "";
      const pct = recordPct(t);
      return `<a class="roster-row" href="${tourneyHash(t.code, event)}" style="grid-template-columns:${cols};text-decoration:none;color:inherit${glow}">
        <span class="num">${i + 1}</span>
        <span style="text-align:left;overflow:hidden"><strong style="display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap${us ? ";color:var(--cyan)" : ""}">${escapeHtml(t.name)}</strong></span>
        <span class="num" title="Tournament record">${wlCell(t)}</span>
        <span class="num">${pct < 0 ? `<span class="muted">—</span>` : pct.toFixed(3).replace(/^0/, "")}</span>
        <span class="num" title="Hitting">${markCell(row.marks.bat)}</span>
        <span class="num" title="Pitching">${markCell(row.marks.pit)}</span>
        <span class="num" title="Overall">${markCell(row.marks.all)}</span>
      </a>`;
    })
    .join("");
  const empty = event === "overall" ? "No posted tournament boards yet." : "No PLW lines posted for this event yet.";
  return `
    <div class="diamond-card card">
      <p class="kicker">Board</p>
      <h2 style="margin:0 0 0.55rem">${escapeHtml((data && data.label) || "Overview")}</h2>
      <p class="kicker" style="margin:0 0 0.35rem">Clubs by record</p>
      <div class="roster-list">${head}${rows || `<p class="muted">${empty}</p>`}</div>
      <div class="grid-2" style="margin-top:0.85rem">
        <div><p class="kicker" style="margin:0 0 0.35rem">Top bats</p><div class="roster-list">${topLeaders(list, "batters", hitterRating, ratingTone)}</div></div>
        <div><p class="kicker" style="margin:0 0 0.35rem">Top arms</p><div class="roster-list">${topLeaders(list, "pitchers", pitchRating, pitchTone)}</div></div>
      </div>
      ${winTrackHtml(list, pack)}
      <p class="muted" style="margin:0.55rem 0 0">Ranked by W-L, then run differential. Cyan BAT/PIT/ALL headers track with winning. Overall tallies every posted event.</p>
    </div>
  `;
}

function renderTourneyScout(data, code, event) {
  const pitFill = leaguePitAvg((data && data.teams) || []);
  const teams = rankedTeams((data && data.teams) || []);
  const ev = event || (data && data.event) || "overall";
  const pick = code && code !== "overview" ? teams.find((t) => t.code === code) : null;
  const href = (data && data.source) || "https://www.mystatsonline.com/ballsports/visitor/league/stats/batter.aspx?IDLeague=61713&IDSeason=110274";
  const menu = scoutMenu(teams, pick ? pick.code : "overview");
  return `
    <p class="kicker">Locker room</p>
    <h1>Tournament rankings</h1>
    <p class="lede">${escapeHtml((data && data.note) || "Pick a tournament or use Overall.")} Clubs rank by record first. Grades stay on the board so we can see when they do not match the W-L. <a href="${escapeHtml(href)}" target="_blank" rel="noopener">MyStatsOnline</a></p>
    <div class="actions" data-tourney-events style="margin-top:0.7rem">${tourneyEventMenu(data)}</div>
    <div class="actions" data-scout-menu style="margin-top:0.55rem">${menu}</div>
    <div id="scout-pane" style="margin-top:1rem">${pick ? (recordPct(pick) >= 0 ? `<p class="muted" style="margin:0 0 0.45rem">${pick.w || 0}-${pick.l || 0}${pick.gp ? ` in ${pick.gp}` : ""} · RS ${pick.rs || 0} RA ${pick.ra || 0}${pick.rd != null ? ` (${pick.rd > 0 ? "+" : ""}${pick.rd})` : ""}${pick.streak ? " · " + pick.streak : ""}</p>` : "") + scoutPane(pick, pitFill, data && data.teams) : tourneyOverview(data)}</div>
    <div class="actions" data-scout-menu style="margin-top:1rem">${menu}</div>
  `;
}

const WIN_STAT = [
  ["all", "ALL", 1],
  ["bat", "BAT", 1],
  ["pit", "PIT", 1],
  ["avg", "AVG", 1],
  ["obp", "OBP", 1],
  ["slg", "SLG", 1],
  ["ops", "OPS", 1],
  ["bb", "BB%", 1],
  ["k", "K%", -1],
  ["era", "ERA", -1],
  ["whip", "WHIP", -1],
  ["pavg", "Opp AVG", -1],
  ["k9", "K/IP", 1],
  ["bb9", "BB/IP", -1],
];

const WIN_BLURB = {
  all: "Better overall grade, more wins.",
  bat: "Clubs that hit better win more.",
  pit: "Clubs that pitch better win more.",
  avg: "Higher batting average tracks with winning.",
  obp: "Getting on base tracks with winning.",
  slg: "Extra-base hitting tracks with winning.",
  ops: "On-base plus slugging tracks with winning.",
  bb: "Drawing walks tracks with winning.",
  k: "Fewer punchouts at the plate track with winning.",
  era: "Lower ERA tracks with winning.",
  whip: "Fewer baserunners allowed track with winning.",
  pavg: "Keeping hitters off the barrel tracks with winning.",
  k9: "Missing bats on the mound tracks with winning.",
  bb9: "Fewer walks issued track with winning.",
};

function wAvg(rows, key, wOf) {
  let t = 0;
  let w = 0;
  for (const r of rows || []) {
    const n = scoutNum(r[key]);
    const wt = Number(wOf(r)) || 0;
    if (n == null || wt <= 0) continue;
    t += n * wt;
    w += wt;
  }
  return w ? t / w : null;
}

function totRate(rows, nKey, dOf) {
  let n = 0;
  let d = 0;
  for (const r of rows || []) {
    n += scoutNum(r[nKey]) || 0;
    d += Number(dOf(r)) || 0;
  }
  return d ? n / d : null;
}

function teamWinStats(team, marks) {
  const b = team.batters || [];
  const p = team.pitchers || [];
  const ab = (r) => scoutNum(r.ab);
  const tpa = (r) => scoutNum(r.tpa) || scoutNum(r.ab);
  const ip = (r) => pitchInnings(r.ip);
  return {
    all: marks.all,
    bat: marks.bat,
    pit: marks.pit,
    avg: wAvg(b, "avg", ab),
    obp: wAvg(b, "obp", tpa),
    slg: wAvg(b, "slg", ab),
    ops: wAvg(b, "ops", tpa),
    bb: totRate(b, "bb", tpa),
    k: totRate(b, "so", tpa),
    era: wAvg(p, "era", ip),
    whip: wAvg(p, "whip", ip),
    pavg: wAvg(p, "avg", ip),
    k9: totRate(p, "so", ip),
    bb9: totRate(p, "bb", ip),
  };
}

function pearson(xs, ys) {
  const n = xs.length;
  if (n < 4) return null;
  let sx = 0;
  let sy = 0;
  let xx = 0;
  let yy = 0;
  let xy = 0;
  for (let i = 0; i < n; i++) {
    sx += xs[i];
    sy += ys[i];
    xx += xs[i] * xs[i];
    yy += ys[i] * ys[i];
    xy += xs[i] * ys[i];
  }
  const den = Math.sqrt((n * xx - sx * sx) * (n * yy - sy * sy));
  return den ? (n * xy - sx * sy) / den : null;
}

function winCorrelates(teams) {
  const pitFill = leaguePitAvg(teams);
  const rows = [];
  for (const t of teams || []) {
    const marks = teamMarks(t, pitFill);
    if (recordPct(t) < 0 || marks.starBat || marks.starPit) continue;
    rows.push({ pct: recordPct(t), stats: teamWinStats(t, marks) });
  }
  if (rows.length < 4) return { n: rows.length, hits: [] };
  const hits = [];
  for (const [key, label, good] of WIN_STAT) {
    const xs = [];
    const ys = [];
    for (const row of rows) {
      const v = row.stats[key];
      if (v == null || !Number.isFinite(v)) continue;
      xs.push(v);
      ys.push(row.pct);
    }
    const r = pearson(xs, ys);
    if (r == null) continue;
    hits.push({ key, label, good, r, link: r * good, n: xs.length });
  }
  hits.sort((a, b) => b.link - a.link);
  return { n: rows.length, hits };
}

function winHead(label, key, pack) {
  const hit = ((pack && pack.hits) || []).find((h) => h.key === key && h.link >= 0.35);
  if (!hit) return `<span class="num muted">${label}</span>`;
  return `<span class="num" style="color:var(--cyan)" title="${label} tracks with wins (r ${hit.r.toFixed(2)})">${label}</span>`;
}

function winTrackHtml(teams, pack, kind) {
  const found = pack || winCorrelates(teams);
  const unit = kind === "history" ? "club-seasons" : "clubs";
  if (found.n < 4) return "";
  const drivers = found.hits.filter((h) => h.link >= 0.35).slice(0, 4);
  if (!drivers.length) {
    return `<p class="muted" style="margin:0.55rem 0 0">No stat clearly tracks with W-L yet across ${found.n} ${unit}.</p>`;
  }
  const rows = drivers
    .map((h) => {
      const txt = (h.r >= 0 ? "+" : "−") + Math.abs(h.r).toFixed(2);
      return `<div class="roster-row" style="grid-template-columns:4.6rem 3.2rem minmax(0,1fr)">
        <span class="tag">${escapeHtml(h.label)}</span>
        <span class="num" style="color:var(--go)">${txt}</span>
        <span class="muted">${escapeHtml(WIN_BLURB[h.key] || "Tracks with winning.")}</span>
      </div>`;
    })
    .join("");
  return `<div style="margin-top:0.85rem">
    <p class="kicker" style="margin:0 0 0.35rem">What tracks with wins</p>
    <div class="roster-list">${rows}</div>
    <p class="muted" style="margin:0.45rem 0 0">${escapeHtml(drivers[0].label)} is the strongest link to win% across ${found.n} ${unit} (Pearson r). Run differential is left off — it is wins in another form.</p>
  </div>`;
}

function histHash(season) {
  return "#/tourney-scout?event=historical" + (season && season !== "all" ? "&season=" + encodeURIComponent(season) : "");
}

function renderHistoryScout(data) {
  const cur = String((data && data.season) || "all");
  const chips =
    `<button class="btn${cur === "all" ? "" : " ghost"}" type="button" data-hist-season="all">All previous</button>` +
    ((data && data.seasons) || [])
      .map((s) => `<button class="btn${cur === String(s.id) ? "" : " ghost"}" type="button" data-hist-season="${escapeHtml(s.id)}">${escapeHtml(s.label)}</button>`)
      .join("");
  const list = (data && data.teams) || [];
  const pack = winCorrelates(list);
  return `
    <p class="kicker">Locker room</p>
    <h1>Tournament rankings</h1>
    <p class="lede">${escapeHtml((data && data.note) || "Previous PLW leagues.")} Same win-tracking as a tournament board, across past league seasons. <a href="${escapeHtml((data && data.source) || "https://www.mystatsonline.com/ballsports/visitor/league/stats/batter.aspx?IDLeague=61713")}" target="_blank" rel="noopener">MyStatsOnline</a></p>
    <div class="actions" data-tourney-events style="margin-top:0.7rem">${tourneyEventMenu(data)}</div>
    <div class="actions" data-hist-seasons style="margin-top:0.55rem">${chips}</div>
    <div id="scout-pane" style="margin-top:1rem">${cur === "all" ? histAllPane(data, pack) : histSeasonPane(data, pack)}</div>
  `;
}

function histAllPane(data, pack) {
  const by = {};
  for (const t of (data && data.teams) || []) {
    if (!t.histSeason) continue;
    (by[t.histSeason] || (by[t.histSeason] = [])).push(t);
  }
  const rows = ((data && data.seasons) || [])
    .map((s) => {
      const p = winCorrelates(by[String(s.id)] || []);
      const top = (p.hits || []).find((h) => h.link >= 0.35);
      const rtxt = top ? (top.r >= 0 ? "+" : "−") + Math.abs(top.r).toFixed(2) + " " + top.label : "—";
      return `<a class="roster-row" href="${histHash(s.id)}" style="grid-template-columns:minmax(0,1fr) 3.2rem 7rem;text-decoration:none;color:inherit">
        <span style="text-align:left;overflow:hidden"><strong style="display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${escapeHtml(s.label)}</strong></span>
        <span class="num">${p.n}</span>
        <span class="num" style="color:var(--cyan)">${escapeHtml(rtxt)}</span>
      </a>`;
    })
    .join("");
  return `
    <div class="diamond-card card">
      <p class="kicker">Board</p>
      <h2 style="margin:0 0 0.15rem">All previous leagues</h2>
      ${winTrackHtml((data && data.teams) || [], pack, "history")}
      <p class="kicker" style="margin:0.85rem 0 0.35rem">By season</p>
      <div class="roster-list">
        <div class="roster-row" style="grid-template-columns:minmax(0,1fr) 3.2rem 7rem"><span class="muted" style="text-align:left">League</span><span class="num muted">Clubs</span><span class="num muted">Top link</span></div>
        ${rows}
      </div>
      <p class="muted" style="margin:0.55rem 0 0">Pooled from Seasons 1–6 and Challengers. Tap a season for that year’s board.</p>
    </div>
  `;
}

function histSeasonPane(data, pack) {
  const list = (data && data.teams) || [];
  const pitFill = leaguePitAvg(list);
  const teams = rankByRecord(list).map((t) => ({ team: t, marks: teamMarks(t, pitFill) }));
  const cols = "2.2rem minmax(6.5rem,1.4fr) 3.4rem 3rem 2.8rem 2.8rem 2.8rem";
  const head = `<div class="roster-row" style="grid-template-columns:${cols}">
    <span class="muted">#</span><span class="muted" style="text-align:left">Team</span><span class="num muted">W-L</span><span class="num muted">PCT</span>${winHead("BAT", "bat", pack)}${winHead("PIT", "pit", pack)}${winHead("ALL", "all", pack)}
  </div>`;
  const rows = teams
    .map((row, i) => {
      const t = row.team;
      const pct = recordPct(t);
      return `<div class="roster-row" style="grid-template-columns:${cols}">
        <span class="num">${i + 1}</span>
        <span style="text-align:left;overflow:hidden"><strong style="display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${escapeHtml(t.name)}</strong></span>
        <span class="num">${wlCell(t)}</span>
        <span class="num">${pct < 0 ? `<span class="muted">—</span>` : pct.toFixed(3).replace(/^0/, "")}</span>
        <span class="num">${markCell(row.marks.bat)}</span>
        <span class="num">${markCell(row.marks.pit)}</span>
        <span class="num">${markCell(row.marks.all)}</span>
      </div>`;
    })
    .join("");
  return `
    <div class="diamond-card card">
      <p class="kicker">Board</p>
      <h2 style="margin:0 0 0.55rem">${escapeHtml((data && data.label) || "Season")}</h2>
      <p class="kicker" style="margin:0 0 0.35rem">Clubs by record</p>
      <div class="roster-list">${head}${rows || '<p class="muted">No standings for this season.</p>'}</div>
      ${winTrackHtml(list, pack)}
    </div>
  `;
}

function bindTourneyScout(event) {
  const ev = event || "overall";
  document.querySelectorAll("[data-tourney-event]").forEach((btn) => {
    btn.addEventListener("click", () => {
      location.hash = tourneyHash("", btn.dataset.tourneyEvent);
    });
  });
  document.querySelectorAll("[data-scout-team]").forEach((btn) => {
    btn.addEventListener("click", () => {
      location.hash = tourneyHash(btn.dataset.scoutTeam, ev);
    });
  });
  document.querySelectorAll("[data-hist-season]").forEach((btn) => {
    btn.addEventListener("click", () => {
      location.hash = histHash(btn.dataset.histSeason);
    });
  });
}

function tourneyGames(offer) {
  const d = offer && (offer.date || offer.day);
  if (d === "2026-08-29") {
    return [
      { time: "10:00 AM", field: "Grass Field", vs: "Marauders" },
      { time: "11:00 AM", field: "Main Field", vs: "Blitz" },
      { time: "2:00 PM", field: "Main Field", vs: "Savages" },
    ];
  }
  return [];
}

function renderTourneyPack() {
  return `
    <section class="card" style="margin-top:1rem">
      <p class="kicker">Aug 29 · End of Summer Showdown</p>
      <h2>Pools and schedule</h2>
      <p class="muted">Pool B: Blitz, Savages, Wizards, Marauders. We play Marauders 10 AM Grass, Blitz 11 AM Main, Savages 2 PM Main. Playoffs 3–5 PM on turf.</p>
      <img src="/media/eos-showdown-pools.jpg?v=3" alt="August 29 tournament pools and schedule" style="width:100%;max-width:40rem;height:auto;border-radius:10px;margin:0.55rem 0 0;display:block" />
    </section>`;
}

async function fillTourneyMatchups(host, offer, oursNames) {
  const games = tourneyGames(offer);
  if (!host || !games.length) return false;
  host.innerHTML = `<div class="diamond-card card" style="margin-top:1rem"><p class="muted">Loading Pool B matchups from tournament boards…</p></div>`;
  try {
    const [data, league] = await Promise.all([
      api.get("/api/plw-tourney?event=overall"),
      api.get("/api/plw-league").catch(() => ({ teams: [] })),
    ]);
    const book = (data && data.teams) || [];
    const lg = {};
    for (const t of (league && league.teams) || []) lg[t.code] = t;
    for (const t of book) {
      if (!lg[t.code]) continue;
      t.lw = lg[t.code].w;
      t.ll = lg[t.code].l;
    }
    const pitFill = leaguePitAvg(book);
    const ranked = rankedTeams(book);
    const us = ranked.find((t) => t.code === "WIZ");
    const usRank = us ? ranked.findIndex((t) => t.code === "WIZ") + 1 : "—";
    host.innerHTML =
      renderTourneyPack() +
      games
        .map((g) => {
          const them = matchScoutTeam(ranked, g.vs);
          if (!us || !them) {
            return `<div class="diamond-card card" style="margin-top:1rem"><p class="kicker">${escapeHtml(g.time)} · ${escapeHtml(g.field)}</p><h2>vs ${escapeHtml(g.vs)}</h2><p class="muted">No tournament board for ${escapeHtml(g.vs)} yet.</p></div>`;
          }
          const themRank = ranked.findIndex((t) => t.code === them.code) + 1;
          return `<p class="kicker" style="margin:1.1rem 0 0">${escapeHtml(g.time)} · ${escapeHtml(g.field)}</p>${renderMatchup(us, them, usRank, themRank, pitFill, book, oursNames || [], null, offer)}`;
        })
        .join("");
  } catch (err) {
    host.innerHTML = `<div class="diamond-card card" style="margin-top:1rem"><p class="muted">${escapeHtml(err.message || "Could not load tournament boards.")}</p></div>`;
  }
  return true;
}
