import { useState } from 'react';
import { TEAMS_MAP } from '../utils';
import './TradeRoomLogin.css';

const SESSION_KEY = 'ipl_trade_session';

export function getTradeSession() {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function setTradeSession(session) {
  localStorage.setItem(SESSION_KEY, JSON.stringify(session));
}

export function clearTradeSession() {
  localStorage.removeItem(SESSION_KEY);
}

export default function TradeRoomLogin({ onSuccess }) {
  const [roomCode, setRoomCode] = useState('');
  const [role, setRole] = useState('team');
  const [teamId, setTeamId] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      const res = await fetch('/api/trade/join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          roomCode: roomCode.trim(),
          role,
          teamId: role === 'team' ? teamId : undefined,
          adminPassword: role === 'admin' ? adminPassword : undefined
        })
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Could not join room');
        return;
      }
      const session = {
        roomCode: data.room.code,
        roomName: data.room.name,
        role: data.role,
        teamId: data.teamId
      };
      setTradeSession(session);
      onSuccess(session, data.auctionState);
    } catch {
      setError('Cannot reach server');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="trade-room-login">
      <div className="trade-login-card animate-in">
        <h2>Trade Window</h2>
        <p>Enter the room code to access trades for this auction.</p>
        <form onSubmit={handleSubmit}>
          <label>
            Room code
            <input
              type="text"
              value={roomCode}
              onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
              placeholder="e.g. IPL2026"
              autoComplete="off"
              required
            />
          </label>

          <label>
            I am a
            <select value={role} onChange={(e) => setRole(e.target.value)}>
              <option value="team">Team representative</option>
              <option value="admin">EB's</option>
            </select>
          </label>

          {role === 'team' && (
            <label>
              Your team
              <select value={teamId} onChange={(e) => setTeamId(e.target.value)} required>
                <option value="">Select team</option>
                {Object.keys(TEAMS_MAP).map((id) => (
                  <option key={id} value={id}>
                    {TEAMS_MAP[id].name}
                  </option>
                ))}
              </select>
            </label>
          )}

          {role === 'admin' && (
            <label>
              EB's password
              <input
                type="password"
                value={adminPassword}
                onChange={(e) => setAdminPassword(e.target.value)}
                placeholder="EB's password"
                required
              />
            </label>
          )}

          {error && <p className="trade-login-error">{error}</p>}

          <button type="submit" className="trade-login-submit" disabled={busy}>
            {busy ? 'Joining…' : 'Enter room'}
          </button>
        </form>
      </div>
    </div>
  );
}
