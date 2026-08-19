function readWhoCookie() {
  const m = document.cookie.match(/(?:^|; )wizardsWho=([^;]*)/);
  return m ? decodeURIComponent(m[1]) : "";
}

function writeWhoCookie(id) {
  document.cookie = "wizardsWho=" + encodeURIComponent(id) + ";path=/;max-age=31536000;SameSite=Lax";
}

function suggestedPlayerId(players) {
  const saved = readWhoCookie();
  if (saved && players && players.length) {
    const hit = players.find((p) => p.name === saved || playerLabel(p) === saved || p.id === saved);
    if (hit) return hit.id;
  }
  return localStorage.getItem("wizardsPlayerId") || "";
}

function rememberPlayerId(id, name) {
  if (!id) return;
  localStorage.setItem("wizardsPlayerId", id);
  const fromSelect = [...document.querySelectorAll("select option")].find((o) => o.value === id);
  writeWhoCookie(name || (fromSelect && fromSelect.textContent.trim()) || readWhoCookie() || id);
}

function clearWhoModal() {
  const el = document.getElementById("who-modal");
  if (el) el.remove();
}

function askWho(players, onPick) {
  clearWhoModal();
  const suggested = suggestedPlayerId(players);
  const known = players.some((p) => p.id === suggested);
  const opts = [`<option value="">Select a Wizard</option>`]
    .concat(
      players.map((p) => {
        const sel = known && p.id === suggested ? " selected" : "";
        return `<option value="${escapeHtml(p.id)}"${sel}>${escapeHtml(playerLabel(p))}</option>`;
      })
    )
    .join("");
  const wrap = document.createElement("div");
  wrap.id = "who-modal";
  wrap.className = "who-modal";
  wrap.innerHTML = `
    <form class="card who-card">
      <p class="kicker">Roster check</p>
      <h2>Who are you?</h2>
      <p class="muted">${known ? "Last time you were the highlighted name. Confirm or switch." : "Pick your name. We’ll suggest it next time."}</p>
      <div class="form-row">
        <select name="who" required>${opts}</select>
      </div>
      <button class="btn" type="submit">That’s me</button>
    </form>`;
  document.body.appendChild(wrap);
  wrap.querySelector("form").addEventListener("submit", (e) => {
    e.preventDefault();
    const id = String(new FormData(e.target).get("who") || "").trim();
    if (!id) return;
    const picked = players.find((p) => p.id === id);
    rememberPlayerId(id, picked ? picked.name : "");
    wrap.remove();
    onPick(id);
  });
}
