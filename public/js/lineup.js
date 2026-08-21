function rowName(row) {
  return (row && (row.name || [row.first, row.last].filter(Boolean).join(" "))) || "";
}

function vsPickLineup(rows, fn, names, allowStub) {
  if (!names || !names.length) return vsPick(rows, fn);
  const out = [];
  for (const n of names) {
    const hit = (rows || []).find((r) => nameHit(rowName(r), n));
    if (hit) out.push({ r: hit, s: fn(hit) });
    else if (allowStub) out.push({ r: { name: n }, s: null });
    if (out.length >= 6) break;
  }
  return out;
}

function lineupExtras(names, team) {
  const pool = [...((team && team.batters) || []), ...((team && team.pitchers) || [])];
  return (names || []).filter((n) => !pool.some((r) => nameHit(rowName(r), n)));
}

function renderLineupBox(them, offer, saved) {
  const names = (saved && saved.names) || [];
  const extras = lineupExtras(names, them);
  const extraHtml = extras.length
    ? `<p class="muted" style="margin:0.4rem 0 0">Not in PLW yet: ${extras.map((n) => `<strong>${escapeHtml(n)}</strong>`).join(", ")}</p>`
    : "";
  const list = names.length
    ? `<p class="muted" style="margin:0.35rem 0 0">Posted lineup (${names.length}): ${names.map((n) => escapeHtml(n)).join(" · ")}</p>`
    : `<p class="muted" style="margin:0.35rem 0 0">Using their full PLW roster — no lineup posted.</p>`;
  if (!isAdmin()) return names.length ? list + extraHtml : "";
  const date = (offer && (offer.date || offer.day)) || "";
  return `
    <div id="opp-lineup" class="form-row" data-date="${escapeHtml(date)}" data-team="${escapeHtml(them.code)}" style="margin:0.7rem 0 0">
      <label>Paste their lineup</label>
      <textarea name="lineup" rows="5" maxlength="2000" placeholder="1. Elyjah Sayre&#10;2. Zack Rosario">${escapeHtml((saved && saved.text) || "")}</textarea>
      <div class="actions" style="margin:0">
        <button type="button" class="btn" data-lineup-save>Save lineup</button>
        <button type="button" class="btn ghost" data-lineup-clear>Clear</button>
      </div>
      <p class="muted" id="lineup-msg" style="margin:0">${names.length ? "Saved. Hitting and pitching lists gray out anyone not on this card." : "Paste from Facebook. Clear to use their full roster again."}</p>
      ${list}${extraHtml}
    </div>`;
}

function beatPlan(us, them, um, tm, usRank, themRank, book, extra) {
  extra = extra || {};
  const posted = extra.lineup || [];
  const ours = extra.oursNames || [];
  const { bats, arms } = bookPool(book);
  const weakBat = weakKeys(them.batters, SCOUT_BAT, BAT_DIR, bats);
  const weakPit = weakKeys(them.pitchers, SCOUT_PIT, PIT_DIR, arms);
  const leak = weakPit.includes("era") || weakPit.includes("h") || weakPit.includes("avg");
  const walkish = weakPit.includes("bb") || weakPit.includes("whip");
  const noWalk = weakBat.includes("bb") || weakBat.includes("obp");
  const punch = weakBat.includes("so") || weakBat.includes("avg");
  const yesArms = ours.filter((n) => (us.pitchers || []).some((r) => nameHit(rowName(r), n)));
  const staff = yesArms.length ? ` Yes arms tonight: ${yesArms.join(", ")}.` : " Jose, Cam, Brian, and Tony stay in the staff even without posted IP.";
  const tips = [];
  const ahead = um.all != null && tm.all != null && um.all >= tm.all;
  tips.push(
    ahead
      ? `We're #${usRank} vs #${themRank}. Packet script: strikes under 55 into the K-zone, 5-second outs, keep RA low. Play our game and make them beat a clean six.`
      : `They're #${themRank} vs our #${usRank}. Packet underdog path: steal one close, two walks scratch an arm, fewest runs allowed is tiebreaker #2.`
  );
  if ((tm.bat || 0) > (um.pit || 0)) {
    tips.push("Their bats grade hotter than our arms. Attack the 0–1, stay under 55, do not nibble into walk #2. Last eligible pitcher has no walk cap." + staff);
  } else if (noWalk && punch) {
    tips.push("They don't walk and they chase. Pound the zone under 55; mix spin after you get ahead. Two free passes scratch that arm." + staff);
  } else if (noWalk) {
    tips.push("They don't walk — throw strikes under 55 and let them get themselves out. Protect the 2-walk cap; last pitcher has no limit." + staff);
  } else {
    tips.push("Every AB starts 0–1. Live under 55 with movement. Two walks and that pitcher is done — challenge the zone rather than dance." + staff);
  }
  if ((um.bat || 0) > (tm.pit || 0) && leak) {
    tips.push("Our bats grade hotter and their arms leak. Shorten up (already 0–1), put it through the infield line. Bounce before the wall is a double; air to the wall is a triple.");
  } else if (walkish) {
    tips.push("They walk hitters. Don't chase. Take until they miss, then hunt the mistake. Two-strike: soft contact — two foul tips into the K-zone is a K.");
  } else if (leak) {
    tips.push("Their arms leak runs. Jump a mistake, but stay short: put the ball in play past the cheap line. Hero swings play into good pitching.");
  } else {
    tips.push("Offense: already 0–1 so shorten up. Aim doubles/triples geometry. You can bat 6–12 — put contact first and hide weaker bats at the bottom.");
  }
  const extras = lineupExtras(posted, them);
  if (posted.length) {
    const mid = posted[2] || posted[3] || posted[0];
    const extraBit = extras.length ? ` New names not in PLW: ${extras.slice(0, 3).join(", ")}.` : "";
    tips.push(`Posted card: ${posted.slice(0, 6).join(", ")}. Work around ${mid} if they heat up (an IBB still counts as a walk).${extraBit}`);
  } else {
    tips.push("No lineup pasted yet — treat their full PLW list as live. Save a Facebook card and we gray the sitters and name any subs.");
  }
  tips.push("Defense from the packet: catch + throw to the backstop/K-zone in 5 seconds. Hold singles with a <5s throw to 3B. Only managers talk to umps.");
  const seen = new Set();
  return tips.filter((t) => (seen.has(t) ? false : seen.add(t))).slice(0, 5);
}

function bindOppLineup(reload) {
  const box = document.getElementById("opp-lineup");
  if (!box) return;
  const msg = document.getElementById("lineup-msg");
  const send = async (text) => {
    try {
      if (msg) msg.textContent = "Saving…";
      await api.send("/api/lineups", "PUT", { date: box.dataset.date, team: box.dataset.team, text });
      if (reload) reload();
    } catch (err) {
      if (msg) msg.textContent = err.message;
    }
  };
  const area = box.querySelector("textarea");
  const save = box.querySelector("[data-lineup-save]");
  const clear = box.querySelector("[data-lineup-clear]");
  if (save) save.addEventListener("click", () => send(area ? area.value : ""));
  if (clear) clear.addEventListener("click", () => send(""));
}
