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

  for (const g of games) {
    const played = Number.isFinite(g.homeScore) && Number.isFinite(g.awayScore);
    if (!played) continue;

    const home = map.get(g.homeTeamId);
    const away = map.get(g.awayTeamId);
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

  return [...map.values()].sort((a, b) => {
    const diffA = a.pf - a.pa;
    const diffB = b.pf - b.pa;
    return (
      b.wins - a.wins ||
      diffB - diffA ||
      b.pf - a.pf ||
      a.name.localeCompare(b.name)
    );
  });
}

function renderStandings(rows) {
  const tbody = document.querySelector("#standingsTable tbody");
  if (!tbody) throw new Error("Standings table body not found.");

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

function renderSchedule(teamsById, games) {
  const el = document.getElementById("schedule");
  if (!el) throw new Error("Schedule container not found.");

  el.innerHTML = "";

  const sorted = [...games].sort((a, b) => {
    const da = new Date(`${a.date}T00:00:00`);
    const db = new Date(`${b.date}T00:00:00`);
    return da - db || String(a.time).localeCompare(String(b.time));
  });

  const gamesByDate = new Map();

  for (const g of sorted) {
    if (!gamesByDate.has(g.date)) gamesByDate.set(g.date, []);
    gamesByDate.get(g.date).push(g);
  }

  let weekNumber = 1;

  for (const [date, weekGames] of gamesByDate.entries()) {
    const header = document.createElement("h3");
    header.textContent = `Week ${weekNumber} – ${date}`;
    header.style.marginTop = "24px";
    el.appendChild(header);

    const sites = new Set(weekGames.map(g => g.location).filter(Boolean));

    if (sites.size === 1) {
      const siteLine = document.createElement("div");
      siteLine.textContent = [...sites][0];
      siteLine.style.fontWeight = "700";
      siteLine.style.fontSize = "1.25rem";
      siteLine.style.marginBottom = "12px";
      el.appendChild(siteLine);
    }

    for (const g of weekGames) {
      const homeName = teamsById.get(g.homeTeamId) || g.homeTeamId || "TBD";
      const awayName = teamsById.get(g.awayTeamId) || g.awayTeamId || "TBD";

      const homeBadge = teamBadge(g.homeTeamId, homeName);
      const awayBadge = teamBadge(g.awayTeamId, awayName);

      const played = Number.isFinite(g.homeScore) && Number.isFinite(g.awayScore);

      const line = played
        ? `${awayBadge} ${g.awayScore} — ${homeBadge} ${g.homeScore}`
        : `${awayBadge} @ ${homeBadge}`;

      const div = document.createElement("div");
      div.className = "game";

      div.innerHTML = `
        <div class="meta">${g.time || ""}</div>
        <div class="score">${line}</div>
        ${g.note ? `<div class="note">${g.note}</div>` : ""}
        ${played ? "" : `<div class="pending">Not played yet</div>`}
      `;

      el.appendChild(div);
    }

    weekNumber += 1;
  }
}

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

  const datesEl = document.getElementById("playoffDates");
  if (datesEl) {
    datesEl.textContent = "All playoff games at Girard / Rice Avenue Middle School";
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
      <div class="meta">Friday 5/1/26 — Play-in Games</div>
      <div class="score">6:00 PM — Game A: #3 ${teamBadge(s(3).teamId, s(3).name)} 21 — #6 ${teamBadge(s(6).teamId, s(6).name)} 17</div>
      <div class="score">7:00 PM — Game B: #4 ${teamBadge(s(4).teamId, s(4).name)} 12 — #5 ${teamBadge(s(5).teamId, s(5).name)} 14</div>
    </div>

    <div class="game">
      <div class="meta">Saturday 5/2/26 — Semifinals</div>
      <div class="score">10:00 AM — Semi 1: #5 ${teamBadge("fusion", "Millcreek Fusion")} vs #1 ${teamBadge(s(1).teamId, s(1).name)}</div>
      <div class="score">11:00 AM — Semi 2: #3 ${teamBadge("wk", "Wattsburg-Kinzig")} vs #2 ${teamBadge(s(2).teamId, s(2).name)}</div>
    </div>

    <div class="game">
      <div class="meta">Saturday 5/2/26 — Championship</div>
      <div class="score">12:15 PM — Winner of Semi 1 vs Winner of Semi 2</div>
    </div>
  `;
}

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
