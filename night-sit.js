const FILES = { league: "availability.json", tournament: "tournament.json", practice: "practice.json" };
const DAYS = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"];

function kindOf(req) {
  const k = (req.body && req.body.kind) || (req.query && req.query.kind) || "league";
  return FILES[k] ? k : "league";
}

function okDay(day) {
  return DAYS.includes(day) || /^\d{4}-\d{2}-\d{2}$/.test(day);
}

function attachNightSit(app, { readJson, writeJson, requireAdmin }) {
  app.put("/api/sit", requireAdmin, async (req, res) => {
    const day = String((req.body && req.body.day) || "");
    const id = String((req.body && req.body.playerId) || "");
    if (!okDay(day)) return res.status(400).json({ error: "Valid day required" });
    if (!id) return res.status(400).json({ error: "playerId required" });
    const avail = await readJson(FILES[kindOf(req)]);
    avail.sit = avail.sit || {};
    const list = new Set(avail.sit[day] || []);
    if (req.body.sit === false) list.delete(id);
    else list.add(id);
    avail.sit[day] = [...list];
    await writeJson(FILES[kindOf(req)], avail);
    res.json(avail);
  });
  app.put("/api/order", requireAdmin, async (req, res) => {
    const day = String((req.body && req.body.day) || "");
    const raw = Array.isArray(req.body && req.body.order) ? req.body.order.map(String) : [];
    if (!okDay(day)) return res.status(400).json({ error: "Valid day required" });
    const avail = await readJson(FILES[kindOf(req)]);
    avail.order = avail.order || {};
    if (!raw.length) delete avail.order[day];
    else avail.order[day] = raw.filter(Boolean);
    await writeJson(FILES[kindOf(req)], avail);
    res.json(avail);
  });
}

module.exports = { attachNightSit };
