const JOIN_POS = ["P", "C", "2B", "SS", "LF", "CF", "RF", "Util"];

function posOptions(selected) {
  return JOIN_POS.map((p) => `<option value="${p}" ${p === selected ? "selected" : ""}>${p}</option>`).join("");
}

function attr(v) {
  return escapeHtml(v == null ? "" : v);
}

function recruitCoreFields(r, opts) {
  r = r || {};
  const phoneReq = opts && opts.phoneRequired ? "required" : "";
  return `
        <div class="grid-2">
          <div class="form-row">
            <label>First name</label>
            <input name="firstName" required maxlength="40" autocomplete="given-name" value="${attr(r.firstName)}" />
          </div>
          <div class="form-row">
            <label>Last name</label>
            <input name="lastName" required maxlength="40" autocomplete="family-name" value="${attr(r.lastName)}" />
          </div>
        </div>
        <div class="grid-2">
          <div class="form-row">
            <label>Phone</label>
            <input name="phone" type="tel" ${phoneReq} maxlength="32" autocomplete="tel" value="${attr(r.phone)}" />
          </div>
          <div class="form-row">
            <label>Email (optional)</label>
            <input name="email" type="email" maxlength="80" autocomplete="email" value="${attr(r.email)}" />
          </div>
        </div>
        <div class="form-row">
          <label>Preferred jersey number</label>
          <input name="number" type="number" min="0" max="99" required placeholder="0–99" value="${attr(r.number)}" />
        </div>
        <div class="grid-2">
          <div class="form-row">
            <label>Primary position</label>
            <select name="primary" required>
              <option value="">Pick one</option>
              ${posOptions(r.primary)}
            </select>
          </div>
          <div class="form-row">
            <label>Secondary position</label>
            <select name="secondary">
              <option value="">Optional</option>
              ${posOptions(r.secondary)}
            </select>
          </div>
        </div>
        <div class="form-row">
          <label>How long have you been playing wiffle, baseball, or softball? (optional)</label>
          <input name="experience" maxlength="200" placeholder="e.g. 12 years baseball, first wiffle season" value="${attr(r.experience)}" />
        </div>
        <div class="form-row">
          <label>Why do you want to play for the Wizards? (optional)</label>
          <textarea name="why" rows="4" maxlength="800">${attr(r.why)}</textarea>
        </div>`;
}

function renderJoin() {
  return `
    <p class="kicker">Tryouts</p>
    <h1>Join the Wizards</h1>
    <p class="lede">This fall is practice and tryouts. We are building a Wizards club for the Real League in January 2027. Co-managers review every form.</p>
    <section class="card" style="max-width:40rem">
      <form id="join-form">
        ${recruitCoreFields({}, { phoneRequired: true })}
        <div class="actions">
          <button class="btn" type="submit">Send it</button>
        </div>
        <p id="join-msg" class="muted"></p>
      </form>
    </section>
  `;
}

function renderRecruits(data, openId) {
  const rows = (data.recruits || [])
    .map((r) => {
      const when = r.createdAt ? fmtDate(r.createdAt.slice(0, 10)) : "";
      const pos = r.secondary ? `${escapeHtml(r.primary)} / ${escapeHtml(r.secondary)}` : escapeHtml(r.primary);
      const bits = [r.phone || "No phone", r.email, r.experience, r.notes].filter(Boolean).map((b) => escapeHtml(b));
      const open = openId === r.id;
      return `
      <article class="event">
        <time>#${escapeHtml(r.number)}</time>
        <div>
          <div class="kind">${when}${pos ? " · " + pos : ""}</div>
          <h3>${escapeHtml(r.firstName)} ${escapeHtml(r.lastName)}</h3>
          <p>${bits.join(" · ")} · <a href="#/recruits" class="recruit-edit" data-id="${attr(r.id)}">${open ? "Close" : "Edit"}</a></p>
          ${open ? `
          <form class="recruit-form" data-id="${attr(r.id)}">
            ${recruitCoreFields(r, { phoneRequired: false })}
            <div class="form-row">
              <label>Notes (team only)</label>
              <textarea name="notes" rows="3" maxlength="800" placeholder="Anything else you pick up later">${attr(r.notes)}</textarea>
            </div>
            <div class="actions">
              <button class="btn" type="submit">Save</button>
            </div>
            <p class="muted recruit-msg"></p>
          </form>` : ""}
        </div>
      </article>`;
    })
    .join("");
  return `
    <p class="kicker">Team only</p>
    <h1>Recruits</h1>
    <p class="lede">People who filled out Join the team. Add phone, email, or notes whenever you get them. ${data.recruits && data.recruits.length ? data.recruits.length + " on the list." : "Nobody yet."}</p>
    <div class="timeline" style="margin-top:1rem">${rows || '<p class="muted">The inbox is empty.</p>'}</div>
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

function bindRecruits(data) {
  document.querySelectorAll(".recruit-edit").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.preventDefault();
      const id = btn.dataset.id;
      const closing = document.querySelector(`.recruit-form[data-id="${id}"]`);
      document.getElementById("app").innerHTML = renderRecruits(data, closing ? "" : id);
      bindRecruits(data);
    });
  });
  document.querySelectorAll(".recruit-form").forEach((form) => {
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const msg = form.querySelector(".recruit-msg");
      const body = Object.fromEntries(new FormData(form).entries());
      try {
        const next = await api.send("/api/recruits/" + form.dataset.id, "PUT", body);
        document.getElementById("app").innerHTML = renderRecruits(next);
        bindRecruits(next);
      } catch (err) {
        if (msg) msg.textContent = err.message;
      }
    });
  });
}
