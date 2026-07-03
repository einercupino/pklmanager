import { setupTabs, watchTournament, computeStandings, teamLabel, teamRecord, formatScore, getRealTeamCount } from './shared.js';

setupTabs();
const $ = (id) => document.getElementById(id);

watchTournament(({ players, teams, matches, settings }) => {
  const teamCount = getRealTeamCount(players, settings);
  const standings = computeStandings(matches, teamCount);
  const group = matches.filter((m) => m.stage === 'group').sort((a, b) => a.round - b.round || a.court - b.court);
  const completed = group.filter((m) => m.locked);
  const currentRound = group.find((m) => !m.locked)?.round || group[group.length - 1]?.round || 1;
  const live = group.filter((m) => !m.locked && m.round === currentRound);
  const upcoming = group.filter((m) => !m.locked && m.round !== currentRound);

  $('groupProgress').textContent = `${completed.length} / ${group.length || 0} completed`;
  $('liveMatches').innerHTML = live.length ? live.map((m) => liveCard(m, standings, teams, players, teamCount)).join('') : '<div class="card">No live matches.</div>';
  $('upcomingMatches').innerHTML = upcoming.length ? upcoming.map((m) => compactCard(m, standings, teams, players, teamCount)).join('') : '<div class="compact-card">No upcoming matches.</div>';
  $('completedMatches').innerHTML = completed.length ? completed.map((m) => compactCard(m, standings, teams, players, teamCount, true)).join('') : '<div class="compact-card">No completed matches yet.</div>';

  const playoffs = matches.filter((m) => m.stage === 'playoff').sort((a, b) => a.round - b.round || a.id.localeCompare(b.id));
  $('playoffMatches').innerHTML = playoffs.length
    ? playoffs.map((m) => playoffCard(m, standings, teams, players, teamCount)).join('')
    : '<div class="card">Playoffs not generated yet.</div>';
});

function liveCard(m, standings, teams, players, teamCount) {
  return `
    <div class="card live-card ${m.bye ? 'bye-card' : ''}">

      <div class="match-top">
          <strong>
              Match ${m.match_num || m.id} • Court ${m.court} • ${m.time || ''}
          </strong>
      </div>

      <div class="match-score-row">

          <div class="team-side left">
              <div class="team-title">
                  ${teamLabel(m.teamA, teams, teamCount)}
                  (${teamRecord(standings, m.teamA)})
              </div>

              <div class="team-members-small">
                  ${teamMembers(m.teamA, players)}
              </div>
          </div>

          <div class="score-center">
              <span class="vs">vs</span>
          </div>

          <div class="team-side right">
              <div class="team-title">
                  ${teamLabel(m.teamB, teams, teamCount)}
                  (${teamRecord(standings, m.teamB)})
              </div>

              <div class="team-members-small">
                  ${teamMembers(m.teamB, players)}
              </div>
          </div>

      </div>

      ${m.bye ? `<div class="subtle">✓ Automatic BYE Win</div>` : ""}

    </div>
  `;
}

function compactCard(m, standings, teams, players, teamCount, done = false) {
  return `
    <div class="compact-card ${done ? 'done' : ''} ${m.bye ? 'bye-card' : ''}">

      <div class="match-top">
          <strong>
              Match ${m.match_num || m.id} • Court ${m.court} • ${m.time || ''}
          </strong>
      </div>

      <div class="match-score-row">

          <div class="team-side left">
              <div class="team-title">
                  ${teamLabel(m.teamA, teams, teamCount)}
                  (${teamRecord(standings, m.teamA)})
              </div>

              <div class="team-members-small">
                  ${teamMembers(m.teamA, players)}
              </div>
          </div>

          <div class="score-center">

              ${
                  done
                  ? `
                      <span class="score">${m.scoreA}</span>
                      <span class="vs">vs</span>
                      <span class="score">${m.scoreB}</span>
                    `
                  : `
                      <span class="vs">vs</span>
                    `
              }

          </div>

          <div class="team-side right">
              <div class="team-title">
                  ${teamLabel(m.teamB, teams, teamCount)}
                  (${teamRecord(standings, m.teamB)})
              </div>

              <div class="team-members-small">
                  ${teamMembers(m.teamB, players)}
              </div>
          </div>

      </div>


      ${m.bye ? `<div class="subtle">✓ Automatic BYE Win</div>` : ""}

    </div>
  `;
}

function playoffCard(m, standings, teams, players, teamCount, done = false) {
  return `
    <div class="compact-card ${m.locked ? 'done' : ''}">

      <div class="playoff-round">
        ${m.roundName} • Court ${m.court}
      </div>

      <div class="match-score-row">

          <div class="team-side left">
              <div class="team-title">
                  ${teamLabel(m.teamA, teams, teamCount)}
                  (${teamRecord(standings, m.teamA)})
              </div>

              <div class="team-members-small">
                  ${teamMembers(m.teamA, players)}
              </div>
          </div>

          <div class="score-center">

              ${
                  m.locked
                  ? `
                      <span class="score">${m.scoreA}</span>
                      <span class="vs">vs</span>
                      <span class="score">${m.scoreB}</span>
                  `
                  : `
                      <span class="vs">vs</span>
                  `
              }

          </div>

          <div class="team-side right">
              <div class="team-title">
                  ${teamLabel(m.teamB, teams, teamCount)}
                  (${teamRecord(standings, m.teamB)})
              </div>

              <div class="team-members-small">
                  ${teamMembers(m.teamB, players)}
              </div>
          </div>

      </div>


      ${m.bye ? `<div class="subtle">✓ Automatic BYE Win</div>` : ""}

    </div>
  `;
}

function teamMembers(teamNo, players) {

    return players
        .filter(p => p.teamNo === teamNo)
        .map(p => p.name)
        .join(" / ");

}