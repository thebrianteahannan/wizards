function bagSum(rows, key) {
  let n = 0;
  for (const r of rows || []) n += scoutNum(r[key]) || 0;
  return n;
}

function uerAllowed(pitchers) {
  return Math.max(0, bagSum(pitchers, "r") - bagSum(pitchers, "er"));
}

function nCell(v, digits) {
  if (v == null || !Number.isFinite(v)) return `<span class="muted">—</span>`;
  if (digits == null) return String(Math.round(v));
  return v.toFixed(digits);
}

function clubGames(t) {
  return Number(t && t.gp) || (Number(t && t.w) || 0) + (Number(t && t.l) || 0);
}

function perGame(n, gp) {
  return gp ? n / gp : null;
}

function pitchE(t) {
  if (t && t.fieldE != null) return t.fieldE;
  return uerAllowed(t && t.pitchers);
}

function winRate(sum, wins) {
  return wins ? sum / wins : null;
}

function pitchEG(t) {
  const g = Number(t && t.fieldG) || clubGames(t);
  return perGame(pitchE(t), g);
}

function clubPct(t) {
  const gp = (Number(t && t.w) || 0) + (Number(t && t.l) || 0);
  return gp ? (Number(t.w) || 0) / gp : null;
}

function clubAttr(v) {
  return v == null || v === "" || (typeof v === "number" && !Number.isFinite(v)) ? "" : String(v);
}

function clubSortBtn(key, label, tip, extra) {
  return `<button type="button" class="club-sort${extra || ""}" data-club-sort="${escapeHtml(key)}" title="${escapeHtml(tip)} · Click to sort">${escapeHtml(label)}</button>`;
}

function clubStatTable(teams, title, keys, bagOf, colW) {
  const w = colW || "2.8rem";
  const cols = `minmax(7.5rem,1fr) 4.6rem ${keys.map(() => w).join(" ")}`;
  const cell = (html) => `<span class="num" style="min-width:auto;white-space:nowrap">${html}</span>`;
  const head = `<div class="roster-row" data-club-head style="grid-template-columns:${cols} !important">${clubSortBtn("team", "Team", "Team name", " muted club-sort-team")}${clubSortBtn("wl", "W-L", "Win-loss record", " num muted")}${keys
    .map((k) => clubSortBtn(k.key, k.label, k.tip, " num muted"))
    .join("")}</div>`;
  const rows = rankByRecord(teams || [])
    .map((t) => {
      const bag = bagOf(t);
      const us = t.code === "WIZ";
      const attrs = [`data-v-team="${escapeHtml(t.name || "")}"`, `data-v-wl="${clubAttr(clubPct(t))}"`]
        .concat(keys.map((k) => `data-v-${k.key}="${clubAttr(bag[k.key])}"`))
        .join(" ");
      return `<div class="roster-row" data-club-row style="grid-template-columns:${cols} !important${us ? ";border-color:var(--cyan)" : ""}" ${attrs}><span style="text-align:left;overflow:hidden;text-overflow:ellipsis;white-space:nowrap"><strong${us ? ' style="color:var(--cyan)"' : ""}>${escapeHtml(t.name)}</strong></span>${cell(wlCell(t))}${keys
        .map((k) => cell(nCell(bag[k.key], k.digits)))
        .join("")}</div>`;
    })
    .join("");
  return `<div style="margin-top:0.85rem;overflow-x:auto"><p class="kicker" style="margin:0 0 0.35rem">${escapeHtml(title)}</p><div class="roster-list" data-club-sheet style="min-width:42rem">${head}${rows}</div></div>`;
}

function clubSection(title, tables, split) {
  return `<section style="margin-top:${split ? "1.35rem" : "0.85rem"};${split ? "padding-top:1rem;border-top:1px solid var(--line)" : ""}">
    <h2 style="margin:0">${escapeHtml(title)}</h2>
    ${tables}
  </section>`;
}

function clubSheetsHtml(teams) {
  if (!(teams || []).length) return "";
  const hittingTotals = clubStatTable(
    teams,
    "Totals",
    [
      { key: "h", label: "H", tip: "Hits" },
      { key: "doubles", label: "2B", tip: "Doubles" },
      { key: "triples", label: "3B", tip: "Triples" },
      { key: "hr", label: "HR", tip: "Home runs" },
      { key: "r", label: "R", tip: "Runs scored" },
      { key: "bb", label: "BB", tip: "Walks while batting" },
      { key: "fe", label: "FE", tip: "Forced errors — reached on error" },
    ],
    (t) => {
      const b = t.batters || [];
      return {
        h: bagSum(b, "h"),
        doubles: bagSum(b, "doubles"),
        triples: bagSum(b, "triples"),
        hr: bagSum(b, "hr"),
        r: bagSum(b, "r") || t.rs || 0,
        bb: bagSum(b, "bb"),
        fe: bagSum(b, "roe"),
      };
    }
  );
  const hittingRates = clubStatTable(
    teams,
    "Per win and per game",
    [
      { key: "rsw", label: "RS/W", tip: "Average runs scored in wins", digits: 1 },
      { key: "h", label: "H/G", tip: "Hits per game", digits: 1 },
      { key: "doubles", label: "2B/G", tip: "Doubles per game", digits: 1 },
      { key: "triples", label: "3B/G", tip: "Triples per game", digits: 1 },
      { key: "hr", label: "HR/G", tip: "Home runs per game", digits: 1 },
      { key: "r", label: "R/G", tip: "Runs scored per game", digits: 1 },
      { key: "bb", label: "BB/G", tip: "Walks per game", digits: 1 },
      { key: "e", label: "E/G", tip: "Reached on error per game", digits: 1 },
    ],
    (t) => {
      const b = t.batters || [];
      const gp = clubGames(t);
      const r = bagSum(b, "r") || t.rs || 0;
      return {
        rsw: winRate(t.boxRsWin, t.boxWins),
        h: perGame(bagSum(b, "h"), gp),
        doubles: perGame(bagSum(b, "doubles"), gp),
        triples: perGame(bagSum(b, "triples"), gp),
        hr: perGame(bagSum(b, "hr"), gp),
        r: perGame(r, gp),
        bb: perGame(bagSum(b, "bb"), gp),
        e: perGame(bagSum(b, "roe"), gp),
      };
    },
    "3.2rem"
  );
  const pitchingTotals = clubStatTable(
    teams,
    "Totals",
    [
      { key: "h", label: "H", tip: "Hits allowed" },
      { key: "doubles", label: "2B", tip: "Doubles allowed — not posted on the PLW pitcher board" },
      { key: "triples", label: "3B", tip: "Triples allowed — not posted on the PLW pitcher board" },
      { key: "hr", label: "HR", tip: "Home runs allowed" },
      { key: "r", label: "R", tip: "Runs allowed" },
      { key: "e", label: "E", tip: "Fielding errors from the line score" },
      { key: "so", label: "SO", tip: "Strikeouts" },
      { key: "bb", label: "BB", tip: "Walks issued" },
    ],
    (t) => {
      const p = t.pitchers || [];
      return {
        h: bagSum(p, "h"),
        doubles: null,
        triples: null,
        hr: bagSum(p, "hr"),
        r: bagSum(p, "r") || t.ra || 0,
        e: pitchE(t),
        so: bagSum(p, "so"),
        bb: bagSum(p, "bb"),
      };
    }
  );
  const pitchingRates = clubStatTable(
    teams,
    "Per win and per game",
    [
      { key: "raw", label: "RA/W", tip: "Average runs allowed in wins", digits: 1 },
      { key: "h", label: "H/G", tip: "Hits allowed per game", digits: 1 },
      { key: "doubles", label: "2B/G", tip: "Doubles allowed per game — not posted by PLW", digits: 1 },
      { key: "triples", label: "3B/G", tip: "Triples allowed per game — not posted by PLW", digits: 1 },
      { key: "hr", label: "HR/G", tip: "Home runs allowed per game", digits: 1 },
      { key: "r", label: "R/G", tip: "Runs allowed per game", digits: 1 },
      { key: "e", label: "E/G", tip: "Fielding errors per game from the line score", digits: 1 },
      { key: "so", label: "SO/G", tip: "Strikeouts per game", digits: 1 },
      { key: "bb", label: "BB/G", tip: "Walks issued per game", digits: 1 },
    ],
    (t) => {
      const p = t.pitchers || [];
      const gp = clubGames(t);
      const r = bagSum(p, "r") || t.ra || 0;
      return {
        raw: winRate(t.boxRaWin, t.boxWins),
        h: perGame(bagSum(p, "h"), gp),
        doubles: null,
        triples: null,
        hr: perGame(bagSum(p, "hr"), gp),
        r: perGame(r, gp),
        e: pitchEG(t),
        so: perGame(bagSum(p, "so"), gp),
        bb: perGame(bagSum(p, "bb"), gp),
      };
    },
    "3.2rem"
  );
  return (
    clubSection("Hitting", hittingTotals + hittingRates) +
    clubSection("Pitching", pitchingTotals + pitchingRates, true) +
    `<p class="muted" style="margin:0.55rem 0 0">Hitting FE and E/G are reached on error. Pitching E and E/G are fielding errors from the line score. RS/W is average runs scored in wins; RA/W is average runs allowed in wins. /G is per game. Click a column header to sort. PLW pitcher pages do not post doubles or triples allowed.</p>`
  );
}

function clubSortVal(row, key) {
  const raw = row.getAttribute("data-v-" + key);
  if (raw == null || raw === "") return null;
  if (key === "team") return raw.toLowerCase();
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

function sortClubSheet(list, key, dir) {
  const rows = [...list.querySelectorAll("[data-club-row]")];
  rows.sort((a, b) => {
    const av = clubSortVal(a, key);
    const bv = clubSortVal(b, key);
    if (av == null && bv == null) return 0;
    if (av == null) return 1;
    if (bv == null) return -1;
    const cmp = key === "team" ? String(av).localeCompare(String(bv)) : av - bv;
    if (cmp) return dir === "asc" ? cmp : -cmp;
    return String(clubSortVal(a, "team") || "").localeCompare(String(clubSortVal(b, "team") || ""));
  });
  rows.forEach((r) => list.appendChild(r));
  list.querySelectorAll("[data-club-sort]").forEach((btn) => {
    const on = btn.dataset.clubSort === key;
    btn.classList.toggle("is-on", on);
    btn.classList.toggle("is-asc", on && dir === "asc");
    btn.setAttribute("aria-sort", on ? (dir === "asc" ? "ascending" : "descending") : "none");
  });
}

function bindClubSheets() {
  document.querySelectorAll("[data-club-sheet]").forEach((sheet) => {
    sheet.querySelectorAll("[data-club-sort]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const key = btn.dataset.clubSort;
        const same = sheet.dataset.clubKey === key;
        const dir = same && sheet.dataset.clubDir === "desc" ? "asc" : key === "team" && !same ? "asc" : "desc";
        sheet.dataset.clubKey = key;
        sheet.dataset.clubDir = dir;
        sortClubSheet(sheet, key, dir);
      });
    });
  });
}
