import { watchTournament } from './shared.js';

const $ = id => document.getElementById(id);

let state = {
  players: [],
  teams: {},
  settings: {}
};

let sortColumn = "name";
let ascending = true;

document.addEventListener("DOMContentLoaded", () => {
  $("sortName").addEventListener("click", () => sortBy("name"));
  $("sortSkill").addEventListener("click", () => sortBy("skill"));
  $("sortTeam").addEventListener("click", () => sortBy("teamNo"));

  watchTournament(data => {
    state = data;
    render();
  });
});

function sortBy(column) {
  if (sortColumn === column) {
    ascending = !ascending;
  } else {
    sortColumn = column;
    ascending = true;
  }

  render();
}

function render() {
  const body = $("playersInfoBody");

  if (!state.players.length) {
    body.innerHTML = `<tr><td colspan="3">No players yet.</td></tr>`;
    return;
  }

  const players = [...state.players].sort((a, b) => {
    let result = 0;

    if (sortColumn === "name") {
      result = a.name.localeCompare(b.name);
    }

    if (sortColumn === "skill") {
      result = Number(a.skill || 0) - Number(b.skill || 0);
    }

    if (sortColumn === "teamNo") {
      result = Number(a.teamNo || 0) - Number(b.teamNo || 0);
    }

    return ascending ? result : -result;
  });

  body.innerHTML = players.map(player => `
    <tr>
      <td>${teamName(player.teamNo)}</td>
      <td>${escapeHtml(player.name)}</td>
      <td>${hearts(player.skill)}</td>

    </tr>
  `).join("");

  updateHeaders();
}

function updateHeaders() {
  $("sortTeam").textContent = `Team ${sortColumn === "teamNo" ? arrow() : ""}`;
  $("sortName").textContent = `Player ${sortColumn === "name" ? arrow() : ""}`;
  $("sortSkill").textContent = `Addiction ${sortColumn === "skill" ? arrow() : ""}`;

}

function arrow() {
  return ascending ? "▲" : "▼";
}

function hearts(skill) {
  const n = Number(skill || 0);
  return "❤️".repeat(n) + "🤍".repeat(5 - n);
}

function teamName(teamNo) {
  if (!teamNo) return "-";
  return state.teams?.[teamNo]?.name || `Team ${teamNo}`;
}

function escapeHtml(value) {
  return String(value).replace(/[&<>'"]/g, c => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "'": "&#39;",
    "\"": "&quot;"
  }[c]));
}