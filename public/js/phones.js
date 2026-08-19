function bindPhones(roster) {
  const btn = document.getElementById("show-phones");
  const box = document.getElementById("phone-list");
  if (!btn || !box) return;
  btn.onclick = async () => {
    if (!box.hidden) {
      box.hidden = true;
      btn.textContent = "Phone numbers";
      return;
    }
    try {
      const data = await api.get("/api/contacts");
      const phones = data.phones || {};
      box.innerHTML =
        "<h2>Phone numbers</h2>" +
        roster.players
          .map((p) => {
            const n = String(phones[p.id] || "").trim();
            const tel = n.replace(/[^\d+]/g, "");
            return `<div class="phone-row"><strong>${escapeHtml(p.name)}</strong>${
              n ? `<a href="tel:${escapeHtml(tel)}">${escapeHtml(n)}</a>` : `<span class="muted">Not on file</span>`
            }</div>`;
          })
          .join("");
      box.hidden = false;
      btn.textContent = "Hide numbers";
    } catch (err) {
      box.hidden = false;
      box.innerHTML = `<p class="muted">${escapeHtml(err.message)}</p>`;
    }
    };
}
