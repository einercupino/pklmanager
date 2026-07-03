import { setupTabs, watchTournament, computeStandings, teamLabel, formatScore, getRealTeamCount } from './shared.js';

setupTabs();
const $ = (id) => document.getElementById(id);

watchTournament(({ players, teams, matches, settings }) => {
  const teamCount = getRealTeamCount(players, settings);
  $('tournamentTitle').textContent = settings.name || 'Pickleball Tournament';

  const group = matches.filter((m) => m.stage === 'group');
  const completed = group.filter((m) => m.locked).length;
 $('groupSummary').innerHTML =
`${completed} / ${group.length || 0} matches completed. <br> Top 4 advance to playoffs.<br>
BYE wins = 1 W / 0 L / 0 PF / 0 PA / 0 D
`;

  const standings = computeStandings(matches, teamCount);
  const body = $('standingsBody');
  body.innerHTML = '';

  standings.forEach((s, i) => {
    const tr = document.createElement('tr');
    if (i < 4) tr.className = 'advance-row';
    tr.innerHTML = `<td>${i + 1}</td>
    
    <td>
        <div class="team-name">
            ${teamLabel(s.teamNo, teams, teamCount)}
        </div>

        <div class="team-members">
            ${teamMembers(s.teamNo, players)}
        </div>
    </td>

    <td>${s.wins}</td><td>${s.losses}</td><td>${s.pf}</td><td>${s.pa}</td><td>${s.diff > 0 ? '+' : ''}${s.diff}</td>`;
    body.appendChild(tr);
  });

  function teamMembers(teamNo, players) {
    return players
        .filter(p => p.teamNo === teamNo)
        .map(p => p.name)
        .join(" / ");
  }

  if (!standings.length) body.innerHTML = '<tr><td colspan="7">No teams yet.</td></tr>';

  const playoffs = matches.filter(m => m.stage === "playoff");

  const final = playoffs.find(m => m.id === "final");
  const third = playoffs.find(m => m.id === "third_place");

  let rankings = [];

  if (final?.locked) {

      rankings.push(final.winner);

      rankings.push(
          final.winner === final.teamA
              ? final.teamB
              : final.teamA
      );

  }

  if (third?.locked) {

      rankings.push(third.winner);

      rankings.push(
          third.winner === third.teamA
              ? third.teamB
              : third.teamA
      );

  }

  if (!rankings.length) {

      $("playoffStandings").innerHTML =
          `<div class="card">Playoff rankings will appear once the Final and Third Place matches are complete.</div>`;

  } else {

      const medals = ["🥇","🥈","🥉","4️⃣"];

      $("playoffStandings").innerHTML = `
          <div class="table-wrap">

              <table class="standings-table">

                  <thead>

                      <tr>
                          <th>Rank</th>
                          <th>Team</th>
                          <th>Players</th>
                      </tr>

                  </thead>

                  <tbody>

                      ${rankings.map((teamNo, i) => `

                          <tr>

                              <td>${medals[i] || i + 1}</td>

                              <td>${teamLabel(teamNo, teams, teamCount)}</td>

                              <td>${teamMembers(teamNo, players)}</td>

                          </tr>

                      `).join("")}

                  </tbody>

              </table>

          </div>
      `;

  }


});
