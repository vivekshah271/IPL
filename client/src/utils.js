export function formatCr(amount) {
  if (amount == null || isNaN(amount)) return '—';
  if (amount >= 1) return `₹${amount.toFixed(2)} Cr`;
  return `₹${Math.round(amount * 100)} L`;
}

export const ROLE_LABELS = {
  BATTER: 'Batter',
  BOWLER: 'Bowler',
  'ALL-ROUNDER': 'All-Rounder',
  WICKETKEEPER: 'Wicketkeeper',
  MARQUEE: 'Marquee'
};

export const TEAMS_MAP = {
  CSK: { name: 'Chennai Super Kings', color: '#F9CD05' },
  MI: { name: 'Mumbai Indians', color: '#004BA0' },
  RCB: { name: 'Royal Challengers Bengaluru', color: '#EC1C24' },
  KKR: { name: 'Kolkata Knight Riders', color: '#3A225D' },
  RR: { name: 'Rajasthan Royals', color: '#254AA5' },
  DC: { name: 'Delhi Capitals', color: '#0078BC' },
  SRH: { name: 'Sunrisers Hyderabad', color: '#F26522' },
  PBKS: { name: 'Punjab Kings', color: '#ED1B24' },
  LSG: { name: 'Lucknow Super Giants', color: '#00BFFF' },
  GT: { name: 'Gujarat Titans', color: '#1C2C5B' }
};

export function teamName(id) {
  return TEAMS_MAP[id]?.name || id || '—';
}

/** Overseas = any player whose country is not India */
export function isPlayerOverseas(country) {
  if (!country || String(country).trim() === '') return false;
  return String(country).trim() !== 'India';
}

export function formatCountry(country) {
  const c = country && String(country).trim();
  return c || '—';
}

export function resolveBoughtPlayer(pb, allPlayers = []) {
  const full = allPlayers.find((p) => p.id === pb.playerId);
  const country = (pb.country && String(pb.country).trim()) || full?.country || '';
  const isOverseas = Boolean(pb.isOverseas) || isPlayerOverseas(country);
  return { ...pb, country, isOverseas };
}

export function getOverseasBought(team, allPlayers = []) {
  return (team.playersBought || []).filter((pb) => resolveBoughtPlayer(pb, allPlayers).isOverseas)
    .length;
}
