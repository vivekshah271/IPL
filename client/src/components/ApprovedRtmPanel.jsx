import { useCallback, useEffect, useState } from 'react';
import { ROLE_LABELS, TEAMS_MAP } from '../utils';
import './ApprovedRtmPanel.css';

export default function ApprovedRtmPanel({ fetchApprovedRtm }) {
  const [teams, setTeams] = useState([]);
  const [loading, setLoading] = useState(true);
  const [collapsed, setCollapsed] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    const data = await fetchApprovedRtm();
    if (data?.teams) setTeams(data.teams);
    setLoading(false);
  }, [fetchApprovedRtm]);

  useEffect(() => {
    refresh();
    const interval = setInterval(refresh, 30000);
    return () => clearInterval(interval);
  }, [refresh]);

  const hasApproved = teams.length > 0;

  return (
    <section className="panel-section approved-rtm-section">
      <div className="section-header-row">
        <div>
          <h3>Approved RTM Panel</h3>
          <p className="approved-rtm-subtitle">
            Accepted Right to Match lists for reference during the live auction.
          </p>
        </div>
        <button
          type="button"
          className="btn-secondary approved-rtm-toggle"
          onClick={() => setCollapsed((v) => !v)}
        >
          {collapsed ? 'Show' : 'Hide'}
        </button>
      </div>

      {!collapsed && (
        <>
          {loading && !teams.length && (
            <p className="approved-rtm-empty">Loading approved RTM lists…</p>
          )}
          {!loading && !hasApproved && (
            <p className="approved-rtm-empty">No accepted RTM lists yet.</p>
          )}
          {hasApproved && (
            <div className="approved-rtm-grid">
              {teams.map((t) => (
                <article
                  key={t.teamId}
                  className="approved-rtm-card"
                  style={{ borderColor: TEAMS_MAP[t.teamId]?.color }}
                >
                  <header>
                    <strong>{t.teamName}</strong>
                    <span className="approved-rtm-count">{t.players.length} players</span>
                  </header>
                  {t.reviewedAt && (
                    <p className="approved-rtm-meta">
                      Accepted {new Date(t.reviewedAt).toLocaleString()}
                    </p>
                  )}
                  <ul>
                    {t.players.map((p) => (
                      <li key={p.playerId}>
                        {p.playerName}
                        <span>
                          {' '}
                          ({ROLE_LABELS[p.playerRole] || p.playerRole})
                        </span>
                      </li>
                    ))}
                  </ul>
                </article>
              ))}
            </div>
          )}
        </>
      )}
    </section>
  );
}
