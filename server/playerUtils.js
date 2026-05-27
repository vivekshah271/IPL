function isPlayerOverseas(country) {
  if (!country || String(country).trim() === '') return false;
  return String(country).trim() !== 'India';
}

module.exports = { isPlayerOverseas };
