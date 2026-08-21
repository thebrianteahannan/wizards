const path = require("path");
const express = require("express");
const { init, readJson, writeJson, status } = require("./store");
const { attachAuth, requireTeam, requireAdmin, resolvePlayer } = require("./accounts");
const { attachRecruitActions } = require("./recruit-actions");
const { getPlwStats } = require("./plw-stats");
const { attachPlwLeague } = require("./plw-league");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json({ limit: "200kb" }));
attachAuth(app);
app.get("/media/Wizards_of_Wiffs_PLW_Tournament_Aug1_2026.pdf", requireTeam, (req, res) => {
  res.sendFile(path.join(__dirname, "public/media/Wizards_of_Wiffs_PLW_Tournament_Aug1_2026.pdf"));
});
app.use(express.static(path.join(__dirname, "public")));

const DAYS = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"];
const WINDOWS = ["afternoon", "evening", "night"];
const STATUSES = ["yes", "maybe", "no"];

async function rosterById() {
  const roster = await readJson("roster.json");
  const map = {};
  for (const p of roster.players) map[p.id] = p;
  return { roster, map };
}

async function playerOrFail(req, res) {
  const player = await resolvePlayer(req.user);
  if (!player) {
    res.status(400).json({ error: "Your login is not linked to a roster name. Ask a manager." });
    return null;
  }
  return player;
}

app.get("/api/roster", async (_req, res) => {
  res.json(await readJson("roster.json"));
});

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, ...status() });
});

app.get("/api/schedule", async (_req, res) => {
  res.json(await readJson("schedule.json"));
});

const AVAIL_FILES = {
  league: "availability.json",
  tournament: "tournament.json",
  practice: "practice.json",
};

function availKind(req) {
  const k = (req.query && req.query.kind) || (req.body && req.body.kind) || "league";
  return AVAIL_FILES[k] ? k : "league";
}

function isDayKey(key) {
  return DAYS.includes(key) || /^\d{4}-\d{2}-\d{2}$/.test(key);
}

function isWindowId(w) {
  return WINDOWS.includes(w) || /^t-[a-z0-9-]{1,32}$/.test(String(w || ""));
}

async function readActivity() {
  try {
    const log = await readJson("activity.json");
    return Array.isArray(log.entries) ? log : { entries: [] };
  } catch (_) {
    return { entries: [] };
  }
}

function capDay(key) {
  if (/^\d{4}-\d{2}-\d{2}$/.test(key)) {
    return new Date(key + "T12:00:00").toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
    });
  }
  const s = String(key || "");
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function stampAvail(entry) {
  if (!entry) return "—";
  const status = entry.status || "no";
  if (status === "no") return "no";
  const hints = { afternoon: "12-5", evening: "5-9", night: "9-11" };
  const wins = (entry.windows || []).map((id) => hints[id] || String(id).replace(/^t-/, "").replace(/-/g, " "));
  return wins.length ? status + " · " + wins.join(", ") : status;
}

async function logAvailability(player, kind, prevDays, nextDays, keys) {
  const lines = [];
  for (const key of keys) {
    if (stampAvail(prevDays[key]) === stampAvail(nextDays[key])) continue;
    lines.push(capDay(key) + ": " + stampAvail(prevDays[key]) + " → " + stampAvail(nextDays[key]));
  }
  if (!lines.length) return;
  const log = await readActivity();
  log.entries.unshift({
    id: "a" + Date.now(),
    at: new Date().toISOString(),
    playerId: player.id,
    playerName: player.name,
    kind,
    action: Object.keys(prevDays || {}).length ? "updated" : "set",
    lines,
  });
  log.entries = log.entries.slice(0, 400);
  await writeJson("activity.json", log);
}

app.get("/api/availability", async (req, res) => {
  res.json(await readJson(AVAIL_FILES[availKind(req)]));
});

function clockLabel(t) {
  const m = String(t || "").match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return "";
  let h = Number(m[1]);
  const min = m[2];
  if (h < 0 || h > 23) return "";
  const ampm = h >= 12 ? "PM" : "AM";
  h = h % 12 || 12;
  return h + ":" + min + " " + ampm;
}

app.post("/api/practice", requireTeam, async (req, res) => {
  const date = String((req.body && req.body.date) || "");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return res.status(400).json({ error: "Pick a date" });
  const label = clockLabel(req.body && req.body.time);
  if (!label) return res.status(400).json({ error: "Pick a time" });
  const location = String((req.body && req.body.location) || "").trim().slice(0, 80);
  if (location.length < 2) return res.status(400).json({ error: "Add a location" });
  const player = await resolvePlayer(req.user);
  const who = (player && player.name) || req.user.username;
  const weekday = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"][
    new Date(date + "T12:00:00").getDay()
  ];
  const avail = await readJson("practice.json");
  avail.offers = Array.isArray(avail.offers) ? avail.offers : [];
  if (avail.offers.length >= 60) return res.status(400).json({ error: "Too many sessions. Delete an old one first." });
  avail.offers.push({
    date,
    day: weekday,
    note: location + " · " + label,
    times: [label],
    location,
    time: label,
    createdBy: who,
  });
  avail.offers.sort((a, b) => String(a.date).localeCompare(String(b.date)));
  await writeJson("practice.json", avail);
  res.json(avail);
});

app.get("/api/activity", requireTeam, async (_req, res) => {
  res.json(await readActivity());
});

app.put("/api/availability/:playerId", requireTeam, async (req, res) => {
  const player = await playerOrFail(req, res);
  if (!player) return;

  const days = req.body && req.body.days;
  if (!days || typeof days !== "object") {
    return res.status(400).json({ error: "days object required" });
  }

  const kind = availKind(req);
  const file = AVAIL_FILES[kind];
  const avail = await readJson(file);
  const prev = ((avail.players[player.id] || {}).days) || {};
  const clean = { ...prev };
  const submitted = [];
  for (const day of DAYS) {
    if (!Object.prototype.hasOwnProperty.call(days, day)) continue;
    const entry = days[day] || {};
    const status = STATUSES.includes(entry.status) ? entry.status : "no";
    const windows = Array.isArray(entry.windows)
      ? entry.windows.filter((w) => isWindowId(w)).slice(0, 8)
      : [];
    clean[day] = { status, windows: status === "no" ? [] : windows };
    submitted.push(day);
  }
  for (const key of Object.keys(days)) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(key)) continue;
    const entry = days[key] || {};
    const status = STATUSES.includes(entry.status) ? entry.status : "no";
    const windows = Array.isArray(entry.windows)
      ? entry.windows.filter((w) => isWindowId(w)).slice(0, 8)
      : [];
    clean[key] = { status, windows: status === "no" ? [] : windows };
    submitted.push(key);
  }

  avail.players[player.id] = {
    name: player.name,
    updatedAt: new Date().toISOString(),
    days: clean,
  };
  await writeJson(file, avail);
  try {
    await logAvailability(player, kind, prev, clean, submitted);
  } catch (_) {}
  res.json(avail);
});

app.post("/api/lock-night", requireTeam, async (req, res) => {
  const player = await resolvePlayer(req.user);
  if (req.user.role !== "admin" && (!player || player.role !== "Co-manager")) {
    return res.status(403).json({ error: "Only co-managers can lock a league night" });
  }

  const file = AVAIL_FILES[availKind(req)];
  const avail = await readJson(file);
  if (req.body.clear) {
    avail.lockedNight = null;
    await writeJson(file, avail);
    return res.json(avail);
  }

  const day = req.body.day;
  const windowId = req.body.window;
  if (!isDayKey(day) || !isWindowId(windowId)) {
    return res.status(400).json({ error: "Valid day and window required" });
  }

  avail.lockedNight = {
    day,
    window: windowId,
    lockedBy: (player && player.name) || req.user.username,
    lockedAt: new Date().toISOString(),
  };
  await writeJson(file, avail);
  res.json(avail);
});

app.get("/api/board", requireTeam, async (_req, res) => {
  res.json(await readJson("announcements.json"));
});

const JERSEY_SIZES = ["S", "M", "L", "XL", "2XL", "3XL"];

app.get("/api/jerseys", requireTeam, async (_req, res) => {
  res.json(await readJson("jerseys.json"));
});

app.post("/api/jerseys", requireTeam, async (req, res) => {
  const player = await playerOrFail(req, res);
  if (!player) return;

  const number = Number.parseInt(String(req.body.number ?? ""), 10);
  if (!Number.isInteger(number) || number < 0 || number > 99) {
    return res.status(400).json({ error: "Jersey number must be 0-99" });
  }
  const size = String(req.body.size || "").toUpperCase();
  if (!JERSEY_SIZES.includes(size)) {
    return res.status(400).json({ error: "Pick a size" });
  }

  const data = await readJson("jerseys.json");
  const existing = data.requests.find((r) => r.playerId === player.id);
  const request = {
    id: existing ? existing.id : "j" + Date.now(),
    playerId: player.id,
    playerName: player.name,
    number,
    size,
    createdAt: existing ? existing.createdAt : new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  data.requests = data.requests.filter((r) => r.playerId !== player.id);
  data.requests.unshift(request);
  await writeJson("jerseys.json", data);
  res.json(data);
});

app.post("/api/board", requireTeam, async (req, res) => {
  const player = await resolvePlayer(req.user);
  const authorId = player ? player.id : req.user.id;
  const authorName = player ? player.name : req.user.username;

  const title = String(req.body.title || req.body.body || "").trim().slice(0, 120);
  const body = String(req.body.body || "").trim().slice(0, 2000);
  const category = String(req.body.category || "General").trim().slice(0, 32);
  if (!body) return res.status(400).json({ error: "Message required" });

  const board = await readJson("announcements.json");
  board.posts.unshift({
    id: "p" + Date.now(),
    authorId,
    authorName,
    createdAt: new Date().toISOString(),
    category,
    title,
    body,
  });
  await writeJson("announcements.json", board);
  res.json(board);
});

app.get("/api/contacts", requireTeam, async (_req, res) => {
  res.json(await readJson("contacts.json"));
});

const JOIN_POS = ["P", "2B", "SS", "IF", "LF", "CF", "RF", "OF", "Util"];

app.get("/api/plw-stats", async (_req, res) => {
  try {
    const roster = await readJson("roster.json");
    res.json(await getPlwStats(roster.players));
  } catch (err) {
    res.status(502).json({ error: String(err.message || err), batters: [], pitchers: [] });
  }
});

app.put("/api/roster/batting", requireAdmin, async (req, res) => {
  const roster = await readJson("roster.json");
  const known = new Set(roster.players.map((p) => p.id));
  const raw = Array.isArray(req.body && req.body.battingOrder) ? req.body.battingOrder.map(String) : null;
  const pits = Array.isArray(req.body && req.body.pitchingOrder) ? req.body.pitchingOrder.map(String) : null;
  if (raw) roster.battingOrder = raw.filter((id) => known.has(id));
  if (pits) roster.pitchingOrder = pits.filter((id) => known.has(id));
  await writeJson("roster.json", roster);
  res.json(roster);
});

app.put("/api/roster/:id/squads", requireAdmin, async (req, res) => {
  const { roster, map } = await rosterById();
  const player = map[req.params.id];
  if (!player) return res.status(404).json({ error: "Unknown player" });
  const raw = Array.isArray(req.body && req.body.squads) ? req.body.squads.map(String) : [];
  player.squads = raw.filter((s) => s === "league" || s === "tournament");
  await writeJson("roster.json", roster);
  res.json(roster);
});

app.put("/api/roster/:id/positions", requireAdmin, async (req, res) => {
  const { roster, map } = await rosterById();
  const player = map[req.params.id];
  if (!player) return res.status(404).json({ error: "Unknown player" });
  const raw = Array.isArray(req.body && req.body.positions) ? req.body.positions.map(String) : [];
  const seen = new Set();
  player.positions = raw.filter((p) => JOIN_POS.includes(p) && !seen.has(p) && seen.add(p));
  await writeJson("roster.json", roster);
  res.json(roster);
});

function parseRecruit(body, requirePhone) {
  const firstName = String((body && body.firstName) || "").trim().slice(0, 40);
  const lastName = String((body && body.lastName) || "").trim().slice(0, 40);
  const number = Number.parseInt(String((body && body.number) ?? ""), 10);
  const primary = String((body && body.primary) || "").trim();
  const secondary = String((body && body.secondary) || "").trim();
  const experience = String((body && body.experience) || "").trim().slice(0, 200);
  const why = String((body && body.why) || "").trim().slice(0, 800);
  const phone = String((body && body.phone) || "").trim().slice(0, 32);
  const email = String((body && body.email) || "").trim().slice(0, 80);
  const notes = String((body && body.notes) || "").trim().slice(0, 800);
  if (!firstName || !lastName) return { error: "First and last name required" };
  if (!Number.isInteger(number) || number < 0 || number > 99) {
    return { error: "Jersey number must be 0-99" };
  }
  if (!JOIN_POS.includes(primary)) return { error: "Pick a primary position" };
  if (secondary && !JOIN_POS.includes(secondary)) return { error: "Pick a valid secondary" };
  if (requirePhone && !phone) return { error: "Phone number required" };
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { error: "Valid email or leave it blank" };
  }
  return {
    value: {
      firstName,
      lastName,
      number,
      primary,
      secondary: secondary || "",
      experience,
      why,
      phone,
      email,
      notes,
    },
  };
}

app.get("/api/recruits", requireTeam, async (_req, res) => {
  res.json(await readJson("recruits.json"));
});

app.post("/api/recruits", async (req, res) => {
  const parsed = parseRecruit(req.body, true);
  if (parsed.error) return res.status(400).json({ error: parsed.error });
  const data = await readJson("recruits.json");
  data.recruits.unshift({
    id: "r" + Date.now(),
    ...parsed.value,
    createdAt: new Date().toISOString(),
  });
  await writeJson("recruits.json", data);
  res.json(data);
});

app.put("/api/recruits/:id", requireTeam, async (req, res) => {
  const parsed = parseRecruit(req.body, false);
  if (parsed.error) return res.status(400).json({ error: parsed.error });
  const data = await readJson("recruits.json");
  const i = data.recruits.findIndex((r) => r.id === req.params.id);
  if (i < 0) return res.status(404).json({ error: "Unknown recruit" });
  data.recruits[i] = {
    ...data.recruits[i],
    ...parsed.value,
    updatedAt: new Date().toISOString(),
  };
  await writeJson("recruits.json", data);
  res.json(data);
});

attachRecruitActions(app, {
  readJson,
  writeJson,
  requireAdmin,
  positions: JOIN_POS,
});
attachPlwLeague(app, { requireTeam });

const FEE_MODELS = ["flat", "split", "core", "play"];

app.get("/api/fees", requireTeam, async (_req, res) => {
  res.json(await readJson("fees.json"));
});

app.put("/api/fees", requireAdmin, async (req, res) => {
  const { map } = await rosterById();
  const player = await resolvePlayer(req.user);

  const model = FEE_MODELS.includes(req.body.model) ? req.body.model : "flat";
  const num = (value, fallback) => {
    const n = Number(value);
    return Number.isFinite(n) && n >= 0 ? n : fallback;
  };
  const coreIds = Array.isArray(req.body.corePlayerIds)
    ? req.body.corePlayerIds.filter((id) => map[id]).slice(0, 6)
    : [];

  const fees = {
    ...(await readJson("fees.json")),
    model,
    teamTotal: num(req.body.teamTotal, 250),
    flatAmount: num(req.body.flatAmount, 25),
    dueDate: String(req.body.dueDate || "").slice(0, 10),
    payTo: String(req.body.payTo || "").trim().slice(0, 80),
    method: String(req.body.method || "").trim().slice(0, 160),
    corePlayerIds: coreIds,
    benchAmount: num(req.body.benchAmount, 0),
    expectedNights: Math.max(1, num(req.body.expectedNights, 10)),
    perNight: req.body.perNight === null || req.body.perNight === "" ? null : num(req.body.perNight, 0),
    note: String(req.body.note || "").trim().slice(0, 500),
    updatedBy: (player && player.name) || req.user.username,
    updatedAt: new Date().toISOString(),
  };
  await writeJson("fees.json", fees);
  res.json(fees);
});

app.put("/api/fees/ledger", requireAdmin, async (req, res) => {
  const { map } = await rosterById();
  const incoming = req.body && req.body.ledger;
  if (!incoming || typeof incoming !== "object") {
    return res.status(400).json({ error: "ledger required" });
  }
  const ledger = {};
  for (const [id, row] of Object.entries(incoming)) {
    if (!map[id]) continue;
    const owed = Number(row && row.owed);
    ledger[id] = {
      owed: Number.isFinite(owed) && owed >= 0 ? Math.round(owed * 100) / 100 : 0,
      comment: String((row && row.comment) || "").trim().slice(0, 240),
    };
  }
  const fees = { ...(await readJson("fees.json")), ledger };
  await writeJson("fees.json", fees);
  res.json(fees);
});

init()
  .then(() => {
    app.use((err, _req, res, _next) => {
      console.error(err);
      res.status(500).json({ error: String(err.message || err) });
    });
    app.listen(PORT, "0.0.0.0", () => {
      console.log(`Wizards hub running at http://localhost:${PORT}`);
    });
  })
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
