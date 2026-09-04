const DAYS_META = [
  ["monday", "Mon"],
  ["tuesday", "Tue"],
  ["wednesday", "Wed"],
  ["thursday", "Thu"],
  ["friday", "Fri"],
  ["saturday", "Sat"],
  ["sunday", "Sun"],
];

function renderHome(roster, schedule, avail, fees, tourneyAvail) {
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
  const nextOffer = typeof nextProposed === "function" ? nextProposed(avail) : null;
  const hudVs = String((nextOffer && nextOffer.note) || "").match(/\bvs\.?\s+([^·|,]+)/i);
  const hudTally = nextOffer ? tallySlot(avail, nextOffer.day || nextOffer.date) : best;
  const hudNight = `${(hudTally && hudTally.yes) || 0}/6${nextOffer ? " · " + (hudVs ? hudVs[1].trim() : cap(nextOffer.day)) : best ? " · " + cap(best.day) : ""}`;
  const actions = team
    ? `<a class="btn" href="#/availability">Set your days</a><a class="btn ghost" href="#/board">Announcements</a><a class="btn ghost" href="#/roster">Roster</a><a class="btn ghost" href="#/league">Watch PLW live</a>`
    : `<a class="btn" href="#/join">Join the team</a><a class="btn ghost" href="#/roster">Roster</a><a class="btn ghost" href="#/league">Watch PLW live</a>`;
  const nightCard = team
    ? `<a class="card feature" href="#/availability"><span class="icon">◉</span><h3>League</h3><p class="muted">Lock six bodies on one window.</p><div class="sparks" aria-hidden="true">${sparks}</div></a>`
    : `<a class="card feature" href="#/league"><span class="icon">◉</span><h3>PLW Info</h3><p class="muted">Fall tryouts. Real League in January.</p></a>`;
  const duesCard = team
    ? `<a class="card feature" href="#/dues"><span class="icon">$</span><h3>Dues</h3><p class="muted">${fees && fees.model === "flat" ? money(fees.flatAmount) + " flat for the year" : "$250 team bill"}</p></a>`
    : `<a class="card feature" href="#/join"><span class="icon">+</span><h3>Join</h3><p class="muted">Tryouts this fall. Put your name in.</p></a>`;
  const jerseyCard = team
    ? `<a class="card feature" href="#/gear">
        <span class="icon">✦</span>
        <h3>Jersey request</h3>
        <p class="muted">Number, size, purple kit.</p>
      </a>`
    : "";
  const duesStat = team
    ? `<a class="card stat" href="#/dues"><b>${fees ? money(fees.model === "flat" ? fees.flatAmount : fees.teamTotal) : "$250"}</b>${fees && fees.model === "flat" ? "flat dues this year" : "team fee for the year"}</a>`
    : "";
  const pulse = team
    ? `<article class="card"><p class="kicker">Availability pulse</p><h2>${best && best.yes >= 6 ? "We can field a night" : "Still hunting a night"}</h2><p>${best ? `<span class="${best.yes >= 6 ? "ok" : "warn"}">${best.yes} yes / ${best.maybe} maybe</span> on ${cap(best.day)} ${best.window}` : "Nobody has filled nights yet. Grab League and tap your week."}</p><p class="muted">Fall league is flexible weeknights and weekends until the lights are fully in.</p></article>`
    : `<article class="card"><p class="kicker">Club only</p><h2>Team tools stay locked</h2><p class="muted">League, announcements, and dues open with the team password in the header.</p></article>`;
  return `
    ${team && locked ? `<div class="banner"><strong>League locked:</strong> ${escapeHtml(cap(locked.day))} ${escapeHtml(locked.window)} — set by ${escapeHtml(locked.lockedBy)}</div>` : ""}
    <section class="hero">
      <div class="hero-copy">
        <p class="kicker">Florida Challengers League · Fall 2026</p>
        <h1>Six on.<br /><span class="grad-text">Lights out.</span></h1>
        <p class="lede">This fall is practice and tryouts. We are building the Wizards for PLW’s Real League, which starts January 2027.</p>
        <p class="muted">Co-managers Tony Kurtanick and Brian Hannan. ${roster.players.filter(isActive).length} on the book. Need <strong>6 players the same night</strong> to take a league game. Check out our roster below.</p>
        <div class="actions">
          ${actions}
        </div>
      </div>
      <div class="hero-stage">
        <a class="hud hud-tl" href="#/availability${nextOffer && nextOffer.date ? "?date=" + encodeURIComponent(nextOffer.date) : ""}">
          <small>Field status</small>
          <b><span class="ring"></span>${escapeHtml(hudNight)}</b>
        </a>
        <figure class="hero-art">
          <img src="/media/jersey-mockup.jpg" alt="Wizards of Wiff pinstripe jersey mockup" />
          <figcaption>Option 5: Pinstripe Wizard Alternate — purple, gold, and smoke.</figcaption>
        </figure>
        <a class="hud hud-br" href="#/availability${next && next.date ? "?date=" + encodeURIComponent(next.date) : ""}">
          <small>Next on deck</small>
          <b>${next ? escapeHtml(next.title.replace(" — ", " · ").slice(0, 28)) : "TBD"}</b>
        </a>
      </div>
    </section>
    <section class="feature-rail">
      ${nightCard}
      <a class="card feature" href="#/schedule">
        <span class="icon">▣</span>
        <h3>Schedule</h3>
        <p class="muted">${next ? fmtDate(next.date) + " · " + escapeHtml(next.when) : "Calendar loading"}</p>
      </a>
      ${jerseyCard}
      ${duesCard}
      <a class="card feature" href="#/roster">
        <span class="icon">☰</span>
        <h3>Roster</h3>
        <p class="muted">${roster.players.filter(isActive).length} Wizards · cap 12 · need 6</p>
      </a>
      <a class="card feature" href="#/media">
        <span class="icon">◈</span>
        <h3>Media</h3>
        <p class="muted">Kits, K-zone, Brooksville film.</p>
      </a>
    </section>
    <section class="${team ? "grid-3" : "grid-2"}" style="margin-top:1rem">
      <article class="card stat"><b>${roster.players.filter(isActive).length}</b>rostered Wizards</article>
      <article class="card stat"><b>6</b>needed for league night</article>
      ${duesStat}
    </section>
    <section style="margin-top:1.2rem">
      ${renderRosterEmbed(roster, localStorage.getItem("wizardsRosterSquad"), avail, tourneyAvail, "dg-home", "h2")}
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
        <h2>Practice league now. Real League in January.</h2>
        <p>Florida Challengers League through December 4 is reps and tryouts — chemistry, nights we can field six, and who belongs on this club. The Real League starts January 2027. Everything we do in Brooksville this fall is to have a Wizards team ready for that.</p>
        <div class="actions">
          <a class="btn ghost" href="#/league">Watch stream</a>
          ${team ? `<a class="btn ghost" href="#/strategy">Strategy</a>` : ""}
          <a class="btn ghost" href="#/media">Gallery</a>
        </div>
      </article>
    </section>
  `;
}

function renderSchedule(schedule, avail, view, monthKey, packs) {
  view = view || localStorage.getItem("wizardsSchedView") || "calendar";
  const events = schedule.events || [];
  const now = new Date();
  const thisMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  monthKey = monthKey || thisMonth;
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
          ${typeof schedFavorHtml === "function" ? schedFavorHtml(e, packs && packs.book) : ""}
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
    <p class="lede">${isTeam() ? `Tournaments and league dates. Recurring weeknight is chosen on <a href="#/availability">League</a> once six Wizards overlap.` : "Tournaments and league dates on the PLW calendar."}</p>
    ${isTeam() ? lock : ""}
    ${view === "calendar" ? renderCalendarMonth(events, monthKey, packs) : `<div class="timeline" style="margin-top:1rem">${list}</div>`}
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

function renderGear(roster, jerseys, playerId) {
  const savedId = playerId || "";
  const mine = (jerseys.requests || []).find((r) => r.playerId === savedId);
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
            <button class="btn" type="submit" ${savedId ? "" : "disabled"}>Request jersey</button>
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
  for (const p of roster.players) if (p.number != null) seen.set(p.number, p.name);
  for (const r of jerseys.requests || []) seen.set(r.number, r.playerName);
  return [...seen.entries()].sort((a, b) => a[0] - b[0]).map(([number, name]) => ({ number, name }));
}
function bindGear(roster) {
  const form = document.getElementById("jersey-form");
  if (!form) return;
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(form).entries());
    const msg = document.getElementById("jersey-msg");
    if (!sessionPlayerId(roster.players)) {
      msg.textContent = "Your login is not linked to a roster name.";
      return;
    }
    try {
      const next = await api.send("/api/jerseys", "POST", data);
      document.getElementById("app").innerHTML = renderGear(roster, next, sessionPlayerId(roster.players));
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
    <h1>PLW Info</h1>
    <p class="lede">Florida Challengers League is the practice and tryouts season. We are stacking a Wizards roster for the Real League, which starts January 2027.</p>
    <section class="card" style="margin-top:1rem">
      <h2>Season facts</h2>
      <ul class="rules">
        <li>Location: private ranch, Brooksville, FL (address to registered teams)</li>
        <li>Fall practice / tryouts through December 4, 2026</li>
        <li>Real League starts January 2027 — this club is being built for that</li>
        <li>$250 per team for the year</li>
        <li>Min 6 on the field, up to 12 on a roster</li>
        <li>21+ events · no kids · no pets · no spikes</li>
        <li>Games stream on Twitch, sometimes YouTube or Instagram</li>
      </ul>
      <p>
        <a href="https://premierleaguewiffle.com/" target="_blank" rel="noopener">premierleaguewiffle.com</a>
        · <a href="https://premierleaguewiffle.com/basic-rules/" target="_blank" rel="noopener">Basic rules</a>
        · <a href="https://premierleaguewiffle.com/player-code-of-conduct/" target="_blank" rel="noopener">Code of conduct</a>
      </p>
    </section>
    <section class="card" style="margin-top:1rem">
      <h2>PLW live streaming</h2>
      <p class="muted">Adam streams league nights and tournaments. Usually Twitch. Sometimes YouTube or Instagram — if one is dark, try the others.</p>
      <div class="twitch-wrap">
        <iframe src="https://player.twitch.tv/?channel=premierwiffle&${parents}&autoplay=false" allow="autoplay; fullscreen; encrypted-media; picture-in-picture" allowfullscreen title="PLW live on Twitch"></iframe>
      </div>
      <div class="actions">
        <a class="btn" href="https://www.twitch.tv/premierwiffle" target="_blank" rel="noopener">Twitch</a>
        <a class="btn ghost" href="https://www.youtube.com/c/premierleaguewiffle" target="_blank" rel="noopener">YouTube</a>
        <a class="btn ghost" href="https://www.instagram.com/premierwiffle2/" target="_blank" rel="noopener">Instagram</a>
      </div>
    </section>
  `;
}

function renderStrategy(data) {
  data = data || {};
  const rules = (data.rules || []).map((r) => `<li>${escapeHtml(r)}</li>`).join("");
  const pdf = data.pdf
    ? `<p><a href="${escapeHtml(data.pdf)}" target="_blank" rel="noopener">August 1 tournament packet (PDF)</a></p>`
    : "";
  return `
    <p class="kicker">Team only</p>
    <h1>Strategy</h1>
    <p class="lede">${escapeHtml(data.lede || "")}</p>
    <section class="card" style="max-width:40rem">
      <h2>Rules that decide games</h2>
      <ul class="rules">${rules}</ul>
      ${pdf}
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
      names.yes.push({ id, name: p.name || id });
    } else if (entry.status === "maybe" && inWindow) {
      maybe += 1;
      names.maybe.push({ id, name: p.name || id });
    } else {
      names.no.push({ id, name: p.name || id });
    }
  }
  return { yes, maybe, names };
}

function shortDay(iso) {
  if (!iso || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) return "";
  return new Date(iso + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function bestUpcomingMatchup(events, book) {
  const today = new Date().toISOString().slice(0, 10);
  let best = null;
  for (const e of (events || []).slice().sort((a, b) => String(a.date).localeCompare(String(b.date)))) {
    if (e.kind !== "league" || !e.date || e.date < today) continue;
    const name = typeof schedOpponent === "function" ? schedOpponent(e.title) : "";
    if (!name || typeof matchupFavor !== "function") continue;
    const fav = matchupFavor({ note: "vs " + name }, book);
    if (fav == null) continue;
    if (!best || fav < best.fav) best = { name, fav, date: e.date };
  }
  if (!best) return "";
  const word = typeof favorWord === "function" ? favorWord(best.fav) : "";
  return [`Best · vs ${best.name}`, shortDay(best.date), word, best.fav].filter((x) => x !== "" && x != null).join(" · ");
}

function nextTournamentTag(events) {
  const today = new Date().toISOString().slice(0, 10);
  const e = (events || []).slice().sort((a, b) => String(a.date).localeCompare(String(b.date))).find((x) => x.kind === "tournament" && x.date && x.date >= today);
  if (!e) return "";
  const title = String(e.title || "Tournament").replace(/\s+[—–-].*$/, "").slice(0, 28);
  return [title && `Next · ${title}`, shortDay(e.date)].filter(Boolean).join(" · ");
}

function practiceTag(avail) {
  const n = ((avail && avail.offers) || []).length;
  return n ? (n === 1 ? "1 session posted" : n + " sessions posted") : "";
}

function wizLeagueRankTag(teams) {
  const pool = teams || [];
  if (typeof rankByRecord === "function" && pool.some((t) => t.w != null || t.l != null)) {
    const list = rankByRecord(pool);
    const i = list.findIndex((t) => t.code === "WIZ");
    if (i < 0) return "";
    return `Wizards #${i + 1} · ${(list[i].w || 0)}-${list[i].l || 0}`;
  }
  if (typeof rankedTeams !== "function") return "";
  const list = rankedTeams(pool);
  const i = list.findIndex((t) => t.code === "WIZ");
  return i >= 0 ? `Wizards #${i + 1}` : "";
}

function recruitNeedTag(roster) {
  const players = (roster && roster.players) || [];
  const n = players.filter((p) => isActive(p) && (typeof onSquad !== "function" || onSquad(p, "league"))).length;
  return n < 12 ? "Looking for more players" : "";
}

function recruitQueueTag(data) {
  const n = ((data && data.recruits) || []).length;
  return n ? (n === 1 ? "1 in queue" : n + " in queue") : "";
}

function latestAnnounceTag(board) {
  const posts = [...((board && board.posts) || [])].sort((a, b) => String(b.createdAt || "").localeCompare(String(a.createdAt || "")));
  const p = posts[0];
  if (!p) return "";
  const text = String(p.body || p.title || "").replace(/\s+/g, " ").trim();
  if (!text) return "";
  return text.length > 240 ? text.slice(0, 237) + "…" : text;
}

function renderTeamHub(favTag, tourneyTag, pracTag, rankTag, tRankTag, recruitTag, queueTag, announceTag) {
  const cards = [
    ["#/board", "◉", "Announcements", "Board notes for the club.", announceTag],
    ["#/availability", "◷", "League", "Mark nights. Need 6 yes at the same time.", ["Set your days", favTag].filter(Boolean)],
    ["#/scout", "▦", "League rankings", "Overview and every Challengers club.", rankTag],
    ["#/tourney-scout", "▣", "Tournament rankings", "Each event, plus an overall tally.", tRankTag],
    ["#/tournament", "✸", "Tournament", "Who can play each tournament date.", ["Set your days", tourneyTag].filter(Boolean)],
    ["#/practice", "◎", "Practice", "Post a session. Tap yes, maybe, or no.", pracTag],
    ["#/gear", "✦", "Gear", "Jersey number and size."],
    ["#/join", "+", "Recruit", "Put someone in the book.", recruitTag],
    ["#/recruits", "☰", "Recruits", "Inbox, contact, move onto the roster.", queueTag],
    ["#/dues", "$", "Dues", "Who paid and what they owe."],
    ["#/strategy", "◈", "Strategy", "Team-only talk."],
  ]
    .map(([href, icon, title, blurb, tag]) => {
      const wrap = title === "Announcements";
      const tags = (Array.isArray(tag) ? tag : tag ? [tag] : [])
        .map(
          (t) =>
            `<span class="tag"${wrap ? ' style="display:block;white-space:normal;text-transform:none;letter-spacing:0.03em;line-height:1.4;max-width:100%"' : ""}>${escapeHtml(t)}</span>`
        )
        .join("");
      return `
      <a class="card feature" href="${href}">
        <span class="icon">${icon}</span>
        <h3>${title}</h3>
        ${tags}
        <p class="muted">${blurb}</p>
      </a>`;
    })
    .join("");
  return `
    <p class="kicker">Locker room</p>
    <h1>Private Team</h1>
    <p class="lede">League, tournament, practice, gear, recruiting, dues, and strategy. Public pages stay in the main menu.</p>
    <section class="grid-3" style="margin-top:1.2rem">${cards}</section>
  `;
}
