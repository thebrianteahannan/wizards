const fs = require("fs");
const path = require("path");
const express = require("express");

const app = express();
const PORT = process.env.PORT || 3000;
const DATA = path.join(__dirname, "data");

app.use(express.json({ limit: "200kb" }));
app.use(express.static(path.join(__dirname, "public")));

const DAYS = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"];
const WINDOWS = ["afternoon", "evening", "night"];
const STATUSES = ["yes", "maybe", "no"];

function readJson(file) {
  return JSON.parse(fs.readFileSync(path.join(DATA, file), "utf8"));
}

function writeJson(file, value) {
  const dest = path.join(DATA, file);
  const tmp = dest + ".tmp";
  fs.writeFileSync(tmp, JSON.stringify(value, null, 2));
  fs.renameSync(tmp, dest);
}

function rosterById() {
  const roster = readJson("roster.json");
  const map = {};
  for (const p of roster.players) map[p.id] = p;
  return { roster, map };
}

app.get("/api/roster", (_req, res) => {
  res.json(readJson("roster.json"));
});

app.get("/api/schedule", (_req, res) => {
  res.json(readJson("schedule.json"));
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

function readActivity() {
  try {
    const log = readJson("activity.json");
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

function logAvailability(player, kind, prevDays, nextDays, keys) {
  const lines = [];
  for (const key of keys) {
    if (stampAvail(prevDays[key]) === stampAvail(nextDays[key])) continue;
    lines.push(capDay(key) + ": " + stampAvail(prevDays[key]) + " → " + stampAvail(nextDays[key]));
  }
  if (!lines.length) return;
  const log = readActivity();
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
  writeJson("activity.json", log);
}

app.get("/api/availability", (req, res) => {
  res.json(readJson(AVAIL_FILES[availKind(req)]));
});

app.get("/api/activity", (_req, res) => {
  res.json(readActivity());
});

app.put("/api/availability/:playerId", (req, res) => {
  const { map } = rosterById();
  const player = map[req.params.playerId];
  if (!player) return res.status(404).json({ error: "Unknown player" });

  const days = req.body && req.body.days;
  if (!days || typeof days !== "object") {
    return res.status(400).json({ error: "days object required" });
  }

  const kind = availKind(req);
  const file = AVAIL_FILES[kind];
  const avail = readJson(file);
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
  writeJson(file, avail);
  try {
    logAvailability(player, kind, prev, clean, submitted);
  } catch (_) {}
  res.json(avail);
});

app.post("/api/lock-night", (req, res) => {
  const { map } = rosterById();
  const player = map[req.body && req.body.playerId];
  if (!player) return res.status(404).json({ error: "Unknown player" });
  if (player.role !== "Co-manager") {
    return res.status(403).json({ error: "Only co-managers can lock a league night" });
  }

  const file = AVAIL_FILES[availKind(req)];
  const avail = readJson(file);
  if (req.body.clear) {
    avail.lockedNight = null;
    writeJson(file, avail);
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
    lockedBy: player.name,
    lockedAt: new Date().toISOString(),
  };
  writeJson(file, avail);
  res.json(avail);
});

app.get("/api/board", (_req, res) => {
  res.json(readJson("announcements.json"));
});

const JERSEY_SIZES = ["S", "M", "L", "XL", "2XL", "3XL"];

app.get("/api/jerseys", (_req, res) => {
  res.json(readJson("jerseys.json"));
});

app.post("/api/jerseys", (req, res) => {
  const { map } = rosterById();
  const player = map[req.body && req.body.playerId];
  if (!player) return res.status(404).json({ error: "Unknown player" });

  const number = Number.parseInt(String(req.body.number ?? ""), 10);
  if (!Number.isInteger(number) || number < 0 || number > 99) {
    return res.status(400).json({ error: "Jersey number must be 0-99" });
  }
  const size = String(req.body.size || "").toUpperCase();
  if (!JERSEY_SIZES.includes(size)) {
    return res.status(400).json({ error: "Pick a size" });
  }

  const data = readJson("jerseys.json");
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
  writeJson("jerseys.json", data);
  res.json(data);
});

app.post("/api/board", (req, res) => {
  const { map } = rosterById();
  const player = map[req.body && req.body.authorId];
  if (!player) return res.status(404).json({ error: "Unknown player" });

  const title = String(req.body.title || req.body.body || "").trim().slice(0, 120);
  const body = String(req.body.body || "").trim().slice(0, 2000);
  const category = String(req.body.category || "General").trim().slice(0, 32);
  if (!body) return res.status(400).json({ error: "Message required" });

  const board = readJson("announcements.json");
  board.posts.unshift({
    id: "p" + Date.now(),
    authorId: player.id,
    authorName: player.name,
    createdAt: new Date().toISOString(),
    category,
    title,
    body,
  });
  writeJson("announcements.json", board);
  res.json(board);
});

app.get("/api/contacts", (_req, res) => {
  res.json(readJson("contacts.json"));
});

const JOIN_POS = ["P", "C", "2B", "SS", "LF", "CF", "RF", "Util"];

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

app.get("/api/recruits", (_req, res) => {
  res.json(readJson("recruits.json"));
});

app.post("/api/recruits", (req, res) => {
  const parsed = parseRecruit(req.body, true);
  if (parsed.error) return res.status(400).json({ error: parsed.error });
  const data = readJson("recruits.json");
  data.recruits.unshift({
    id: "r" + Date.now(),
    ...parsed.value,
    createdAt: new Date().toISOString(),
  });
  writeJson("recruits.json", data);
  res.json(data);
});

app.put("/api/recruits/:id", (req, res) => {
  const parsed = parseRecruit(req.body, false);
  if (parsed.error) return res.status(400).json({ error: parsed.error });
  const data = readJson("recruits.json");
  const i = data.recruits.findIndex((r) => r.id === req.params.id);
  if (i < 0) return res.status(404).json({ error: "Unknown recruit" });
  data.recruits[i] = {
    ...data.recruits[i],
    ...parsed.value,
    updatedAt: new Date().toISOString(),
  };
  writeJson("recruits.json", data);
  res.json(data);
});

const FEE_MODELS = ["flat", "split", "core", "play"];

app.get("/api/fees", (_req, res) => {
  res.json(readJson("fees.json"));
});

app.put("/api/fees", (req, res) => {
  const { map } = rosterById();
  const player = map[req.body && req.body.playerId];
  if (!player) return res.status(404).json({ error: "Unknown player" });
  if (player.role !== "Co-manager") {
    return res.status(403).json({ error: "Only co-managers can change the fee model" });
  }

  const model = FEE_MODELS.includes(req.body.model) ? req.body.model : "flat";
  const num = (value, fallback) => {
    const n = Number(value);
    return Number.isFinite(n) && n >= 0 ? n : fallback;
  };
  const coreIds = Array.isArray(req.body.corePlayerIds)
    ? req.body.corePlayerIds.filter((id) => map[id]).slice(0, 6)
    : [];

  const fees = {
    ...readJson("fees.json"),
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
    updatedBy: player.name,
    updatedAt: new Date().toISOString(),
  };
  writeJson("fees.json", fees);
  res.json(fees);
});

app.put("/api/fees/ledger", (req, res) => {
  const { map } = rosterById();
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
  const fees = { ...readJson("fees.json"), ledger };
  writeJson("fees.json", fees);
  res.json(fees);
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Wizards hub running at http://localhost:${PORT}`);
});
