function shortWhen(iso) {
  const p = String(iso || "").split("-");
  const mo = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  if (p.length < 3 || !mo[Number(p[1]) - 1]) return iso || "";
  return mo[Number(p[1]) - 1] + " " + Number(p[2]);
}

function bindLeaderToggle() {
  const more = document.querySelector("[data-leaders-all]");
  if (!more || more.dataset.bound === "1") return;
  more.dataset.bound = "1";
  more.addEventListener("click", () => {
    const open = more.dataset.open !== "1";
    document.querySelectorAll("[data-leader-rest]").forEach((row) => { row.style.display = open ? "" : "none"; });
    more.dataset.open = open ? "1" : "";
    more.textContent = open ? "Top 10" : "All bats & arms";
  });
}

function gameSeasonQuery() {
  const hash = location.hash;
  const event = new URLSearchParams((hash.split("?")[1] || "")).get("event") || "overall";
  if (hash.indexOf("/overall-scout") >= 0) return "110335,110274,110567";
  if (hash.indexOf("/tourney-scout") < 0) return "110335";
  if (event === "aug1") return "110274";
  if (event === "marathon") return "110567";
  if (event === "historical") return "";
  return "110274,110567";
}

function whoLine(label, rows, ours) {
  const text = (rows || []).map((p) => {
    const bit = escapeHtml(p.name) + " " + p.rate;
    return ours ? `<strong style="color:var(--cyan)">${bit}</strong>` : bit;
  }).join(" · ");
  return `<p class="muted" style="margin:0.12rem 0 0;font-size:0.72rem">${label} ${text || "—"}</p>`;
}

function gameLogHtml(games, ours) {
  if (!games.length) return `<p class="muted">No box scores posted for this club yet.</p>`;
  const cols = "4.6rem minmax(0,1fr) 4.4rem 2.4rem 2.4rem 2.6rem";
  const head = `<div class="roster-row" style="grid-template-columns:${cols}"><span class="muted">Date</span><span class="muted" style="text-align:left">Opp</span><span class="num muted">W-L</span><span class="num muted">BAT</span><span class="num muted">PIT</span><span class="num muted">ALL</span></div>`;
  const rows = games
    .map((g) => {
      return `<div class="roster-row" style="grid-template-columns:${cols}"><span>${escapeHtml(shortWhen(g.date))}</span><span style="text-align:left">${escapeHtml(g.opp || "")}</span><span class="num">${escapeHtml(g.mark || "")} ${g.us}-${g.them}</span><span class="num" title="At-bat weighted hitting">${markCell(g.bat)}</span><span class="num" title="Inning weighted pitching">${markCell(g.pit)}</span><span class="num" title="55% hitting, 45% pitching">${markCell(g.all)}</span></div>${whoLine("Bats", g.hitters, ours)}${whoLine("Arms", g.pitchers, ours)}`;
    })
    .join("");
  return `<div class="roster-list">${head}${rows}</div>`;
}

async function loadGameLog() {
  const host = document.getElementById("game-log");
  if (!host || host.dataset.loading === "1") return;
  const code = host.dataset.team || "";
  const season = gameSeasonQuery();
  if (!code || !season) return;
  host.dataset.loading = "1";
  host.innerHTML = `<p class="kicker">Games</p><p class="muted">Loading a rating for each game…</p>`;
  try {
    const data = await api.get("/api/plw-games?team=" + encodeURIComponent(code) + "&season=" + encodeURIComponent(season));
    const games = (data && data.games) || [];
    host.innerHTML = `<p class="kicker">Games</p><h2 style="margin:0 0 0.55rem">Each game</h2>${gameLogHtml(games, code === "WIZ")}`;
  } catch (err) {
    host.innerHTML = `<p class="kicker">Games</p><p class="muted">${escapeHtml(err.message || "Could not load games.")}</p>`;
  }
  host.dataset.loading = "";
}
