import CurrentAuctionCard from './CurrentAuctionCard';
import TeamBudgetTable from './TeamBudgetTable';
import {
  formatCr,
  formatCountry,
  ROLE_LABELS,
  teamName,
  TEAMS_MAP,
  resolveBoughtPlayer,
  getOverseasBought
} from '../utils';
import './LiveViewerPanel.css';

export default function LiveViewerPanel({ auctionState }) {
  const current = auctionState?.currentAuction;
  const recentSales = auctionState?.recentSales ?? [];
  const teams = auctionState?.teams ?? [];
  const players = auctionState?.players ?? [];

  const auctionSales = recentSales.filter(
    (s) => s.finalPrice != null && s.soldTeam
  );

  return (
    <div className="live-viewer">
      <div className="auctioneer-credits animate-in">
        <div className="credit-line">
          <strong>Vivek Shah</strong>
          <span>Head Auctioneer</span>
        </div>
        <div className="credit-line">
          <strong>Premnidhan Thakkar</strong>
          <span>Deputy Auctioneer</span>
        </div>
      </div>

      <section className="viewer-hero animate-in">
        <div className="hero-label">
          <span className="live-dot" />
          LIVE AUCTION
        </div>
        <CurrentAuctionCard current={current} large />
      </section>

      <div className="viewer-grid">
        <section className="viewer-card animate-in">
          <h3>Recently Sold</h3>
          <ul className="sales-timeline ipl-scroll">
            {auctionSales.length === 0 ? (
              <li className="empty-sale">No auction sales yet</li>
            ) : (
              auctionSales.map((s, i) => (
                <li
                  key={`${s.playerId}-${i}`}
                  className="sale-item"
                  style={{ '--tc': TEAMS_MAP[s.soldTeam]?.color }}
                >
                  <span className="sale-name">{s.name}</span>
                  <span className="sale-team">{teamName(s.soldTeam)}</span>
                  <span className="sale-price">{formatCr(s.finalPrice)}</span>
                </li>
              ))
            )}
          </ul>
        </section>

        <section className="viewer-card animate-in">
          <h3>Team Budgets</h3>
          <TeamBudgetTable teams={teams} players={players} compact />
        </section>
      </div>

      <section className="viewer-squads animate-in">
        <h3>Team Squads</h3>
        <div className="squad-grid">
          {teams.map((t) => (
            <div
              key={t.id}
              className="squad-card"
              style={{ '--tc': TEAMS_MAP[t.id]?.color || t.color }}
            >
              <header className="squad-header">
                <strong>{t.shortName}</strong>
                <div className="squad-header-stats">
                  <span>{t.playersBought?.length ?? 0} players</span>
                  <span className="squad-os-stat" title="Overseas players bought">
                    <span className="os-plane" aria-hidden>✈</span>
                    OS {t.overseasBought ?? getOverseasBought(t, players)} bought
                  </span>
                  <span>{formatCr(t.totalSpent)} spent</span>
                </div>
              </header>
              <div className="squad-budget">
                <span>Remaining</span>
                <strong>{formatCr(t.remainingBudget)}</strong>
              </div>
              <ul className="squad-list ipl-scroll">
                {(t.playersBought ?? []).length === 0 ? (
                  <li className="squad-empty">No players yet</li>
                ) : (
                  t.playersBought.map((pb) => {
                    const row = resolveBoughtPlayer(pb, players);
                    return (
                      <li key={pb.playerId} className="squad-row">
                        <span
                          className={`os-plane-cell ${row.isOverseas ? 'is-os' : ''}`}
                          title={row.isOverseas ? 'Overseas (OS)' : undefined}
                          aria-hidden={!row.isOverseas}
                        >
                          {row.isOverseas ? <span className="os-plane">✈</span> : null}
                        </span>
                        <div className="squad-player-block">
                          <span className="squad-player">{row.name}</span>
                          <span className="squad-role">
                            {formatCountry(row.country)} · {ROLE_LABELS[row.role] || row.role}
                          </span>
                        </div>
                        <span className="squad-price">{formatCr(row.price)}</span>
                      </li>
                    );
                  })
                )}
              </ul>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
