const DAYS_META = [
  ["monday", "Mon"],
  ["tuesday", "Tue"],
  ["wednesday", "Wed"],
  ["thursday", "Thu"],
  ["friday", "Fri"],
  ["saturday", "Sat"],
  ["sunday", "Sun"],
];

function renderHome(roster, schedule, avail, fees) {
  const locked = avail.lockedNight;
  const today = new Date().toISOString().slice(0, 10);
  const next = (schedule.events || []).find((e) => e.date >= today) || (schedule.events || []).at(-1);
  const consensus = bestDays(roster, avail);
  const best = consensus[0];
  const sparks = DAYS_META.map(([day, label]) => {
    const t = tallySlot(avail, day, "evening");
    const pct = Math.min(100, Math.round(((t.yes || 0) / 6) * 100));
    return `<span class="spark" title="${label}"><i style="height:${pct}%"></i></span>`;
  }).join("");
  const team = isTeam();
  const hudNight = team && best ? `${best.yes}/6 · ${cap(best.day)}` : "Wizards";
  const actions = team
    ? `<a class="btn" href="#/availability">Set your nights</a><a class="btn ghost" href="#/board">Announcements</a>`
    : `<a class="btn" href="#/join">Join the team</a><a class="btn ghost" href="#/roster">Roster</a>`;
  const nightCard = team
    ? `<a class="card feature" href="#/availability"><span class="icon">◉</span><h3>League night</h3><p class="muted">Lock six bodies on one window.</p><div class="sparks" aria-hidden="true">${sparks}</div></a>`
    : `<a class="card feature" href="#/league"><span class="icon">◉</span><h3>The league</h3><p class="muted">Florida Challengers League in Brooksville.</p></a>`;
  const duesCard = team
    ? `<a class="card feature" href="#/dues"><span class="icon">$</span><h3>Dues</h3><p class="muted">${fees && fees.model === "flat" ? money(fees.flatAmount) + " flat for the year" : "$250 team bill"}</p></a>`
    : `<a class="card feature" href="#/gear"><span class="icon">$</span><h3>Gear</h3><p class="muted">Purple kits. Turf shoes. Request a jersey.</p></a>`;
  const duesStat = team
    ? `<a class="card stat" href="#/dues"><b>${fees ? money(fees.model === "flat" ? fees.flatAmount : fees.teamTotal) : "$250"}</b>${fees && fees.model === "flat" ? "flat dues this year" : "team fee for the year"}</a>`
    : `<article class="card stat"><b>$250</b>team fee for the year</article>`;
  const pulse = team
    ? `<article class="card"><p class="kicker">Availability pulse</p><h2>${best && best.yes >= 6 ? "We can field a night" : "Still hunting a night"}</h2><p>${best ? `<span class="${best.yes >= 6 ? "ok" : "warn"}">${best.yes} yes / ${best.maybe} maybe</span> on ${cap(best.day)} ${best.window}` : "Nobody has filled nights yet. Grab League Night and tap your week."}</p><p class="muted">Fall league is flexible weeknights and weekends until the lights are fully in.</p></article>`
    : `<article class="card"><p class="kicker">Club only</p><h2>Team tools stay locked</h2><p class="muted">League Night, announcements, and dues open with the team password in the header.</p></article>`;
  return `
    ${team && locked ? `<div class="banner"><strong>League night locked:</strong> ${escapeHtml(cap(locked.day))} ${escapeHtml(locked.window)} — set by ${escapeHtml(locked.lockedBy)}</div>` : ""}
    <section class="hero">
      <div class="hero-copy">
        <p class="kicker">Florida Challengers League · Fall 2026</p>
        <h1>Six on.<br /><span class="grad-text">Lights out.</span></h1>
        <p class="lede">Purple pinstripes, yellow bats, six on the field. This is the Wizards control deck — roster, league nights, and the Brooksville run toward the January PLW weeknight league.</p>
        <p class="muted">Co-managers Tony Kurtanick and Brian Hannan. ${roster.players.length} on the book. Need <strong>6 players the same night</strong> to take a league game.</p>
        <div class="actions">
          ${actions}
        </div>
      </div>
      <div class="hero-stage">
        <div class="hud hud-tl">
          <small>Field status</small>
          <b><span class="ring"></span>${escapeHtml(hudNight)}</b>
        </div>
        <figure class="hero-art">
          <img src="/media/jersey-mockup.jpg" alt="Wizards of Wiff pinstripe jersey mockup" />
          <figcaption>Option 5: Pinstripe Wizard Alternate — purple, gold, and smoke.</figcaption>
        </figure>
        <div class="hud hud-br">
          <small>Next on deck</small>
          <b>${next ? escapeHtml(next.title.replace(" — ", " · ").slice(0, 28)) : "TBD"}</b>
        </div>
      </div>
    </section>
    <section class="feature-rail">
      ${nightCard}
      <a class="card feature" href="#/schedule">
        <span class="icon">▣</span>
        <h3>Schedule</h3>
        <p class="muted">${next ? fmtDate(next.date) + " · " + escapeHtml(next.when) : "Calendar loading"}</p>
      </a>
      <a class="card feature" href="#/gear">
        <span class="icon">✦</span>
        <h3>Jersey request</h3>
        <p class="muted">Number, size, purple kit.</p>
      </a>
      ${duesCard}
      <a class="card feature" href="#/roster">
        <span class="icon">☰</span>
        <h3>Roster</h3>
        <p class="muted">${roster.players.length} Wizards · cap 12 · need 6</p>
      </a>
      <a class="card feature" href="#/media">
        <span class="icon">◈</span>
        <h3>Media</h3>
        <p class="muted">Kits, K-zone, Brooksville film.</p>
      </a>
    </section>
    <section class="grid-3" style="margin-top:1rem">
      <article class="card stat"><b>${roster.players.length}</b>rostered Wizards</article>
      <article class="card stat"><b>6</b>needed for league night</article>
      ${duesStat}
    </section>
    <section class="grid-2" style="margin-top:1rem">
      <article class="card">
        <p class="kicker">Next on the calendar</p>
        <h2>${next ? escapeHtml(next.title) : "No events"}</h2>
        <p>${next ? fmtDate(next.date) + " · " + escapeHtml(next.when) : ""}</p>
        <p class="muted">${next ? escapeHtml(next.detail) : ""}</p>
        <a href="#/schedule">Full schedule</a>
      </article>
      ${pulse}
    </section>
    <section class="grid-2" style="margin-top:1rem">
      <figure class="hero-art" style="min-height:220px">
        <img src="/media/jerseys-box.jpg" alt="Wizards jerseys in a box, logo up" />
        <figcaption>Kits arrived. Wizard, bat, and a wiffle ball on the chest.</figcaption>
      </figure>
      <article class="card">
        <p class="kicker">What this season is</p>
        <h2>Ramp-up now. Real league in Feb.</h2>
        <p>PLW’s Florida Challengers League runs through December 4 in Brooksville. Stats, attendance, and how we show up all feed the January 2027 weeknight stream league. Jerseys are in. Turf shoes are approved. Opening night already hit Twitch.</p>
        <div class="actions">
          <a class="btn ghost" href="#/league">Rules &amp; stream</a>
          <a class="btn ghost" href="#/media">Gallery</a>
        </div>
      </article>
    </section>
  `;
}

function onSquad(p, squad) {
  const s = p.squads || ["league"];
  return s.includes(squad);
}

function rosterRows(players) {
  return players
    .map((p) => {
      const pos = (p.positions || []).join(", ") || "Util";
      return `
        <div class="roster-row">
          <strong>${escapeHtml(p.name)}</strong>
          <span class="num">${p.number != null ? "#" + p.number : "—"}</span>
          <span class="role">${escapeHtml(p.role)}</span>
          <span class="tag">${escapeHtml(pos)}</span>
          <span class="muted">${p.born ? escapeHtml(p.born) : ""}</span>
        </div>`;
    })
    .join("");
}

function rosterDiamond(players, svgId) {
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
      const names = here
        .map((p) => `<b>${escapeHtml(p.name)}</b>`)
        .join("");
      return `<div class="spot" style="left:${spot.left};top:${spot.top}"><small>${spot.key}</small>${names || "<span class='muted'>—</span>"}</div>`;
    })
    .join("");
  const bench = players.filter((p) => !placed.has(p.id));
  const benchHtml = bench.map((p) => `<span class="chip">${escapeHtml(p.name)}</span>`).join("");
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
      <p class="muted" style="margin-top:0.6rem">Bench / unassigned</p>
      <div class="chips">${benchHtml || '<span class="muted">Everybody has a spot</span>'}</div>
    </div>`;
}

function renderRoster(roster, squad) {
  squad = squad === "tournament" ? "tournament" : "league";
  const players = roster.players.filter((p) => onSquad(p, squad));
  const leagueOn = squad === "league";
  const blurb = leagueOn
    ? "Florida Challengers League · need 6 to take a night · cap 12"
    : "PLW Saturday events · Aug 1 packet and onward";
  return `
    <div class="sched-bar">
      <div>
        <p class="kicker">${escapeHtml(roster.league)} · ${escapeHtml(roster.season)}</p>
        <h1>Roster</h1>
      </div>
      <div class="squad-switch" role="group" aria-label="Roster type">
        <button type="button" class="btn ${leagueOn ? "" : "ghost"}" data-squad="league">League</button>
        <button type="button" class="btn ${leagueOn ? "ghost" : ""}" data-squad="tournament">Tournament</button>
      </div>
    </div>
    <p class="lede">League nights and Saturday tournaments are different books. Co-managers: Tony Kurtanick and Brian Hannan.</p>
    <p class="muted">${blurb}</p>
    <div class="roster-layout">
      ${rosterDiamond(players, "dg-roster")}
      <div class="roster-list">${rosterRows(players)}</div>
    </div>
  `;
}

function bindRoster(roster) {
  document.querySelectorAll("[data-squad]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const squad = btn.dataset.squad;
      localStorage.setItem("wizardsRosterSquad", squad);
      document.getElementById("app").innerHTML = renderRoster(roster, squad);
      bindRoster(roster);
      if (window.bootVisuals) window.bootVisuals();
    });
  });
}

function renderSchedule(schedule, avail, view, monthKey) {
  view = view || localStorage.getItem("wizardsSchedView") || "calendar";
  const events = schedule.events || [];
  const first = events[0] && events[0].date ? events[0].date.slice(0, 7) : "2026-08";
  monthKey = monthKey || localStorage.getItem("wizardsSchedMonth") || first;
  const locked = avail.lockedNight;
  const lock = locked
    ? `<div class="banner">Standing league night: <strong>${cap(locked.day)} ${escapeHtml(locked.window)}</strong> (${escapeHtml(locked.lockedBy)})</div>`
    : `<p class="notice">No standing league night yet. Need ${schedule.leagueNight.needed} at the same time.</p>`;
  const list = events
    .map((e) => `
      <article class="event ${e.status}">
        <time datetime="${escapeHtml(e.date)}">${fmtDate(e.date)}</time>
        <div>
          <div class="kind">${escapeHtml(e.kind)} · ${escapeHtml(e.status)}</div>
          <h3>${escapeHtml(e.title)}</h3>
          <p>${escapeHtml(e.when)}${e.detail ? ` <span class="muted">· ${escapeHtml(e.detail)}</span>` : ""}${e.link ? ` · <a href="${escapeHtml(e.link)}" target="_blank" rel="noopener">Watch</a>` : ""}</p>
        </div>
      </article>`)
    .join("");
  return `
    <div class="sched-bar">
      <div>
        <p class="kicker">Brooksville · PLW calendar</p>
        <h1>Schedule</h1>
      </div>
      <button class="btn ghost" type="button" id="sched-view">${view === "calendar" ? "List view" : "Calendar view"}</button>
    </div>
    <p class="lede">${isTeam() ? `Tournaments and league dates. Recurring weeknight is chosen on <a href="#/availability">League Night</a> once six Wizards overlap.` : "Tournaments and league dates on the PLW calendar."}</p>
    ${isTeam() ? lock : ""}
    ${view === "calendar" ? renderCalendarMonth(events, monthKey) : `<div class="timeline" style="margin-top:1rem">${list}</div>`}
  `;
}

function renderMedia() {
  const shots = [
    ["jersey-mockup.jpg", "Pinstripe Wizard alternate jersey — front and back."],
    ["jerseys-box.jpg", "Kits in the box: wizard crest, stars, wiffle ball."],
    ["field-selfie.jpg", "Field day — turf, batting mat, Spanish moss."],
    ["batting-stance.jpg", "In the box, yellow bat, white PVC fence."],
    ["batting-followthrough.jpg", "Swing through. Prodigy on the back."],
    ["pitching-windup.jpg", "Windup from the rubber."],
    ["pitching-set.jpg", "Set position, ball in hand."],
    ["strike-zone.jpg", "K-zone / Blitzball target for backyard work."],
    ["backstop-frame.jpg", "DIY PVC frame going up."],
    ["turf-shoes.jpg", "Approved 3n2 MOFO turf shoe."],
    ["league-texts.png", "PLW opening notes and team texts."],
    ["roster-fcl.jpg", "FCL roster board."],
  ];
  const figs = shots
    .map(
      ([src, cap]) => `
      <a href="/media/${src}" target="_blank" rel="noopener">
        <figure>
          <img src="/media/${src}" alt="${escapeHtml(cap)}" />
          <figcaption>${escapeHtml(cap)}</figcaption>
        </figure>
      </a>`
    )
    .join("");
  return `
    <p class="kicker">Gallery</p>
    <h1>Media</h1>
    <p class="lede">Jerseys, the ranch, backyard K-zone, and the road to Brooksville.</p>
    <div class="media-grid" style="margin-top:1rem">${figs}</div>
  `;
}

function renderGear(roster, jerseys) {
  const savedId = localStorage.getItem("wizardsPlayerId") || roster.players[0].id;
  const mine = (jerseys.requests || []).find((r) => r.playerId === savedId);
  const options = roster.players
    .map((p) => `<option value="${p.id}" ${p.id === savedId ? "selected" : ""}>${escapeHtml(playerLabel(p))}</option>`)
    .join("");
  const sizes = ["S", "M", "L", "XL", "2XL", "3XL"]
    .map((s) => `<option ${mine && mine.size === s ? "selected" : ""}>${s}</option>`)
    .join("");
  const taken = takenJerseyNumbers(roster, jerseys);
  const takenNote = taken.length
    ? `Already spoken for: ${taken.map((t) => "#" + t.number + " " + t.name).join(" · ")}`
    : "No numbers claimed yet besides the ones on the FCL book.";
  const rows = (jerseys.requests || [])
    .map(
      (r) => `
      <article class="card post">
        <p class="meta">${escapeHtml(r.playerName)}</p>
        <h3>#${escapeHtml(r.number)} · ${escapeHtml(r.size)}</h3>
      </article>`
    )
    .join("");
  const selected = roster.players.find((p) => p.id === savedId);
  const defaultNum = mine ? mine.number : selected && selected.number != null ? selected.number : "";
  return `
    <p class="kicker">Locker</p>
    <h1>Gear</h1>
    <div class="grid-2" style="margin-top:1rem">
      <article class="card">
        <h2>Jerseys</h2>
        <p>Deep purple pinstripe alternate with the wizard crest — pointed hat, wooden bat, wiffle ball, gold “WIFF!”. White shoulders, PLW patch, tournament patch. Matching kits matter for photos and the best-dressed purse at the End of Summer Showdown.</p>
        <p class="muted">Wear the purple. Photographers notice the teams that look like a club.</p>
        <form id="jersey-form" style="margin-top:1rem">
          <div class="form-row">
            <label for="jersey-player">I am</label>
            <select id="jersey-player" name="playerId">${options}</select>
          </div>
          <div class="grid-2">
            <div class="form-row">
              <label for="jersey-number">Preferred number</label>
              <input id="jersey-number" name="number" type="number" min="0" max="99" required placeholder="0–99" value="${escapeHtml(defaultNum)}" />
            </div>
            <div class="form-row">
              <label for="jersey-size">Size</label>
              <select id="jersey-size" name="size" required>
                <option value="">Pick size</option>
                ${sizes}
              </select>
            </div>
          </div>
          <p class="muted">${escapeHtml(takenNote)}</p>
          <div class="actions">
            <button class="btn" type="submit">Request jersey</button>
          </div>
          <p id="jersey-msg" class="muted"></p>
        </form>
      </article>
      <figure class="hero-art" style="min-height:240px">
        <img src="/media/jersey-mockup.jpg" alt="Wizards jersey mockup" />
      </figure>
      <article class="card">
        <h2>Approved turf shoes</h2>
        <p>Approved style: the <strong>3n2 MOFO turf shoe</strong> (~$89). Similar black/white turf trainers are fine. PLW: no spikes, no metal cleats — turf shoes or sneakers only.</p>
        <p class="muted">Bring water, shade, legal yellow Wiffle bats, and a change of shirt. August in Florida is a second opponent.</p>
      </article>
      <figure class="hero-art" style="min-height:240px">
        <img src="/media/turf-shoes.jpg" alt="3n2 MOFO turf shoe search screenshot" />
      </figure>
    </div>
    ${rows ? `<h2 style="margin-top:1.4rem">Open requests</h2><div class="posts">${rows}</div>` : ""}
  `;
}

function takenJerseyNumbers(roster, jerseys) {
  const seen = new Map();
  for (const p of roster.players) {
    if (p.number != null) seen.set(p.number, p.name);
  }
  for (const r of jerseys.requests || []) {
    seen.set(r.number, r.playerName);
  }
  return [...seen.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([number, name]) => ({ number, name }));
}

function bindGear(roster) {
  const form = document.getElementById("jersey-form");
  if (!form) return;
  const playerSelect = document.getElementById("jersey-player");
  const numberInput = document.getElementById("jersey-number");
  playerSelect.addEventListener("change", () => {
    localStorage.setItem("wizardsPlayerId", playerSelect.value);
    const player = roster.players.find((p) => p.id === playerSelect.value);
    if (player && player.number != null && !numberInput.value) {
      numberInput.value = player.number;
    }
  });
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(form).entries());
    localStorage.setItem("wizardsPlayerId", data.playerId);
    const msg = document.getElementById("jersey-msg");
    try {
      const next = await api.send("/api/jerseys", "POST", data);
      document.getElementById("app").innerHTML = renderGear(roster, next);
      bindGear(roster);
    } catch (err) {
      msg.textContent = err.message;
    }
  });
}

function renderLeague() {
  const parents = [...new Set([location.hostname || "localhost", "localhost", "127.0.0.1"])]
    .map((h) => "parent=" + encodeURIComponent(h))
    .join("&");
  return `
    <p class="kicker">Premier League WIFFLE®</p>
    <h1>League desk</h1>
    <p class="lede">Florida Challengers League, Brooksville. Fall games count toward standings, player profiles, and the January 2027 weeknight invite.</p>
    <div class="grid-2" style="margin-top:1rem">
      <article class="card">
        <h2>Season facts</h2>
        <ul class="rules">
          <li>Location: private ranch, Brooksville, FL (address to registered teams)</li>
          <li>Fall season through December 4, 2026</li>
          <li>$250 per team for the year · ramp-up now, reset for the real league in February</li>
          <li>Min 6 on the field, up to 12 on a roster</li>
          <li>21+ events · no kids · no pets · no spikes</li>
          <li>Opening night stream: Aug 6, 7pm EST</li>
        </ul>
        <p>
          <a href="https://premierleaguewiffle.com/" target="_blank" rel="noopener">premierleaguewiffle.com</a>
          · <a href="https://premierleaguewiffle.com/basic-rules/" target="_blank" rel="noopener">Basic rules</a>
          · <a href="https://premierleaguewiffle.com/player-code-of-conduct/" target="_blank" rel="noopener">Code of conduct</a>
        </p>
      </article>
      <article class="card">
        <h2>Rules that decide games</h2>
        <ul class="rules">
          <li>Every at-bat starts 0–1. Six innings.</li>
          <li>Called strikes must read ≤55 mph and hit the K-zone in the air.</li>
          <li>Walk 2 batters → pitcher is done (last eligible pitcher has no walk cap).</li>
          <li>No gloves. Force outs: ball into backstop / K-zone / batter in the air within 5 seconds.</li>
          <li>Only official yellow Wiffle bats. Legal tape only.</li>
          <li>Motto: Play Hard. Have Fun. Respect All.</li>
        </ul>
        <p><a href="/media/Wizards_of_Wiffs_PLW_Tournament_Aug1_2026.pdf" target="_blank" rel="noopener">August 1 tournament packet (PDF)</a></p>
      </article>
    </div>
    <section class="card" style="margin-top:1rem">
      <h2>Opening night replay</h2>
      <div class="twitch-wrap">
        <iframe src="https://player.twitch.tv/?video=2834716125&${parents}&autoplay=false" allow="autoplay; fullscreen; encrypted-media; picture-in-picture" allowfullscreen title="PLW Opening Night Twitch replay"></iframe>
      </div>
      <p style="margin-top:0.7rem"><a href="https://www.twitch.tv/videos/2834716125" target="_blank" rel="noopener">Open on Twitch</a> · <a href="https://www.twitch.tv/premierwiffle" target="_blank" rel="noopener">twitch.tv/premierwiffle</a></p>
    </section>
  `;
}

function cap(word) {
  return String(word || "").replace(/^\w/, (c) => c.toUpperCase());
}

function bestDays(roster, avail) {
  const windows = (avail.windows || []).map((w) => w.id);
  const rows = [];
  for (const [day] of DAYS_META) {
    for (const windowId of windows) {
      const tally = tallySlot(avail, day, windowId);
      rows.push({ day, window: windowId, ...tally });
    }
  }
  rows.sort((a, b) => b.yes - a.yes || b.maybe - a.maybe);
  return rows;
}

function tallySlot(avail, day, windowId) {
  let yes = 0;
  let maybe = 0;
  const names = { yes: [], maybe: [], no: [] };
  for (const [id, p] of Object.entries(avail.players || {})) {
    const entry = (p.days || {})[day] || { status: "no", windows: [] };
    const inWindow = !windowId || (entry.windows || []).includes(windowId) || (entry.windows || []).length === 0;
    if (entry.status === "yes" && inWindow) {
      yes += 1;
      names.yes.push(p.name || id);
    } else if (entry.status === "maybe" && inWindow) {
      maybe += 1;
      names.maybe.push(p.name || id);
    } else {
      names.no.push(p.name || id);
    }
  }
  return { yes, maybe, names };
}
