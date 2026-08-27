function playerSquads(p) {
  const s = p && p.squads;
  return s && s.length ? s.slice() : ["league", "tournament"];
}

function onSquad(p, squad) {
  return playerSquads(p).includes(squad);
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

function rosterRows(players, squad) {
  return players
    .map((p, i) => {
      const pos = (p.positions || []).join(", ") || "Util";
      const inBook = onSquad(p, squad);
      const tag = isAdmin()
        ? `<button type="button" class="tag" data-edit-pos="${escapeHtml(p.id)}" style="cursor:pointer;background:transparent;color:inherit;font:inherit;white-space:nowrap">${escapeHtml(pos)}</button>`
        : `<span class="tag" style="white-space:nowrap">${escapeHtml(pos)}</span>`;
      const last = isAdmin()
        ? `<span>${["league", "tournament"]
            .map((book) => {
              const on = onSquad(p, book);
              return `<button type="button" class="btn ghost" data-squad-set="${escapeHtml(p.id)}" data-book="${book}" style="padding:0.08rem 0.32rem;font-size:0.62rem;margin-left:0.15rem${on ? "" : ";opacity:0.4"}">${book === "league" ? "L" : "T"}</button>`;
            })
            .join("")}</span>`
        : `<span class="muted">${inBook ? (p.born ? escapeHtml(p.born) : "") : squad === "league" ? "Not league" : "Not tourney"}</span>`;
      return `
        <div class="roster-row" style="grid-template-columns:2rem minmax(0,1.4fr) 2.8rem 7.2rem 5.2rem;${inBook ? "" : "opacity:0.55"}">
          <span class="num">${i + 1}</span>
          <strong>${escapeHtml(p.name)}</strong>
          <span class="num">${p.number != null ? "#" + p.number : "—"}</span>
          ${tag}
          ${last}
        </div>`;
    })
    .join("");
}

const FIELD_POS = ["P", "3B", "SS", "2B", "IF", "LF", "CF", "RF", "OF", "Util"];

function posPickerHtml(selected) {
  selected = (selected || []).filter((p) => FIELD_POS.includes(p));
  const rank = {};
  selected.forEach((p, i) => {
    rank[p] = i + 1;
  });
  const btns = FIELD_POS.map((pos) => {
    const n = rank[pos];
    return `<button type="button" class="btn ${n ? "" : "ghost"}" data-pos-pick="${pos}" style="padding:0.25rem 0.5rem;font-size:0.75rem">${n ? n + " " + pos : pos}</button>`;
  }).join("");
  const hint = selected[0]
    ? "Primary " + selected[0] + (selected[1] ? " · secondary " + selected[1] : "")
    : "Tap in order: first is primary, second is secondary.";
  return `<div class="pos-picker">
    <input type="hidden" name="positions" value="${escapeHtml(selected.join(","))}" />
    <div class="actions" style="margin:0;flex-wrap:wrap">${btns}</div>
    <p class="muted pos-order" style="margin:0.35rem 0 0">${hint}</p>
  </div>`;
}

function bindPosPicker(root) {
  const hidden = root.querySelector("input[name=positions]");
  const paint = (list) => {
    if (hidden) hidden.value = list.join(",");
    const hint = root.querySelector(".pos-order");
    if (hint) {
      hint.textContent = list[0]
        ? "Primary " + list[0] + (list[1] ? " · secondary " + list[1] : "")
        : "Tap in order: first is primary, second is secondary.";
    }
    root.querySelectorAll("[data-pos-pick]").forEach((btn) => {
      const i = list.indexOf(btn.dataset.posPick);
      btn.className = "btn" + (i >= 0 ? "" : " ghost");
      btn.style.padding = "0.25rem 0.5rem";
      btn.style.fontSize = "0.75rem";
      btn.textContent = i >= 0 ? i + 1 + " " + btn.dataset.posPick : btn.dataset.posPick;
    });
  };
  root.querySelectorAll("[data-pos-pick]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const list = String((hidden && hidden.value) || "").split(",").filter(Boolean);
      const i = list.indexOf(btn.dataset.posPick);
      if (i >= 0) list.splice(i, 1);
      else list.push(btn.dataset.posPick);
      paint(list);
    });
  });
}

function readPosPicker(root) {
  return String((root.querySelector("input[name=positions]") || {}).value || "")
    .split(",")
    .filter((p) => FIELD_POS.includes(p));
}

function posEditorHtml(p) {
  return `<form class="pos-inline card" data-id="${escapeHtml(p.id)}" style="padding:0.55rem 0.7rem">
    ${posPickerHtml(p.positions || [])}
    <div class="actions" style="margin-top:0.4rem">
      <button class="btn" type="submit">Save</button>
      <button class="btn ghost" type="button" data-pos-cancel>Cancel</button>
      <p class="muted pos-msg" style="margin:0"></p>
    </div>
  </form>`;
}

function canEditPos() {
  return typeof isAdmin === "function" && isAdmin();
}

function bindPosEditor(root, roster, onSaved) {
  if (!root || !canEditPos()) return;
  root.querySelectorAll("[data-edit-pos]").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      const id = btn.dataset.editPos;
      const list = root.querySelector(".roster-list") || root;
      const row = btn.closest(".roster-row");
      const open = list.querySelector(`.pos-inline[data-id="${id}"]`);
      list.querySelectorAll(".pos-inline").forEach((el) => el.remove());
      if (open) return;
      const p = roster.players.find((x) => x.id === id);
      if (!p) return;
      if (row) row.insertAdjacentHTML("afterend", posEditorHtml(p));
      else list.insertAdjacentHTML("beforeend", posEditorHtml(p));
      const form = list.querySelector(`.pos-inline[data-id="${id}"]`);
      if (!form) return;
      bindPosPicker(form);
      form.querySelector("[data-pos-cancel]").addEventListener("click", () => form.remove());
      form.addEventListener("submit", async (ev) => {
        ev.preventDefault();
        const note = form.querySelector(".pos-msg");
        try {
          const next = await api.send("/api/roster/" + id + "/positions", "PUT", { positions: readPosPicker(form) });
          roster.players = next.players || roster.players;
          onSaved();
        } catch (err) {
          if (note) note.textContent = err.message;
        }
      });
    });
  });
}

function pitcherKey(squad) {
  return "wizardsPitcher-" + (squad === "tournament" ? "tournament" : "league");
}

function pitcherArms(players) {
  return players.filter((p) => (p.positions || []).includes("P") || p.id === "jose-gonzalez" || p.id === "cam");
}

function pickPitcherId(players, squad) {
  const arms = pitcherArms(players);
  const saved = localStorage.getItem(pitcherKey(squad));
  if (saved && players.some((p) => p.id === saved)) return saved;
  return (arms[0] || players[0] || {}).id || "";
}

function fieldLayout(players, pitcherId) {
  const FIELD = ["CF", "LF", "3B", "SS", "2B/RF"];
  const IF_FIRST = ["3B", "SS", "2B/RF", "CF", "LF"];
  const spots = [
    { key: "CF", left: "50%", top: "10%" },
    { key: "LF", left: "16%", top: "22%" },
    { key: "3B", left: "18%", top: "48%" },
    { key: "SS", left: "38%", top: "36%" },
    { key: "2B/RF", left: "72%", top: "32%" },
    { key: "P", left: "50%", top: "58%" },
  ];
  const pitcher = players.find((p) => p.id === pitcherId) || pitcherArms(players)[0];
  const others = players.filter((p) => p.id !== (pitcher && pitcher.id));
  const extras = pitcherArms(players).filter((p) => !pitcher || p.id !== pitcher.id);
  const at = { CF: [], LF: [], "3B": [], SS: [], "2B/RF": [], P: pitcher ? [pitcher, ...extras] : extras.slice() };
  const cover = (pos) =>
    pos === "P"
      ? []
      : pos === "IF"
        ? ["3B", "SS", "2B/RF"]
        : pos === "OF"
          ? ["LF", "CF", "2B/RF"]
          : pos === "2B" || pos === "RF"
            ? ["2B/RF"]
            : FIELD.includes(pos)
              ? [pos]
              : [];
  for (const p of others) {
    (p.positions || []).forEach((pos, idx) => {
      for (const spot of cover(pos)) {
        if (at[spot].some((x) => x.id === p.id)) continue;
        if (idx === 0) at[spot].unshift(p);
        else at[spot].push(p);
      }
    });
  }
  const onField = (p) => FIELD.some((k) => at[k].some((x) => x.id === p.id));
  const placed = new Set(pitcher ? [pitcher.id] : []);
  extras.forEach((p) => placed.add(p.id));
  for (const key of FIELD) at[key].forEach((p) => placed.add(p.id));
  const pool = others.filter((p) => !placed.has(p.id));
  for (const key of FIELD) {
    if (!at[key].length && pool.length) at[key].push(pool.shift());
  }
  const extraPool = extras.filter((p) => !onField(p));
  for (const key of IF_FIRST) {
    if (!at[key].length && extraPool.length) at[key].push(extraPool.shift());
  }
  while (pool.length) {
    const open = FIELD.filter((k) => at[k].length < 2).sort((a, b) => at[a].length - at[b].length);
    if (!open.length) break;
    at[open[0]].push(pool.shift());
  }
  return { spots: spots.map((s) => ({ ...s, here: at[s.key] })), bench: pool };
}

function rosterDiamond(players, svgId, marks, offer, pitcherId, extraBench) {
  const { spots, bench } = fieldLayout(players, pitcherId);
  const diamondSpots = spots
    .map((spot) => {
      if (!spot.here.length) {
        return `<div class="spot empty" style="left:${spot.left};top:${spot.top}"><small>${spot.key}</small></div>`;
      }
      const anyYes = spot.here.some((p) => marks[p.id] === "yes");
      const anyMaybe = spot.here.some((p) => marks[p.id] === "maybe");
      const glow = anyYes ? " going" : anyMaybe ? " maybe-go" : "";
      const names = spot.here
        .map((p, i) => {
          const mark = marks[p.id] || "";
          const cls = mark || (i ? "muted" : "");
          if (spot.key === "P") {
            return `<b class="${cls}" data-pitcher="${escapeHtml(p.id)}" style="cursor:pointer">${escapeHtml(p.name)}</b>`;
          }
          return canEditPos()
            ? `<b class="${cls}" data-edit-pos="${escapeHtml(p.id)}" style="cursor:pointer">${escapeHtml(p.name)}</b>`
            : `<b class="${cls}">${escapeHtml(p.name)}</b>`;
        })
        .join("");
      return `<div class="spot${glow}" style="left:${spot.left};top:${spot.top}"><small>${spot.key}</small>${names}</div>`;
    })
    .join("");
  const benchHtml = bench.concat(extraBench || [])
    .map((p) =>
      canEditPos()
        ? `<span class="chip ${marks[p.id] || ""}" data-edit-pos="${escapeHtml(p.id)}" style="cursor:pointer">${escapeHtml(p.name)}</span>`
        : `<span class="chip ${marks[p.id] || ""}">${escapeHtml(p.name)}</span>`
    )
    .join("");
  const when = offer
    ? new Date(offer.date + "T12:00:00").toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })
    : "";
  const mound = players.find((p) => p.id === pitcherId);
  const note = !players.length
    ? `<p class="muted">Select a date to see that night's potential roster.</p>`
    : mound
      ? `<p class="muted">${escapeHtml(mound.name)} pitching. Tap another name on the mound to switch.${when ? ` Next up: <strong>${escapeHtml(when)}</strong> · ${escapeHtml(offer.note)}.` : ""} Green is committed, gold is maybe.</p>`
      : `<p class="muted">3B, SS, 2B/RF, LF, CF, and P.${when ? ` Next up: <strong>${escapeHtml(when)}</strong> · ${escapeHtml(offer.note)}.` : ""} Green is committed, gold is maybe.</p>`;
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
          <path d="M50 88 L82 56 L50 28 L18 56 Z" fill="rgba(192,38,255,0.08)" stroke="url(#${svgId})" stroke-width="1.4"/>
          <path d="M18 56 L50 88 L82 56" fill="none" stroke="rgba(240,193,75,0.45)" stroke-width="0.8"/>
        </svg>
        ${diamondSpots}
      </div>
      ${note}
      <div class="chips">${benchHtml || '<span class="muted">Everybody has a spot</span>'}</div>
    </div>`;
}

function nightMarks(roster, avail, day, liveStatus) {
  const myId = sessionPlayerId(roster.players);
  const marks = {};
  const players = roster.players.filter((p) => {
    let st = ((((avail.players || {})[p.id] || {}).days || {})[day] || {}).status;
    if (p.id === myId && liveStatus) st = liveStatus;
    if (st !== "yes" && st !== "maybe") return false;
    marks[p.id] = st;
    return true;
  });
  return { players, marks };
}

function renderEmptyNightDiamond() {
  return `
    <div id="avail-diamond">
      <p class="muted" style="margin:1rem 0 0.4rem">Select a date card to see that night's potential roster.</p>
      <div class="roster-layout">
        ${rosterDiamond([], "dg-avail", {}, null, "")}
        <div class="roster-list"><p class="muted">Nobody selected yet.</p></div>
      </div>
    </div>`;
}

function renderNightDiamond(roster, avail, offer, day, kind, liveStatus) {
  const { players, marks } = nightMarks(roster, avail, day, liveStatus);
  const sit = new Set(((avail.sit || {})[day] || []));
  const fielded = players.filter((p) => !sit.has(p.id));
  const sat = players.filter((p) => sit.has(p.id));
  const squad = kind === "tournament" ? "tournament" : "league";
  const pitcherId = pickPitcherId(fielded, squad);
  const tip = canEditPos()
    ? "Tap a name or position tag to edit. Bench sits them. ↑ ↓ changes batting order. Mound tap switches pitcher."
    : "Empty spots still need a body.";
  return `
    <div id="avail-diamond" data-day="${escapeHtml(day)}" data-kind="${escapeHtml(kind)}">
      <p class="muted" style="margin:1rem 0 0.4rem">Yes and maybe for this date. ${tip}</p>
      <div class="roster-layout">
        ${rosterDiamond(fielded, "dg-avail", marks, offer, pitcherId, sat)}
        <div class="roster-list" id="night-lineup-list">${players.length ? "" : '<p class="muted">Nobody marked yes or maybe yet.</p>'}</div>
      </div>
      <div id="night-scout-host"></div>
      <div id="night-opp-host"></div>
    </div>`;
}

function bindNightDiamond(roster, avail, kind, offer) {
  const refresh = () => {
    const host = document.getElementById("avail-diamond");
    const card = host && document.querySelector(`article.day[data-day="${host.dataset.day}"]`);
    if (card) paintAvailDiamond(card, roster, avail, kind, offer, false);
  };
  document.querySelectorAll("#avail-diamond [data-pitcher]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const squad = kind === "tournament" ? "tournament" : "league";
      localStorage.setItem(pitcherKey(squad), btn.dataset.pitcher);
      refresh();
    });
  });
  bindPosEditor(document.querySelector("#avail-diamond .diamond-card"), roster, refresh);
  bindPosEditor(document.getElementById("night-lineup-list"), roster, refresh);
}

function paintAvailDiamond(card, roster, avail, kind, offer, toggle) {
  const host = document.getElementById("avail-diamond");
  const show = (html) => {
    if (host) host.outerHTML = html;
    else {
      const form = document.getElementById("avail-form");
      if (form) form.insertAdjacentHTML("afterend", html);
    }
    if (window.bootVisuals) window.bootVisuals();
  };
  if (!card) {
    show(renderEmptyNightDiamond());
    return;
  }
  const day = card.dataset.day;
  if (toggle && host && host.dataset.day === day) {
    card.classList.remove("focus");
    show(renderEmptyNightDiamond());
    return;
  }
  document.querySelectorAll("article.day").forEach((el) => el.classList.remove("focus"));
  card.classList.add("focus");
  const live = (card.querySelector(`input[name="st-${day}"]:checked`) || {}).value || "";
  show(renderNightDiamond(roster, avail, offer, day, kind, live));
  bindNightDiamond(roster, avail, kind, offer);
  const { players, marks } = nightMarks(roster, avail, day, live);
  if (typeof paintNightLineup === "function") {
    const reload = (next) => {
      if (next && next.sit) avail.sit = next.sit;
      if (next && next.order) avail.order = next.order;
      const box = document.querySelector(`article.day[data-day="${day}"]`);
      if (box) paintAvailDiamond(box, roster, avail, kind, offer, false);
    };
    Promise.resolve(paintNightLineup(players, marks, (avail.sit || {})[day] || [], reload, (avail.order || {})[day] || [])).then(() =>
      bindPosEditor(document.getElementById("night-lineup-list"), roster, () => reload())
    );
  }
  if ((kind === "league" || kind === "tournament") && typeof loadNightMatchup === "function") {
    loadNightMatchup(offer, players.filter((p) => marks[p.id] === "yes").map((p) => p.name));
  }
}

function renderRosterEmbed(roster, squad, leagueAvail, tourneyAvail, svgId, heading) {
  squad = squad === "tournament" ? "tournament" : "league";
  const field = roster.players.filter((p) => onSquad(p, squad));
  const leagueOn = squad === "league";
  const avail = leagueOn ? leagueAvail || {} : tourneyAvail || {};
  const offer = nextProposed(avail);
  const marks = {};
  if (offer) {
    for (const p of field) marks[p.id] = playerMark(avail, p.id, offer, squad);
  }
  const pitcherId = pickPitcherId(field, squad);
  const blurb = leagueOn
    ? `Florida Challengers League · need 6 to take a night · ${field.length} of 12 counting`
    : `PLW Saturday events · Aug 1 packet and onward · ${field.length} counting`;
  const title = heading === "h2" ? "h2" : "h1";
  return `
    <div id="roster-embed" data-svg="${escapeHtml(svgId || "dg-roster")}" data-book="${escapeHtml(squad)}">
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
        ${rosterDiamond(field, svgId || "dg-roster", marks, offer, pitcherId)}
        <div class="roster-list">${rosterRows(roster.players, squad)}</div>
      </div>
    </div>
  `;
}

function renderRoster(roster, squad, leagueAvail, tourneyAvail) {
  return `
    <p class="lede">One Wizards book. League and Tournament only change which dates light up on the diamond. Co-managers: Tony Kurtanick and Brian Hannan.</p>
    ${isTeam() ? `<div class="actions" style="margin:0.7rem 0 0"><button class="btn ghost" type="button" id="show-phones">Phone numbers</button></div><div id="phone-list" class="card phone-list" hidden></div>` : ""}
    ${renderRosterEmbed(roster, squad, leagueAvail, tourneyAvail, "dg-roster", "h1")}
    <div id="offense-host"></div>
    <div id="pitching-host"></div>
  `;
}

function bindRoster(roster, leagueAvail, tourneyAvail) {
  const redraw = (squad) => {
    localStorage.setItem("wizardsRosterSquad", squad);
    const box = document.getElementById("roster-embed");
    const svgId = (box && box.dataset.svg) || "dg-roster";
    const heading = box && box.querySelector("h2") ? "h2" : "h1";
    if (box) box.outerHTML = renderRosterEmbed(roster, squad, leagueAvail, tourneyAvail, svgId, heading);
    bindRoster(roster, leagueAvail, tourneyAvail);
    if (window.bootVisuals) window.bootVisuals();
  };
  document.querySelectorAll("button[data-squad]").forEach((btn) => {
    btn.addEventListener("click", () => redraw(btn.dataset.squad));
  });
  document.querySelectorAll("[data-pitcher]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const box = document.getElementById("roster-embed");
      const squad = (box && box.dataset.book) === "tournament" ? "tournament" : "league";
      localStorage.setItem(pitcherKey(squad), btn.dataset.pitcher);
      redraw(squad);
    });
  });
  document.querySelectorAll("[data-squad-set]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const p = roster.players.find((x) => x.id === btn.dataset.squadSet);
      if (!p) return;
      const book = btn.dataset.book;
      const next = playerSquads(p);
      const i = next.indexOf(book);
      if (i >= 0) next.splice(i, 1);
      else next.push(book);
      try {
        const saved = await api.send("/api/roster/" + p.id + "/squads", "PUT", { squads: next });
        roster.players = saved.players || roster.players;
        const box = document.getElementById("roster-embed");
        redraw((box && box.dataset.book) === "tournament" ? "tournament" : "league");
      } catch (err) {
        alert(err.message);
      }
    });
  });
  bindPosEditor(document.getElementById("roster-embed"), roster, () => {
    const box = document.getElementById("roster-embed");
    redraw((box && box.dataset.book) === "tournament" ? "tournament" : "league");
  });
  bindPhones(roster);
  if (typeof loadOffense === "function") loadOffense(roster);
}
