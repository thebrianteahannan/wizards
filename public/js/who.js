function readWhoCookie() {
  const m = document.cookie.match(/(?:^|; )wizardsWho=([^;]*)/);
  return m ? decodeURIComponent(m[1]) : "";
}

function writeWhoCookie(id) {
  document.cookie = "wizardsWho=" + encodeURIComponent(id) + ";path=/;max-age=31536000;SameSite=Lax";
}

function sessionPlayerId(players) {
  const id = (session && session.playerId) || "";
  if (!id) return "";
  if (players && players.length && !players.some((p) => p.id === id)) return "";
  return id;
}

function sessionPlayerName(players) {
  const id = sessionPlayerId(players);
  const hit = (players || []).find((p) => p.id === id);
  if (hit) return hit.name;
  return (session && (session.playerName || session.username)) || "";
}

function suggestedPlayerId(players) {
  return sessionPlayerId(players);
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
  const id = sessionPlayerId(players);
  if (id) onPick(id);
}
