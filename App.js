async function loadJson(path) {
  const res = await fetch(path);
  if (!res.ok) throw new Error(`Failed to load ${path}`);
  return res.json();
}

function computeStandings(teams, games) {
  const standings = new Map();

  // init
  for (const t of teams) {
    standings.set(t.id, {
      teamId: t.id,
      name: t.name,
      wins: 0,
      losses: 0,
      pf: 0,
      pa: 0
    });
  }

  // apply completed games
  for (const g of games) {
    const played = Number.isFinite(g.homeScore) && Number.isFinite(g.awayScore);
    if (!played) continue;

    const home = standings.get(g.homeTeamId);
    const away = standings.get(g.awayTeamId);
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
    // ties: if you need them, tell me and I’ll add a “T” column + logic
  }

  // sort: wins desc, then point diff desc, then PF desc
  return [...standings.values()].sort((a, b) => {
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
  tbody.innerHTML = "";
  for (const r of rows) {
    const tr = document.createElement("tr");
    const diff = r.pf - r.pa;
    tr.innerHTML = `
      <td>${r.name}</td>
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
  el.innerHTML = "";

  // sort by date/time
  const sorted = [...games].sort((a, b) => {
    const da = new Date(`${a.date}T00:00:00`);
    const db = new Date(`${b.date}T00:00:00`);
    return da - db || String(a.time).localeCompare(String(b.time));
  });

  for (const g of sorted) {
    const homeName = teamsById.get(g.homeTeamId) ?? g.homeTeamId;
    const awayName = teamsById.get(g.awayTeamId) ?? g.awayTeamId;

    const played = Number.isFinite(g.homeScore) && Number.isFinite(g.awayScore);
    const scoreHtml = played
      ? `<span class="score">${awayName} ${g.awayScore} — ${homeName} ${g.homeScore}</span>`
      : `<span class="pending">Not played yet</span>`;

    const div = document.createElement("div");
    div.className = "game";
    div.innerHTML = `
      <div class="meta">${g.date} • ${g.time}</div>
      <div>${scoreHtml}</div>
    `;
    el.appendChild(div);
  }
}

async function main() {
  const [teams, games] = await Promise.all([
    loadJson("teams.json"),
    loadJson("games.json"),
  ]);

  const teamsById = new Map(teams.map(t => [t.id, t.name]));
  const standings = computeStandings(teams, games);

  renderStandings(standings);
  renderSchedule(teamsById, games);
}

main().catch(err => {
  console.error(err);
  alert("Error loading league data. Check console.");
});
