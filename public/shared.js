import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js';
import {
  getFirestore, collection, doc, onSnapshot, addDoc, setDoc, updateDoc,
  deleteDoc, writeBatch, serverTimestamp
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';
import { firebaseConfig } from './firebaseConfig.js';

export const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);

export const refs = {
  players: collection(db, 'players'),
  teams: collection(db, 'teams'),
  matches: collection(db, 'matches'),
  settings: doc(db, 'settings', 'tournament')
};

export { collection, doc, onSnapshot, addDoc, setDoc, updateDoc, deleteDoc, writeBatch, serverTimestamp };

export function setupTabs() {
  document.querySelectorAll('.tab-button').forEach((btn) => {
    btn.addEventListener('click', () => {
      const tab = btn.dataset.tab;
      document.querySelectorAll('.tab-button').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      document.querySelectorAll('main section').forEach((section) => section.classList.add('hidden'));
      document.getElementById(`${tab}Tab`)?.classList.remove('hidden');
    });
  });
}

export function watchTournament(callback) {
  const state = { players: [], teams: {}, matches: [], settings: {} };
  const loaded = { players: false, teams: false, matches: false, settings: false };
  const emit = () => {
    if (Object.values(loaded).every(Boolean)) callback({ ...state });
  };

  const unsubscribers = [
    onSnapshot(refs.players, (s) => {
      state.players = s.docs.map((d) => normalizePlayer(d.id, d.data()))
        .sort((a, b) => (a.teamNo - b.teamNo) || a.name.localeCompare(b.name));
      loaded.players = true;
      emit();
    }),
    onSnapshot(refs.teams, (s) => {
      state.teams = Object.fromEntries(
        s.docs.map((d) => {
          const team = normalizeTeam(d.id, d.data());
          return [team.teamNo, team];
        })
      );
      loaded.teams = true;
      emit();
    }),
    onSnapshot(refs.matches, (s) => {
      state.matches = s.docs.map((d) => normalizeMatch(d.id, d.data())).sort(matchSort);
      loaded.matches = true;
      emit();
    }),
    onSnapshot(refs.settings, (s) => {
      state.settings = s.exists() ? s.data() : {};
      loaded.settings = true;
      emit();
    })
  ];

  return () => unsubscribers.forEach((u) => u());
}

function normalizePlayer(id, p) {
  return {
    id,
    name: p.name || '',
    skill: Number(p.skill || 1),
    teamNo: Number(p.teamNo || p.team_num || 0)
  };
}

function normalizeTeam(id, t) {
  const teamNo = Number(t.teamNo || t.team_num || String(id).replace('team_', ''));
  return {
    id,
    teamNo,
    name: t.name || t.team_name || `Team ${teamNo}`,
    bye: !!t.bye
  };
}

function normalizeMatch(id, m) {
  return {
    id,
    ...m,
    round: Number(m.round || 0),
    court: Number(m.court || 0),
    teamA: Number(m.teamA || 0),
    teamB: Number(m.teamB || 0),
    scoreA: m.scoreA ?? '',
    scoreB: m.scoreB ?? '',
    winner: Number(m.winner || 0),
    locked: !!m.locked,
    bye: !!m.bye
  };
}

function matchSort(a, b) {
  return stageOrder(a.stage) - stageOrder(b.stage) || a.round - b.round || a.court - b.court || a.id.localeCompare(b.id);
}

function stageOrder(stage) {
  return stage === 'group' ? 1 : stage === 'playoff' ? 2 : 9;
}

export function getRealTeamCount(players = [], settings = {}) {
  return Number(settings.teamCount || Math.ceil(players.length / 2) || 0);
}

export function getTemplateTeamCount(teamCount) {
  if (teamCount < 4 || teamCount > 10) return 0;
  return teamCount % 2 === 0 ? teamCount : teamCount + 1;
}

export function getByeTeamNo(teamCount) {
  return teamCount % 2 === 1 ? teamCount + 1 : 0;
}

export function getTeamPlayers(players, teamNo) {
  return players.filter((p) => Number(p.teamNo) === Number(teamNo)).sort((a, b) => a.name.localeCompare(b.name));
}

export function teamLabel(teamNo, teams = {}, realTeamCount = 0) {
  if (realTeamCount && Number(teamNo) === getByeTeamNo(realTeamCount)) return 'BYE';
  return teams?.[teamNo]?.name || `Team ${teamNo}`;
}

export function teamRecord(standings, teamNo) {
  const r = standings.find((s) => s.teamNo === Number(teamNo));
  return r ? `${r.wins}-${r.losses}` : '0-0';
}

export function validateTeams(players) {
  if (!players.length) return { ok: false, message: 'Add players first.' };
  if (players.length % 2) return { ok: false, message: `There are ${players.length} players. Add one more player.` };
  if (players.length < 8) return { ok: false, message: 'Minimum is 8 players / 4 teams.' };
  if (players.length > 20) return { ok: false, message: 'Maximum is 20 players / 10 teams.' };

  const teamCount = players.length / 2;
  const counts = {};

  for (const p of players) {
    if (!p.teamNo) return { ok: false, message: `${p.name} is not assigned to a team.` };
    if (p.teamNo < 1 || p.teamNo > teamCount) {
      return { ok: false, message: `${p.name} has invalid team number ${p.teamNo}. Use 1-${teamCount}.` };
    }
    counts[p.teamNo] = (counts[p.teamNo] || 0) + 1;
  }

  for (let i = 1; i <= teamCount; i++) {
    if ((counts[i] || 0) !== 2) {
      return { ok: false, message: `Team ${i} has ${counts[i] || 0} player(s). Every team must have exactly 2.` };
    }
  }

  const byeMessage = teamCount % 2 === 1 ? ` Team ${teamCount + 1} will be used as BYE.` : '';
  return { ok: true, message: `${teamCount} teams saved.${byeMessage}` };
}

export function generateBalancedAssignments(players) {
  const teamCount = players.length / 2;
  const ranked = shuffle([...players]).sort((a, b) => b.skill - a.skill);
  const topHalf = shuffle(ranked.slice(0, teamCount));
  const bottomHalf = shuffle(ranked.slice(teamCount));
  const teamNumbers = shuffle(Array.from({ length: teamCount }, (_, i) => i + 1));
  const result = {};

  for (let i = 0; i < teamCount; i++) {
    const teamNo = teamNumbers[i];
    result[topHalf[i].id] = teamNo;
    result[bottomHalf[i].id] = teamNo;
  }

  return result;
}

function shuffle(items) {
  const arr = [...items];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

const SCHEDULES = {
  4: [
    [[1, 2], [3, 4], [1, 3]],
    [[2, 4], [1, 4], [2, 3]]
  ],
  6: [
    [[1, 2], [3, 4], [5, 6]],
    [[1, 3], [2, 5], [4, 6]],
    [[1, 4], [2, 6], [3, 5]]
  ],
  8: [
    [[1, 2], [3, 4], [5, 6]],
    [[7, 8], [1, 3], [2, 5]],
    [[4, 6], [7, 1], [8, 2]],
    [[3, 5], [4, 7], [6, 8]]
  ],
  10: [
    [[1, 2], [3, 4], [6, 7]],
    [[8, 9], [1, 3], [2, 5]],
    [[4, 5], [6, 8], [7, 10]],
    [[9, 10], [1, 4], [2, 3]],
    [[5, 9], [6, 10], [7, 8]]
  ]
};

export function getSchedule(teamCount, startTime = '15:00') {
  const templateTeamCount = getTemplateTeamCount(teamCount);
  if (!SCHEDULES[templateTeamCount]) {
    throw new Error('Tournament supports 4-10 teams only.');
  }
  return makeMatches(SCHEDULES[templateTeamCount], startTime, teamCount);
}

function makeMatches(rounds, startTime, realTeamCount) {
  const [h, m] = startTime.split(':').map(Number);
  const base = h * 60 + m;
  const byeTeamNo = getByeTeamNo(realTeamCount);

  return rounds.flatMap((round, r) => round.map((pair, c) => {
    const t = base + r * 15;
    const hh = String(Math.floor(t / 60) % 24).padStart(2, '0');
    const mm = String(t % 60).padStart(2, '0');
    const n = String(r * 3 + c + 1).padStart(2, '0');
    const [teamA, teamB] = pair;
    const bye = !!byeTeamNo && (teamA === byeTeamNo || teamB === byeTeamNo);
    const winner = bye ? (teamA === byeTeamNo ? teamB : teamA) : 0;

    return {
      id: `group_${n}`,
      stage: 'group',
      round: r + 1,
      court: c + 1,
      time: `${hh}:${mm}`,
      teamA,
      teamB,
      scoreA: bye ? 0 : '',
      scoreB: bye ? 0 : '',
      winner,
      locked: bye,
      bye
    };
  }));
}

export function computeStandings(matches = [], teamCount = 0) {
  const rows = Array.from({ length: teamCount }, (_, i) => ({
    teamNo: i + 1,
    wins: 0,
    losses: 0,
    pf: 0,
    pa: 0,
    diff: 0,
    played: 0
  }));

  const by = Object.fromEntries(rows.map((r) => [r.teamNo, r]));

  for (const m of matches.filter((x) => x.stage === 'group' && x.locked)) {
    if (m.bye) {
      const winner = by[m.winner];
      if (winner) winner.wins += 1;
      continue;
    }

    const a = by[m.teamA];
    const b = by[m.teamB];
    if (!a || !b) continue;

    const scoreA = Number(m.scoreA || 0);
    const scoreB = Number(m.scoreB || 0);

    a.pf += scoreA;
    a.pa += scoreB;
    a.diff = a.pf - a.pa;
    a.played += 1;

    b.pf += scoreB;
    b.pa += scoreA;
    b.diff = b.pf - b.pa;
    b.played += 1;

    if (scoreA > scoreB) {
      a.wins += 1;
      b.losses += 1;
    } else {
      b.wins += 1;
      a.losses += 1;
    }
  }

  return rows.sort((a, b) => b.wins - a.wins || b.diff - a.diff || b.pf - a.pf || a.teamNo - b.teamNo);
}

export function formatScore(m) {
  if (m.bye) return 'BYE Win';
  return m.locked ? `${m.scoreA} - ${m.scoreB}` : 'Pending';
}
