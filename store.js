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
];

let url = "";
let key = "";
let supabaseOk = false;

function loadEnv() {
  try {
    const text = fs.readFileSync(path.join(__dirname, ".env"), "utf8");
    for (const line of text.split("\n")) {
      const cut = line.trim();
      if (!cut || cut.startsWith("#")) continue;
      const i = cut.indexOf("=");
      if (i < 1) continue;
      const name = cut.slice(0, i);
      let val = cut.slice(i + 1);
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      if (!process.env[name]) process.env[name] = val;
    }
  } catch (_) {}
}

function usingDb() {
  return supabaseOk;
}

async function sb(pathname, options) {
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
  if (!res.ok) throw new Error(text || res.statusText);
  return text ? JSON.parse(text) : null;
}

function strip(v) {
  v = String(v || "").trim();
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
  return v.trim();
}

async function init() {
  loadEnv();
  url = strip(process.env.SUPABASE_URL).replace(/\/$/, "");
  key = strip(process.env.SUPABASE_SERVICE_ROLE_KEY);
  fs.mkdirSync(DATA, { recursive: true });
  if (url && key) {
    try {
      const rows = await sb("kv?select=k", { method: "GET", prefer: "count=exact" });
      supabaseOk = true;
      if (!rows.length) await seedFromFiles();
      console.log("Data: Supabase " + url.replace(/^https:\/\//, ""));
      return;
    } catch (err) {
      supabaseOk = false;
      console.error("Supabase unavailable, using JSON files:", err.message);
    }
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
    throw new Error("Missing data: " + file);
  }
  try {
    return JSON.parse(fs.readFileSync(path.join(DATA, file), "utf8"));
  } catch (err) {
    if (file === "activity.json") return { entries: [] };
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
  };
}

module.exports = { init, readJson, writeJson, usingDb, status };

loadEnv();

