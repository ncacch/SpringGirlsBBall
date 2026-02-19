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

function seedFromStandings(standings) {
  // standings already sorted best-to-worst
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

  // Basic safety
  if (!seeds || seeds.length < 6) {
    el.innerHTML = `<div class="game"><div class="pending">Playoffs will appear once all 6 teams are loaded.</div></div>`;
    return;
  }

  const s = (n) => seeds[n - 1]; // seed lookup: s(1) is seed #1 team object

  el.innerHTML = `
    <div class="game">
      <div class="meta">Seeding (based on current standings)</div>
      <div class="score">
        ${seeds.map(x => `#${x.seed} ${x.name}`).join("<br/>")}
      </div>
    </div>

    <div class="game">
      <div class="meta">Friday Night — Play-in</div>
      <div class="score">Game A: #3 ${s(3).name} vs #6 ${s(6).name}</div>
      <div class="score">Game B: #4 ${s(4).name} vs #5 ${s(5).name}</div>
    </div>

    <div class="game">
      <div class="meta">Saturday — Semifinals (10:30 AM)</div>
      <div class="score">Semi 1: Winner of #4/#5 vs #1 ${s(1).name}</div>
      <div class="score">Semi 2: Winner of #3/#6 vs #2 ${s(2).name}</div>
    </div>

    <div class="game">
      <div class="meta">Saturday — Championship (12:00 PM)</div>
      <div class="score">Championship: Winners of the 10:30 AM semifinals</div>
    </div>
  `;
}
  renderStandings(standings);
  renderSchedule(teamsById, games);

  const seeds = seedFromStandings(standings);
  renderPlayoffs(seeds);
main().catch(err => {
  console.error(err);
  alert("Error loading league data. Check console for details.");
});
