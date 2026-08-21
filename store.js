const fs = require("fs");
const path = require("path");

const DATA = path.join(__dirname, "data");
const FILES = [
  "roster.json",
  "schedule.json",
  "availability.json",
  "tournament.json",
  "practice.json",
  "announcements.json",
  "jerseys.json",
  "contacts.json",
  "recruits.json",
  "fees.json",
  "activity.json",
  "accounts.json",
  "strategy.json",
  "lineups.json",
];

let url = "";
let key = "";
let supabaseOk = false;
let lastError = "";

function loadEnv() {
  try {
    const text = fs.readFileSync(path.join(__dirname, ".env"), "utf8");
    for (const line of text.split("\n")) {
      const cut = line.trim();
      if (!cut || cut.startsWith("#")) continue;
      const i = cut.indexOf("=");
      if (i < 1) continue;
      const name = cut.slice(0, i);
      let val = strip(cut.slice(i + 1));
      if (!process.env[name]) process.env[name] = val;
    }
  } catch (_) {}
}

function usingDb() {
  return supabaseOk;
}

function hideSecret(msg) {
  let s = String(msg || "unknown").slice(0, 220);
  if (key) s = s.split(key).join("[key]");
  return s;
}

async function sb(pathname, options) {
  if (typeof fetch !== "function") {
    throw new Error("Node " + process.version + " has no fetch");
  }
  const res = await fetch(url + "/rest/v1/" + pathname, {
    ...options,
    headers: {
      apikey: key,
      Authorization: "Bearer " + key,
      "Content-Type": "application/json",
      Prefer: options.prefer || "return=representation",
      ...(options.headers || {}),
    },
  });
  const text = await res.text();
  if (!res.ok) throw new Error((text || res.statusText).slice(0, 220));
  return text ? JSON.parse(text) : [];
}

function strip(v) {
  v = String(v || "")
    .replace(/^\uFEFF/, "")
    .replace(/\r/g, "")
    .trim();
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
    v = v.slice(1, -1).trim();
  }
  return v.replace(/^Bearer\s+/i, "").trim();
}

async function init() {
  loadEnv();
  url = strip(process.env.SUPABASE_URL).replace(/\/$/, "");
  key = strip(process.env.SUPABASE_SERVICE_ROLE_KEY);
  fs.mkdirSync(DATA, { recursive: true });
  lastError = "";
  if (url && key) {
    try {
      const rows = await sb("kv?select=k", { method: "GET", prefer: "count=exact,return=representation" });
      supabaseOk = true;
      if (!Array.isArray(rows) || !rows.length) await seedFromFiles();
      console.log("Data: Supabase " + url.replace(/^https:\/\//, ""));
      return;
    } catch (err) {
      supabaseOk = false;
      lastError = hideSecret(err && err.message);
      console.error("Supabase unavailable, using JSON files:", lastError);
    }
  } else {
    lastError = "Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY";
  }
  console.log("Data: JSON files in " + DATA);
}

async function seedFromFiles() {
  for (const file of FILES) {
    const dest = path.join(DATA, file);
    if (!fs.existsSync(dest)) continue;
    await writeJson(file, JSON.parse(fs.readFileSync(dest, "utf8")));
  }
}

async function readJson(file) {
  if (usingDb()) {
    const rows = await sb("kv?k=eq." + encodeURIComponent(file) + "&select=v", { method: "GET" });
    if (rows && rows[0]) return rows[0].v;
    const dest = path.join(DATA, file);
    if (fs.existsSync(dest)) {
      const value = JSON.parse(fs.readFileSync(dest, "utf8"));
      await writeJson(file, value);
      return value;
    }
    if (file === "activity.json") return { entries: [] };
    if (file === "accounts.json") return { users: [], sessions: [], resets: [], inviteCode: "" };
    if (file === "lineups.json") return { nights: {} };
    throw new Error("Missing data: " + file);
  }
  try {
    return JSON.parse(fs.readFileSync(path.join(DATA, file), "utf8"));
  } catch (err) {
    if (file === "activity.json") return { entries: [] };
    if (file === "accounts.json") return { users: [], sessions: [], resets: [], inviteCode: "" };
    if (file === "lineups.json") return { nights: {} };
    throw err;
  }
}

async function writeJson(file, value) {
  if (usingDb()) {
    await sb("kv", {
      method: "POST",
      prefer: "resolution=merge-duplicates,return=minimal",
      body: JSON.stringify({ k: file, v: value }),
    });
    return;
  }
  fs.mkdirSync(DATA, { recursive: true });
  const dest = path.join(DATA, file);
  const tmp = dest + ".tmp";
  fs.writeFileSync(tmp, JSON.stringify(value, null, 2));
  fs.renameSync(tmp, dest);
}

function status() {
  return {
    data: usingDb() ? "supabase" : "files",
    hasUrl: Boolean(strip(process.env.SUPABASE_URL)),
    hasKey: Boolean(strip(process.env.SUPABASE_SERVICE_ROLE_KEY)),
    node: process.version,
    error: lastError || undefined,
  };
}

module.exports = { init, readJson, writeJson, usingDb, status };

loadEnv();

