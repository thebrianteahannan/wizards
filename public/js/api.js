const api = {
  async get(path) {
    const res = await fetch(path, { credentials: "include" });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },
  async send(path, method, body) {
    const res = await fetch(path, {
      method,
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      let msg = "Request failed";
      try {
        const data = await res.json();
        msg = data.error || msg;
      } catch (_) {}
      throw new Error(msg);
    }
    return res.json();
  },
};

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function fmtDate(iso) {
  const d = new Date(iso + (iso.length === 10 ? "T12:00:00" : ""));
  return d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric" });
}

function playerLabel(p) {
  return p.number != null ? `${p.name} #${p.number}` : p.name;
}
