import { useState, useEffect } from 'react';
import { formatCr } from '../utils';
import {
  getBidIncrement,
  getIncrementLabel,
  getNextBidUp,
  BID_RULES
} from '../bidUtils';
import './BidControlPanel.css';

export default function BidControlPanel({
  basePrice,
  currentBid,
  biddingTeam,
  teams,
  onTeamSelect,
  onBidUp,
  onBidDown,
  onSetBid,
  onMarkSold,
  onUnsold,
  onClearBlock,
  disabled
}) {
  const bid = parseFloat(currentBid) || parseFloat(basePrice) || 0;
  const stepLabel = getIncrementLabel(bid);
  const nextPreview = getNextBidUp(bid);
  const [manualBid, setManualBid] = useState('');

  useEffect(() => {
    if (currentBid != null && currentBid !== '') {
      setManualBid(String(currentBid));
    } else if (basePrice != null) {
      setManualBid(String(basePrice));
    }
  }, [currentBid, basePrice]);

  const applyManualBid = () => {
    const val = parseFloat(manualBid);
    if (!isNaN(val) && val >= basePrice) {
      onSetBid(val);
    }
  };

  return (
    <div className="bid-control-panel">
      <div className="bid-rules-strip">
        {BID_RULES.map((r) => (
          <span key={r.range}>
            <strong>{r.range}</strong> → {r.step}
          </span>
        ))}
      </div>

      <div className="bid-main-row">
        <div className="bid-amount-display">
          <label>Current Bid</label>
          <div className="bid-amount-value">{formatCr(bid)}</div>
          <span className="bid-base-hint">Base {formatCr(basePrice)}</span>
        </div>

        <div className="bid-manual-entry">
          <label>Set bid directly (Cr)</label>
          <div className="bid-manual-row">
            <input
              type="number"
              step="0.05"
              min={basePrice}
              placeholder="e.g. 4.5"
              value={manualBid}
              disabled={disabled}
              onChange={(e) => setManualBid(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && applyManualBid()}
            />
            <button
              type="button"
              className="btn-apply-bid"
              disabled={disabled}
              onClick={applyManualBid}
            >
              Apply
            </button>
          </div>
          <span className="bid-manual-hint">Enter any amount ≥ base price</span>
        </div>

        <div className="bid-step-controls">
          <button
            type="button"
            className="bid-btn bid-btn-down"
            disabled={disabled || bid <= basePrice}
            onClick={onBidDown}
            title="Decrease bid"
          >
            −
          </button>
          <div className="bid-step-info">
            <span className="bid-step-label">Next raise</span>
            <span className="bid-step-value">{stepLabel}</span>
            <span className="bid-step-preview">→ {formatCr(nextPreview)}</span>
          </div>
          <button
            type="button"
            className="bid-btn bid-btn-up"
            disabled={disabled}
            onClick={onBidUp}
            title={`Increase by ${stepLabel}`}
          >
            +
          </button>
        </div>
      </div>

      <div className="bid-team-row">
        <label>Bidding team — tap to raise bid (+{stepLabel}) and assign team</label>
        <div className="team-chip-grid">
          {teams.map((t) => (
            <button
              key={t.id}
              type="button"
              className={`team-chip ${biddingTeam === t.id ? 'active' : ''}`}
              style={{ '--tc': t.color }}
              disabled={disabled}
              onClick={() => onTeamSelect(t.id)}
            >
              <span className="chip-name">{t.shortName}</span>
              <span className="chip-budget">{formatCr(t.remainingBudget)}</span>
              <span className="chip-os">OS {t.overseasBought ?? 0} bought</span>
            </button>
          ))}
        </div>
      </div>

      <div className="bid-action-row">
        <button
          type="button"
          className="btn-sold btn-lg"
          disabled={disabled || !biddingTeam}
          onClick={onMarkSold}
        >
          Mark Sold
        </button>
        <button type="button" className="btn-unsold btn-lg" disabled={disabled} onClick={onUnsold}>
          Unsold
        </button>
        <button type="button" className="btn-secondary btn-lg" disabled={disabled} onClick={onClearBlock}>
          Clear Block
        </button>
      </div>
    </div>
  );
}
