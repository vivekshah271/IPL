/** Manual country/OS fixes for marquee players missing country in PDF parse */
const PLAYER_COUNTRY_OVERRIDES = {
  'Matheesha Pathirana': 'Sri Lanka',
  'Shimron Hetmyer': 'West Indies',
  'Sunil Narine': 'West Indies',
  'Andre Russell': 'West Indies',
  'Andre Russel': 'West Indies',
  'Heinrich Klaasen': 'South Africa',
  'Pat Cummins': 'Australia',
  'Travis Head': 'Australia',
  'Rashid Khan': 'Afghanistan',
  'Nicholas Pooran': 'West Indies'
};

function applyCountryOverrides(players) {
  return players.map((p) => {
    const country = PLAYER_COUNTRY_OVERRIDES[p.name];
    if (country) return { ...p, country };
    return p;
  });
}

module.exports = { PLAYER_COUNTRY_OVERRIDES, applyCountryOverrides };
