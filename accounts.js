const crypto = require("crypto");
const bcrypt = require("bcryptjs");
const { readJson, writeJson } = require("./store");

const COOKIE = "wizards";
const EMPTY = { users: [], sessions: [], resets: [], inviteCode: "" };

function publicUser(u) {
  if (!u) return null;
  return { id: u.id, username: u.username, role: u.role, active: u.active, playerId: u.playerId || "" };
}

function matchKey(v) {
  return String(v || "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

async function rosterPlayers() {
  try {
    const roster = await readJson("roster.json");
    return Array.isArray(roster.players) ? roster.players : [];
  } catch (_) {
    return [];
  }
}

function claimedPlayerIds(users, players) {
  const ids = new Set();
  for (const u of users || []) {
    if (u.playerId) ids.add(u.playerId);
    const key = matchKey(u.username);
    if (!key) continue;
    for (const p of players) {
      if (matchKey(p.name) === key || matchKey(p.id) === key) ids.add(p.id);
    }
  }
  return ids;
}

function findUserByLogin(users, raw) {
  const key = normName(raw);
  if (key.length < 3) return null;
  return (users || []).find((u) => normName(u.username) === key) || null;
}

function playerFromUser(user, players) {
  if (!user || !players || !players.length) return null;
  if (user.playerId === "") return null;
  if (user.playerId) {
    const hit = players.find((p) => p.id === user.playerId);
    if (hit) return hit;
  }
  const key = matchKey(user.username);
  if (!key) return null;
  return players.find((p) => matchKey(p.id) === key || matchKey(p.name) === key) || null;
}

async function resolvePlayer(user) {
  return playerFromUser(user, await rosterPlayers());
}

async function rememberPlayerLink(user, player) {
  if (!user || !player || user.playerId != null) return player;
  const data = await loadAccounts();
  const row = data.users.find((u) => u.id === user.id);
  if (!row || row.playerId != null) return player;
  row.playerId = player.id;
  await writeJson("accounts.json", data);
  user.playerId = player.id;
  return player;
}

function normName(v) {
  return String(v || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, "")
    .slice(0, 24);
}

function inviteChars() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  return Array.from({ length: 6 }, () => chars[crypto.randomInt(chars.length)]).join("");
}

function tokenFromReq(req) {
  const m = String(req.headers.cookie || "").match(/(?:^|; )wizards=([^;]*)/);
  return m ? decodeURIComponent(m[1]) : "";
}

function hashToken(token) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

function setSessionCookie(req, res, token) {
  const secure = req.headers["x-forwarded-proto"] === "https" || req.secure;
  const bits = [
    COOKIE + "=" + encodeURIComponent(token),
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    "Max-Age=2592000",
  ];
  if (secure) bits.push("Secure");
  res.setHeader("Set-Cookie", bits.join("; "));
}

function clearSessionCookie(req, res) {
  const secure = req.headers["x-forwarded-proto"] === "https" || req.secure;
  res.setHeader(
    "Set-Cookie",
    COOKIE + "=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0" + (secure ? "; Secure" : "")
  );
}

async function loadAccounts() {
  try {
    const data = await readJson("accounts.json");
    return {
      users: Array.isArray(data.users) ? data.users : [],
      sessions: Array.isArray(data.sessions) ? data.sessions : [],
      resets: Array.isArray(data.resets) ? data.resets : [],
      inviteCode: String(data.inviteCode || ""),
    };
  } catch (_) {
    return { ...EMPTY };
  }
}

async function userFromReq(req) {
  const token = tokenFromReq(req);
  if (!token) return null;
  const data = await loadAccounts();
  const hashed = hashToken(token);
  const sess = data.sessions.find((s) => s.tokenHash === hashed && (!s.expiresAt || s.expiresAt > Date.now()));
  if (!sess) return null;
  const user = data.users.find((u) => u.id === sess.userId && u.active);
  return user || null;
}

function requireTeam(req, res, next) {
  userFromReq(req)
    .then((user) => {
      if (!user) return res.status(401).json({ error: "Log in" });
      req.user = user;
      next();
    })
    .catch(next);
}

function requireAdmin(req, res, next) {
  userFromReq(req)
    .then((user) => {
      if (!user) return res.status(401).json({ error: "Log in" });
      if (user.role !== "admin") return res.status(403).json({ error: "Managers only" });
      req.user = user;
      next();
    })
    .catch(next);
}

async function createSession(data, userId) {
  const token = crypto.randomBytes(24).toString("hex");
  data.sessions = data.sessions.filter((s) => s.expiresAt > Date.now());
  data.sessions.push({
    id: "s" + Date.now(),
    userId,
    tokenHash: hashToken(token),
    expiresAt: Date.now() + 30 * 24 * 60 * 60 * 1000,
  });
  await writeJson("accounts.json", data);
  return token;
}

function attachAuth(app) {
  app.get("/api/auth/me", async (req, res) => {
    const user = await userFromReq(req);
    if (!user) return res.json(null);
    const player = await rememberPlayerLink(user, await resolvePlayer(user));
    res.json({
      ...publicUser(user),
      playerId: (player && player.id) || "",
      playerName: (player && player.name) || "",
    });
  });

  app.get("/api/auth/open-players", async (_req, res) => {
    const players = await rosterPlayers();
    const data = await loadAccounts();
    const claimed = claimedPlayerIds(data.users, players);
    res.json({
      players: players
        .filter((p) => !claimed.has(p.id))
        .map((p) => ({ id: p.id, name: p.name, number: p.number })),
    });
  });

  app.get("/api/auth/claimed-players", async (_req, res) => {
    const players = await rosterPlayers();
    const data = await loadAccounts();
    const rows = [];
    for (const u of data.users) {
      if (!u.active) continue;
      const p = playerFromUser(u, players);
      rows.push({
        username: u.username,
        name: (p && p.name) || u.username,
        number: p ? p.number : null,
      });
    }
    rows.sort((a, b) => String(a.name).localeCompare(String(b.name)));
    res.json({ players: rows });
  });

  app.post("/api/auth/register", async (req, res) => {
    const password = String((req.body && req.body.password) || "");
    const invite = String((req.body && req.body.invite) || "")
      .trim()
      .toUpperCase();
    if (password.length < 6) return res.status(400).json({ error: "Password must be at least 6 characters" });
    const players = await rosterPlayers();
    const player = players.find((p) => p.id === String((req.body && req.body.playerId) || ""));
    if (!player) return res.status(400).json({ error: "Pick your name from the roster" });
    const data = await loadAccounts();
    if (claimedPlayerIds(data.users, players).has(player.id) || findUserByLogin(data.users, player.name)) {
      return res.status(400).json({ error: "That Wizard already has a login" });
    }
    const first = data.users.length === 0;
    if (!first) {
      if (!data.inviteCode || invite !== data.inviteCode) {
        return res.status(403).json({ error: "Need the current invite code from Brian" });
      }
    }
    const user = {
      id: "u" + Date.now(),
      username: player.name,
      passwordHash: await bcrypt.hash(password, 10),
      role: first ? "admin" : "team",
      active: true,
      playerId: player.id,
      createdAt: new Date().toISOString(),
    };
    data.users.push(user);
    if (first) data.inviteCode = inviteChars();
    const token = await createSession(data, user.id);
    setSessionCookie(req, res, token);
    res.json({ user: publicUser(user), inviteCode: first ? data.inviteCode : undefined });
  });

  app.post("/api/auth/login", async (req, res) => {
    const password = String((req.body && req.body.password) || "");
    const data = await loadAccounts();
    const user = findUserByLogin(data.users, req.body && req.body.username);
    if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
      return res.status(401).json({ error: "Wrong username or password" });
    }
    if (!user.active) return res.status(403).json({ error: "This login was revoked. Ping Brian." });
    const matched = playerFromUser(user, await rosterPlayers());
    if (matched && user.playerId == null) user.playerId = matched.id;
    const token = await createSession(data, user.id);
    setSessionCookie(req, res, token);
    res.json({ user: publicUser(user) });
  });

  app.post("/api/auth/logout", async (req, res) => {
    const token = tokenFromReq(req);
    if (token) {
      const data = await loadAccounts();
      const hashed = hashToken(token);
      data.sessions = data.sessions.filter((s) => s.tokenHash !== hashed);
      await writeJson("accounts.json", data);
    }
    clearSessionCookie(req, res);
    res.json({ ok: true });
  });

  app.post("/api/auth/reset-request", async (req, res) => {
    const username = normName(req.body && req.body.username);
    if (username.length < 3) return res.status(400).json({ error: "Enter your username" });
    const data = await loadAccounts();
    data.resets.unshift({
      id: "x" + Date.now(),
      username,
      known: !!findUserByLogin(data.users, req.body && req.body.username),
      status: "pending",
      createdAt: new Date().toISOString(),
    });
    data.resets = data.resets.slice(0, 100);
    await writeJson("accounts.json", data);
    res.json({ ok: true });
  });

  app.post("/api/auth/password", requireTeam, async (req, res) => {
    const current = String((req.body && req.body.current) || "");
    const next = String((req.body && req.body.next) || "");
    if (next.length < 6) return res.status(400).json({ error: "New password must be at least 6 characters" });
    const data = await loadAccounts();
    const user = data.users.find((u) => u.id === req.user.id);
    if (!user || !(await bcrypt.compare(current, user.passwordHash))) {
      return res.status(401).json({ error: "Current password is wrong" });
    }
    user.passwordHash = await bcrypt.hash(next, 10);
    await writeJson("accounts.json", data);
    res.json({ ok: true });
  });

  app.get("/api/auth/admin", requireAdmin, async (_req, res) => {
    const data = await loadAccounts();
    res.json({
      inviteCode: data.inviteCode,
      users: data.users.map((u) => ({
        id: u.id,
        username: u.username,
        role: u.role,
        active: u.active,
        playerId: u.playerId || "",
        createdAt: u.createdAt,
      })),
      resets: data.resets.filter((r) => r.status === "pending"),
    });
  });

  app.post("/api/auth/invite", requireAdmin, async (_req, res) => {
    const data = await loadAccounts();
    data.inviteCode = inviteChars();
    await writeJson("accounts.json", data);
    res.json({ inviteCode: data.inviteCode });
  });

  app.post("/api/auth/revoke", requireAdmin, async (req, res) => {
    const id = String((req.body && req.body.userId) || "");
    const data = await loadAccounts();
    const user = data.users.find((u) => u.id === id);
    if (!user) return res.status(404).json({ error: "Unknown user" });
    if (user.id === req.user.id) return res.status(400).json({ error: "You cannot revoke yourself" });
    user.active = false;
    data.sessions = data.sessions.filter((s) => s.userId !== id);
    await writeJson("accounts.json", data);
    res.json({ ok: true });
  });

  app.post("/api/auth/restore", requireAdmin, async (req, res) => {
    const id = String((req.body && req.body.userId) || "");
    const data = await loadAccounts();
    const user = data.users.find((u) => u.id === id);
    if (!user) return res.status(404).json({ error: "Unknown user" });
    user.active = true;
    await writeJson("accounts.json", data);
    res.json({ ok: true });
  });

  app.post("/api/auth/role", requireAdmin, async (req, res) => {
    const id = String((req.body && req.body.userId) || "");
    const role = (req.body && req.body.role) === "admin" ? "admin" : "team";
    const data = await loadAccounts();
    const user = data.users.find((u) => u.id === id);
    if (!user) return res.status(404).json({ error: "Unknown user" });
    if (user.id === req.user.id && role !== "admin") {
      return res.status(400).json({ error: "You cannot demote yourself" });
    }
    user.role = role;
    await writeJson("accounts.json", data);
    res.json({ ok: true });
  });

  app.post("/api/auth/player", requireAdmin, async (req, res) => {
    const id = String((req.body && req.body.userId) || "");
    const playerId = String((req.body && req.body.playerId) || "");
    const players = await rosterPlayers();
    if (playerId && !players.some((p) => p.id === playerId)) {
      return res.status(400).json({ error: "Unknown roster player" });
    }
    const data = await loadAccounts();
    const user = data.users.find((u) => u.id === id);
    if (!user) return res.status(404).json({ error: "Unknown user" });
    user.playerId = playerId;
    await writeJson("accounts.json", data);
    res.json({ ok: true, playerId });
  });

  app.post("/api/auth/set-password", requireAdmin, async (req, res) => {
    const id = String((req.body && req.body.userId) || "");
    const password = String((req.body && req.body.password) || "");
    if (password.length < 6) return res.status(400).json({ error: "Password must be at least 6 characters" });
    const data = await loadAccounts();
    const user = data.users.find((u) => u.id === id);
    if (!user) return res.status(404).json({ error: "Unknown user" });
    user.passwordHash = await bcrypt.hash(password, 10);
    data.sessions = data.sessions.filter((s) => s.userId !== id);
    data.resets = data.resets.map((r) =>
      r.username === user.username && r.status === "pending" ? { ...r, status: "done" } : r
    );
    await writeJson("accounts.json", data);
    res.json({ ok: true });
  });

  app.post("/api/auth/dismiss-reset", requireAdmin, async (req, res) => {
    const id = String((req.body && req.body.id) || "");
    const data = await loadAccounts();
    data.resets = data.resets.map((r) => (r.id === id ? { ...r, status: "dismissed" } : r));
    await writeJson("accounts.json", data);
    res.json({ ok: true });
  });

  app.get("/api/strategy", requireTeam, async (_req, res) => {
    res.json(await readJson("strategy.json"));
  });
}

module.exports = { attachAuth, requireTeam, requireAdmin, userFromReq, resolvePlayer };
