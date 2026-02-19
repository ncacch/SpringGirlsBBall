async function loadJson(path) {
  const res = await fetch(path, { cache: "no-store" });
  if (!res.ok) throw new Error(`Failed to load ${path}: ${res.status}`);
  return res.json();
}

function computeStandings(teams, games) {
  const standings = new Map();

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
  }

  return [...standings.values()].sort((a, b) => {
    const diffA = a.pf - a.pa;
    const diffB = b.pf - b.pa;
    return (b.wins - a.wins) || (diffB - diffA) || (b.pf - a.pf) || a.name.localeCompare(b.name);
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

  const sorted = [...games].sort((a, b) => {
    const da = new Date(`${a.date}T00:00:00`);
    const db = new Date(`${b.date}T00:00:00`);
    return da - db || String(a.time).localeCompare(String(b.time));
  });

  for (const g of sorted) {
    const homeName = teamsById.get(g.homeTeamId) || g.homeTeamId || "TBD";
    const awayName = teamsById.get(g.awayTeamId) || g.awayTeamId || "TBD";

    const played = Number.isFinite(g.homeScore) && Number.isFinite(g.awayScore);
    const scoreLine = played
      ? `${awayName} ${g.awayScore} — ${homeName} ${g.homeScore}`
      : `${awayName} @ ${homeName}`;

    const metaParts = [
      g.location ? g.location : null,
      g.date ? g.date : null,
      g.time ? g.time : null
    ].filter(Boolean);

    const div = document.createElement("div");
    div.className = "game";
    div.innerHTML = `
      <div class="meta">${metaParts.join(" • ")}</div>
      <div class="score">${scoreLine}</div>
      ${played ? "" : `<div class="pending">Not played yet</div>`}
    `;
    el.appendChild(div);
  }
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
}

main().catch(err => {
  console.error(err);
  alert("Error loading league data. Check console for details.");
});
