import { useMemo, useState } from 'react';
import { formatCr, ROLE_LABELS, teamName, TEAMS_MAP } from '../utils';
import { clearTradeSession } from './TradeRoomLogin';
import RtmListSection from './RtmListSection';
import './TradeWindowPanel.css';

function playerRow(player, selected, onSelect, disabled) {
  return (
    <button
      key={player.playerId}
      type="button"
      className={`trade-player-row ${selected ? 'selected' : ''}`}
      onClick={() => !disabled && onSelect(player)}
      disabled={disabled}
    >
      <span className="trade-player-name">{player.name}</span>
      <span className="trade-player-meta">
        {ROLE_LABELS[player.role] || player.role} · {formatCr(player.price)}
      </span>
    </button>
  );
}

export default function TradeWindowPanel({
  auctionState,
  session,
  onLeaveRoom,
  onProposeTrade,
  onAcceptTrade,
  onRejectTrade,
  busy,
  adminPassword,
  setAdminPassword,
  fetchTeamRtm,
  fetchAdminRtm,
  addRtmPlayer,
  removeRtmPlayer,
  submitRtmList,
  acceptRtmList,
  rejectRtmList,
  fetchApprovedRtm
}) {
  const [myPlayer, setMyPlayer] = useState(null);
  const [otherTeamId, setOtherTeamId] = useState('');
  const [theirPlayer, setTheirPlayer] = useState(null);
  const [localError, setLocalError] = useState('');

  const role = session?.role;
  const myTeamId = session?.teamId;
  const teams = auctionState?.teams || [];
  const trades = auctionState?.trades || [];

  const myTeam = useMemo(
    () => teams.find((t) => t.id === myTeamId),
    [teams, myTeamId]
  );

  const myPlayers = useMemo(() => {
    if (!myTeam) return [];
    return (myTeam.playersBought || []).map((pb) => ({
      playerId: pb.playerId,
      name: pb.name,
      role: pb.role,
      price: pb.price
    }));
  }, [myTeam]);

  const otherTeam = useMemo(
    () => teams.find((t) => t.id === otherTeamId),
    [teams, otherTeamId]
  );

  const theirPlayers = useMemo(() => {
    if (!otherTeam) return [];
    return (otherTeam.playersBought || []).map((pb) => ({
      playerId: pb.playerId,
      name: pb.name,
      role: pb.role,
      price: pb.price
    }));
  }, [otherTeam]);

  const otherTeamOptions = useMemo(
    () => teams.filter((t) => t.id !== myTeamId),
    [teams, myTeamId]
  );

  const canPropose = role === 'team';
  const canModerate = role === 'admin';

  const handlePropose = async () => {
    setLocalError('');
    if (!myPlayer || !theirPlayer || !otherTeamId) {
      setLocalError('Select your player, opponent team, and their player.');
      return;
    }
    const ok = await onProposeTrade({
      proposerTeamId: myTeamId,
      receiverTeamId: otherTeamId,
      offeredPlayerId: myPlayer.playerId,
      requestedPlayerId: theirPlayer.playerId
    });
    if (ok) {
      setMyPlayer(null);
      setTheirPlayer(null);
      setOtherTeamId('');
    }
  };

  const roleLabel = role === 'admin' ? "EB's" : teamName(myTeamId);

  return (
    <div className="trade-window">
      <header className="trade-window-header animate-in">
        <div>
          <h2>Trade Window</h2>
          <p>
            Room <strong>{session.roomCode}</strong> · {roleLabel}
          </p>
        </div>
        <button type="button" className="trade-leave-btn" onClick={() => {
          clearTradeSession();
          onLeaveRoom();
        }}>
          Leave room
        </button>
      </header>

      {localError && <p className="trade-error-banner">{localError}</p>}

      <div className="trade-panels">
        <section className="trade-panel animate-in">
          <h3>{canPropose ? 'My team' : 'Teams overview'}</h3>
          {canPropose ? (
            myPlayers.length ? (
              myPlayers.map((p) =>
                playerRow(p, myPlayer?.playerId === p.playerId, setMyPlayer, false)
              )
            ) : (
              <p className="trade-empty">No players purchased yet.</p>
            )
          ) : (
            <div className="trade-teams-summary">
              {teams.map((t) => (
                <div key={t.id} className="trade-team-chip" style={{ borderColor: TEAMS_MAP[t.id]?.color }}>
                  <strong>{t.shortName || t.id}</strong>
                  <span>{(t.playersBought || []).length} players</span>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="trade-panel animate-in">
          <h3>{canPropose ? 'Opponent team & player' : 'Trade board'}</h3>
          {canPropose ? (
            <>
              <label className="trade-select-label">
                Select team
                <select
                  value={otherTeamId}
                  onChange={(e) => {
                    setOtherTeamId(e.target.value);
                    setTheirPlayer(null);
                  }}
                >
                  <option value="">Choose team</option>
                  {otherTeamOptions.map((t) => (
                    <option key={t.id} value={t.id}>
                      {teamName(t.id)}
                    </option>
                  ))}
                </select>
              </label>
              {otherTeamId ? (
                theirPlayers.length ? (
                  theirPlayers.map((p) =>
                    playerRow(p, theirPlayer?.playerId === p.playerId, setTheirPlayer, false)
                  )
                ) : (
                  <p className="trade-empty">That team has no players yet.</p>
                )
              ) : (
                <p className="trade-empty">Pick a team to see their squad.</p>
              )}
              <button
                type="button"
                className="trade-propose-btn"
                disabled={busy || !myPlayer || !theirPlayer}
                onClick={handlePropose}
              >
                Propose trade
              </button>
            </>
          ) : (
            <p className="trade-hint">
              Review pending trades and accept or reject them on the right.
            </p>
          )}
        </section>

        <section className="trade-panel animate-in">
          <h3>Trade requests</h3>
          {canModerate && (
            <label className="trade-admin-pass">
              EB's password (trades & RTM)
              <input
                type="password"
                value={adminPassword}
                onChange={(e) => setAdminPassword(e.target.value)}
                placeholder="Required for trades and RTM review"
              />
            </label>
          )}
          <div className="trade-requests-list">
            {trades.length === 0 && (
              <p className="trade-empty">No trade requests yet.</p>
            )}
            {trades.map((t) => (
              <article key={t.id} className={`trade-request status-${t.status}`}>
                <div className="trade-request-head">
                  <span className={`trade-status-badge ${t.status}`}>{t.status}</span>
                  <time>{new Date(t.createdAt).toLocaleString()}</time>
                </div>
                <p>
                  <strong>{teamName(t.proposerTeamId)}</strong> offers{' '}
                  <strong>{t.offeredPlayerName}</strong> ({ROLE_LABELS[t.offeredPlayerRole] || t.offeredPlayerRole},{' '}
                  {formatCr(t.offeredPlayerPrice)})
                </p>
                <p>
                  for <strong>{teamName(t.receiverTeamId)}</strong>&apos;s{' '}
                  <strong>{t.requestedPlayerName}</strong> (
                  {ROLE_LABELS[t.requestedPlayerRole] || t.requestedPlayerRole},{' '}
                  {formatCr(t.requestedPlayerPrice)})
                </p>
                {canModerate && t.status === 'pending' && (
                  <div className="trade-request-actions">
                    <button
                      type="button"
                      className="trade-accept-btn"
                      disabled={busy || !adminPassword}
                      onClick={() => onAcceptTrade(t.id, adminPassword)}
                    >
                      Accept
                    </button>
                    <button
                      type="button"
                      className="trade-reject-btn"
                      disabled={busy || !adminPassword}
                      onClick={() => onRejectTrade(t.id, adminPassword)}
                    >
                      Reject
                    </button>
                  </div>
                )}
              </article>
            ))}
          </div>
        </section>
      </div>

      <RtmListSection
        session={session}
        players={auctionState?.players}
        adminPassword={adminPassword}
        busy={busy}
        fetchTeamRtm={fetchTeamRtm}
        fetchAdminRtm={fetchAdminRtm}
        addRtmPlayer={addRtmPlayer}
        removeRtmPlayer={removeRtmPlayer}
        submitRtmList={submitRtmList}
        acceptRtmList={acceptRtmList}
        rejectRtmList={rejectRtmList}
        onError={setLocalError}
      />
    </div>
  );
}
