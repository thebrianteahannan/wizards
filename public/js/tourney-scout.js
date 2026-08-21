function tourneyHash(code) {
  return !code || code === "overview" ? "#/tourney-scout" : "#/tourney-scout?team=" + encodeURIComponent(code);
}

function tourneyOverview(data) {
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
      return `<a class="roster-row" href="${tourneyHash(t.code)}" style="grid-template-columns:${cols};text-decoration:none;color:inherit${glow}">
        <span class="num">${i + 1}</span>
        <span style="text-align:left"><strong${us ? ' style="color:var(--cyan)"' : ""}>${escapeHtml(t.name)}</strong></span>
        <span class="num" title="Hitting">${markCell(row.marks.bat)}</span>
        <span class="num" title="Pitching">${markCell(row.marks.pit)}</span>
        <span class="num" title="Overall">${markCell(row.marks.all)}</span>
      </a>`;
    })
    .join("");
  return `
    <div class="diamond-card card">
      <p class="kicker">Board</p>
      <h2 style="margin:0 0 0.55rem">Overview</h2>
      <div class="grid-3">
        <div><p class="kicker" style="margin:0 0 0.35rem">Clubs</p><div class="roster-list">${head}${rows || '<p class="muted">No tourney lines posted yet.</p>'}</div></div>
        <div><p class="kicker" style="margin:0 0 0.35rem">Top bats</p><div class="roster-list">${topLeaders(list, "batters", hitterRating, ratingTone)}</div></div>
        <div><p class="kicker" style="margin:0 0 0.35rem">Top arms</p><div class="roster-list">${topLeaders(list, "pitchers", pitchRating, pitchTone)}</div></div>
      </div>
      <p class="muted" style="margin:0.55rem 0 0">2026 Tourney Season. Cyan made the top 10. We always tack on our next bat and arm. Gold is tied or within 2 of 10th. Dim dashed is further back.</p>
    </div>
  `;
}

function renderTourneyScout(data, code) {
  const pitFill = leaguePitAvg((data && data.teams) || []);
  const teams = rankedTeams((data && data.teams) || []);
  const pick = code && code !== "overview" ? teams.find((t) => t.code === code) : null;
  const href = (data && data.source) || "https://www.mystatsonline.com/ballsports/visitor/league/stats/batter.aspx?IDLeague=61713&IDSeason=110274";
  const menu = scoutMenu(teams, pick ? pick.code : "overview");
  return `
    <p class="kicker">Locker room</p>
    <h1>Tournament rankings</h1>
    <p class="lede">${escapeHtml((data && data.note) || "2026 Tourney Season by club.")} Hitting is weighted by at-bats. Pitching is weighted by innings. Overall is 55% bats / 45% arms. <a href="${escapeHtml(href)}" target="_blank" rel="noopener">MyStatsOnline</a></p>
    <div class="actions" data-scout-menu style="margin-top:0.7rem">${menu}</div>
    <div id="scout-pane" style="margin-top:1rem">${pick ? scoutPane(pick, pitFill, data && data.teams) : tourneyOverview(data)}</div>
    <div class="actions" data-scout-menu style="margin-top:1rem">${menu}</div>
  `;
}

function bindTourneyScout() {
  document.querySelectorAll("[data-scout-team]").forEach((btn) => {
    btn.addEventListener("click", () => {
      location.hash = tourneyHash(btn.dataset.scoutTeam);
    });
  });
}
