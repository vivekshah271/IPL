const db = require('./db');
const TEAMS = require('./teams');

const STATUS_LABELS = {
  draft: 'Draft',
  pending: 'Pending Approval',
  rejected: 'Rejected',
  accepted: 'Accepted',
  empty: 'Empty'
};

/** @type {Array<{id:string,roomId:number,teamId:string,playerId:string,status:string,submittedAt:string|null,reviewedAt:string|null,createdAt:string}>} */
let entries = [];

function teamMeta(teamId) {
  const t = TEAMS.find((x) => x.id === teamId);
  return { id: teamId, name: t?.name || teamId, shortName: t?.shortName || teamId };
}

function teamStatusFromEntries(teamEntries) {
  if (!teamEntries.length) return 'empty';
  return teamEntries[0].status || 'draft';
}

function isTeamLocked(teamId) {
  const status = teamStatusFromEntries(entries.filter((e) => e.teamId === teamId));
  return status === 'pending' || status === 'accepted';
}

function statusLabel(status) {
  return STATUS_LABELS[status] || status;
}

function enrichEntry(entry, players) {
  const p = players?.find((x) => x.id === entry.playerId);
  return {
    ...entry,
    playerName: p?.name || entry.playerId,
    playerRole: p?.role || '',
    playerSet: p?.set || '',
    basePrice: p?.basePrice ?? null
  };
}

function buildTeamSummary(teamId, teamEntries, players) {
  const status = teamStatusFromEntries(teamEntries);
  const submittedAt =
    status === 'pending' || status === 'accepted' || status === 'rejected'
      ? teamEntries.find((e) => e.submittedAt)?.submittedAt || null
      : null;
  const reviewedAt =
    status === 'accepted' || status === 'rejected'
      ? teamEntries.find((e) => e.reviewedAt)?.reviewedAt || null
      : null;

  return {
    teamId,
    teamName: teamMeta(teamId).name,
    shortName: teamMeta(teamId).shortName,
    status,
    statusLabel: statusLabel(status),
    submissionStatus: statusLabel(status),
    submittedAt,
    reviewedAt,
    locked: status === 'pending' || status === 'accepted',
    players: teamEntries.map((e) => enrichEntry(e, players))
  };
}

async function loadEntries(roomId) {
  entries = db.isEnabled() ? await db.loadRtmEntries(roomId) : entries;
  return entries;
}

function getEntries() {
  return entries;
}

async function getTeamRtmList(teamId, players) {
  const teamEntries = entries.filter((e) => e.teamId === teamId);
  return buildTeamSummary(teamId, teamEntries, players);
}

async function getAdminRtmOverview(players) {
  const byTeam = new Map();
  for (const t of TEAMS) {
    byTeam.set(t.id, []);
  }
  for (const e of entries) {
    if (!byTeam.has(e.teamId)) byTeam.set(e.teamId, []);
    byTeam.get(e.teamId).push(e);
  }

  return TEAMS.map((t) => buildTeamSummary(t.id, byTeam.get(t.id) || [], players));
}

async function getApprovedRtmOverview(players) {
  const overview = await getAdminRtmOverview(players);
  return overview.filter((t) => t.status === 'accepted' && t.players.length > 0);
}

async function addPlayer(roomId, teamId, playerId, players) {
  if (isTeamLocked(teamId)) {
    return { error: 'RTM list is locked while pending approval or after acceptance.' };
  }

  const player = players?.find((p) => p.id === playerId);
  if (!player) return { error: 'Player not found' };
  if (player.soldStatus === 'sold') return { error: 'Player already sold' };

  if (entries.some((e) => e.teamId === teamId && e.playerId === playerId)) {
    return { error: 'Player already on your RTM list' };
  }

  const onOtherTeam = entries.find((e) => e.playerId === playerId && e.teamId !== teamId);
  if (onOtherTeam) {
    return {
      error: `Player is already on ${teamMeta(onOtherTeam.teamId).name}'s RTM list`
    };
  }

  const teamEntries = entries.filter((e) => e.teamId === teamId);
  const rowStatus = teamStatusFromEntries(teamEntries);
  const status = rowStatus === 'rejected' ? 'rejected' : 'draft';

  const entry = await db.insertRtmEntry(roomId, teamId, playerId, status).catch((err) => {
    if (err.code === '23505') {
      return { error: 'Player is already on another team\'s RTM list' };
    }
    throw err;
  });
  if (entry?.error) return entry;

  if (!db.isEnabled()) {
    entries.push(entry);
  } else {
    await loadEntries(roomId);
  }

  return { ok: true, list: await getTeamRtmList(teamId, players) };
}

async function removePlayer(roomId, teamId, playerId, players) {
  if (isTeamLocked(teamId)) {
    return { error: 'RTM list is locked while pending approval or after acceptance.' };
  }

  if (!entries.some((e) => e.teamId === teamId && e.playerId === playerId)) {
    return { error: 'Player not on your RTM list' };
  }

  const removed = await db.removeRtmEntry(roomId, teamId, playerId);
  if (db.isEnabled() && !removed) return { error: 'Player not on your RTM list' };

  if (!db.isEnabled()) {
    entries = entries.filter((e) => !(e.teamId === teamId && e.playerId === playerId));
  } else {
    await loadEntries(roomId);
  }

  return { ok: true, list: await getTeamRtmList(teamId, players) };
}

async function submitTeamList(roomId, teamId, players) {
  const teamEntries = entries.filter((e) => e.teamId === teamId);
  if (!teamEntries.length) return { error: 'Add at least one player before submitting' };

  const status = teamStatusFromEntries(teamEntries);
  if (status === 'pending') return { error: 'RTM list is already pending approval' };
  if (status === 'accepted') return { error: 'RTM list is already accepted' };
  if (status !== 'draft' && status !== 'rejected') {
    return { error: 'RTM list cannot be submitted in its current state' };
  }

  await db.submitRtmTeam(roomId, teamId);
  if (!db.isEnabled()) {
    const now = new Date().toISOString();
    entries = entries.map((e) =>
      e.teamId === teamId ? { ...e, status: 'pending', submittedAt: now, reviewedAt: null } : e
    );
  } else {
    await loadEntries(roomId);
  }

  return { ok: true, list: await getTeamRtmList(teamId, players) };
}

async function acceptTeamList(roomId, teamId, players) {
  const teamEntries = entries.filter((e) => e.teamId === teamId);
  if (!teamEntries.length) return { error: 'No RTM list for this team' };
  if (teamStatusFromEntries(teamEntries) !== 'pending') {
    return { error: 'Only pending RTM lists can be accepted' };
  }

  await db.acceptRtmTeam(roomId, teamId);
  if (!db.isEnabled()) {
    const now = new Date().toISOString();
    entries = entries.map((e) =>
      e.teamId === teamId ? { ...e, status: 'accepted', reviewedAt: now } : e
    );
  } else {
    await loadEntries(roomId);
  }

  return { ok: true, list: await getTeamRtmList(teamId, players) };
}

async function rejectTeamList(roomId, teamId, players) {
  const teamEntries = entries.filter((e) => e.teamId === teamId);
  if (!teamEntries.length) return { error: 'No RTM list for this team' };
  if (teamStatusFromEntries(teamEntries) !== 'pending') {
    return { error: 'Only pending RTM lists can be rejected' };
  }

  await db.rejectRtmTeam(roomId, teamId);
  if (!db.isEnabled()) {
    const now = new Date().toISOString();
    entries = entries.map((e) =>
      e.teamId === teamId ? { ...e, status: 'rejected', reviewedAt: now } : e
    );
  } else {
    await loadEntries(roomId);
  }

  return { ok: true, list: await getTeamRtmList(teamId, players) };
}

function findAcceptedForPlayer(playerId) {
  const match = entries.find((e) => e.playerId === playerId && e.status === 'accepted');
  if (!match) return null;
  const meta = teamMeta(match.teamId);
  return {
    teamId: match.teamId,
    teamName: meta.name,
    shortName: meta.shortName
  };
}

async function clearAll(roomId) {
  entries = [];
  if (db.isEnabled()) await db.clearRtmEntries(roomId);
}

module.exports = {
  loadEntries,
  getEntries,
  getTeamRtmList,
  getAdminRtmOverview,
  getApprovedRtmOverview,
  addPlayer,
  removePlayer,
  submitTeamList,
  acceptTeamList,
  rejectTeamList,
  findAcceptedForPlayer,
  clearAll
};
