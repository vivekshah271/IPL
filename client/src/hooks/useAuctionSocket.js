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
    s.on('error', (msg) => setError(typeof msg === 'string' ? msg : 'Server error'));

    fetch('/api/state')
      .then((r) => r.json())
      .then(setAuctionState)
      .catch(() => {});

    return () => s.disconnect();
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
      runAction('edit-sale', { playerId, teamId, finalPrice })
  };
}
