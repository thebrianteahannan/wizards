const FEE_MODELS = {
  flat: {
    label: "Flat fee",
    blurb: "Everyone on the roster pays the same amount once. Simple, small, done.",
  },
  split: {
    label: "Equal split",
    blurb: "The $250 team bill is divided by however many Wizards are on the book right now.",
  },
  core: {
    label: "Core six",
    blurb: "Six regulars split the $250. Reserves do not pay the league fee (or pay a smaller bench amount).",
  },
  play: {
    label: "Pay when you play",
    blurb: "No annual dues. You Venmo a night fee only when you take a league game.",
  },
};

function money(n) {
  const v = Number(n) || 0;
  return "$" + v.toFixed(2).replace(/\.00$/, "");
}

function feeBreakdown(roster, fees) {
  const total = Number(fees.teamTotal) || 250;
  const players = roster.players || [];
  const model = FEE_MODELS[fees.model] ? fees.model : "flat";
  const rows = [];

  if (model === "flat") {
    const amount = Number(fees.flatAmount) || 25;
    for (const p of players) {
      rows.push({ id: p.id, name: p.name, amount, when: "Once, for the year", note: "Same as everybody" });
    }
  } else if (model === "split") {
    const n = Math.max(players.length, 1);
    const amount = Math.round((total / n) * 100) / 100;
    for (const p of players) {
      rows.push({ id: p.id, name: p.name, amount, when: "Once, for the year", note: "1/" + n + " of " + money(total) });
    }
  } else if (model === "core") {
    const coreIds =
      fees.corePlayerIds && fees.corePlayerIds.length
        ? fees.corePlayerIds
        : players.filter((p) => p.regular).slice(0, 6).map((p) => p.id);
    const n = Math.max(coreIds.length, 1);
    const coreAmt = Math.round((total / n) * 100) / 100;
    const benchAmt = Number(fees.benchAmount) || 0;
    for (const p of players) {
      const isCore = coreIds.includes(p.id);
      rows.push({
        id: p.id,
        name: p.name,
        amount: isCore ? coreAmt : benchAmt,
        when: "Once, for the year",
        note: isCore ? "Core six" : "Reserve",
      });
    }
  } else {
    const nights = Number(fees.expectedNights) || 10;
    const perNight =
      fees.perNight != null && fees.perNight !== ""
        ? Number(fees.perNight)
        : Math.round((total / (6 * nights)) * 100) / 100;
    for (const p of players) {
      rows.push({
        id: p.id,
        name: p.name,
        amount: perNight,
        when: "Each league night you play",
        note: "Not billed if you sit",
      });
    }
  }

  const collected = rows.reduce((sum, r) => sum + (model === "play" ? 0 : r.amount), 0);
  return { model, total, rows, collected };
}

function renderDues(roster, fees) {
  const { model, total, rows, collected } = feeBreakdown(roster, fees);
  const meta = FEE_MODELS[model];
  const due = fees.dueDate ? fmtDate(fees.dueDate) : "when Tony or Brian call it";
  const headline =
    model === "play"
      ? rows[0]
        ? money(rows[0].amount) + " a night you play"
        : money(0)
      : rows[0]
        ? money(rows[0].amount) + " each"
        : money(0);
  const table = rows
    .map(
      (r) => `
      <tr>
        <td>${escapeHtml(r.name)}</td>
        <td><strong>${money(r.amount)}</strong></td>
        <td class="muted">${escapeHtml(r.when)}</td>
        <td class="muted">${escapeHtml(r.note)}</td>
      </tr>`
    )
    .join("");
  return `
    <p class="kicker">League dues</p>
    <h1>What you pay</h1>
    <p class="lede">PLW charges the club <strong>${money(total)}</strong> for the year. We can carry 12. We only need 6 to take a night. Dues are how we cover that bill without chasing people for $3 leftovers.</p>
    <section class="grid-3">
      <article class="card stat"><b>${headline}</b>${escapeHtml(meta.label)}</article>
      <article class="card stat"><b>${due}</b>due date</article>
      <article class="card stat"><b>Pay</b>${escapeHtml(fees.payTo || "a co-manager")}</article>
    </section>
    <section class="grid-2" style="margin-top:1rem">
      <article class="card">
        <h2>${escapeHtml(meta.label)}</h2>
        <p>${escapeHtml(meta.blurb)}</p>
        <p><strong>How:</strong> ${escapeHtml(fees.method || "Ask a co-manager")}</p>
        ${fees.note ? `<p class="muted">${escapeHtml(fees.note)}</p>` : ""}
        ${model !== "play" ? `<p class="muted">At this roster size the flat/split take is ${money(collected)} against a ${money(total)} bill.</p>` : ""}
      </article>
      <article class="card">
        <h2>The simple version</h2>
        <ul class="rules">
          <li>The league fee is a team bill, not a per-game ticket from PLW.</li>
          <li>Jerseys and turf shoes are on you. This page is only the ${money(total)} club fee.</li>
          <li>If you are on the roster, you are in the current model until a manager changes it.</li>
          <li>${isAdmin() ? `Co-managers can switch models on the <a href="#/admin">Admin</a> page.` : "Co-managers set the model. Ping Tony or Brian if yours looks wrong."}</li>
        </ul>
      </article>
    </section>
    <h2 style="margin-top:1.4rem">Who owes what</h2>
    <div class="card" style="overflow:auto">
      <table class="dues-table">
        <thead><tr><th>Player</th><th>Amount</th><th>When</th><th>Why</th></tr></thead>
        <tbody>${table}</tbody>
      </table>
    </div>
  `;
}

function renderAdmin(roster, fees) {
  const managers = roster.players.filter((p) => p.role === "Co-manager");
  const savedId = localStorage.getItem("wizardsPlayerId") || (managers[0] && managers[0].id);
  const options = managers
    .map((p) => `<option value="${p.id}" ${p.id === savedId ? "selected" : ""}>${escapeHtml(p.name)}</option>`)
    .join("");
  const modelRadios = Object.entries(FEE_MODELS)
    .map(
      ([id, m]) => `
      <label class="model-pick ${fees.model === id ? "on" : ""}">
        <input type="radio" name="model" value="${id}" ${fees.model === id ? "checked" : ""} />
        <strong>${escapeHtml(m.label)}</strong>
        <span class="muted">${escapeHtml(m.blurb)}</span>
      </label>`
    )
    .join("");
  const coreBoxes = roster.players
    .map((p) => {
      const checked = (fees.corePlayerIds || []).includes(p.id) ? "checked" : "";
      return `<label><input type="checkbox" name="corePlayerIds" value="${p.id}" ${checked} /> ${escapeHtml(p.name)}</label>`;
    })
    .join("");
  return `
    <p class="kicker">Co-managers</p>
    <h1>Admin</h1>
    <p class="lede">Switch how the ${money(fees.teamTotal || 250)} team fee is split. Players see the result on <a href="#/dues">Dues</a>.</p>
    <section class="card">
      <form id="fees-form">
        <div class="form-row">
          <label>I am</label>
          <select name="playerId">${options}</select>
        </div>
        <p class="muted">Pick a model</p>
        <div class="model-grid">${modelRadios}</div>
        <div class="grid-2" style="margin-top:1rem">
          <div class="form-row">
            <label>Team fee (year)</label>
            <input name="teamTotal" type="number" min="0" step="1" value="${escapeHtml(fees.teamTotal)}" required />
          </div>
          <div class="form-row">
            <label>Due date</label>
            <input name="dueDate" type="date" value="${escapeHtml(fees.dueDate || "")}" />
          </div>
          <div class="form-row">
            <label>Pay to</label>
            <input name="payTo" value="${escapeHtml(fees.payTo || "")}" />
          </div>
          <div class="form-row">
            <label>How to pay</label>
            <input name="method" value="${escapeHtml(fees.method || "")}" />
          </div>
          <div class="form-row">
            <label>Flat amount (flat model)</label>
            <input name="flatAmount" type="number" min="0" step="1" value="${escapeHtml(fees.flatAmount)}" />
          </div>
          <div class="form-row">
            <label>Bench amount (core model)</label>
            <input name="benchAmount" type="number" min="0" step="1" value="${escapeHtml(fees.benchAmount || 0)}" />
          </div>
          <div class="form-row">
            <label>Expected league nights (pay-when-you-play)</label>
            <input name="expectedNights" type="number" min="1" step="1" value="${escapeHtml(fees.expectedNights || 10)}" />
          </div>
          <div class="form-row">
            <label>Per-night override (blank = auto)</label>
            <input name="perNight" type="number" min="0" step="0.01" value="${fees.perNight == null ? "" : escapeHtml(fees.perNight)}" placeholder="auto" />
          </div>
        </div>
        <div class="form-row">
          <label>Core six (leave empty to use the first six regulars)</label>
          <div class="windows">${coreBoxes}</div>
        </div>
        <div class="form-row">
          <label>Note on the Dues page</label>
          <textarea name="note" rows="3">${escapeHtml(fees.note || "")}</textarea>
        </div>
        <button class="btn" type="submit">Save fee model</button>
        <p id="fees-msg" class="muted">${fees.updatedBy ? "Last saved by " + escapeHtml(fees.updatedBy) : ""}</p>
      </form>
    </section>
  `;
}

function bindAdmin(roster) {
  const form = document.getElementById("fees-form");
  if (!form) return;
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const raw = new FormData(form);
    const corePlayerIds = raw.getAll("corePlayerIds");
    const body = Object.fromEntries(raw.entries());
    body.corePlayerIds = corePlayerIds;
    body.perNight = body.perNight === "" ? null : body.perNight;
    localStorage.setItem("wizardsPlayerId", body.playerId);
    const msg = document.getElementById("fees-msg");
    try {
      const fees = await api.send("/api/fees", "PUT", body);
      document.getElementById("app").innerHTML = renderAdmin(roster, fees);
      bindAdmin(roster);
      document.getElementById("fees-msg").textContent = "Saved. Dues page now matches this model.";
    } catch (err) {
      msg.textContent = err.message;
    }
  });
}
