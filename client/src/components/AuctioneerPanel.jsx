import { useMemo, useState } from 'react';

import CurrentAuctionCard from './CurrentAuctionCard';

import ApprovedRtmPanel from './ApprovedRtmPanel';

import BidControlPanel from './BidControlPanel';

import TeamBudgetTable from './TeamBudgetTable';

import {
  formatCr,
  formatCountry,
  ROLE_LABELS,
  teamName,
  isPlayerOverseas,
  getOverseasBought
} from '../utils';

import { getIncrementLabel } from '../bidUtils';

import './AuctioneerPanel.css';



const ROLE_FILTERS = [

  { id: 'all', label: 'All Roles' },

  { id: 'BATTER', label: 'Batter' },

  { id: 'BOWLER', label: 'Bowler' },

  { id: 'ALL-ROUNDER', label: 'All-Rounder' },

  { id: 'WICKETKEEPER', label: 'Wicketkeeper' }

];



export default function AuctioneerPanel({

  auctionState,

  startAuction,

  adjustBid,

  selectTeamBid,

  setBid,

  markSold,

  busy,

  markUnsold,

  clearAuction,

  clearSale,

  clearAllSales,

  editSale,

  fetchApprovedRtm

}) {

  const [search, setSearch] = useState('');

  const [roleFilter, setRoleFilter] = useState('all');

  const [setFilter, setSetFilter] = useState('');

  const [cappedFilter, setCappedFilter] = useState('all');

  const [statusFilter, setStatusFilter] = useState('all');

  const [editingSoldId, setEditingSoldId] = useState(null);

  const [editTeam, setEditTeam] = useState('');

  const [editPrice, setEditPrice] = useState('');



  const players = auctionState?.players ?? [];

  const teams = auctionState?.teams ?? [];

  const current = auctionState?.currentAuction;

  const livePlayerId = current?.playerId;

  const livePlayer = players.find((p) => p.id === livePlayerId);



  const setNumbers = useMemo(() => {

    const nums = new Set(players.map((p) => p.setNumber).filter((n) => n != null));

    return [...nums].sort((a, b) => a - b);

  }, [players]);



  const filtered = useMemo(() => {

    return players.filter((p) => {

      if (search && !p.name.toLowerCase().includes(search.toLowerCase())) return false;

      if (roleFilter !== 'all' && p.role !== roleFilter) return false;

      if (setFilter && String(p.setNumber) !== setFilter) return false;

      if (cappedFilter === 'capped' && !p.capped) return false;

      if (cappedFilter === 'uncapped' && p.capped) return false;

      if (statusFilter === 'sold' && p.soldStatus !== 'sold') return false;

      if (statusFilter === 'unsold' && p.soldStatus !== 'unsold') return false;

      if (statusFilter === 'pending' && p.soldStatus !== 'pending') return false;

      return true;

    });

  }, [players, search, roleFilter, setFilter, cappedFilter, statusFilter]);



  const liveBid = livePlayer?.currentBid ?? current?.currentBid ?? livePlayer?.basePrice;

  const liveTeam = livePlayer?.biddingTeam ?? current?.biddingTeam ?? '';



  const handleClearSale = (p) => {

    clearSale(p.id);

  };



  const startEditSold = (p) => {

    setEditingSoldId(p.id);

    setEditTeam(p.soldTeam || '');

    setEditPrice(p.finalPrice != null ? String(p.finalPrice) : '');

  };



  const saveEditSold = (playerId) => {

    editSale(playerId, editTeam, parseFloat(editPrice));

    setEditingSoldId(null);

  };



  return (

    <div className="auctioneer-panel">

      <section className="panel-section current-section">

        <h3>Current Auction</h3>

        <CurrentAuctionCard current={current} showRtmAlert />

        {current?.soldStatus === 'live' && livePlayer && (

          <BidControlPanel

            basePrice={livePlayer.basePrice}

            currentBid={liveBid}

            biddingTeam={liveTeam}

            teams={teams}

            disabled={busy}

            onTeamSelect={(teamId) => selectTeamBid(livePlayerId, teamId)}

            onBidUp={() => adjustBid(livePlayerId, 'up', liveTeam || null)}

            onBidDown={() => adjustBid(livePlayerId, 'down', liveTeam || null)}

            onSetBid={(amount) => setBid(livePlayerId, amount, liveTeam || null)}

            onMarkSold={() => markSold(livePlayerId, liveTeam, liveBid)}

            onUnsold={() => markUnsold(livePlayerId)}

            onClearBlock={clearAuction}

          />

        )}

      </section>



      <ApprovedRtmPanel fetchApprovedRtm={fetchApprovedRtm} />



      <section className="panel-section teams-section">

        <div className="section-header-row">
          <h3>Team Management</h3>
          <button
            type="button"
            className="btn-clear-all-sales"
            disabled={busy}
            onClick={() => {
              const ok = window.confirm(
                'Do you want to clear all the players sale and start with zero?\n\nAll players will become available, team budgets will reset to ₹120 Cr, and recent sales will be cleared.'
              );
              if (ok) clearAllSales();
            }}
          >
            Clear All Sales
          </button>
        </div>

        <div className="team-cards">

          {teams.map((t) => (

            <div key={t.id} className="team-card" style={{ '--tc': t.color }}>

              <div className="team-card-header">

                <strong>{t.shortName}</strong>

                <span>{t.name}</span>

              </div>

              <div className="team-stats">

                <div>

                  <label>Budget Left</label>

                  <span>{formatCr(t.remainingBudget)}</span>

                </div>

                <div>

                  <label>Players</label>

                  <span>{t.playersBought?.length ?? 0}</span>

                </div>

                <div>

                  <label>Spent</label>

                  <span>{formatCr(t.totalSpent)}</span>

                </div>

                <div>

                  <label>Slots</label>

                  <span>{t.remainingSlots}</span>

                </div>

                <div>

                  <label>OS Bought</label>

                  <span>{t.overseasBought ?? getOverseasBought(t, players)}</span>

                </div>

              </div>

            </div>

          ))}

        </div>

        <TeamBudgetTable teams={teams} players={players} />

      </section>



      <section className="panel-section players-section">

        <h3>Player Catalogue ({filtered.length})</h3>

        <div className="filters">

          <input

            type="search"

            placeholder="Search by name..."

            value={search}

            onChange={(e) => setSearch(e.target.value)}

          />

          <select value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)}>

            {ROLE_FILTERS.map((f) => (

              <option key={f.id} value={f.id}>

                {f.label}

              </option>

            ))}

          </select>

          <select value={setFilter} onChange={(e) => setSetFilter(e.target.value)}>

            <option value="">All Sets</option>

            {setNumbers.map((n) => (

              <option key={n} value={String(n)}>

                Set {n}

              </option>

            ))}

            <option value="0">Marquee</option>

          </select>

          <select value={cappedFilter} onChange={(e) => setCappedFilter(e.target.value)}>

            <option value="all">Capped + Uncapped</option>

            <option value="capped">Capped</option>

            <option value="uncapped">Uncapped</option>

          </select>

          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>

            <option value="all">All Status</option>

            <option value="pending">Available</option>

            <option value="sold">Sold</option>

            <option value="unsold">Unsold</option>

          </select>

        </div>



        <div className="player-table-wrap ipl-scroll">

          <table className="player-table">

            <thead>

              <tr>

                <th>Name</th>

                <th>Country</th>

                <th>OS</th>

                <th>Role</th>

                <th>Set</th>

                <th>Base</th>

                <th>Status</th>

                <th>Team</th>

                <th>Final</th>

                <th>Actions</th>

              </tr>

            </thead>

            <tbody>

              {filtered.map((p) => {

                const isLive = p.isLive || current?.playerId === p.id;

                const canAuction = p.soldStatus === 'pending' || p.soldStatus === 'unsold';

                const isSold = p.soldStatus === 'sold';

                const isEditing = editingSoldId === p.id;

                const rowBid = p.currentBid ?? p.basePrice;



                return (

                  <tr key={p.id} className={isLive ? 'row-live' : ''}>

                    <td className="name-cell">{p.name}</td>

                    <td className="country-cell">{formatCountry(p.country)}</td>
                    <td>
                      {isPlayerOverseas(p.country) ? (
                        <span className="os-badge" title="Overseas">OS ✈</span>
                      ) : (
                        '—'
                      )}
                    </td>

                    <td>{ROLE_LABELS[p.role] || p.role}</td>

                    <td>{p.set}</td>

                    <td>{formatCr(p.basePrice)}</td>

                    <td>

                      <span className={`badge ${p.soldStatus}`}>{p.soldStatus}</span>

                    </td>

                    <td>{p.soldTeam ? teamName(p.soldTeam) : '—'}</td>

                    <td>{p.finalPrice != null ? formatCr(p.finalPrice) : '—'}</td>

                    <td className="controls-cell">

                      {canAuction && (

                        <div className="row-controls">

                          <button

                            type="button"

                            className="btn-start"

                            onClick={() => startAuction(p.id)}

                          >

                            Start Auction

                          </button>

                          {isLive && (

                            <div className="row-bid-mini">

                              <span className="row-bid-amt">{formatCr(rowBid)}</span>

                              <button

                                type="button"

                                className="bid-mini-btn"

                                onClick={() => adjustBid(p.id, 'down', p.biddingTeam || null)}

                              >

                                −

                              </button>

                              <span className="row-bid-step">{getIncrementLabel(rowBid)}</span>

                              <button

                                type="button"

                                className="bid-mini-btn bid-mini-up"

                                onClick={() => adjustBid(p.id, 'up', p.biddingTeam || null)}

                              >

                                +

                              </button>

                            </div>

                          )}

                        </div>

                      )}

                      {isSold && (

                        <div className="row-controls sold-controls">

                          {isEditing ? (

                            <>

                              <select

                                value={editTeam}

                                onChange={(e) => setEditTeam(e.target.value)}

                              >

                                <option value="">Team</option>

                                {teams.map((t) => (

                                  <option key={t.id} value={t.id}>

                                    {t.shortName}

                                  </option>

                                ))}

                              </select>

                              <input

                                type="number"

                                step="0.05"

                                value={editPrice}

                                onChange={(e) => setEditPrice(e.target.value)}

                                placeholder="Price (Cr)"

                              />

                              <button

                                type="button"

                                className="btn-sold"

                                disabled={!editTeam || !editPrice}

                                onClick={() => saveEditSold(p.id)}

                              >

                                Save

                              </button>

                              <button

                                type="button"

                                className="btn-secondary"

                                onClick={() => setEditingSoldId(null)}

                              >

                                Cancel

                              </button>

                            </>

                          ) : (

                            <>

                              <button type="button" className="btn-edit" onClick={() => startEditSold(p)}>

                                Edit

                              </button>

                              <button

                                type="button"

                                className="btn-clear-sale"

                                onClick={() => handleClearSale(p)}

                              >

                                Clear Sale

                              </button>

                            </>

                          )}

                        </div>

                      )}

                      {p.soldStatus === 'unsold' && !isLive && (

                        <div className="row-controls">

                          <button type="button" className="btn-start" onClick={() => startAuction(p.id)}>

                            Re-auction

                          </button>

                          <button

                            type="button"

                            className="btn-clear-sale"

                            onClick={() => handleClearSale(p)}

                          >

                            Make Available

                          </button>

                        </div>

                      )}

                    </td>

                  </tr>

                );

              })}

            </tbody>

          </table>

        </div>

      </section>

    </div>

  );

}


