import { formatCr, TEAMS_MAP, getOverseasBought } from '../utils';
import './TeamBudgetTable.css';

export default function TeamBudgetTable({ teams, players = [], compact = false }) {
  if (!teams?.length) return null;

  return (
    <div className={`team-budget-table ipl-scroll ${compact ? 'compact' : ''}`}>
      <table>
        <thead>
          <tr>
            <th>Team</th>
            <th>Remaining</th>
            <th>Players</th>
            <th className="os-col">OS Bought</th>
            <th>Spent</th>
            {!compact && <th>Slots</th>}
          </tr>
        </thead>
        <tbody>
          {teams.map((t) => (
            <tr key={t.id} style={{ '--team-color': TEAMS_MAP[t.id]?.color }}>
              <td>
                <span className="team-dot" />
                <strong>{t.shortName}</strong>
              </td>
              <td className="budget-cell">{formatCr(t.remainingBudget)}</td>
              <td>{t.playersBought?.length ?? 0}</td>
              <td className="os-cell">
                {t.overseasBought ?? getOverseasBought(t, players)}
              </td>
              <td>{formatCr(t.totalSpent)}</td>
              {!compact && <td>{t.remainingSlots}</td>}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
