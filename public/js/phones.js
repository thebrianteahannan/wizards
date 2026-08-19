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
      const emails = data.emails || {};
      box.innerHTML =
        "<h2>Contacts</h2>" +
        roster.players
          .map((p) => {
            const n = String(phones[p.id] || "").trim();
            const em = String(emails[p.id] || "").trim();
            const tel = n.replace(/[^\d+]/g, "");
            const bits = [];
            if (n) bits.push(`<a href="tel:${escapeHtml(tel)}">${escapeHtml(n)}</a>`);
            if (em) bits.push(`<a href="mailto:${escapeHtml(em)}">${escapeHtml(em)}</a>`);
            return `<div class="phone-row"><strong>${escapeHtml(p.name)}</strong>${
              bits.length ? `<span>${bits.join("<br>")}</span>` : `<span class="muted">Not on file</span>`
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
