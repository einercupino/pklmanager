import {
  db, refs, setupTabs, watchTournament, doc, setDoc, updateDoc, writeBatch,
  serverTimestamp, validateTeams, getSchedule, computeStandings, teamLabel,
  getRealTeamCount, getByeTeamNo
} from './shared.js';

setupTabs();
const $ = (id) => document.getElementById(id);
let state = { players: [], teams: {}, matches: [], settings: {} };

$('saveSettingsBtn').addEventListener('click', saveSettings);
$('generateTournamentBtn').addEventListener('click', generateTournament);
$('generatePlayoffsBtn').addEventListener('click', generatePlayoffs);
$('resetTournamentBtn').addEventListener('click', resetMatches);

watchTournament((data) => {
  state = data;
  $('tournamentName').value = state.settings.name || '';
  $('startTime').value = state.settings.startTime || '15:00';
  renderAdmin();
});

async function saveSettings() {
  await setDoc(refs.settings, {
    name: $('tournamentName').value.trim() || 'Pickleball Tournament',
    startTime: $('startTime').value || '15:00',
    updatedAt: serverTimestamp()
  }, { merge: true });
}

async function generateTournament() {
  const result = validateTeams(state.players);
  if (!result.ok) return alert(result.message);

  const teamCount = state.players.length / 2;
  const startTime = $('startTime').value || state.settings.startTime || '15:00';
  const matches = getSchedule(teamCount, startTime);
  const byeTeamNo = getByeTeamNo(teamCount);
  const byeNote = byeTeamNo ? `\n\nTeam ${byeTeamNo} will be BYE. BYE matches are locked as 0-0 automatic wins with no points.` : '';

  if (!confirm(`Generate ${matches.length} group-stage matches? This will replace existing group matches.${byeNote}`)) return;

  const batch = writeBatch(db);
  state.matches.filter((m) => m.stage === 'group').forEach((m) => batch.delete(doc(db, 'matches', m.id)));
  matches.forEach((m, index) => {
    batch.set(doc(db, 'matches', m.id), {
      ...m,
      match_num: index + 1,
      court: m.court + 3
    });
  });
  batch.set(refs.settings, {
    teamCount,
    startTime,
    status: 'group',
    tournamentGenerated: true,
    updatedAt: serverTimestamp()
  }, { merge: true });

  await batch.commit();
}

async function generatePlayoffs() {
  const group = state.matches.filter((m) => m.stage === 'group');
  if (!group.length) return alert('Generate group matches first.');
  if (group.some((m) => !m.locked)) return alert('Lock all group-stage matches first.');

  const teamCount = getRealTeamCount(state.players, state.settings);
  const standings = computeStandings(state.matches, teamCount);
  if (standings.length < 4) return alert('Need at least 4 teams.');

  const playoffMatches = [
    { id: 'semi_1', stage: 'playoff', round: 1, roundName: 'Semi Final 1', court: 4, teamA: standings[0].teamNo, teamB: standings[3].teamNo, scoreA: '', scoreB: '', winner: 0, locked: false },
    { id: 'semi_2', stage: 'playoff', round: 1, roundName: 'Semi Final 2', court: 5, teamA: standings[1].teamNo, teamB: standings[2].teamNo, scoreA: '', scoreB: '', winner: 0, locked: false }
  ];

  const batch = writeBatch(db);
  state.matches.filter((m) => m.stage === 'playoff').forEach((m) => batch.delete(doc(db, 'matches', m.id)));
  playoffMatches.forEach((m) => batch.set(doc(db, 'matches', m.id), m));
  batch.set(refs.settings, { status: 'playoffs', updatedAt: serverTimestamp() }, { merge: true });
  await batch.commit();
}

async function resetMatches() {
  if (!confirm('Delete all matches? Players and teams will stay.')) return;
  const batch = writeBatch(db);
  state.matches.forEach((m) => batch.delete(doc(db, 'matches', m.id)));
  batch.set(refs.settings, { status: 'setup', tournamentGenerated: false, updatedAt: serverTimestamp() }, { merge: true });
  await batch.commit();
}

function renderAdmin() {
  const group = state.matches.filter((m) => m.stage === 'group').sort((a, b) => a.round - b.round || a.court - b.court);
  const playoffs = state.matches.filter((m) => m.stage === 'playoff').sort((a, b) => a.round - b.round || a.id.localeCompare(b.id));

  $('adminGroupMatches').innerHTML =
  group.length
    ? group.map((m, index) => scoreCard(m, index + 1)).join('')
    : '<div class="card">No group matches yet.</div>';

  $('adminPlayoffMatches').innerHTML =
  playoffs.length
    ? playoffs.map((m, index) => scoreCard(m, index + 1)).join('')
    : '<div class="card">No playoff matches yet.</div>';

  document.querySelectorAll('[data-lock]').forEach((btn) => btn.addEventListener('click', lockMatch));
  document.querySelectorAll('[data-unlock]').forEach((btn) => btn.addEventListener('click', unlockMatch));
}

async function lockMatch(e) {
  const id = e.target.dataset.lock;
  const scoreA = Number(document.getElementById(`${id}_a`).value);
  const scoreB = Number(document.getElementById(`${id}_b`).value);
  if (Number.isNaN(scoreA) || Number.isNaN(scoreB) || scoreA === scoreB) return alert('Enter valid scores. Ties are not allowed.');

  const match = state.matches.find((m) => m.id === id);
  await updateDoc(doc(db, 'matches', id), {
    scoreA,
    scoreB,
    winner: scoreA > scoreB ? match.teamA : match.teamB,
    locked: true
  });

  await maybeCreateFinals();
}

async function unlockMatch(e) {
  await updateDoc(doc(db, 'matches', e.target.dataset.unlock), { locked: false, winner: 0 });
}

async function maybeCreateFinals() {
  const semi1 = state.matches.find((m) => m.id === 'semi_1');
  const semi2 = state.matches.find((m) => m.id === 'semi_2');
  if (!semi1?.locked || !semi2?.locked) return;
  if (state.matches.some((m) => m.id === 'final')) return;

  const loser1 = semi1.winner === semi1.teamA ? semi1.teamB : semi1.teamA;
  const loser2 = semi2.winner === semi2.teamA ? semi2.teamB : semi2.teamA;

  const batch = writeBatch(db);
  batch.set(doc(db, 'matches', 'final'), {
    id: 'final', stage: 'playoff', round: 2, roundName: 'Final', court: 4,
    teamA: semi1.winner, teamB: semi2.winner, scoreA: '', scoreB: '', winner: 0, locked: false
  });
  batch.set(doc(db, 'matches', 'third_place'), {
    id: 'third_place', stage: 'playoff', round: 2, roundName: 'Third Place', court: 5,
    teamA: loser1, teamB: loser2, scoreA: '', scoreB: '', winner: 0, locked: false
  });
  await batch.commit();
}

function teamMembers(teamNo, players) {
    return players
        .filter(p => p.teamNo === teamNo)
        .map(p => p.name)
        .join(" / ");
}

function scoreCard(m, matchNo) {
  const teamCount = getRealTeamCount(state.players, state.settings);
  const a = teamLabel(m.teamA, state.teams, teamCount);
  const b = teamLabel(m.teamB, state.teams, teamCount);

  if (m.bye) {
    return `
      <div class="admin-match-card bye-card">

        <div class="admin-match-top">
          <div class="admin-match-info">
            Match ${m.id} • Court ${m.court} • ${m.time || ''}
          </div>

          <button class="lock-btn" disabled>
            ✓ BYE
          </button>
        </div>

        <div class="admin-score-inline">
          <div class="team-name">
              <div class="team-name-main">
                  ${a}
              </div>

              <div class="team-members-small">
                  ${teamMembers(m.teamA, state.players)}
              </div>
          </div>

          <input class="score-input" value="0" disabled>

          <span class="vs">vs</span>

          <input class="score-input" value="0" disabled>

          <div class="team-name">
              <div class="team-name-main">
                  ${b}
              </div>

              <div class="team-members-small">
                  ${teamMembers(m.teamB, state.players)}
              </div>
          </div>
        </div>

      </div>
    `;
  }

  return `
    <div class="admin-match-card ${m.locked ? 'locked-card' : ''}">

      <div class="admin-match-top">

      <div class="admin-match-info">
          ${
              m.stage === "playoff"
                  ? `${m.roundName} • Court ${m.court}`
                  : `Match ${m.match_num} • Court ${m.court} • ${m.time || ""}`
          }
      </div>

        ${
          m.locked
            ? `<button class="lock-btn" data-unlock="${m.id}">Unlock</button>`
            : `<button class="lock-btn" data-lock="${m.id}">Lock</button>`
        }

      </div>

      <div class="admin-score-inline">

        <div class="team-name">
            <div class="team-name-main">
                ${a}
            </div>

            <div class="team-members-small">
                ${teamMembers(m.teamA, state.players)}
            </div>
        </div>

        <input
          id="${m.id}_a"
          class="score-input"
          type="number"
          min="0"
          value="${m.scoreA ?? ''}"
          ${m.locked ? 'disabled' : ''}>

        <span class="vs">vs</span>

        <input
          id="${m.id}_b"
          class="score-input"
          type="number"
          min="0"
          value="${m.scoreB ?? ''}"
          ${m.locked ? 'disabled' : ''}>

        <div class="team-name">
            <div class="team-name-main">
                ${b}
            </div>

            <div class="team-members-small">
                ${teamMembers(m.teamB, state.players)}
            </div>
        </div>

      </div>

    </div>
  `;
}

