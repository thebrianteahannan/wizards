function initials(name) {
  return String(name || "?")
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();
}

function chatWhen(iso) {
  const d = new Date(iso);
  const diff = Date.now() - d.getTime();
  if (diff < 45000) return "just now";
  if (diff < 3600000) return Math.max(1, Math.round(diff / 60000)) + "m ago";
  if (diff < 86400000) return Math.round(diff / 3600000) + "h ago";
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function renderChatMessages(board, meId) {
  const posts = [...(board.posts || [])].reverse();
  if (!posts.length) return `<p class="muted chat-empty">No messages yet. Fire the first one.</p>`;
  return posts
    .map((p) => {
      const mine = p.authorId === meId;
      const extra = p.title && p.title !== p.body.slice(0, p.title.length) ? `<strong>${escapeHtml(p.title)}</strong>` : "";
      return `
        <div class="bubble-row ${mine ? "mine" : ""}">
          <div class="avatar" aria-hidden="true">${escapeHtml(initials(p.authorName))}</div>
          <div class="bubble">
            <div class="bubble-meta">${escapeHtml(p.authorName)} · ${chatWhen(p.createdAt)} · ${escapeHtml(p.category)}</div>
            ${extra}
            <p>${escapeHtml(p.body)}</p>
          </div>
        </div>`;
    })
    .join("");
}

function renderBoard(roster, board, playerId) {
  const savedId = playerId || (session && session.id) || "";
  const cats = ["General", "Announcement", "League", "Gear", "Ride", "Watch"]
    .map((c, i) => `<option ${i === 0 ? "selected" : ""}>${c}</option>`)
    .join("");
  return `
    <p class="kicker">Live locker room</p>
    <h1>Announcements</h1>
    <p class="lede">Who can drive, who has bats, who is late. Talk like the group chat.</p>
    <section class="chat-shell">
      <div class="chat-thread" id="chat-thread">${renderChatMessages(board, savedId)}</div>
      <form class="chat-composer" id="board-form">
        <div class="chat-who">
          <select name="category">${cats}</select>
        </div>
        <div class="chat-send">
          <input name="body" maxlength="2000" required autocomplete="off" placeholder="Message the Wizards…" />
          <button class="btn" type="submit">Send</button>
        </div>
        <p id="board-msg" class="muted"></p>
      </form>
    </section>
  `;
}

function bindBoard(roster) {
  const form = document.getElementById("board-form");
  const thread = document.getElementById("chat-thread");
  if (!form || !thread) return;
  const meId = () => sessionPlayerId(roster.players) || (session && session.id) || "";
  thread.scrollTop = thread.scrollHeight;
  if (window.boardTimer) clearInterval(window.boardTimer);
  window.boardTimer = setInterval(async () => {
    if (!document.getElementById("chat-thread")) {
      clearInterval(window.boardTimer);
      return;
    }
    try {
      const board = await api.get("/api/board");
      const html = renderChatMessages(board, meId());
      if (thread.innerHTML !== html) {
        const stick = thread.scrollHeight - thread.scrollTop < thread.clientHeight + 90;
        thread.innerHTML = html;
        if (stick) thread.scrollTop = thread.scrollHeight;
      }
    } catch (_) {}
  }, 4000);
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(form).entries());
    const msg = document.getElementById("board-msg");
    data.title = data.body.slice(0, 48);
    try {
      const board = await api.send("/api/board", "POST", data);
      thread.innerHTML = renderChatMessages(board, meId());
      thread.scrollTop = thread.scrollHeight;
      form.body.value = "";
      form.body.focus();
      msg.textContent = "";
    } catch (err) {
      msg.textContent = err.message;
    }
  });
}
