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

app.get("/api/availability", (_req, res) => {
  res.json(readJson("availability.json"));
});

app.put("/api/availability/:playerId", (req, res) => {
  const { map } = rosterById();
  const player = map[req.params.playerId];
  if (!player) return res.status(404).json({ error: "Unknown player" });

  const days = req.body && req.body.days;
  if (!days || typeof days !== "object") {
    return res.status(400).json({ error: "days object required" });
  }

  const clean = {};
  for (const day of DAYS) {
    const entry = days[day] || {};
    const status = STATUSES.includes(entry.status) ? entry.status : "no";
    const windows = Array.isArray(entry.windows)
      ? entry.windows.filter((w) => WINDOWS.includes(w))
      : [];
    clean[day] = { status, windows: status === "no" ? [] : windows };
  }

  const avail = readJson("availability.json");
  avail.players[player.id] = {
    name: player.name,
    updatedAt: new Date().toISOString(),
    days: clean,
  };
  writeJson("availability.json", avail);
  res.json(avail);
});

app.post("/api/lock-night", (req, res) => {
  const { map } = rosterById();
  const player = map[req.body && req.body.playerId];
  if (!player) return res.status(404).json({ error: "Unknown player" });
  if (player.role !== "Co-manager") {
    return res.status(403).json({ error: "Only co-managers can lock a league night" });
  }

  const avail = readJson("availability.json");
  if (req.body.clear) {
    avail.lockedNight = null;
    writeJson("availability.json", avail);
    return res.json(avail);
  }

  const day = req.body.day;
  const windowId = req.body.window;
  if (!DAYS.includes(day) || !WINDOWS.includes(windowId)) {
    return res.status(400).json({ error: "Valid day and window required" });
  }

  avail.lockedNight = {
    day,
    window: windowId,
    lockedBy: player.name,
    lockedAt: new Date().toISOString(),
  };
  writeJson("availability.json", avail);
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

const JOIN_POS = ["P", "C", "2B", "SS", "LF", "CF", "RF", "Util"];

app.get("/api/recruits", (_req, res) => {
  res.json(readJson("recruits.json"));
});

app.post("/api/recruits", (req, res) => {
  const firstName = String((req.body && req.body.firstName) || "").trim().slice(0, 40);
  const lastName = String((req.body && req.body.lastName) || "").trim().slice(0, 40);
  const number = Number.parseInt(String((req.body && req.body.number) ?? ""), 10);
  const primary = String((req.body && req.body.primary) || "").trim();
  const secondary = String((req.body && req.body.secondary) || "").trim();
  const experience = String((req.body && req.body.experience) || "").trim().slice(0, 200);
  const why = String((req.body && req.body.why) || "").trim().slice(0, 800);
  if (!firstName || !lastName) return res.status(400).json({ error: "First and last name required" });
  if (!Number.isInteger(number) || number < 0 || number > 99) {
    return res.status(400).json({ error: "Jersey number must be 0-99" });
  }
  if (!JOIN_POS.includes(primary)) return res.status(400).json({ error: "Pick a primary position" });
  if (secondary && !JOIN_POS.includes(secondary)) return res.status(400).json({ error: "Pick a valid secondary" });
  if (!experience) return res.status(400).json({ error: "Tell us how long you have been playing" });
  if (!why) return res.status(400).json({ error: "Tell us why you want to play" });

  const data = readJson("recruits.json");
  data.recruits.unshift({
    id: "r" + Date.now(),
    firstName,
    lastName,
    number,
    primary,
    secondary: secondary || "",
    experience,
    why,
    createdAt: new Date().toISOString(),
  });
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

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Wizards hub running at http://localhost:${PORT}`);
});
