const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const path = require('path');
const state = require('./state');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*', methods: ['GET', 'POST'] }
});

app.use(cors());
app.use(express.json());

const CLIENT_DIST = path.join(__dirname, '..', 'client', 'dist');
const hasClientBuild = require('fs').existsSync(CLIENT_DIST);
if (hasClientBuild) {
  app.use(express.static(CLIENT_DIST));
}

function respondAction(res, result) {
  if (result?.error) {
    return res.status(400).json({ error: result.error });
  }
  state.broadcast(io);
  return res.json(state.getPublicState());
}

function respondTradeAction(res, result) {
  if (result?.error) {
    return res.status(400).json({ error: result.error });
  }
  state.broadcastAll(io);
  return res.json(state.getPublicState());
}

async function respondTradeJoin(res, result) {
  if (result?.error) {
    return res.status(400).json({ error: result.error });
  }
  return res.json(result);
}

app.get('/api/state', (_, res) => {
  res.json(state.getPublicState());
});

app.get('/api/teams', (_, res) => {
  res.json(state.TEAMS);
});

app.post('/api/reset', (_, res) => {
  state.resetAuction();
  state.broadcast(io);
  res.json(state.getPublicState());
});

app.post('/api/clear-sale', (req, res) => {
  respondAction(res, state.clearSale(req.body?.playerId));
});

app.post('/api/auction/start', (req, res) => {
  respondAction(res, state.startAuction(req.body?.playerId));
});

app.post('/api/auction/bid-adjust', (req, res) => {
  const { playerId, direction, teamId } = req.body || {};
  respondAction(res, state.adjustBid(playerId, direction, teamId));
});

app.post('/api/auction/select-team', (req, res) => {
  const { playerId, teamId } = req.body || {};
  respondAction(res, state.selectTeamBid(playerId, teamId));
});

app.post('/api/auction/set-bid', (req, res) => {
  const { playerId, bid, teamId } = req.body || {};
  respondAction(res, state.updateBid(playerId, bid, teamId));
});

app.post('/api/auction/sold', (req, res) => {
  const { playerId, teamId, finalPrice } = req.body || {};
  respondAction(res, state.markSold(playerId, teamId, finalPrice));
});

app.post('/api/auction/unsold', (req, res) => {
  respondAction(res, state.markUnsold(req.body?.playerId));
});

app.post('/api/auction/clear', (_, res) => {
  state.clearCurrentAuction();
  state.broadcast(io);
  res.json(state.getPublicState());
});

app.post('/api/auction/clear-sale', (req, res) => {
  respondAction(res, state.clearSale(req.body?.playerId));
});

app.post('/api/auction/clear-all-sales', (_, res) => {
  respondAction(res, state.clearAllSales());
});

app.post('/api/auction/edit-sale', (req, res) => {
  const { playerId, teamId, finalPrice } = req.body || {};
  respondAction(res, state.editSale(playerId, teamId, finalPrice));
});

app.post('/api/trade/join', async (req, res) => {
  const { roomCode, role, teamId, adminPassword } = req.body || {};
  const result = await state.joinTradeRoom(roomCode, role, teamId, adminPassword);
  await respondTradeJoin(res, result);
});

app.post('/api/trade/propose', async (req, res) => {
  const { proposerTeamId, receiverTeamId, offeredPlayerId, requestedPlayerId } = req.body || {};
  const result = await state.proposeTrade(
    proposerTeamId,
    receiverTeamId,
    offeredPlayerId,
    requestedPlayerId
  );
  respondTradeAction(res, result);
});

app.post('/api/trade/accept', async (req, res) => {
  const { tradeId, adminPassword } = req.body || {};
  if (adminPassword !== (process.env.TRADE_ADMIN_PASSWORD || 'vivekandprem123')) {
    return res.status(403).json({ error: 'Invalid admin credentials' });
  }
  const result = await state.acceptTrade(tradeId, 'admin');
  respondTradeAction(res, result);
});

app.post('/api/trade/reject', async (req, res) => {
  const { tradeId, adminPassword } = req.body || {};
  if (adminPassword !== (process.env.TRADE_ADMIN_PASSWORD || 'vivekandprem123')) {
    return res.status(403).json({ error: 'Invalid admin credentials' });
  }
  const result = await state.rejectTrade(tradeId, 'admin');
  respondTradeAction(res, result);
});

function respondRtm(res, result) {
  if (result?.error) {
    return res.status(400).json({ error: result.error });
  }
  return res.json(result);
}

app.get('/api/rtm/team/:teamId', async (req, res) => {
  const result = await state.getTeamRtm(req.params.teamId);
  respondRtm(res, result);
});

app.post('/api/rtm/admin', async (req, res) => {
  const { adminPassword } = req.body || {};
  if (adminPassword !== (process.env.TRADE_ADMIN_PASSWORD || 'vivekandprem123')) {
    return res.status(403).json({ error: 'Invalid admin credentials' });
  }
  const result = await state.getAdminRtm();
  respondRtm(res, result);
});

app.post('/api/rtm/add', async (req, res) => {
  const { teamId, playerId } = req.body || {};
  const result = await state.addRtmPlayer(teamId, playerId);
  respondRtm(res, result);
});

app.post('/api/rtm/remove', async (req, res) => {
  const { teamId, playerId } = req.body || {};
  const result = await state.removeRtmPlayer(teamId, playerId);
  respondRtm(res, result);
});

app.post('/api/rtm/submit', async (req, res) => {
  const { teamId } = req.body || {};
  const result = await state.submitRtmList(teamId);
  respondRtm(res, result);
});

app.post('/api/rtm/accept', async (req, res) => {
  const { teamId, adminPassword } = req.body || {};
  if (adminPassword !== (process.env.TRADE_ADMIN_PASSWORD || 'vivekandprem123')) {
    return res.status(403).json({ error: 'Invalid admin credentials' });
  }
  const result = await state.acceptRtmList(teamId);
  respondRtm(res, result);
});

app.post('/api/rtm/reject', async (req, res) => {
  const { teamId, adminPassword } = req.body || {};
  if (adminPassword !== (process.env.TRADE_ADMIN_PASSWORD || 'vivekandprem123')) {
    return res.status(403).json({ error: 'Invalid admin credentials' });
  }
  const result = await state.rejectRtmList(teamId);
  respondRtm(res, result);
});

app.get('/api/rtm/approved', async (_, res) => {
  const result = await state.getApprovedRtm();
  respondRtm(res, result);
});

io.on('connection', (socket) => {
  socket.emit('state:update', state.getPublicState());
  socket.emit('trades:update', state.getPublicState().trades || []);

  socket.on('auction:start', ({ playerId }) => {
    const result = state.startAuction(playerId);
    if (result.error) socket.emit('error', result.error);
    else state.broadcast(io);
  });

  socket.on('auction:bid-adjust', ({ playerId, direction, teamId }) => {
    const result = state.adjustBid(playerId, direction, teamId);
    if (result.error) socket.emit('error', result.error);
    else state.broadcast(io);
  });

  socket.on('auction:select-team', ({ playerId, teamId }) => {
    const result = state.selectTeamBid(playerId, teamId);
    if (result.error) socket.emit('error', result.error);
    else state.broadcast(io);
  });

  socket.on('auction:set-team', ({ playerId, teamId }) => {
    const result = state.selectTeamBid(playerId, teamId);
    if (result.error) socket.emit('error', result.error);
    else state.broadcast(io);
  });

  socket.on('auction:sold', ({ playerId, teamId, finalPrice }) => {
    const result = state.markSold(playerId, teamId, finalPrice);
    if (result.error) socket.emit('error', result.error);
    else state.broadcast(io);
  });

  socket.on('auction:unsold', ({ playerId }) => {
    const result = state.markUnsold(playerId);
    if (result.error) socket.emit('error', result.error);
    else state.broadcast(io);
  });

  socket.on('auction:clear', () => {
    state.clearCurrentAuction();
    state.broadcast(io);
  });

  socket.on('auction:clear-sale', ({ playerId }) => {
    const result = state.clearSale(playerId);
    if (result.error) socket.emit('error', result.error);
    else state.broadcast(io);
  });

  socket.on('auction:clear-all-sales', () => {
    const result = state.clearAllSales();
    if (result.error) socket.emit('error', result.error);
    else state.broadcast(io);
  });

  socket.on('auction:edit-sale', ({ playerId, teamId, finalPrice }) => {
    const result = state.editSale(playerId, teamId, finalPrice);
    if (result.error) socket.emit('error', result.error);
    else state.broadcast(io);
  });
});

if (hasClientBuild) {
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api') || req.path.startsWith('/socket.io')) {
      return next();
    }
    res.sendFile(path.join(CLIENT_DIST, 'index.html'));
  });
}

const PORT = process.env.PORT || 3001;

async function start() {
  try {
    await state.initState();
  } catch (err) {
    console.error('Failed to initialize auction state:', err);
    process.exit(1);
  }

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`IPL Auction server running on port ${PORT}`);
  });
}

start();
