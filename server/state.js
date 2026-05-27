const fs = require('fs');
const path = require('path');
const TEAMS = require('./teams');
const db = require('./db');
const { getNextBidUp, getNextBidDown, roundCr } = require('./bidUtils');
const { isPlayerOverseas } = require('./playerUtils');
const { applyCountryOverrides } = require('./playerOverrides');

let state = null;
let persistQueue = Promise.resolve();

function freshTeam(t) {
  const maxOs = t.maxOverseas ?? 8;
  return {
    ...t,
    remainingBudget: t.budget,
    playersBought: [],
    totalSpent: 0,
    remainingSlots: t.maxSlots,
    maxOverseas: maxOs,
    remainingOverseasSlots: maxOs
  };
}

function loadPlayers() {
  const file = path.join(__dirname, '..', 'data', 'players.json');
  if (!fs.existsSync(file)) return [];
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function resolvePlayerCountry(playerOrPb) {
  let p = null;
  let fromPb = '';
  if (playerOrPb?.playerId) {
    p = state.players.find((x) => x.id === playerOrPb.playerId);
    fromPb = playerOrPb.country || '';
  } else if (playerOrPb?.id) {
    p = playerOrPb;
    fromPb = playerOrPb.country || '';
  }
  const country =
    (fromPb && String(fromPb).trim()) || (p?.country && String(p.country).trim()) || '';
  return { country, player: p };
}

function isOverseasPlayer(playerOrPb) {
  const { country, player } = resolvePlayerCountry(playerOrPb);
  if (playerOrPb.isOverseas === true) return true;
  return isPlayerOverseas(country);
}

function enrichTeam(team, allPlayers = state?.players) {
  const overseasBought = team.playersBought.filter((pb) => {
    if (pb.isOverseas) return true;
    const p = allPlayers?.find((x) => x.id === pb.playerId);
    const country =
      (pb.country && String(pb.country).trim()) ||
      (p?.country && String(p.country).trim()) ||
      '';
    return isPlayerOverseas(country);
  }).length;
  return { ...team, overseasBought };
}

function syncTeamsFromPlayers() {
  rebuildTeamsFromPlayers();
}

function createInitialState() {
  const players = applyCountryOverrides(loadPlayers()).map((p) => ({
    ...p,
    soldStatus: p.soldStatus || (p.retained ? 'sold' : 'pending'),
    soldTeam: p.soldTeam || null,
    finalPrice: p.finalPrice ?? null,
    currentBid: null,
    biddingTeam: null,
    isLive: false
  }));

  const teams = TEAMS.map(freshTeam);

  players.filter((p) => p.soldStatus === 'sold' && p.soldTeam).forEach((p) => {
    const team = teams.find((t) => t.id === p.soldTeam);
    if (team) {
      const price = p.finalPrice || p.basePrice;
      const isOS = isPlayerOverseas(p.country);
      team.playersBought.push({
        playerId: p.id,
        name: p.name,
        role: p.role,
        price,
        isOverseas: isOS,
        country: p.country || ''
      });
      team.totalSpent += price;
      team.remainingBudget -= price;
      team.remainingSlots -= 1;
      if (isOS) team.remainingOverseasSlots -= 1;
    }
  });

  const built = {
    players,
    teams,
    currentAuction: null,
    recentSales: players
      .filter((p) => p.soldStatus === 'sold' && !p.retained)
      .slice(-20)
      .map((p) => ({
        playerId: p.id,
        name: p.name,
        soldTeam: p.soldTeam,
        finalPrice: p.finalPrice
      }))
      .reverse()
  };
  built.teams = built.teams.map((t) => enrichTeam(t, players));
  return built;
}

function getSnapshot() {
  return {
    players: state.players,
    currentAuction: state.currentAuction,
    recentSales: state.recentSales
  };
}

function schedulePersist() {
  if (!db.isEnabled() || !state) return;
  persistQueue = persistQueue
    .then(() => db.saveState(getSnapshot()))
    .catch((err) => console.error('Failed to persist auction state:', err.message));
}

function applySavedState(saved) {
  const fresh = createInitialState();
  const savedById = new Map((saved.players || []).map((p) => [p.id, p]));

  state = {
    players: fresh.players.map((p) => {
      const savedPlayer = savedById.get(p.id);
      if (!savedPlayer) return p;
      return { ...p, ...savedPlayer };
    }),
    teams: fresh.teams,
    currentAuction: saved.currentAuction ?? null,
    recentSales: Array.isArray(saved.recentSales) ? saved.recentSales : []
  };

  state.players = applyCountryOverrides(state.players);
  rebuildTeamsFromPlayers();
}

async function initState() {
  await db.init();
  const saved = await db.loadState();

  if (saved?.players?.length) {
    applySavedState(saved);
    console.log('Restored auction state from Postgres');
  } else {
    state = createInitialState();
    state.players = applyCountryOverrides(state.players);
    rebuildTeamsFromPlayers();
    if (db.isEnabled()) {
      await db.saveState(getSnapshot());
      console.log('Initialized auction state in Postgres');
    }
  }
}

function getState() {
  return state;
}

function broadcast(io) {
  io.emit('state:update', getPublicState());
}

function getPublicState() {
  return {
    players: state.players,
    teams: state.teams.map((t) => enrichTeam(t, state.players)),
    currentAuction: state.currentAuction,
    recentSales: state.recentSales
  };
}

function rebuildTeamsFromPlayers() {
  const teams = TEAMS.map(freshTeam);

  state.players
    .filter((p) => p.soldStatus === 'sold' && p.soldTeam)
    .forEach((p) => {
      const team = teams.find((t) => t.id === p.soldTeam);
      if (!team) return;
      const price = roundCr(p.finalPrice ?? p.basePrice ?? 0);
      const isOS = isPlayerOverseas(p.country);
      team.playersBought.push({
        playerId: p.id,
        name: p.name,
        role: p.role,
        price,
        isOverseas: isOS,
        country: p.country || ''
      });
      team.totalSpent = roundCr(team.totalSpent + price);
      team.remainingBudget = roundCr(team.remainingBudget - price);
      team.remainingSlots -= 1;
      if (isOS) team.remainingOverseasSlots -= 1;
    });

  state.teams = teams.map((t) => enrichTeam(t, state.players));
}

function rebuildRecentSales() {
  state.recentSales = state.players
    .filter((p) => p.soldStatus === 'sold' && p.soldTeam && !p.retained)
    .map((p) => ({
      playerId: p.id,
      name: p.name,
      soldTeam: p.soldTeam,
      finalPrice: p.finalPrice,
      at: Date.now()
    }))
    .slice(-50)
    .reverse();
}

function getLivePlayer(playerId) {
  const player = state.players.find((p) => p.id === playerId);
  if (!player) return null;
  if (state.currentAuction?.playerId === playerId && state.currentAuction?.soldStatus === 'live') {
    player.isLive = true;
  }
  if (!player.isLive) return null;
  return player;
}

function startAuction(playerId) {
  state.players.forEach((p) => {
    p.isLive = false;
  });
  const player = state.players.find((p) => p.id === playerId);
  if (!player || player.soldStatus === 'sold') return { error: 'Player not available' };

  if (player.soldStatus === 'unsold') {
    player.soldStatus = 'pending';
  }

  player.isLive = true;
  player.currentBid = player.basePrice;
  player.biddingTeam = null;

  state.currentAuction = {
    playerId: player.id,
    name: player.name,
    country: player.country,
    isOverseas: isPlayerOverseas(player.country),
    role: player.role,
    set: player.set,
    category: player.category,
    basePrice: player.basePrice,
    currentBid: player.currentBid,
    biddingTeam: null,
    soldStatus: 'live'
  };
  schedulePersist();
  return { ok: true };
}

function syncCurrentAuctionFromPlayer(player) {
  if (state.currentAuction?.playerId !== player.id) return;
  state.currentAuction = {
    ...state.currentAuction,
    currentBid: player.currentBid,
    biddingTeam: player.biddingTeam,
    soldStatus: player.isLive ? 'live' : state.currentAuction.soldStatus
  };
}

function removePlayerFromTeam(team, playerId) {
  const idx = team.playersBought.findIndex((pb) => pb.playerId === playerId);
  if (idx === -1) return null;
  const [removed] = team.playersBought.splice(idx, 1);
  const price = removed.price;
  team.totalSpent = Math.round((team.totalSpent - price) * 100) / 100;
  team.remainingBudget = Math.round((team.remainingBudget + price) * 100) / 100;
  team.remainingSlots += 1;
  if (removed.isOverseas || isPlayerOverseas(removed.country)) team.remainingOverseasSlots += 1;
  return price;
}

function addPlayerToTeam(team, player, price) {
  if (price > team.remainingBudget) return { error: 'Insufficient budget' };
  if (team.remainingSlots <= 0) return { error: 'No slots remaining' };
  const isOS = isPlayerOverseas(player.country);
  if (isOS && team.remainingOverseasSlots <= 0) {
    return { error: 'No overseas (OS) slots remaining' };
  }
  team.playersBought.push({
    playerId: player.id,
    name: player.name,
    role: player.role,
    price,
    isOverseas: isOS,
    country: player.country || ''
  });
  team.totalSpent = Math.round((team.totalSpent + price) * 100) / 100;
  team.remainingBudget = Math.round((team.remainingBudget - price) * 100) / 100;
  team.remainingSlots -= 1;
  if (isOS) team.remainingOverseasSlots -= 1;
  return { ok: true };
}

function applyBidAmount(player, amount, teamId) {
  if (isNaN(amount) || amount < player.basePrice) return { error: 'Invalid bid' };

  if (teamId) {
    const team = state.teams.find((t) => t.id === teamId);
    if (!team) return { error: 'Invalid team' };
    if (amount > team.remainingBudget) return { error: 'Insufficient budget' };
    if (isPlayerOverseas(player.country) && team.remainingOverseasSlots <= 0) {
      return { error: 'No overseas (OS) slots remaining for this team' };
    }
    player.biddingTeam = teamId;
  }

  player.currentBid = roundCr(amount);
  syncCurrentAuctionFromPlayer(player);
  schedulePersist();
  return { ok: true };
}

function updateBid(playerId, bid, teamId) {
  const player = getLivePlayer(playerId);
  if (!player) return { error: 'No live auction for this player' };
  return applyBidAmount(player, parseFloat(bid), teamId);
}

function adjustBid(playerId, direction, teamId) {
  const player = getLivePlayer(playerId);
  if (!player) return { error: 'No live auction for this player' };

  const current = player.currentBid ?? player.basePrice;
  const next =
    direction === 'up'
      ? getNextBidUp(current)
      : getNextBidDown(current, player.basePrice);

  const activeTeam = teamId || player.biddingTeam || null;
  return applyBidAmount(player, next, activeTeam);
}

/** Team tap: raise bid by one IPL increment and assign that team. */
function selectTeamBid(playerId, teamId) {
  const player = getLivePlayer(playerId);
  if (!player) return { error: 'No live auction for this player' };
  if (!teamId) return { error: 'Select a team' };

  const current = player.currentBid ?? player.basePrice;
  const next = getNextBidUp(current);
  return applyBidAmount(player, next, teamId);
}

function markSold(playerId, teamId, finalPrice) {
  const player = state.players.find((p) => p.id === playerId);
  if (!player) return { error: 'Player not found' };

  const team = state.teams.find((t) => t.id === teamId);
  if (!team) return { error: 'Select a team' };

  const price = parseFloat(finalPrice) || player.currentBid || player.basePrice;
  const addResult = addPlayerToTeam(team, player, price);
  if (addResult.error) return addResult;

  player.soldStatus = 'sold';
  player.soldTeam = teamId;
  player.finalPrice = price;
  player.isLive = false;
  player.currentBid = price;
  player.biddingTeam = teamId;

  state.recentSales.unshift({
    playerId: player.id,
    name: player.name,
    soldTeam: teamId,
    finalPrice: price,
    at: Date.now()
  });
  state.recentSales = state.recentSales.slice(0, 50);
  syncTeamsFromPlayers();

  if (state.currentAuction?.playerId === playerId) {
    state.currentAuction = {
      ...state.currentAuction,
      currentBid: price,
      biddingTeam: teamId,
      soldStatus: 'sold'
    };
  }

  schedulePersist();
  return { ok: true };
}

function markUnsold(playerId) {
  const player = state.players.find((p) => p.id === playerId);
  if (!player) return { error: 'Player not found' };

  player.soldStatus = 'unsold';
  player.soldTeam = null;
  player.finalPrice = null;
  player.isLive = false;
  player.biddingTeam = null;

  if (state.currentAuction?.playerId === playerId) {
    state.currentAuction = {
      ...state.currentAuction,
      currentBid: player.currentBid,
      soldStatus: 'unsold',
      biddingTeam: null
    };
  }
  schedulePersist();
  return { ok: true };
}

function clearCurrentAuction() {
  state.players.forEach((p) => {
    if (p.isLive && p.soldStatus === 'pending') p.isLive = false;
  });
  state.currentAuction = null;
  schedulePersist();
}

function clearAllSales() {
  state.players.forEach((p) => {
    p.soldStatus = 'pending';
    p.soldTeam = null;
    p.finalPrice = null;
    p.currentBid = null;
    p.biddingTeam = null;
    p.isLive = false;
    p.retained = false;
  });

  rebuildTeamsFromPlayers();
  state.recentSales = [];
  state.currentAuction = null;

  schedulePersist();
  return { ok: true };
}

function clearSale(playerId) {
  const player = state.players.find((p) => p.id === playerId);
  if (!player) return { error: 'Player not found' };
  if (player.soldStatus !== 'sold' && player.soldStatus !== 'unsold') {
    return { error: 'Player is not sold or unsold' };
  }

  player.soldStatus = 'pending';
  player.soldTeam = null;
  player.finalPrice = null;
  player.currentBid = null;
  player.biddingTeam = null;
  player.isLive = false;
  player.retained = false;

  rebuildTeamsFromPlayers();
  rebuildRecentSales();

  if (state.currentAuction?.playerId === playerId) {
    state.currentAuction = null;
  }

  schedulePersist();
  return { ok: true, playerId, status: 'pending' };
}

function editSale(playerId, teamId, finalPrice) {
  const player = state.players.find((p) => p.id === playerId);
  if (!player) return { error: 'Player not found' };
  if (player.soldStatus !== 'sold') return { error: 'Player is not sold' };

  const newTeam = state.teams.find((t) => t.id === teamId);
  if (!newTeam) return { error: 'Select a team' };

  const price = parseFloat(finalPrice);
  if (isNaN(price) || price <= 0) return { error: 'Invalid price' };

  const oldTeamId = player.soldTeam;
  if (oldTeamId === teamId) {
    const team = state.teams.find((t) => t.id === teamId);
    const existing = team?.playersBought.find((pb) => pb.playerId === playerId);
    if (existing) {
      const diff = price - existing.price;
      if (diff > team.remainingBudget) return { error: 'Insufficient budget' };
      team.totalSpent = Math.round((team.totalSpent + diff) * 100) / 100;
      team.remainingBudget = Math.round((team.remainingBudget - diff) * 100) / 100;
      existing.price = price;
    }
  } else {
    if (oldTeamId) {
      const oldTeam = state.teams.find((t) => t.id === oldTeamId);
      if (oldTeam) removePlayerFromTeam(oldTeam, playerId);
    }
    const result = addPlayerToTeam(newTeam, player, price);
    if (result.error) return result;
  }

  player.soldTeam = teamId;
  player.finalPrice = price;
  player.currentBid = price;
  player.biddingTeam = teamId;

  const saleIdx = state.recentSales.findIndex((s) => s.playerId === playerId);
  const saleEntry = {
    playerId: player.id,
    name: player.name,
    soldTeam: teamId,
    finalPrice: price,
    at: Date.now()
  };
  if (saleIdx >= 0) state.recentSales[saleIdx] = saleEntry;
  else state.recentSales.unshift(saleEntry);

  rebuildTeamsFromPlayers();
  schedulePersist();
  return { ok: true };
}

function resetAuction() {
  state = createInitialState();
  state.players = applyCountryOverrides(state.players);
  rebuildTeamsFromPlayers();
  schedulePersist();
}

module.exports = {
  initState,
  getState,
  getPublicState,
  broadcast,
  startAuction,
  updateBid,
  markSold,
  markUnsold,
  clearCurrentAuction,
  clearSale,
  clearAllSales,
  editSale,
  adjustBid,
  selectTeamBid,
  rebuildTeamsFromPlayers,
  resetAuction,
  TEAMS
};
