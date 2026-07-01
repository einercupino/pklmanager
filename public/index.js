import { setupTabs, watchTournament, computeStandings, teamLabel, formatScore, getRealTeamCount } from './shared.js';

setupTabs();
const $ = (id) => document.getElementById(id);

watchTournament(({ players, teams, matches, settings }) => {
  const teamCount = getRealTeamCount(players, settings);
  $('tournamentTitle').textContent = settings.name || 'Pickleball Tournament';

  const group = matches.filter((m) => m.stage === 'group');
  const completed = group.filter((m) => m.locked).length;
  $('groupSummary').innerHTML = `${completed} / ${group.length || 0} matches completed. Top 4 advance to playoffs.<br><span class="subtle">BYE wins count as 1 win, with 0 PF / 0 PA / 0 Diff.</span>`;

  const standings = computeStandings(matches, teamCount);
  const body = $('standingsBody');
  body.innerHTML = '';

  standings.forEach((s, i) => {
    const tr = document.createElement('tr');
    if (i < 4) tr.className = 'advance-row';
    tr.innerHTML = `<td>${i + 1}</td><td>${teamLabel(s.teamNo, teams, teamCount)}</td><td>${s.wins}</td><td>${s.losses}</td><td>${s.pf}</td><td>${s.pa}</td><td>${s.diff > 0 ? '+' : ''}${s.diff}</td>`;
    body.appendChild(tr);
  });

  if (!standings.length) body.innerHTML = '<tr><td colspan="7">No teams yet.</td></tr>';

  const playoffs = matches.filter((m) => m.stage === 'playoff');
  $('playoffStandings').innerHTML = playoffs.length
    ? playoffs.map((m) => `<div class="card"><div class="match-title"><strong>${m.roundName || 'Playoff'}</strong><span>Court ${m.court || '-'}</span></div><div class="score-line">${teamLabel(m.teamA, teams, teamCount)} <strong>${formatScore(m)}</strong> ${teamLabel(m.teamB, teams, teamCount)}</div></div>`).join('')
    : '<div class="card">Playoffs not generated yet.</div>';
});
