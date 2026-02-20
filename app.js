// ---------- Visible error banners (helps debugging on mobile) ----------
window.addEventListener("error", (e) => {
  document.body.insertAdjacentHTML(
    "afterbegin",
    `<div style="background:#ffe0e0;color:#900;padding:10px;font-weight:700">
      JS Error: ${String(e.message || e.error || e)}
    </div>`
  );
});

window.addEventListener("unhandledrejection", (e) => {
  document.body.insertAdjacentHTML(
    "afterbegin",
    `<div style="background:#ffe0e0;color:#900;padding:10px;font-weight:700">
      Promise Error: ${String(e.reason || e)}
    </div>`
  );
});

// ---------- Helpers ----------
async function loadJson(path) {
  const res = await fetch(path, { cache: "no-store" });
  if (!res.ok) throw new Error(`Failed to load ${path}: ${res.status}`);
  return res.json();
}

function teamBadge(teamId, teamName) {
  const safeName = String(teamName ?? teamId ?? "TBD");
  const safeId = String(teamId ?? "tbd");
  return `<span class="team-badge team-${safeId}">${safeName}</span>`;
}

function computeStandings(teams, games) {
  const map = new Map();

  // Initialize every team
  for (const t of teams) {
    map.set(t.id, {
      teamId: t.id,
      name: t.name,
      wins: 0,
      losses: 0,
      pf: 0,
      pa: 0
    });
  }

  // Apply completed games
  for (const g of games) {
    const played = Number.isFinite(g.homeScore) && Number.isFinite(g.awayScore);
    if (!played) continue;

    const home = map.get(g.homeTeamId);
    const away = map.get(g.awayTeamId);

    // If a game references an unknown teamId, skip it (prevents crashing)
    if (!home || !away) continue;

    home.pf += g.homeScore;
    home.pa += g.awayScore;

    away.pf += g.awayScore;
    away.pa += g.homeScore;

    if (g.homeScore > g.awayScore) {
      home.wins += 1;
      away.losses += 1;
    } else if (g.awayScore > g.homeScore) {
      away.wins += 1;
      home.losses += 1;
    }
  }

  // Sort: wins desc, diff desc, PF desc, name asc
  const rows = [...map.values()];
  rows.sort((a, b) => {
    const diffA = a.pf - a.pa;
    const diffB = b.pf - b.pa;
    return (
      b.wins - a.wins ||
      diffB - diffA ||
      b.pf - a.pf ||
      a.name.localeCompare(b.name)
    );
  });

  return rows;
}

function renderStandings(rows) {
  const tbody = document.querySelector("#standingsTable tbody");
  if (!tbody) throw new Error("Standings table body not found (#standingsTable tbody).");

  tbody.innerHTML = "";
  for (const r of rows) {
    const diff = r.pf - r.pa;
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${teamBadge(r.teamId, r.name)}</td>
      <td>${r.wins}</td>
      <td>${r.losses}</td>
      <td>${r.pf}</td>
      <td>${r.pa}</td>
      <td>${diff}</td>
    `;
    tbody.appendChild(tr);
  }
}

// ---------- Schedule (grouped by week/date) ----------
function renderSchedule(teamsById, games) {
  const el = document.getElementById("schedule");
  if (!el) throw new Error("Schedule container not found (#schedule).");

  el.innerHTML = "";

  // Sort by date then time
  const sorted = [...games].sort((a, b) => {
    const da = new Date(`${a.date}T00:00:00`);
    const db = new Date(`${b.date}T00:00:00`);
    return da - db || String(a.time).localeCompare(String(b.time));
  });

  // Group by date
  const gamesByDate = new Map();
  for (const g of sorted) {
    if (!gamesByDate.has(g.date)) gamesByDate.set(g.date, []);
    gamesByDate.get(g.date).push(g);
  }

  let weekNumber = 1;

  for (const [date, weekGames] of gamesByDate.entries()) {
    // Week header
    const header = document.createElement("h3");
    header.textContent = `Week ${weekNumber} – ${date}`;
    header.style.marginTop = "24px";
    el.appendChild(header);

// Show site once if consistent (BOLD + LARGE)
const sites = new Set(weekGames.map(g => g.location).filter(Boolean));
if (sites.size === 1) {
  const siteLine = document.createElement("div");
  siteLine.textContent = [...sites][0];
  siteLine.style.fontWeight = "700";
  siteLine.style.fontSize = "1.15rem";
  siteLine.style.marginBottom = "12px";
  el.appendChild(siteLine);
}

    // Games
    for (const g of weekGames) {
      const homeName = teamsById.get(g.homeTeamId) || g.homeTeamId || "TBD";
      const awayName = teamsById.get(g.awayTeamId) || g.awayTeamId || "TBD";
      const played = Number.isFinite(g.homeScore) && Number.isFinite(g.awayScore);

     const awayBadge = teamBadge(g.awayTeamId, awayName);
const homeBadge = teamBadge(g.homeTeamId, homeName);

const line = played
  ? `${awayBadge} ${g.awayScore} — ${homeBadge} ${g.homeScore}`
  : `${awayBadge} @ ${homeBadge}`;

      const div = document.createElement("div");
      div.className = "game";
      div.innerHTML = `
        <div class="meta">${g.time || ""}</div>
        <div class="score">${line}</div>
        ${played ? "" : `<div class="pending">Not played yet</div>`}
      `;
      el.appendChild(div);
    }

    weekNumber += 1;
  }
}

// ---------- Playoffs ----------
function seedFromStandings(standings) {
  return standings.map((t, idx) => ({
    seed: idx + 1,
    teamId: t.teamId,
    name: t.name,
    wins: t.wins,
    losses: t.losses,
    pf: t.pf,
    pa: t.pa,
    diff: t.pf - t.pa
  }));
}

function renderPlayoffs(seeds) {
  const el = document.getElementById("playoffs");
  if (!el) return;

  // Set the playoff dates line
  const datesEl = document.getElementById("playoffDates");
  if (datesEl) {
    datesEl.textContent =
      "Friday 5/1/26 (Play-in Games) • Saturday 5/2/26 — Semifinals 10:30 AM • Championship 12:00 PM";
  }

  if (!seeds || seeds.length < 6) {
    el.innerHTML = `
      <div class="game">
        <div class="pending">Playoffs will appear once 6 teams are loaded.</div>
      </div>
    `;
    return;
  }

  const s = (n) => seeds[n - 1];

  el.innerHTML = `
    <div class="game">
      <div class="meta">Seeding (based on current standings)</div>
      <div class="score">
        ${seeds.map(x => `#${x.seed} ${x.name}`).join("<br/>")}
      </div>
    </div>

    <div class="game">
      <div class="meta">Friday 5/1/26 — Play-in</div>
      <div class="score">Game A: #3 ${s(3).name} vs #6 ${s(6).name}</div>
      <div class="score">Game B: #4 ${s(4).name} vs #5 ${s(5).name}</div>
    </div>

    <div class="game">
      <div class="meta">Saturday 5/2/26 — Semifinals (10:30 AM)</div>
      <div class="score">Semi 1: Winner of #4/#5 vs #1 ${s(1).name}</div>
      <div class="score">Semi 2: Winner of #3/#6 vs #2 ${s(2).name}</div>
    </div>

    <div class="game">
      <div class="meta">Saturday 5/2/26 — Championship (12:00 PM)</div>
      <div class="score">Championship: Winners of the 10:30 AM semifinals</div>
    </div>
  `;
}

// ---------- Main ----------
async function main() {
  const [teams, games] = await Promise.all([
    loadJson("teams.json"),
    loadJson("games.json")
  ]);

  const teamsById = new Map(teams.map(t => [t.id, t.name]));
  const standings = computeStandings(teams, games);

  renderStandings(standings);
  renderSchedule(teamsById, games);

  const seeds = seedFromStandings(standings);
  renderPlayoffs(seeds);
}

main();
