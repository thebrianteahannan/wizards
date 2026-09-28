const JOIN_POS = ["P", "3B", "SS", "2B", "IF", "LF", "CF", "RF", "OF", "Util"];

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
            <label>Phone (optional)</label>
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
  const team = isTeam();
  return `
    <p class="kicker">${team ? "Team" : "Tryouts"}</p>
    <h1>${team ? "Recruit a Wizard" : "Join the Wizards"}</h1>
    <p class="lede">${team
      ? "Know someone who should try out? Put them in the book. They show up on Recruits so you can add notes later."
      : "This fall is practice and tryouts. We are building a Wizards club for the Real League in January 2027. Co-managers review every form."}</p>
    <section class="card" style="max-width:40rem">
      <form id="join-form">
        ${recruitCoreFields({}, { phoneRequired: false })}
        ${team ? `<div class="form-row">
            <label>Notes (optional)</label>
            <textarea name="notes" rows="3" maxlength="800" placeholder="How you know them, when they can play, anything else"></textarea>
          </div>` : ""}
        <div class="actions">
          <button class="btn" type="submit">${team ? "Add them" : "Send it"}</button>
        </div>
        <p id="join-msg" class="muted"></p>
      </form>
    </section>
  `;
}

function recruitActions(r) {
  if (r.contactedAt && !isAdmin()) return `<p class="muted">Contacted</p>`;
  if (!isAdmin()) return "";
  return `<div class="actions" style="margin-top:0.55rem">
      ${r.contactedAt
        ? `<span class="muted">Contacted</span>
           <button class="btn" type="button" data-recruit-roster="${attr(r.id)}">They want on the team</button>`
        : `<button class="btn" type="button" data-recruit-contact="${attr(r.id)}">I've contacted them</button>`}
    </div>
    <p class="muted recruit-action-msg"></p>`;
}

function foldRecruit(s) {
  return String(s || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z]/g, "");
}

function sameRecruit(r, p) {
  const rf = foldRecruit(r.firstName);
  const rl = foldRecruit(r.lastName);
  const pf = foldRecruit(p.first);
  const pl = foldRecruit(p.last);
  if (!rf || !rl || !pf || !pl || rl !== pl) return false;
  return rf === pf || rf.startsWith(pf) || pf.startsWith(rf);
}

function recruitClub(r, book) {
  for (const t of book || []) {
    if (t.code === "WIZ") continue;
    for (const p of [...(t.batters || []), ...(t.pitchers || [])]) {
      if (sameRecruit(r, p)) return t;
    }
  }
  return null;
}

function recruitInbox(data) {
  return (data.recruits || []).filter((r) => !r.archivedAt);
}

function recruitArchive(data) {
  return (data.recruits || []).filter((r) => r.archivedAt);
}

function renderRecruits(data, openId, book, view) {
  view = view === "archive" ? "archive" : "inbox";
  const archived = view === "archive";
  const inbox = recruitInbox(data);
  const stored = recruitArchive(data);
  const list = archived ? stored : inbox;
  const takenN = list.filter((r) => recruitClub(r, book)).length;
  const rows = list
    .map((r) => {
      const when = r.createdAt ? fmtDate(r.createdAt.slice(0, 10)) : "";
      const pos = r.secondary ? `${escapeHtml(r.primary)} / ${escapeHtml(r.secondary)}` : escapeHtml(r.primary);
      const bits = [r.phone || "No phone", r.email, r.experience, r.notes].filter(Boolean).map((b) => escapeHtml(b));
      const open = openId === r.id;
      const taken = recruitClub(r, book);
      const move = archived
        ? `<a href="#/recruits" class="recruit-unarchive" data-id="${attr(r.id)}">Restore</a>`
        : `<a href="#/recruits" class="recruit-archive" data-id="${attr(r.id)}">Archive</a>`;
      return `
      <article class="event"${taken || archived ? ' style="opacity:0.88"' : ""}>
        <time>#${escapeHtml(r.number)}</time>
        <div>
          <div class="kind">${when}${pos ? " · " + pos : ""}${taken ? ` · <span style="color:#fb7185">On ${escapeHtml(taken.name)}</span>` : ""}${archived ? " · Archived" : ""}</div>
          <h3>${escapeHtml(r.firstName)} ${escapeHtml(r.lastName)}${taken ? ` <span class="tag" style="color:#fb7185">Taken</span>` : ""}</h3>
          <p>${bits.join(" · ")} · <a href="#/recruits" class="recruit-edit" data-id="${attr(r.id)}">${open ? "Close" : "Edit"}</a> · ${move} · <a href="#/recruits" class="recruit-del" data-id="${attr(r.id)}">Delete</a></p>
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
          ${archived ? "" : recruitActions(r)}
        </div>
      </article>`;
    })
    .join("");
  return `
    <p class="kicker">Team only</p>
    <h1>Recruits</h1>
    <p class="lede">People who joined or that a Wizard recruited. Archive keeps them for later outreach without cluttering the inbox. ${isAdmin() ? "After you contact someone, you can move them onto the roster." : ""} ${inbox.length ? inbox.length + " in the inbox." : "Inbox is empty."}${stored.length ? " " + stored.length + " archived." : ""}${takenN ? " " + takenN + (takenN === 1 ? " already on another club." : " already on other clubs.") : ""}</p>
    <div class="actions" style="margin-top:0.7rem">
      <a class="btn ghost${archived ? "" : " on"}" href="#/recruits" data-recruit-view="inbox">Inbox${inbox.length ? " · " + inbox.length : ""}</a>
      <a class="btn ghost${archived ? " on" : ""}" href="#/recruits" data-recruit-view="archive">Archive${stored.length ? " · " + stored.length : ""}</a>
    </div>
    <div class="timeline" style="margin-top:1rem">${rows || `<p class="muted">${archived ? "Archive is empty." : "The inbox is empty."}</p>`}</div>
  `;
}

function bindJoin() {
  const form = document.getElementById("join-form");
  if (!form || form.dataset.bound) return;
  form.dataset.bound = "1";
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (form.dataset.busy) return;
    form.dataset.busy = "1";
    const btn = form.querySelector('button[type="submit"]');
    if (btn) btn.disabled = true;
    const msg = document.getElementById("join-msg");
    const body = Object.fromEntries(new FormData(form).entries());
    try {
      await api.send("/api/recruits", "POST", body);
      form.reset();
      msg.textContent = isTeam() ? "They're on Recruits." : "Got it. A Wizard will be in touch.";
    } catch (err) {
      msg.textContent = err.message;
    }
    form.dataset.busy = "";
    if (btn) btn.disabled = false;
  });
}

function bindRecruits(data, book, view) {
  view = view === "archive" ? "archive" : "inbox";
  const paint = (next, openId) => {
    document.getElementById("app").innerHTML = renderRecruits(next, openId || "", book, view);
    bindRecruits(next, book, view);
  };
  document.querySelectorAll("[data-recruit-view]").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.preventDefault();
      view = btn.dataset.recruitView === "archive" ? "archive" : "inbox";
      paint(data);
    });
  });
  document.querySelectorAll(".recruit-edit").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.preventDefault();
      const id = btn.dataset.id;
      const closing = document.querySelector(`.recruit-form[data-id="${id}"]`);
      paint(data, closing ? "" : id);
    });
  });
  document.querySelectorAll(".recruit-archive").forEach((btn) => {
    btn.addEventListener("click", async (e) => {
      e.preventDefault();
      try {
        paint(await api.send("/api/recruits/" + btn.dataset.id + "/archive", "POST", {}));
      } catch (err) {
        alert(err.message);
      }
    });
  });
  document.querySelectorAll(".recruit-unarchive").forEach((btn) => {
    btn.addEventListener("click", async (e) => {
      e.preventDefault();
      try {
        paint(await api.send("/api/recruits/" + btn.dataset.id + "/unarchive", "POST", {}));
      } catch (err) {
        alert(err.message);
      }
    });
  });
  document.querySelectorAll(".recruit-del").forEach((btn) => {
    btn.addEventListener("click", async (e) => {
      e.preventDefault();
      const id = btn.dataset.id;
      const r = (data.recruits || []).find((x) => x.id === id);
      const name = r ? (r.firstName + " " + r.lastName).trim() : "this recruit";
      if (!confirm("Delete " + name + " from recruits?")) return;
      try {
        paint(await api.send("/api/recruits/" + id, "DELETE"));
      } catch (err) {
        alert(err.message);
      }
    });
  });
  document.querySelectorAll(".recruit-form").forEach((form) => {
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const msg = form.querySelector(".recruit-msg");
      const body = Object.fromEntries(new FormData(form).entries());
      try {
        paint(await api.send("/api/recruits/" + form.dataset.id, "PUT", body));
      } catch (err) {
        if (msg) msg.textContent = err.message;
      }
    });
  });
  async function runRecruitAction(btn, path, confirmText) {
    if (confirmText && !window.confirm(confirmText)) return;
    btn.disabled = true;
    const card = btn.closest("article");
    const msg = card && card.querySelector(".recruit-action-msg");
    try {
      paint(await api.send(path, "POST", {}));
    } catch (err) {
      btn.disabled = false;
      if (msg) msg.textContent = err.message;
      else window.alert(err.message);
    }
  }
  document.querySelectorAll("[data-recruit-contact]").forEach((btn) => {
    btn.addEventListener("click", () => runRecruitAction(btn, "/api/recruits/" + btn.dataset.recruitContact + "/contact"));
  });
  document.querySelectorAll("[data-recruit-roster]").forEach((btn) => {
    const card = btn.closest("article");
    const h = card && card.querySelector("h3");
    const name = h ? String((h.childNodes[0] && h.childNodes[0].textContent) || h.textContent).trim() : "This recruit";
    btn.addEventListener("click", () =>
      runRecruitAction(btn, "/api/recruits/" + btn.dataset.recruitRoster + "/roster", name + " will move to the roster. Continue?")
    );
  });
}
