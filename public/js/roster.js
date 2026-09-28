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
  if (offer && offer.date) return offer.date;
  return (offer && offer.day) || "";
}

function playerMark(avail, playerId, offer, kind) {
  if (!avail || !offer) return "";
  const entry = (((avail.players || {})[playerId] || {}).days || {})[offerKey(offer, kind)] || {};
  return entry.status === "yes" || entry.status === "maybe" ? entry.status : "";
}

function rosterRows(players, dead, stats) {
  const admin = isAdmin();
  const offStatuses = [
    { status: "IR", label: "IR" },
    { status: "New", label: "New" },
    { status: "Inactive", label: "Away" },
  ];
  return players
    .map((p, i) => {
      const pos = (p.positions || []).join(", ") || "Util";
      const cur = typeof rosterStatus === "function" ? rosterStatus(p) : p.status || "Active";
      const tag = !dead && admin
        ? `<button type="button" class="tag" data-edit-pos="${escapeHtml(p.id)}" style="cursor:pointer;background:transparent;color:inherit;font:inherit;white-space:nowrap">${escapeHtml(pos)}</button>`
        : `<span class="tag" style="white-space:nowrap">${escapeHtml(pos)}</span>`;
      let last;
      if (dead && admin) {
        last = `<span class="roster-acts roster-edit-acts">
          ${offStatuses
            .map((s) => {
              const on = cur === s.status;
              return `<button type="button" class="btn ${on ? "" : "ghost"}" data-status-set="${escapeHtml(p.id)}" data-status="${s.status}">${s.label}</button>`;
            })
            .join("")}
          <button type="button" class="btn ghost" data-status-set="${escapeHtml(p.id)}" data-status="Active">On</button>
          <button type="button" class="btn ghost" data-roster-del="${escapeHtml(p.id)}" title="Delete player">Del</button>
        </span>`;
      } else if (dead) {
        const label = typeof rosterStatusLabel === "function" ? rosterStatusLabel(cur) : cur;
        last = `<span class="muted roster-acts">${escapeHtml(label)}</span>`;
      } else if (admin) {
        last = `<span class="roster-acts roster-edit-acts">${offStatuses
          .map((s) => `<button type="button" class="btn ghost" data-status-set="${escapeHtml(p.id)}" data-status="${s.status}">${s.label}</button>`)
          .join("")}</span>`;
      } else {
        last = "";
      }
      const hit = typeof batterRow === "function" ? batterRow(stats, p) : null;
      const avg = `<span class="muted roster-avg" title="Combined AVG / OBP">${escapeHtml(rosterAvgText(stats, p))}${hitTrendMark(hit)}</span>`;
      return `
        <div class="roster-row${dead ? " sideline" : ""}">
          <span class="num roster-n">${i + 1}</span>
          <span class="roster-who"><strong>${escapeHtml(p.name)}</strong>${avg}</span>
          <div class="roster-extra">
            <span class="num roster-jersey">${p.number != null ? "#" + p.number : ""}</span>
            ${tag}
            ${last}
          </div>
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
      list.querySelectorAll(".pos-inline, .limits-inline").forEach((el) => el.remove());
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

function limitsEditorHtml(p) {
  return `<form class="limits-inline card" data-id="${escapeHtml(p.id)}" style="padding:0.55rem 0.7rem">
    <label class="muted" style="display:block;font-size:0.72rem;margin-bottom:0.25rem">Availability limits</label>
    <textarea name="limits" rows="2" maxlength="200" placeholder="e.g. Fridays only · through Sept · every other weekend" style="width:100%;box-sizing:border-box">${escapeHtml(p.limits || "")}</textarea>
    <div class="actions" style="margin-top:0.4rem">
      <button class="btn" type="submit">Save</button>
      <button class="btn ghost" type="button" data-limits-cancel>Cancel</button>
      <p class="muted limits-msg" style="margin:0"></p>
    </div>
  </form>`;
}

function bindLimitsEditor(root, roster, onSaved) {
  if (!root || !canEditPos()) return;
  root.querySelectorAll("[data-edit-limits]").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      const id = btn.dataset.editLimits;
      const list = root.querySelector(".roster-list") || root;
      const row = btn.closest(".roster-row");
      const open = list.querySelector(`.limits-inline[data-id="${id}"]`);
      list.querySelectorAll(".pos-inline, .limits-inline").forEach((el) => el.remove());
      if (open) return;
      const p = roster.players.find((x) => x.id === id);
      if (!p) return;
      if (row) row.insertAdjacentHTML("afterend", limitsEditorHtml(p));
      else list.insertAdjacentHTML("beforeend", limitsEditorHtml(p));
      const form = list.querySelector(`.limits-inline[data-id="${id}"]`);
      if (!form) return;
      const area = form.querySelector("textarea[name=limits]");
      if (area) {
        area.focus();
        area.setSelectionRange(area.value.length, area.value.length);
      }
      form.querySelector("[data-limits-cancel]").addEventListener("click", () => form.remove());
      form.addEventListener("submit", async (ev) => {
        ev.preventDefault();
        const note = form.querySelector(".limits-msg");
        try {
          const next = await api.send("/api/roster/" + id + "/limits", "PUT", {
            limits: String((area && area.value) || "").trim(),
          });
          roster.players = next.players || roster.players;
          onSaved();
        } catch (err) {
          if (note) note.textContent = err.message;
        }
      });
    });
  });
}

function pitcherKey(kind) {
  if (kind === "tournament") return "wizardsPitcher-tournament";
  if (kind === "league") return "wizardsPitcher-league";
  return "wizardsPitcher";
}
function pitcherArms(players) {
  return players.filter((p) => (p.positions || []).includes("P") || p.id === "jose-gonzalez" || p.id === "cam");
}

function pickPitcherId(players, kind) {
  const arms = pitcherArms(players);
  const saved = localStorage.getItem(pitcherKey(kind));
  if (saved && players.some((p) => p.id === saved)) return saved;
  return (arms[0] || players[0] || {}).id || "";
}

function fieldLayout(players, pitcherId) {
  const FIELD = ["CF", "LF", "3B", "SS", "2B"];
  const IF_FIRST = ["3B", "SS", "2B", "CF", "LF"];
  const spots = [
    { key: "CF", left: "50%", top: "10%" },
    { key: "LF", left: "16%", top: "22%" },
    { key: "3B", left: "18%", top: "48%" },
    { key: "SS", left: "38%", top: "36%" },
    { key: "2B", left: "72%", top: "32%" },
    { key: "P", left: "50%", top: "58%" },
  ];
  const pitcher = players.find((p) => p.id === pitcherId) || pitcherArms(players)[0];
  const extras = pitcherArms(players).filter((p) => !pitcher || p.id !== pitcher.id);
  const at = { CF: [], LF: [], "3B": [], SS: [], "2B": [], P: pitcher ? [pitcher, ...extras] : extras.slice() };
  const cover = (pos) =>
    pos === "P"
      ? []
      : pos === "IF"
        ? ["3B", "SS", "2B"]
        : pos === "OF" || pos === "RF"
          ? ["LF", "CF"]
          : pos === "Util"
            ? FIELD.slice()
            : pos === "2B"
              ? ["2B"]
              : FIELD.includes(pos)
                ? [pos]
                : [];
  const ofOnly = (p) => {
    const pos = p.positions || [];
    const inf = pos.some((x) => x === "IF" || x === "2B" || x === "3B" || x === "SS" || x === "Util");
    return pos.some((x) => x === "OF" || x === "LF" || x === "CF" || x === "RF") && !inf;
  };
  const canFill = (spot, p) => spot !== "2B" || !ofOnly(p);
  for (const p of players) {
    const posList = p.positions || [];
    const primaryAt = posList.findIndex((x) => cover(x).length);
    posList.forEach((pos, idx) => {
      for (const spot of cover(pos)) {
        if (at[spot].some((x) => x.id === p.id)) continue;
        if (idx === primaryAt) at[spot].unshift(p);
        else at[spot].push(p);
      }
    });
  }
  const onField = (p) => FIELD.some((k) => at[k].some((x) => x.id === p.id));
  const placed = new Set();
  extras.forEach((p) => placed.add(p.id));
  for (const key of FIELD) at[key].forEach((p) => placed.add(p.id));
  if (pitcher) placed.add(pitcher.id);
  const pool = players.filter((p) => !placed.has(p.id));
  for (const key of FIELD) {
    if (at[key].length) continue;
    const i = pool.findIndex((p) => canFill(key, p));
    if (i >= 0) at[key].push(pool.splice(i, 1)[0]);
  }
  const extraPool = extras.filter((p) => !onField(p));
  for (const key of IF_FIRST) {
    if (at[key].length) continue;
    const i = extraPool.findIndex((p) => canFill(key, p));
    if (i >= 0) at[key].push(extraPool.splice(i, 1)[0]);
  }
  while (pool.length) {
    const open = FIELD.filter((k) => at[k].length < 2 && canFill(k, pool[0])).sort((a, b) => at[a].length - at[b].length);
    if (!open.length) {
      pool.shift();
      continue;
    }
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
      const glow = Object.keys(marks).length && anyYes ? " going" : Object.keys(marks).length && anyMaybe ? " maybe-go" : "";
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
  const marked = Object.keys(marks).some((id) => marks[id]);
  const tone = marked ? " Green is committed, gold is maybe." : "";
  const note = !players.length
    ? `<p class="muted">Select a date to see that night's potential roster.</p>`
    : mound
      ? `${when || tone ? `<p class="muted">${when ? `Next up: <strong>${escapeHtml(when)}</strong> · ${escapeHtml(offer.note)}.` : ""}${tone}</p>` : ""}`
      : `<p class="muted">3B, SS, 2B, LF, CF, and P.${when ? ` Next up: <strong>${escapeHtml(when)}</strong> · ${escapeHtml(offer.note)}.` : ""}${tone}</p>`;
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
    if (!isActive(p)) return false;
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

function rosterAvg(stats, p) {
  const hit = typeof batterRow === "function" ? batterRow(stats, p) : null;
  const n = parseFloat(hit && hit.avg);
  return Number.isFinite(n) ? n : -1;
}

function sortByAvg(players, stats) {
  if (!stats) return players;
  return players.slice().sort((a, b) => rosterAvg(stats, b) - rosterAvg(stats, a) || String(a.name).localeCompare(String(b.name)));
}

function rosterAvgText(stats, p) {
  const hit = typeof batterRow === "function" ? batterRow(stats, p) : null;
  const avg = hit && hit.avg != null && hit.avg !== "" ? String(hit.avg) : "";
  if (!avg || rosterAvg(stats, p) < 0) return "—";
  const obp = hit && hit.obp != null && hit.obp !== "" ? String(hit.obp) : "";
  return obp ? avg + " / " + obp : avg;
}

function hitTrendMark(hit) {
  const t = hit && hit.trend;
  if (!t) return "";
  const pts = Math.round(Math.abs(Number(t.delta)) * 1000);
  if (t.dir === "up") {
    const tip = "On the rise: " + t.recentAvg + " last " + t.recentG + " games vs " + t.priorAvg + " before (+" + pts + " points)";
    return `<span class="hit-hot" title="${escapeHtml(tip)}">↑</span>`;
  }
  if (t.dir === "down" && typeof isAdmin === "function" && isAdmin()) {
    const tip = "Cooling off: " + t.recentAvg + " last " + t.recentG + " games vs " + t.priorAvg + " before (−" + pts + " points)";
    return `<span class="hit-cold" title="${escapeHtml(tip)}">↓</span>`;
  }
  return "";
}

let rosterEditing = false;

function renderRosterEmbed(roster, leagueAvail, tourneyAvail, svgId, heading, stats) {
  const active = roster.players.filter(isActive);
  const inactive = roster.players.filter((p) => !isActive(p));
  const leagueOffer = nextProposed(leagueAvail || {});
  const tourneyOffer = nextProposed(tourneyAvail || {});
  const avail = !leagueOffer || (tourneyOffer && tourneyOffer.date < leagueOffer.date) ? tourneyAvail || {} : leagueAvail || {};
  const offer = nextProposed(avail);
  const pitcherId = pickPitcherId(active);
  const title = heading === "h2" ? "h2" : "h1";
  const admin = isAdmin();
  return `
    <div id="roster-embed"${rosterEditing ? ' class="roster-editing"' : ""} data-svg="${escapeHtml(svgId || "dg-roster")}">
      <div class="sched-bar">
        <div>
          <p class="kicker">${escapeHtml(roster.league)} · ${escapeHtml(roster.season)}</p>
          <${title}>Roster</${title}>
        </div>
      </div>
      <p class="muted">Locked roster · need 6 to take a night · ${active.length} on the book</p>
      <div class="roster-layout">
        ${rosterDiamond(active, svgId || "dg-roster", {}, offer, pitcherId)}
        <div class="roster-book">
          ${admin ? `<div class="actions" style="margin:0 0 0.45rem"><button class="btn ghost" type="button" id="toggle-roster-edit">${rosterEditing ? "Hide statuses" : "Edit statuses"}</button></div>` : ""}
          <div class="roster-list">${rosterRows(sortByAvg(active, stats), false, stats)}</div>
        </div>
      </div>
      ${inactive.length ? `<div class="roster-list" style="margin-top:0.85rem"><p class="kicker">Sideline · IR / New / Away</p>${rosterRows(inactive, true, stats)}</div>` : ""}
    </div>
  `;
}
function renderRoster(roster, leagueAvail, tourneyAvail, stats) {
  return `
    <p class="lede">One locked Wizards roster. Co-managers: Tony Kurtanick and Brian Hannan.</p>
    ${isTeam() ? `<div class="actions" style="margin:0.7rem 0 0"><button class="btn ghost" type="button" id="show-phones">Phone numbers</button></div><div id="phone-list" class="card phone-list" hidden></div>` : ""}
    ${renderRosterEmbed(roster, leagueAvail, tourneyAvail, "dg-roster", "h1", stats)}
    <div id="offense-host"></div>
    <div id="pitching-host"></div>
  `;
}

function bindRoster(roster, leagueAvail, tourneyAvail, stats) {
  const redraw = () => {
    const box = document.getElementById("roster-embed");
    const svgId = (box && box.dataset.svg) || "dg-roster";
    const heading = box && box.querySelector("h2") ? "h2" : "h1";
    if (box) box.outerHTML = renderRosterEmbed(roster, leagueAvail, tourneyAvail, svgId, heading, stats);
    bindRoster(roster, leagueAvail, tourneyAvail, stats);
    if (window.bootVisuals) window.bootVisuals();
  };
  document.querySelectorAll("#roster-embed [data-pitcher]").forEach((btn) => {
    btn.addEventListener("click", () => {
      localStorage.setItem(pitcherKey(), btn.dataset.pitcher);
      redraw();
    });
  });
  document.querySelectorAll("[data-status-set]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const p = roster.players.find((x) => x.id === btn.dataset.statusSet);
      if (!p) return;
      try {
        const saved = await api.send("/api/roster/" + p.id + "/status", "PUT", { status: btn.dataset.status });
        Object.assign(roster, saved);
        redraw();
      } catch (err) {
        alert(err.message);
      }
    });
  });
  document.querySelectorAll("[data-roster-del]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const p = roster.players.find((x) => x.id === btn.dataset.rosterDel);
      if (!p) return;
      if (!confirm("Delete " + p.name + " from the roster permanently?")) return;
      try {
        const saved = await api.send("/api/roster/" + p.id, "DELETE");
        Object.assign(roster, saved);
        redraw();
      } catch (err) {
        alert(err.message);
      }
    });
  });
  bindPosEditor(document.getElementById("roster-embed"), roster, redraw);
  bindPhones(roster);
  const editBtn = document.getElementById("toggle-roster-edit");
  if (editBtn) {
    editBtn.addEventListener("click", () => {
      rosterEditing = !rosterEditing;
      const box = document.getElementById("roster-embed");
      if (box) box.classList.toggle("roster-editing", rosterEditing);
      editBtn.textContent = rosterEditing ? "Hide statuses" : "Edit statuses";
    });
  }
  if (typeof loadOffense === "function") loadOffense(roster);
}
