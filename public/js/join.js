const JOIN_POS = ["P", "C", "2B", "SS", "LF", "CF", "RF", "Util"];

function posOptions(selected) {
  return JOIN_POS.map((p) => `<option value="${p}" ${p === selected ? "selected" : ""}>${p}</option>`).join("");
}

function renderJoin() {
  return `
    <p class="kicker">Tryouts</p>
    <h1>Join the Wizards</h1>
    <p class="lede">Tell us who you are and where you play. Co-managers review every form. Brooksville, Fall 2026 — we need bodies who can make a night.</p>
    <section class="card" style="max-width:40rem">
      <form id="join-form">
        <div class="grid-2">
          <div class="form-row">
            <label for="join-first">First name</label>
            <input id="join-first" name="firstName" required maxlength="40" autocomplete="given-name" />
          </div>
          <div class="form-row">
            <label for="join-last">Last name</label>
            <input id="join-last" name="lastName" required maxlength="40" autocomplete="family-name" />
          </div>
        </div>
        <div class="form-row">
          <label for="join-number">Preferred jersey number</label>
          <input id="join-number" name="number" type="number" min="0" max="99" required placeholder="0–99" />
        </div>
        <div class="grid-2">
          <div class="form-row">
            <label for="join-primary">Primary position</label>
            <select id="join-primary" name="primary" required>
              <option value="">Pick one</option>
              ${posOptions()}
            </select>
          </div>
          <div class="form-row">
            <label for="join-secondary">Secondary position</label>
            <select id="join-secondary" name="secondary">
              <option value="">Optional</option>
              ${posOptions()}
            </select>
          </div>
        </div>
        <div class="form-row">
          <label for="join-exp">How long have you been playing wiffle, baseball, or softball?</label>
          <input id="join-exp" name="experience" required maxlength="200" placeholder="e.g. 12 years baseball, first wiffle season" />
        </div>
        <div class="form-row">
          <label for="join-why">Why do you want to play for the Wizards?</label>
          <textarea id="join-why" name="why" rows="4" required maxlength="800"></textarea>
        </div>
        <div class="actions">
          <button class="btn" type="submit">Send it</button>
        </div>
        <p id="join-msg" class="muted"></p>
      </form>
    </section>
  `;
}

function renderRecruits(data) {
  const rows = (data.recruits || [])
    .map((r) => {
      const pos = r.secondary ? `${escapeHtml(r.primary)} / ${escapeHtml(r.secondary)}` : escapeHtml(r.primary);
      return `
      <article class="card post">
        <p class="meta">${fmtDate(r.createdAt.slice(0, 10))} · #${escapeHtml(r.number)} · ${pos}</p>
        <h3>${escapeHtml(r.firstName)} ${escapeHtml(r.lastName)}</h3>
        <p><strong>Playing:</strong> ${escapeHtml(r.experience)}</p>
        <p class="muted">${escapeHtml(r.why)}</p>
      </article>`;
    })
    .join("");
  return `
    <p class="kicker">Team only</p>
    <h1>Recruits</h1>
    <p class="lede">People who filled out Join the team. ${data.recruits && data.recruits.length ? data.recruits.length + " on the list." : "Nobody yet."}</p>
    <div class="posts">${rows || '<p class="muted">The inbox is empty.</p>'}</div>
  `;
}

function bindJoin() {
  const form = document.getElementById("join-form");
  if (!form) return;
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const msg = document.getElementById("join-msg");
    const body = Object.fromEntries(new FormData(form).entries());
    try {
      await api.send("/api/recruits", "POST", body);
      form.reset();
      msg.textContent = "Got it. A Wizard will be in touch.";
    } catch (err) {
      msg.textContent = err.message;
    }
  });
}
