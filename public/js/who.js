function readWhoCookie() {
  const m = document.cookie.match(/(?:^|; )wizardsWho=([^;]*)/);
  return m ? decodeURIComponent(m[1]) : "";
}

function writeWhoCookie(id) {
  document.cookie = "wizardsWho=" + encodeURIComponent(id) + ";path=/;max-age=31536000;SameSite=Lax";
}

function suggestedPlayerId(players) {
  const saved = readWhoCookie();
  const local = localStorage.getItem("wizardsPlayerId") || "";
  if (players && players.length) {
    const hit = players.find((p) => p.id === saved || p.id === local || p.name === saved || playerLabel(p) === saved);
    if (hit) return hit.id;
    return "";
  }
  return local || saved || "";
}

function rememberPlayerId(id) {
  if (!id) return;
  localStorage.setItem("wizardsPlayerId", id);
  writeWhoCookie(id);
}

function clearWhoModal() {
  const el = document.getElementById("who-modal");
  if (el) el.remove();
}

function askWho(players, onPick) {
  const suggested = suggestedPlayerId(players);
  if (suggested && players.some((p) => p.id === suggested)) {
    rememberPlayerId(suggested);
    onPick(suggested);
    return;
  }
  clearWhoModal();
  const opts = [`<option value="">Select a Wizard</option>`]
    .concat(players.map((p) => `<option value="${escapeHtml(p.id)}">${escapeHtml(playerLabel(p))}</option>`))
    .join("");
  const wrap = document.createElement("div");
  wrap.id = "who-modal";
  wrap.className = "who-modal";
  wrap.innerHTML = `
    <form class="card who-card">
      <p class="kicker">Roster check</p>
      <h2>Who are you?</h2>
      <p class="muted">Pick your name. We’ll remember it on this device.</p>
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
    rememberPlayerId(id);
    wrap.remove();
    onPick(id);
  });
}
