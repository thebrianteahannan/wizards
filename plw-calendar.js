const LEAGUE = 61713;
const CAL_URL =
  "https://www.mystatsonline.com/ballsports/visitor/league/schedule_scores/calendar.aspx?IDLeague=" + LEAGUE;

const MONTHS = {
  January: 0,
  February: 1,
  March: 2,
  April: 3,
  May: 4,
  June: 5,
  July: 6,
  August: 7,
  September: 8,
  October: 9,
  November: 10,
  December: 11,
};

const TEAM_NAMES = {
  BTZ: "Blitz",
  DEM: "Dem Bois",
  FLM: "Flamingos",
  RPR: "Reapers",
  SAN: "Sandvipers",
  SVG: "Savages",
  STP: "Step Above",
  WIZ: "Wizards",
  TBD: "To Be Determined",
  WAR: "Warbirds",
  PUF: "Pufferfish",
};

const WEEKDAYS = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];

let cache = { at: 0, nights: null, error: "" };

function todayStamp() {
  const d = new Date();
  return (
    d.getFullYear() +
    "-" +
    String(d.getMonth() + 1).padStart(2, "0") +
    "-" +
    String(d.getDate()).padStart(2, "0")
  );
}

function teamName(code) {
  return TEAM_NAMES[code] || code;
}

function isClock(status) {
  return /\b\d{1,2}:\d{2}\s*(AM|PM)\b/i.test(String(status || ""));
}

function isScore(status) {
  return /^\d+\s*-\s*\d+$/.test(String(status || "").trim());
}

function parseScorePair(status) {
  const m = String(status || "").trim().match(/^(\d+)\s*-\s*(\d+)$/);
  if (!m) return null;
  return { away: Number(m[1]), home: Number(m[2]) };
}

function wizGameOutcome(g) {
  const pair = parseScorePair(g && g.time);
  if (!pair || (g.away !== "WIZ" && g.home !== "WIZ")) return null;
  const us = g.home === "WIZ" ? pair.home : pair.away;
  const them = g.home === "WIZ" ? pair.away : pair.home;
  return { us, them, mark: us > them ? "W" : us < them ? "L" : "T" };
}

function normalizeTime(status) {
  const m = String(status || "").match(/(\d{1,2}:\d{2})\s*(AM|PM)/i);
  if (!m) return "";
  return m[1] + " " + m[2].toUpperCase();
}

async function fetchHtml(url, body) {
  const res = await fetch(url, {
    method: body ? "POST" : "GET",
    headers: {
      "User-Agent": "Mozilla/5.0 WizardsHub",
      ...(body ? { "Content-Type": "application/x-www-form-urlencoded" } : {}),
    },
    body: body || undefined,
  });
  if (!res.ok) throw new Error("MyStats calendar " + res.status);
  return res.text();
}

function viewFields(html) {
  const grab = (id) => {
    const m = String(html || "").match(new RegExp('id="' + id + '"[^>]*value="([^"]*)"', "i"));
    return m ? m[1] : "";
  };
  return {
    __VIEWSTATE: grab("__VIEWSTATE"),
    __VIEWSTATEGENERATOR: grab("__VIEWSTATEGENERATOR"),
    __EVENTVALIDATION: grab("__EVENTVALIDATION"),
  };
}

function monthArg(html, title) {
  const m = String(html || "").match(
    new RegExp(`__doPostBack\\('ctl00\\$maincontent\\$calMonthlySchedule','(V\\d+)'\\)"[^>]*title="${title}"`)
  );
  return m ? m[1] : "";
}

function nextMonthArg(html) {
  return monthArg(html, "Go to the next month");
}

function prevMonthArg(html) {
  return monthArg(html, "Go to the previous month");
}

async function fetchPostedMonth(baseHtml, arg) {
  if (!arg) return [];
  const fields = viewFields(baseHtml);
  const body = new URLSearchParams({
    ...fields,
    __EVENTTARGET: "ctl00$maincontent$calMonthlySchedule",
    __EVENTARGUMENT: arg,
  });
  const page = await fetchHtml(CAL_URL, body.toString());
  return parseMonthNights(page);
}

function parseMonthNights(html) {
  const monthHit = String(html || "").match(
    /(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{4})/
  );
  if (!monthHit) return [];
  const year0 = Number(monthHit[2]);
  const month0 = MONTHS[monthHit[1]];
  const parts = String(html || "").split(/class="(cal-date(?:-other)?)"/);
  const byDate = {};
  for (let i = 1; i < parts.length; i += 2) {
    const kind = parts[i];
    const chunk = parts[i + 1] || "";
    const dayHit = chunk.match(/^>(\d{1,2})</);
    if (!dayHit) continue;
    const dayNum = Number(dayHit[1]);
    let y = year0;
    let mo = month0;
    if (kind === "cal-date-other" && dayNum > 20) {
      mo = month0 - 1;
      if (mo < 0) {
        mo = 11;
        y -= 1;
      }
    } else if (kind === "cal-date-other" && dayNum < 15) {
      mo = month0 + 1;
      if (mo > 11) {
        mo = 0;
        y += 1;
      }
    }
    const date = y + "-" + String(mo + 1).padStart(2, "0") + "-" + String(dayNum).padStart(2, "0");
    const gameRe =
      /cal-game-away-abbr[^>]*>([^<]+)<[\s\S]*?game_score_ball\(\d+\)'>([^<]+)<[\s\S]*?cal-game-home-abbr[^>]*>([^<]+)</g;
    let g;
    while ((g = gameRe.exec(chunk))) {
      const away = g[1].trim();
      const status = g[2].trim();
      const home = g[3].trim();
      if (!isClock(status) && !isScore(status)) continue;
      if (![away, home].some((t) => t === "WIZ" || t === "TBD")) continue;
      const time = isClock(status) ? normalizeTime(status) : String(status).trim();
      if (!time) continue;
      const row = byDate[date] || (byDate[date] = { date, games: [] });
      row.games.push({ away, home, time });
    }
  }
  return Object.values(byDate);
}

function sortTimes(times) {
  return [...new Set(times)].sort((a, b) => {
    const toMin = (t) => {
      const m = String(t).match(/(\d{1,2}):(\d{2})\s*(AM|PM)/i);
      if (!m) return 0;
      let h = Number(m[1]) % 12;
      if (/pm/i.test(m[3])) h += 12;
      return h * 60 + Number(m[2]);
    };
    return toMin(a) - toMin(b);
  });
}

function formatTimes(times) {
  const sorted = sortTimes(times);
  const tags = sorted.map((t) => ((String(t).match(/AM|PM/i) || [""])[0] || "").toUpperCase());
  const same = tags.length && tags.every((a) => a && a === tags[0]);
  if (same) return sorted.map((t) => t.replace(/\s*(AM|PM)/i, "")).join(" · ") + " " + tags[0];
  return sorted.join(" · ");
}

function offerFromNight(night) {
  const games = night.games || [];
  const times = sortTimes(games.map((g) => g.time));
  const wiz = games.find((g) => g.away === "WIZ" || g.home === "WIZ");
  let note;
  if (wiz) {
    const them = wiz.away === "WIZ" ? wiz.home : wiz.away;
    note = "vs " + teamName(them);
  } else {
    const open = games.find((g) => g.away === "TBD" || g.home === "TBD") || games[0];
    const them = open.away === "TBD" ? open.home : open.away;
    note = "Open · vs " + teamName(them);
  }
  if (times.length) note += " · " + times.join(" / ");
  const weekday = WEEKDAYS[new Date(night.date + "T12:00:00").getDay()];
  return {
    date: night.date,
    day: weekday,
    note,
    times,
    source: "mystats",
  };
}

function mergeNights(into, extra) {
  for (const n of extra || []) {
    if (!into.some((x) => x.date === n.date)) into.push(n);
  }
}

async function loadCalendarNights(force) {
  if (!force && cache.nights && Date.now() - cache.at < 10 * 60 * 1000) return cache.nights;
  const first = await fetchHtml(CAL_URL);
  const nights = parseMonthNights(first);
  try {
    mergeNights(nights, await fetchPostedMonth(first, prevMonthArg(first)));
  } catch (_) {}
  try {
    mergeNights(nights, await fetchPostedMonth(first, nextMonthArg(first)));
  } catch (_) {}
  nights.sort((a, b) => a.date.localeCompare(b.date));
  cache = { at: Date.now(), nights, error: "" };
  return nights;
}

async function syncLeagueOffers(avail, opts) {
  const force = !!(opts && opts.refresh);
  let nights = [];
  try {
    nights = await loadCalendarNights(force);
  } catch (err) {
    cache.error = String(err.message || err);
    return { avail, synced: 0, error: cache.error };
  }
  const today = todayStamp();
  const nextOffers = nights
    .filter((n) => n.date >= today && (n.games || []).some((g) => isClock(g.time)))
    .map(offerFromNight);
  const keep = (avail.offers || []).filter(
    (o) => o && o.source !== "mystats" && (!o.date || o.date >= today)
  );
  const byDate = new Map();
  for (const o of keep) {
    if (o.date) byDate.set(o.date, o);
  }
  for (const o of nextOffers) byDate.set(o.date, o);
  avail.offers = [...byDate.values()].sort((a, b) => String(a.date || "").localeCompare(String(b.date || "")));
  return { avail, synced: nextOffers.length, error: "" };
}

function eventFromWizNight(night) {
  const games = (night.games || []).filter((g) => g.away === "WIZ" || g.home === "WIZ");
  if (!games.length) return null;
  const wiz = games[0];
  const them = wiz.away === "WIZ" ? wiz.home : wiz.away;
  const title = wiz.home === "WIZ" ? teamName(them) + " vs Wizards" : "Wizards vs " + teamName(them);
  const today = todayStamp();
  const clocks = games.map((g) => g.time).filter(isClock);
  const scores = games.map((g) => g.time).filter(isScore);
  const outcomes = games.map(wizGameOutcome).filter(Boolean);
  const wins = outcomes.filter((o) => o.mark === "W").length;
  const losses = outcomes.filter((o) => o.mark === "L").length;
  const ties = outcomes.filter((o) => o.mark === "T").length;
  const played = night.date < today || (scores.length > 0 && !clocks.length);
  const rec = played && outcomes.length ? (ties ? wins + "-" + losses + "-" + ties : wins + "-" + losses) : "";
  const mark = played && outcomes.length ? (wins > losses ? "W" : wins < losses ? "L" : "T") : "";
  const ev = {
    id: "plw-" + night.date,
    date: night.date,
    title,
    when: clocks.length ? formatTimes(clocks) : scores.join(" · "),
    kind: "league",
    status: played ? "played" : "upcoming",
    detail: played ? "Final on the PLW calendar." : "Locked on the PLW MyStats calendar.",
    source: "mystats",
  };
  if (played && outcomes.length) {
    ev.wins = wins;
    ev.losses = losses;
    ev.ties = ties;
    ev.result = mark;
    ev.record = rec;
  }
  return ev;
}

function sameEvent(a, b) {
  return (
    a.title === b.title &&
    a.when === b.when &&
    a.status === b.status &&
    a.detail === b.detail &&
    a.source === b.source &&
    a.wins === b.wins &&
    a.losses === b.losses &&
    a.ties === b.ties &&
    a.result === b.result &&
    a.record === b.record
  );
}

async function syncScheduleEvents(schedule, opts) {
  let nights = [];
  try {
    nights = await loadCalendarNights(!!(opts && opts.refresh));
  } catch (err) {
    return { schedule, changed: false, error: String(err.message || err) };
  }
  const incoming = nights.map(eventFromWizNight).filter(Boolean);
  const incomingIds = new Set(incoming.map((e) => e.id));
  const today = todayStamp();
  const kept = [];
  let changed = false;
  for (const e of schedule.events || []) {
    if (e && e.source === "mystats" && e.date >= today && !incomingIds.has(e.id)) {
      changed = true;
      continue;
    }
    kept.push(e);
  }
  for (const ev of incoming) {
    const i = kept.findIndex((e) => e && (e.id === ev.id || (e.source === "mystats" && e.date === ev.date)));
    if (i >= 0) {
      if (!sameEvent(kept[i], ev)) {
        kept[i] = { ...kept[i], ...ev, id: kept[i].id || ev.id };
        changed = true;
      }
      continue;
    }
    const j = kept.findIndex((e) => e && e.date === ev.date && e.kind === "league");
    if (j >= 0) {
      const merged = {
        ...kept[j],
        title: ev.title,
        when: ev.when,
        status: ev.status,
        detail: ev.detail,
        source: "mystats",
        wins: ev.wins,
        losses: ev.losses,
        ties: ev.ties,
        result: ev.result,
        record: ev.record,
      };
      if (!sameEvent(kept[j], merged)) {
        kept[j] = merged;
        changed = true;
      }
    } else {
      kept.push(ev);
      changed = true;
    }
  }
  kept.sort((a, b) => String(a.date || "").localeCompare(String(b.date || "")));
  return { schedule: { ...schedule, events: kept }, changed, error: "" };
}

module.exports = { syncLeagueOffers, syncScheduleEvents, loadCalendarNights, CAL_URL };
