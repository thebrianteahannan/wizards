function onSquad(p, squad) {
  const s = p.squads || ["league"];
  return s.includes(squad);
}

function nextProposed(avail) {
  const today = new Date().toISOString().slice(0, 10);
  const upcoming = [...(avail.offers || [])]
    .filter((o) => o.date && o.date >= today)
    .sort((a, b) => a.date.localeCompare(b.date));
  if (!upcoming.length) return null;
  const locked = avail.lockedNight;
  if (locked) {
    const hit = upcoming.find((o) => o.day === locked.day || o.date === locked.day);
    if (hit) return hit;
  }
  return upcoming[0];
}

function offerKey(offer, kind) {
  return kind === "tournament" ? offer.date || offer.day : offer.day;
}

function playerMark(avail, playerId, offer, kind) {
  if (!avail || !offer) return "";
  const entry = (((avail.players || {})[playerId] || {}).days || {})[offerKey(offer, kind)] || {};
  return entry.status === "yes" || entry.status === "maybe" ? entry.status : "";
}

function rosterRows(players) {
  return players
    .map((p) => {
      const pos = (p.positions || []).join(", ") || "Util";
      return `
        <div class="roster-row">
          <strong>${escapeHtml(p.name)}</strong>
          <span class="num">${p.number != null ? "#" + p.number : "—"}</span>
          <span class="tag">${escapeHtml(pos)}</span>
          <span class="muted">${p.born ? escapeHtml(p.born) : ""}</span>
        </div>`;
    })
    .join("");
}

function rosterDiamond(players, svgId, marks, offer) {
  const spots = [
    { key: "CF", codes: ["CF"], left: "50%", top: "10%" },
    { key: "LF", codes: ["LF"], left: "16%", top: "22%" },
    { key: "RF", codes: ["RF"], left: "84%", top: "22%" },
    { key: "SS", codes: ["SS"], left: "32%", top: "40%" },
    { key: "2B", codes: ["2B"], left: "68%", top: "40%" },
    { key: "P", codes: ["P"], left: "50%", top: "58%" },
    { key: "C", codes: ["C"], left: "50%", top: "90%" },
  ];
  const placed = new Set();
  const diamondSpots = spots
    .map((spot) => {
      const here = players.filter((p) => (p.positions || []).some((pos) => spot.codes.includes(pos)));
      here.forEach((p) => placed.add(p.id));
      if (!here.length && spot.key !== "P") {
        return `<div class="spot empty" style="left:${spot.left};top:${spot.top}"><small>${spot.key}</small></div>`;
      }
      const anyYes = here.some((p) => marks[p.id] === "yes");
      const anyMaybe = here.some((p) => marks[p.id] === "maybe");
      const glow = anyYes ? " going" : anyMaybe ? " maybe-go" : "";
      const names = here
        .map((p) => `<b class="${marks[p.id] || ""}">${escapeHtml(p.name)}</b>`)
        .join("");
      return `<div class="spot${glow}" style="left:${spot.left};top:${spot.top}"><small>${spot.key}</small>${names || "<span class='muted'>—</span>"}</div>`;
    })
    .join("");
  const bench = players.filter((p) => !placed.has(p.id));
  const benchHtml = bench
    .map((p) => `<span class="chip ${marks[p.id] || ""}">${escapeHtml(p.name)}</span>`)
    .join("");
  const when = offer
    ? new Date(offer.date + "T12:00:00").toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })
    : "";
  const note = offer
    ? `<p class="muted">Next up: <strong>${escapeHtml(when)}</strong> · ${escapeHtml(offer.note)}. Cyan is yes, gold is maybe.</p>`
    : `<p class="muted">Bench / unassigned</p>`;
  return `
    <div class="diamond-card card">
      <p class="kicker">Defense</p>
      <div class="diamond">
        <svg class="diamond-lines" viewBox="0 0 100 100" aria-hidden="true">
          <defs>
            <linearGradient id="${svgId}" x1="0" y1="0" x2="1" y2="1">
              <stop stop-color="#c026ff"/><stop offset="1" stop-color="#22d3ee"/>
            </linearGradient>
          </defs>
          <path d="M8 58 Q50 4 92 58" fill="none" stroke="rgba(34,211,238,0.28)" stroke-width="1.2"/>
          <path d="M50 88 L82 56 L50 28 L18 56 Z" fill="rgba(192,38,255,0.08)" stroke="url(#${svgId})" stroke-width="1.4"/>
          <circle cx="50" cy="58" r="5" fill="none" stroke="#22d3ee" stroke-width="1.1"/>
          <path d="M18 56 L50 88 L82 56" fill="none" stroke="rgba(240,193,75,0.45)" stroke-width="0.8"/>
        </svg>
        ${diamondSpots}
      </div>
      ${note}
      <div class="chips">${benchHtml || '<span class="muted">Everybody has a spot</span>'}</div>
    </div>`;
}

function renderRosterEmbed(roster, squad, leagueAvail, tourneyAvail, svgId, heading) {
  squad = squad === "tournament" ? "tournament" : "league";
  const players = roster.players.filter((p) => onSquad(p, squad));
  const leagueOn = squad === "league";
  const avail = leagueOn ? leagueAvail || {} : tourneyAvail || {};
  const offer = nextProposed(avail);
  const marks = {};
  if (offer) {
    for (const p of players) marks[p.id] = playerMark(avail, p.id, offer, squad);
  }
  const blurb = leagueOn
    ? "Florida Challengers League · need 6 to take a night · cap 12"
    : "PLW Saturday events · Aug 1 packet and onward";
  const title = heading === "h2" ? "h2" : "h1";
  return `
    <div id="roster-embed" data-svg="${escapeHtml(svgId || "dg-roster")}">
      <div class="sched-bar">
        <div>
          <p class="kicker">${escapeHtml(roster.league)} · ${escapeHtml(roster.season)}</p>
          <${title}>Roster</${title}>
        </div>
        <div class="squad-switch" role="group" aria-label="Roster type">
          <button type="button" class="btn ${leagueOn ? "" : "ghost"}" data-squad="league">League</button>
          <button type="button" class="btn ${leagueOn ? "ghost" : ""}" data-squad="tournament">Tournament</button>
        </div>
      </div>
      <p class="muted">${blurb}</p>
      <div class="roster-layout">
        ${rosterDiamond(players, svgId || "dg-roster", marks, offer)}
        <div class="roster-list">${rosterRows(players)}</div>
      </div>
    </div>
  `;
}

function renderRoster(roster, squad, leagueAvail, tourneyAvail) {
  return `
    <p class="lede">League nights and Saturday tournaments are different books. Co-managers: Tony Kurtanick and Brian Hannan.</p>
    ${isTeam() ? `<div class="actions" style="margin:0.7rem 0 0"><button class="btn ghost" type="button" id="show-phones">Phone numbers</button></div><div id="phone-list" class="card phone-list" hidden></div>` : ""}
    ${renderRosterEmbed(roster, squad, leagueAvail, tourneyAvail, "dg-roster", "h1")}
  `;
}

function bindRoster(roster, leagueAvail, tourneyAvail) {
  document.querySelectorAll("[data-squad]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const squad = btn.dataset.squad;
      localStorage.setItem("wizardsRosterSquad", squad);
      const box = document.getElementById("roster-embed");
      const svgId = (box && box.dataset.svg) || "dg-roster";
      const heading = box && box.querySelector("h2") ? "h2" : "h1";
      if (box) box.outerHTML = renderRosterEmbed(roster, squad, leagueAvail, tourneyAvail, svgId, heading);
      bindRoster(roster, leagueAvail, tourneyAvail);
      if (window.bootVisuals) window.bootVisuals();
    });
  });
  bindPhones(roster);
}
