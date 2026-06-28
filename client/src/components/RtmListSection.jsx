import { useCallback, useEffect, useMemo, useState } from 'react';
import { formatCr, ROLE_LABELS, TEAMS_MAP } from '../utils';
import './RtmListSection.css';

function statusBadgeClass(status) {
  if (!status || status === 'empty') return 'empty';
  return String(status).toLowerCase();
}

export default function RtmListSection({
  session,
  players,
  adminPassword,
  busy,
  fetchTeamRtm,
  fetchAdminRtm,
  addRtmPlayer,
  removeRtmPlayer,
  submitRtmList,
  acceptRtmList,
  rejectRtmList,
  onError
}) {
  const [search, setSearch] = useState('');
  const [list, setList] = useState(null);
  const [adminTeams, setAdminTeams] = useState(null);
  const [takenPlayerIds, setTakenPlayerIds] = useState([]);
  const [loading, setLoading] = useState(false);
  const [adminLoaded, setAdminLoaded] = useState(false);
  const [localError, setLocalError] = useState('');

  const role = session?.role;
  const teamId = session?.teamId;
  const isTeam = role === 'team';
  const isAdmin = role === 'admin';

  const refreshTeam = useCallback(async () => {
    if (!teamId) return;
    setLoading(true);
    const data = await fetchTeamRtm(teamId);
    if (data?.list) {
      setList(data.list);
      setTakenPlayerIds(data.takenPlayerIds || []);
    }
    setLoading(false);
  }, [teamId, fetchTeamRtm]);

  const refreshAdmin = useCallback(async () => {
    if (!adminPassword?.trim()) {
      setLocalError('Enter your EB password above first.');
      setAdminTeams(null);
      setAdminLoaded(false);
      return;
    }
    setLocalError('');
    setLoading(true);
    const data = await fetchAdminRtm(adminPassword);
    if (data?.error) {
      setLocalError(data.error);
      setAdminTeams(null);
      setAdminLoaded(false);
    } else if (data?.teams) {
      setAdminTeams(data.teams);
      setAdminLoaded(true);
    }
    setLoading(false);
  }, [adminPassword, fetchAdminRtm]);

  useEffect(() => {
    if (isTeam) refreshTeam();
  }, [isTeam, refreshTeam]);

  const locked = list?.locked;
  const myPlayerIds = useMemo(
    () => new Set((list?.players || []).map((p) => p.playerId)),
    [list]
  );
  const takenSet = useMemo(() => new Set(takenPlayerIds), [takenPlayerIds]);

  const searchResults = useMemo(() => {
    if (!isTeam || locked || !search.trim()) return [];
    const q = search.trim().toLowerCase();
    return (players || [])
      .filter(
        (p) =>
          p.soldStatus !== 'sold' &&
          !myPlayerIds.has(p.id) &&
          !takenSet.has(p.id) &&
          (p.name?.toLowerCase().includes(q) ||
            p.role?.toLowerCase().includes(q) ||
            p.country?.toLowerCase().includes(q))
      )
      .slice(0, 12);
  }, [isTeam, locked, search, players, myPlayerIds, takenSet]);

  const handleAdd = async (playerId) => {
    setLocalError('');
    const data = await addRtmPlayer(teamId, playerId);
    if (data?.error) {
      setLocalError(data.error);
      onError?.(data.error);
      return;
    }
    if (data?.list) {
      setList(data.list);
      setSearch('');
    }
  };

  const handleRemove = async (playerId) => {
    setLocalError('');
    const data = await removeRtmPlayer(teamId, playerId);
    if (data?.error) {
      setLocalError(data.error);
      onError?.(data.error);
      return;
    }
    if (data?.list) setList(data.list);
  };

  const handleSubmit = async () => {
    setLocalError('');
    const data = await submitRtmList(teamId);
    if (data?.error) {
      setLocalError(data.error);
      onError?.(data.error);
      return;
    }
    if (data?.list) setList(data.list);
  };

  const handleAccept = async (acceptTeamId) => {
    setLocalError('');
    const data = await acceptRtmList(acceptTeamId, adminPassword);
    if (data?.error) {
      setLocalError(data.error);
      onError?.(data.error);
      return;
    }
    if (data?.teams) setAdminTeams(data.teams);
  };

  const handleReject = async (rejectTeamId) => {
    setLocalError('');
    const data = await rejectRtmList(rejectTeamId, adminPassword);
    if (data?.error) {
      setLocalError(data.error);
      onError?.(data.error);
      return;
    }
    if (data?.teams) setAdminTeams(data.teams);
  };

  const formatTime = (iso) => (iso ? new Date(iso).toLocaleString() : '—');

  const teamStatusNote = () => {
    if (!list) return null;
    if (list.status === 'pending') {
      return (
        <>
          Your RTM list is pending EB approval and is read-only.
          {list.submittedAt && <> Submitted {formatTime(list.submittedAt)}.</>}
        </>
      );
    }
    if (list.status === 'accepted') {
      return (
        <>
          Your RTM list has been accepted and is permanently locked.
          {list.reviewedAt && <> Accepted {formatTime(list.reviewedAt)}.</>}
        </>
      );
    }
    if (list.status === 'rejected') {
      return (
        <>
          Your RTM list was rejected. Update it and resubmit for approval.
          {list.reviewedAt && <> Rejected {formatTime(list.reviewedAt)}.</>}
        </>
      );
    }
    return null;
  };

  return (
    <section className="rtm-section animate-in">
      <header className="rtm-header">
        <div>
          <h3>RTM List</h3>
          <p className="rtm-subtitle">
            Right to Match — submit your list to EB for approval before the auction.
          </p>
        </div>
        {isTeam && list && (
          <span className={`rtm-status-badge ${statusBadgeClass(list.status)}`}>
            {list.statusLabel || list.status}
          </span>
        )}
      </header>

      {localError && <p className="rtm-error">{localError}</p>}

      {loading && !list && !adminTeams && (
        <p className="rtm-empty">Loading RTM lists…</p>
      )}

      {isTeam && list && (
        <div className="rtm-team-view">
          {locked && teamStatusNote() && (
            <p className="rtm-locked-note">{teamStatusNote()}</p>
          )}

          {!locked && (
            <div className="rtm-search">
              <input
                type="search"
                placeholder="Search players to add…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              {searchResults.length > 0 && (
                <ul className="rtm-search-results">
                  {searchResults.map((p) => (
                    <li key={p.id}>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => handleAdd(p.id)}
                      >
                        <span>{p.name}</span>
                        <span className="rtm-search-meta">
                          {ROLE_LABELS[p.role] || p.role} · Set {p.set} ·{' '}
                          {formatCr(p.basePrice)}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              {search.trim() && searchResults.length === 0 && (
                <p className="rtm-empty">No matching available players.</p>
              )}
            </div>
          )}

          <ul className="rtm-player-list">
            {(list.players || []).length === 0 && (
              <li className="rtm-empty">No players on your RTM list yet.</li>
            )}
            {(list.players || []).map((p) => (
              <li key={p.playerId} className="rtm-player-item">
                <div>
                  <strong>{p.playerName}</strong>
                  <span className="rtm-player-meta">
                    {ROLE_LABELS[p.playerRole] || p.playerRole} · Set {p.playerSet} ·{' '}
                    {formatCr(p.basePrice)}
                  </span>
                </div>
                {!locked && (
                  <button
                    type="button"
                    className="rtm-remove-btn"
                    disabled={busy}
                    onClick={() => handleRemove(p.playerId)}
                  >
                    Remove
                  </button>
                )}
              </li>
            ))}
          </ul>

          {!locked && (
            <button
              type="button"
              className="rtm-submit-btn"
              disabled={busy || !(list.players || []).length}
              onClick={handleSubmit}
            >
              {list.status === 'rejected' ? 'Resubmit to EB' : 'Submit to EB'}
            </button>
          )}
        </div>
      )}

      {isAdmin && (
        <div className="rtm-admin-view">
          <div className="rtm-admin-load-row">
            <p className="rtm-hint">
              Enter your EB password in the trade requests panel above, then load RTM lists.
            </p>
            <button
              type="button"
              className="rtm-load-btn"
              disabled={loading || busy}
              onClick={refreshAdmin}
            >
              {loading ? 'Loading…' : 'Load RTM lists'}
            </button>
          </div>
          {adminLoaded && adminTeams && (
            <div className="rtm-admin-grid">
              {adminTeams.map((t) => (
                <article
                  key={t.teamId}
                  className="rtm-admin-card"
                  style={{ borderColor: TEAMS_MAP[t.teamId]?.color }}
                >
                  <div className="rtm-admin-card-head">
                    <strong>{t.teamName}</strong>
                    <span className={`rtm-status-badge ${statusBadgeClass(t.status)}`}>
                      {t.statusLabel || t.submissionStatus}
                    </span>
                  </div>
                  <p className="rtm-admin-meta">
                    Submitted: {formatTime(t.submittedAt)}
                    {t.reviewedAt && <> · Reviewed: {formatTime(t.reviewedAt)}</>}
                  </p>
                  <ul className="rtm-admin-players">
                    {(t.players || []).length === 0 && (
                      <li className="rtm-empty">No players listed.</li>
                    )}
                    {(t.players || []).map((p) => (
                      <li key={p.playerId}>
                        {p.playerName}{' '}
                        <span className="rtm-player-meta">
                          ({ROLE_LABELS[p.playerRole] || p.playerRole})
                        </span>
                      </li>
                    ))}
                  </ul>
                  {t.status === 'pending' && (
                    <div className="rtm-admin-actions">
                      <button
                        type="button"
                        className="rtm-accept-btn"
                        disabled={busy}
                        onClick={() => handleAccept(t.teamId)}
                      >
                        Accept
                      </button>
                      <button
                        type="button"
                        className="rtm-reject-btn"
                        disabled={busy}
                        onClick={() => handleReject(t.teamId)}
                      >
                        Reject
                      </button>
                    </div>
                  )}
                </article>
              ))}
            </div>
          )}
        </div>
      )}
    </section>
  );
}
