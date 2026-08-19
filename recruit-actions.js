function playerSlug(first, last) {
  return ((first + " " + last).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "player");
}

function attachRecruitActions(app, { readJson, writeJson, requireAdmin, positions }) {
  app.post("/api/recruits/:id/contact", requireAdmin, async (req, res) => {
    const data = await readJson("recruits.json");
    const r = data.recruits.find((x) => x.id === req.params.id);
    if (!r) return res.status(404).json({ error: "Unknown recruit" });
    r.contactedAt = r.contactedAt || new Date().toISOString();
    r.updatedAt = new Date().toISOString();
    await writeJson("recruits.json", data);
    res.json(data);
  });

  app.post("/api/recruits/:id/roster", requireAdmin, async (req, res) => {
    const data = await readJson("recruits.json");
    const i = data.recruits.findIndex((x) => x.id === req.params.id);
    if (i < 0) return res.status(404).json({ error: "Unknown recruit" });
    const r = data.recruits[i];
    if (!r.contactedAt) return res.status(400).json({ error: "Mark them contacted first" });
    const roster = await readJson("roster.json");
    const name = (r.firstName + " " + r.lastName).replace(/\s+/g, " ").trim();
    if (roster.players.some((p) => p.name.toLowerCase() === name.toLowerCase())) {
      return res.status(400).json({ error: name + " is already on the roster" });
    }
    const taken = new Set(roster.players.map((p) => p.id));
    let id = playerSlug(r.firstName, r.lastName);
    if (taken.has(id)) {
      let n = 2;
      while (taken.has(id + "-" + n)) n += 1;
      id += "-" + n;
    }
    roster.players.push({
      id,
      name,
      number: Number.isInteger(r.number) ? r.number : null,
      positions: [r.primary, r.secondary].filter((p) => positions.includes(p)),
      born: null,
      sex: "M",
      status: "Active",
      role: "Player",
      regular: true,
      squads: ["league"],
    });
    if (r.phone) {
      const contacts = await readJson("contacts.json");
      contacts.phones = contacts.phones || {};
      contacts.phones[id] = r.phone;
      await writeJson("contacts.json", contacts);
    }
    data.recruits.splice(i, 1);
    await writeJson("roster.json", roster);
    await writeJson("recruits.json", data);
    res.json(data);
  });
}

module.exports = { attachRecruitActions };
