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

function renderDues(roster, fees, showLedger) {
  const { model, total, rows, collected } = feeBreakdown(roster, fees);
  const meta = FEE_MODELS[model];
  const due = fees.dueDate ? fmtDate(fees.dueDate) : "when Brian calls it";
  const ledger = fees.ledger || {};
  const open = !!(showLedger && isAdmin());
  const headline =
    model === "play"
      ? rows[0]
        ? money(rows[0].amount) + " a night you play"
        : money(0)
      : rows[0]
        ? money(rows[0].amount) + " each"
        : money(0);
  const table = rows
    .map((r) => {
      const entry = ledger[r.id] || {};
      const owed = entry.owed != null && entry.owed !== "" ? entry.owed : r.amount;
      const extra = open
        ? `<td><input class="ledger-owed" data-id="${escapeHtml(r.id)}" type="number" min="0" step="0.01" value="${escapeHtml(owed)}" /></td>
        <td><input class="ledger-comment" data-id="${escapeHtml(r.id)}" maxlength="240" placeholder="Paid, waiting, Venmo later…" value="${escapeHtml(entry.comment || "")}" /></td>`
        : "";
      return `
      <tr>
        <td>${escapeHtml(r.name)}</td>
        <td><strong>${money(r.amount)}</strong></td>
        <td class="muted">${escapeHtml(r.when)}</td>
        <td class="muted">${escapeHtml(r.note)}</td>
        ${extra}
      </tr>`;
    })
    .join("");
  const headExtra = open ? "<th>Owes me</th><th>Comments</th>" : "";
  return `
    <p class="kicker">League dues</p>
    <h1>What you pay</h1>
    <p class="lede">PLW charges the club <strong>${money(total)}</strong> for the year. We can carry 12. We only need 6 to take a night. Dues are how we cover that bill without chasing people for $3 leftovers.</p>
    <section class="grid-3">
      <article class="card stat"><b>${headline}</b>${escapeHtml(meta.label)}</article>
      <article class="card stat"><b>${due}</b>due date</article>
      <article class="card stat"><b>Pay</b>${escapeHtml(fees.payTo || "Brian")}</article>
    </section>
    <section class="grid-2" style="margin-top:1rem">
      <article class="card">
        <h2>${escapeHtml(meta.label)}</h2>
        <p>${escapeHtml(meta.blurb)}</p>
        <p><strong>How:</strong> ${escapeHtml(fees.method || "Ask Brian")}</p>
        ${fees.note ? `<p class="muted">${escapeHtml(fees.note)}</p>` : ""}
        ${model !== "play" ? `<p class="muted">At this roster size the flat/split take is ${money(collected)} against a ${money(total)} bill.</p>` : ""}
      </article>
      <article class="card">
        <h2>Pay Brian</h2>
        <p class="muted">Dues go to Brian Hannan. Tap a link and send your amount.</p>
        <div class="actions">
          <a class="btn" href="https://www.paypal.com/cgi-bin/webscr?cmd=_xclick&amp;business=bthannan%40gmail.com&amp;currency_code=USD&amp;item_name=Wizards%20of%20Wiff%20dues" target="_blank" rel="noopener">PayPal</a>
          <a class="btn ghost" href="https://venmo.com/u/Brian-Hannan-14" target="_blank" rel="noopener">Venmo</a>
          <a class="btn ghost" href="https://cash.app/$bthannan" target="_blank" rel="noopener">Cash App</a>
        </div>
        <ul class="rules">
          <li>PayPal: bthannan@gmail.com</li>
          <li>Venmo: @Brian-Hannan-14</li>
          <li>Cash App: $bthannan</li>
        </ul>
      </article>
    </section>
    <article class="card" style="margin-top:1rem">
        <h2>The simple version</h2>
        <ul class="rules">
          <li>The league fee is a team bill, not a per-game ticket from PLW.</li>
          <li>Jerseys and turf shoes are on you. This page is only the ${money(total)} club fee.</li>
          <li>If you are on the roster, you are in the current model until a manager changes it.</li>
          <li>${isAdmin() ? `Brian can switch models on the <a href="#/admin">Admin</a> page.` : "Brian sets the model. Ping him if yours looks wrong."}</li>
        </ul>
    </article>
    <div class="who-bar" style="margin-top:1.4rem">
      <h2 style="margin:0">Who owes what</h2>
      ${open
        ? `<button class="btn ghost" type="button" id="hide-ledger">Hide</button><button class="btn" type="button" id="save-ledger">Save ledger</button>`
        : `<button class="btn" type="button" id="show-ledger">What they owe me</button>`}
    </div>
    <form id="ledger-lock" class="who-bar" hidden>
      <input name="password" type="password" autocomplete="off" placeholder="Admin password" />
      <button class="btn" type="submit">Unlock</button>
      <p class="muted" id="ledger-lock-msg"></p>
    </form>
    <p id="ledger-msg" class="muted"></p>
    <div class="card" style="overflow:auto">
      <table class="dues-table">
        <thead><tr><th>Player</th><th>Amount</th><th>When</th><th>Why</th>${headExtra}</tr></thead>
        <tbody>${table}</tbody>
      </table>
    </div>
  `;
}

function redrawDues(roster, fees, showLedger) {
  document.getElementById("app").innerHTML = renderDues(roster, fees, showLedger);
  bindDues(roster, fees, showLedger);
  if (window.bootVisuals) window.bootVisuals();
}

function bindDues(roster, fees, showLedger) {
  const show = document.getElementById("show-ledger");
  const hide = document.getElementById("hide-ledger");
  const lock = document.getElementById("ledger-lock");
  const save = document.getElementById("save-ledger");
  if (show) {
    show.addEventListener("click", () => {
      if (isAdmin()) {
        redrawDues(roster, fees, true);
        return;
      }
      if (lock) {
        lock.hidden = false;
        const msg = document.getElementById("ledger-lock-msg");
        if (msg) msg.textContent = "Log in as a manager to open the ledger.";
      }
    });
  }
  if (lock) {
    lock.addEventListener("submit", (e) => {
      e.preventDefault();
      const password = String(new FormData(lock).get("password") || "").trim();
      const msg = document.getElementById("ledger-lock-msg");
      if (msg) msg.textContent = "Log in as a manager.";
    });
  }
  if (hide) {
    hide.addEventListener("click", () => redrawDues(roster, fees, false));
  }
  if (save) {
    save.addEventListener("click", async () => {
      const ledger = {};
      document.querySelectorAll(".ledger-owed").forEach((input) => {
        const id = input.dataset.id;
        const commentEl = document.querySelector(`.ledger-comment[data-id="${id}"]`);
        ledger[id] = { owed: input.value, comment: commentEl ? commentEl.value : "" };
      });
      const msg = document.getElementById("ledger-msg");
      try {
        const next = await api.send("/api/fees/ledger", "PUT", { ledger });
        redrawDues(roster, next, true);
        document.getElementById("ledger-msg").textContent = "Saved.";
      } catch (err) {
        if (msg) msg.textContent = err.message;
      }
    });
  }
}

function renderAdmin(roster, fees) {
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
    <p class="kicker">Site admin</p>
    <h1>Admin</h1>
    <p class="lede">Switch how the ${money(fees.teamTotal || 250)} team fee is split. Players see the result on <a href="#/dues">Dues</a>.</p>
    <section class="card">
      <details>
        <summary style="cursor:pointer">Fee model</summary>
        <form id="fees-form" style="margin-top:0.8rem">
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
      </details>
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
    const msg = document.getElementById("fees-msg");
    try {
      const fees = await api.send("/api/fees", "PUT", body);
      document.getElementById("app").innerHTML = renderAdmin(roster, fees) + '<div id="users-panel"></div>';
      bindAdmin(roster);
      reloadUsers();
      document.getElementById("fees-msg").textContent = "Saved. Dues page now matches this model.";
    } catch (err) {
      msg.textContent = err.message;
    }
  });
}
