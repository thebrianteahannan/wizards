function renderStrategy(data) {
  data = data || {};
  const list = (items) => (items || []).map((r) => `<li>${escapeHtml(r)}</li>`).join("");
  const pdf = data.pdf
    ? `<p><a href="${escapeHtml(data.pdf)}" target="_blank" rel="noopener">August 1 tournament packet (PDF)</a></p>`
    : "";
  const voices = (data.voices || [])
    .map(
      (v) =>
        `<section class="card"><p class="kicker">${escapeHtml(v.role || "")}</p><h2>${escapeHtml(v.name)}</h2><p class="muted">${escapeHtml(v.blurb || "")}</p></section>`
    )
    .join("");
  const books = (data.playbook || []).slice(0, 2)
    .map((p) => `<section class="card"><h2>${escapeHtml(p.title)}</h2><ul class="rules">${list(p.items)}</ul></section>`)
    .join("");
  const extra = (data.playbook || []).slice(2)
    .map((p) => `<section class="card" style="margin-top:1rem"><h2>${escapeHtml(p.title)}</h2><ul class="rules">${list(p.items)}</ul></section>`)
    .join("");
  const rows = (data.quotes || [])
    .map((q) => {
      const src = q.href
        ? `<a href="${escapeHtml(q.href)}" target="_blank" rel="noopener">${escapeHtml(q.who || "Watch")}</a>`
        : escapeHtml(q.who || "");
      return `<tr><th scope="row">${escapeHtml(q.tip || "")}</th><td>${escapeHtml(q.quote || "")}</td><td>${src}</td></tr>`;
    })
    .join("");
  return `
    <p class="kicker">Team only</p>
    <h1>Strategy</h1>
    <p class="lede">${escapeHtml(data.lede || "")}</p>
    ${data.why ? `<p class="notice" style="margin:1rem 0;max-width:48rem">${escapeHtml(data.why)}</p>` : ""}
    <section class="card" style="max-width:40rem">
      <h2>Rules that decide games</h2>
      <ul class="rules">${list(data.rules)}</ul>
      ${pdf}
    </section>
    <div class="grid-2" style="margin-top:1rem;align-items:start">${voices}</div>
    <div class="grid-2" style="margin-top:1rem;align-items:start">${books}</div>
    ${extra}
    ${
      rows
        ? `<section class="card" style="margin-top:1rem">
        <h2>From the booth</h2>
        <p class="muted">${escapeHtml(data.source || "")}</p>
        <table class="dues-table">
          <thead><tr><th>Tip</th><th>What they said</th><th>Source</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </section>`
        : ""
    }
  `;
}
