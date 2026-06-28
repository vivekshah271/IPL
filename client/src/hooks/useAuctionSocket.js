import { useEffect, useState, useCallback } from 'react';
import { io } from 'socket.io-client';

const SOCKET_URL = import.meta.env.DEV
  ? 'http://localhost:3001'
  : window.location.origin;

export function useAuctionSocket() {
  const [auctionState, setAuctionState] = useState(null);
  const [error, setError] = useState(null);
  const [connected, setConnected] = useState(false);
  const [busy, setBusy] = useState(false);

  const runAction = useCallback(async (path, payload = {}) => {
    setError(null);
    setBusy(true);
    try {
      const res = await fetch(`/api/auction/${path}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Action failed');
        return false;
      }
      if (data.players) {
        setAuctionState(data);
      }
      return true;
    } catch {
      setError('Cannot reach auction server. Run: npm run dev');
      return false;
    } finally {
      setBusy(false);
    }
  }, []);

  useEffect(() => {
    const s = io(SOCKET_URL, { transports: ['websocket', 'polling'] });

    s.on('connect', () => setConnected(true));
    s.on('disconnect', () => setConnected(false));
    s.on('state:update', (data) => setAuctionState(data));
    s.on('trades:update', (trades) => {
      setAuctionState((prev) => (prev ? { ...prev, trades } : prev));
    });
    s.on('error', (msg) => setError(typeof msg === 'string' ? msg : 'Server error'));

    fetch('/api/state')
      .then((r) => r.json())
      .then(setAuctionState)
      .catch(() => {});

    return () => s.disconnect();
  }, []);

  const runTradeAction = useCallback(async (path, payload = {}) => {
    setError(null);
    setBusy(true);
    try {
      const res = await fetch(`/api/trade/${path}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Trade action failed');
        return false;
      }
      if (data.players) {
        setAuctionState(data);
      }
      return true;
    } catch {
      setError('Cannot reach auction server');
      return false;
    } finally {
      setBusy(false);
    }
  }, []);

  const runRtmAction = useCallback(async (path, payload = {}, { silent = false } = {}) => {
    if (!silent) setError(null);
    if (!silent) setBusy(true);
    try {
      const res = await fetch(`/api/rtm/${path}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (!res.ok) {
        if (!silent) setError(data?.error || 'RTM action failed');
        return { error: data?.error || 'RTM action failed' };
      }
      return data;
    } catch {
      if (!silent) setError('Cannot reach auction server');
      return { error: 'Cannot reach auction server' };
    } finally {
      if (!silent) setBusy(false);
    }
  }, []);

  const fetchTeamRtm = useCallback(
    async (teamId) => {
      setError(null);
      try {
        const res = await fetch(`/api/rtm/team/${teamId}`);
        const data = await res.json();
        if (!res.ok) {
          setError(data.error || 'Failed to load RTM list');
          return { error: data.error };
        }
        return data;
      } catch {
        setError('Cannot reach auction server');
        return { error: 'Cannot reach auction server' };
      }
    },
    []
  );

  const fetchAdminRtm = useCallback(async (adminPassword) => {
    try {
      const res = await fetch('/api/rtm/admin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ adminPassword })
      });
      const data = await res.json();
      if (!res.ok) return { error: data.error || 'Failed to load RTM lists' };
      return data;
    } catch {
      return { error: 'Cannot reach auction server' };
    }
  }, []);

  const fetchApprovedRtm = useCallback(async () => {
    try {
      const res = await fetch('/api/rtm/approved');
      const data = await res.json();
      if (!res.ok) return { error: data.error };
      return data;
    } catch {
      return { error: 'Cannot reach auction server' };
    }
  }, []);

  return {
    auctionState,
    connected,
    busy,
    error,
    setError,
    startAuction: (playerId) => runAction('start', { playerId }),
    adjustBid: (playerId, direction, teamId) =>
      runAction('bid-adjust', { playerId, direction, teamId: teamId || null }),
    selectTeamBid: (playerId, teamId) => runAction('select-team', { playerId, teamId }),
    setBid: (playerId, bid, teamId) =>
      runAction('set-bid', { playerId, bid, teamId: teamId || null }),
    markSold: (playerId, teamId, finalPrice) =>
      runAction('sold', { playerId, teamId, finalPrice }),
    markUnsold: (playerId) => runAction('unsold', { playerId }),
    clearAuction: () => runAction('clear'),
    clearSale: (playerId) => runAction('clear-sale', { playerId }),
    clearAllSales: () => runAction('clear-all-sales'),
    editSale: (playerId, teamId, finalPrice) =>
      runAction('edit-sale', { playerId, teamId, finalPrice }),
    proposeTrade: (payload) => runTradeAction('propose', payload),
    acceptTrade: (tradeId, adminPassword) =>
      runTradeAction('accept', { tradeId, adminPassword }),
    rejectTrade: (tradeId, adminPassword) =>
      runTradeAction('reject', { tradeId, adminPassword }),
    fetchTeamRtm,
    fetchAdminRtm,
    addRtmPlayer: (teamId, playerId) => runRtmAction('add', { teamId, playerId }),
    removeRtmPlayer: (teamId, playerId) => runRtmAction('remove', { teamId, playerId }),
    submitRtmList: (teamId) => runRtmAction('submit', { teamId }),
    acceptRtmList: (teamId, adminPassword) =>
      runRtmAction('accept', { teamId, adminPassword }, { silent: true }),
    rejectRtmList: (teamId, adminPassword) =>
      runRtmAction('reject', { teamId, adminPassword }, { silent: true }),
    fetchApprovedRtm
  };
}
