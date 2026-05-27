import {
  formatCr,
  ROLE_LABELS,
  teamName,
  TEAMS_MAP,
  isPlayerOverseas,
  formatCountry
} from '../utils';
import { getIncrementLabel } from '../bidUtils';
import './CurrentAuctionCard.css';

export default function CurrentAuctionCard({ current, large = false }) {
  if (!current) {
    return (
      <div className={`current-auction ${large ? 'large' : ''} empty`}>
        <p>No player on the block</p>
      </div>
    );
  }

  const teamColor = current.biddingTeam
    ? TEAMS_MAP[current.biddingTeam]?.color
    : null;
  const status = current.soldStatus;

  return (
    <div
      className={`current-auction ${large ? 'large' : ''} animate-in ${status === 'live' ? 'is-live' : ''}`}
      style={teamColor ? { '--team-color': teamColor } : undefined}
    >
      {status === 'live' && (
        <div className="live-badge">
          <span className="live-dot" /> LIVE
        </div>
      )}
      <h2 className="player-name">{current.name}</h2>
      <div className="player-country-row">
        <span className="player-country">{formatCountry(current.country)}</span>
        {(current.isOverseas || isPlayerOverseas(current.country)) && (
          <span className="os-tag" title="Overseas player">
            <span className="os-tag-icon" aria-hidden>
              ✈
            </span>
            OS
          </span>
        )}
      </div>
      <div className="meta-row">
        <span>{ROLE_LABELS[current.role] || current.role}</span>
        <span>Set {current.set}</span>
        <span>{current.category}</span>
      </div>
      <div className="price-grid">
        <div className="price-cell">
          <label>Base Price</label>
          <span>{formatCr(current.basePrice)}</span>
        </div>
        <div className="price-cell highlight">
          <label>Current Bid</label>
          <span className="bid-amount">{formatCr(current.currentBid)}</span>
          {status === 'live' && current.currentBid != null && (
            <span className="bid-next-step">Next raise: {getIncrementLabel(current.currentBid)}</span>
          )}
        </div>
        <div className="price-cell">
          <label>Bidding Team</label>
          <span className="team-bid">
            {current.biddingTeam ? teamName(current.biddingTeam) : '—'}
          </span>
        </div>
        <div className="price-cell">
          <label>Status</label>
          <span className={`status-pill ${status}`}>
            {status === 'live' ? 'ON BLOCK' : status?.toUpperCase()}
          </span>
        </div>
      </div>
    </div>
  );
}
