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

function nextMonthArg(html) {
  const m = String(html || "").match(
    /__doPostBack\('ctl00\$maincontent\$calMonthlySchedule','(V\d+)'\)"[^>]*title="Go to the next month"/
  );
  return m ? m[1] : "";
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
      if (!isClock(status)) continue;
      if (![away, home].some((t) => t === "WIZ" || t === "TBD")) continue;
      const time = normalizeTime(status);
      if (!time) continue;
      const row = byDate[date] || (byDate[date] = { date, games: [] });
      row.games.push({ away, home, time });
    }
  }
  return Object.values(byDate);
}

function offerFromNight(night) {
  const games = night.games || [];
  const times = [...new Set(games.map((g) => g.time))];
  times.sort((a, b) => {
    const toMin = (t) => {
      const m = t.match(/(\d{1,2}):(\d{2})\s*(AM|PM)/i);
      if (!m) return 0;
      let h = Number(m[1]) % 12;
      if (/pm/i.test(m[3])) h += 12;
      return h * 60 + Number(m[2]);
    };
    return toMin(a) - toMin(b);
  });
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

async function loadCalendarNights(force) {
  if (!force && cache.nights && Date.now() - cache.at < 10 * 60 * 1000) return cache.nights;
  const first = await fetchHtml(CAL_URL);
  const nights = parseMonthNights(first);
  const nextArg = nextMonthArg(first);
  if (nextArg) {
    try {
      const fields = viewFields(first);
      const body = new URLSearchParams({
        ...fields,
        __EVENTTARGET: "ctl00$maincontent$calMonthlySchedule",
        __EVENTARGUMENT: nextArg,
      });
      const second = await fetchHtml(CAL_URL, body.toString());
      for (const n of parseMonthNights(second)) {
        if (!nights.some((x) => x.date === n.date)) nights.push(n);
      }
    } catch (_) {}
  }
  const today = todayStamp();
  const upcoming = nights.filter((n) => n.date >= today).sort((a, b) => a.date.localeCompare(b.date));
  cache = { at: Date.now(), nights: upcoming, error: "" };
  return upcoming;
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
  const nextOffers = nights.map(offerFromNight);
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

module.exports = { syncLeagueOffers, loadCalendarNights, CAL_URL };
