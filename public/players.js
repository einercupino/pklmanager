import {
  db, refs, setupTabs, watchTournament, addDoc, doc, setDoc, updateDoc,
  deleteDoc, writeBatch, serverTimestamp, validateTeams, generateBalancedAssignments,
  getTeamPlayers
} from './shared.js';

setupTabs();
const $ = (id) => document.getElementById(id);
let state = { players: [], teams: {}, matches: [], settings: {} };

$('addPlayerBtn').addEventListener('click', addPlayer);
$('playerName').addEventListener('keydown', (event) => {
  if (event.key === 'Enter') addPlayer();
});
$('generateTeamsBtn').addEventListener('click', shuffleTeams);
$('saveTeamsBtn').addEventListener('click', saveTeams);

watchTournament((data) => {
  state = data;

  const locked = state.settings.tournamentGenerated;

  $("playerName").disabled = locked;
  $("playerSkill").disabled = locked;
  $("addPlayerBtn").disabled = locked;
  $("generateTeamsBtn").disabled = locked;
  $("saveTeamsBtn").disabled = locked;

  renderPlayers();
  renderTeamAssignments();
  renderTeamCards();
});

async function addPlayer() {

  if (state.settings.tournamentGenerated) {
    alert("The tournament has already been generated. Reset the tournament before adding players.");
    return;
  }

  const name = $('playerName').value.trim();
  if (!name) return alert('Enter player name.');

  await addDoc(refs.players, {
    name,
    skill: Number($('playerSkill').value),
    teamNo: 0,
    createdAt: serverTimestamp()
  });

  $('playerName').value = '';
  $('playerName').focus();
}

function renderPlayers() {
  const body = $('playersBody');
  if (!state.players.length) {
    body.innerHTML = '<tr><td colspan="3">No players yet.</td></tr>';
    return;
  }

  body.innerHTML = state.players
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((p) => `
      <tr>
        <td><input class="table-input" value="${escapeHtml(p.name)}" data-player-name="${p.id}"></td>
        <td>
          <select class="table-input" data-player-skill="${p.id}">
            ${[1, 2, 3, 4, 5].map((n) => `<option value="${n}" ${p.skill === n ? 'selected' : ''}>${skillLabel(n)}</option>`).join('')}
          </select>
        </td>
        <td><button class="danger-small" data-delete-player="${p.id}">Delete</button></td>
      </tr>
    `).join('');

  document.querySelectorAll('[data-player-name]').forEach((input) => {
    input.addEventListener('change', async (e) => {
      const id = e.target.dataset.playerName;
      const name = e.target.value.trim();
      if (!name) return alert('Player name cannot be blank.');
      await updateDoc(doc(db, 'players', id), { name });
    });
  });

  document.querySelectorAll('[data-player-skill]').forEach((select) => {
    select.addEventListener('change', async (e) => {
      await updateDoc(doc(db, 'players', e.target.dataset.playerSkill), { skill: Number(e.target.value) });
    });
  });

  document.querySelectorAll('[data-delete-player]').forEach((btn) => {

    btn.disabled = state.settings.tournamentGenerated;

    btn.addEventListener('click', async (e) => {

      if (state.settings.tournamentGenerated) {
        alert("The tournament has already been generated. Reset the tournament before modifying players.");
        return;
      }

      const player = state.players.find((p) => p.id === e.target.dataset.deletePlayer);

      if (!confirm(`Delete ${player?.name || 'this player'}?`)) return;

      await deleteDoc(doc(db, 'players', e.target.dataset.deletePlayer));

    });

  });

}

function renderTeamAssignments() {
  const body = $('teamAssignmentsBody');
  if (!state.players.length) {
    body.innerHTML = '<tr><td colspan="3">Add players first.</td></tr>';
    return;
  }

  const teamCount = Math.floor(state.players.length / 2);
  body.innerHTML = state.players
    .sort((a, b) => (a.teamNo - b.teamNo) || a.name.localeCompare(b.name))
    .map((p) => `
      <tr>
        <td>${escapeHtml(p.name)}</td>
        <td>${skillStars(p.skill)}</td>
        <td>
          <select class="table-input team-number-select" data-player-team="${p.id}">
            <option value="0" ${!p.teamNo ? 'selected' : ''}>-</option>
            ${Array.from({ length: teamCount }, (_, i) => i + 1)
        .map((n) => `<option value="${n}" ${p.teamNo === n ? 'selected' : ''}>Team ${n}</option>`).join('')}
          </select>
        </td>
      </tr>
    `).join('');

  const locked = state.settings.tournamentGenerated;

  document.querySelectorAll('[data-player-team]').forEach((select) => {
    select.addEventListener('change', async (e) => {

      if (state.settings.tournamentGenerated) {
        alert("The tournament has already been generated. Reset the tournament before modifying teams.");
        e.target.value = state.players.find(
          p => p.id === e.target.dataset.playerTeam
        )?.teamNo || 0;
        return;
      }

      await updateDoc(doc(db, 'players', e.target.dataset.playerTeam), {
        teamNo: Number(e.target.value)
      });

      setValidation('Team number changed. Save teams when ready.', true);
    });
  });
}

function renderTeamCards() {
  const box = $('teamsList');
  const teamCount = Math.floor(state.players.length / 2);

  if (!teamCount) {
    box.innerHTML = '<div class="card">No teams yet.</div>';
    return;
  }

  box.innerHTML = Array.from({ length: teamCount }, (_, i) => i + 1).map((teamNo) => {
    const players = getTeamPlayers(state.players, teamNo);
    return `
      <div class="card team-card">
        <div class="team-title">Team ${teamNo}</div>
        ${players.length
        ? players.map((p) => `<div class="team-player"><span>${escapeHtml(p.name)}</span><span>${skillStars(p.skill)}</span></div>`).join('')
        : '<div class="subtle">No players assigned.</div>'}
      </div>
    `;
  }).join('');
}

async function shuffleTeams() {

  if (state.settings.tournamentGenerated) {
    alert("The tournament has already been generated. Reset the tournament before modifying teams.");
    return;
  }

  const players = state.players;
  if (!players.length) return alert('Add players first.');
  if (players.length % 2) return alert(`There are ${players.length} players. Add one more player.`);
  if (players.length < 8) return alert('Minimum is 8 players / 4 teams.');
  if (players.length > 20) return alert('Maximum is 20 players / 10 teams.');

  const assignments = generateBalancedAssignments(players);
  const batch = writeBatch(db);

  for (const [id, teamNo] of Object.entries(assignments)) {
    batch.update(doc(db, 'players', id), { teamNo });
  }

  batch.set(refs.settings, {
    teamsLocked: false,
    tournamentGenerated: false,
    teamCount: players.length / 2,
    updatedAt: serverTimestamp()
  }, { merge: true });

  await batch.commit();
  setValidation('Teams shuffled.', true);
}

async function saveTeams() {

  if (state.settings.tournamentGenerated) {
    alert("The tournament has already been generated. Reset the tournament before modifying teams.");
    return;
  }

  const result = validateTeams(state.players);
  setValidation(result.message, result.ok);
  if (!result.ok) return;

  const teamCount = state.players.length / 2;
  const batch = writeBatch(db);

  for (let teamNo = 1; teamNo <= teamCount; teamNo++) {
    batch.set(doc(db, 'teams', `team_${teamNo}`), {
      teamNo,
      name: state.teams?.[teamNo]?.name || `Team ${teamNo}`,
      bye: false,
      updatedAt: serverTimestamp()
    });
  }

  batch.set(refs.settings, {
    teamsLocked: true,
    teamCount,
    updatedAt: serverTimestamp()
  }, { merge: true });

  await batch.commit();
}

function setValidation(message, ok) {
  $('teamValidation').textContent = message;
  $('teamValidation').className = ok ? 'success-text' : 'error-text';
}

function skillLabel(n) {
  return `${n} ${'❤️'.repeat(n)}${'🤍'.repeat(5 - n)}`;
}

function skillStars(n) {
  return `${'❤️'.repeat(n)}${'🤍'.repeat(5 - n)}`;
}

function escapeHtml(value) {
  return String(value).replace(/[&<>'"]/g, (char) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
  }[char]));
}
