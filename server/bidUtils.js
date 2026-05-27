function getBidIncrement(amountCr) {
  const a = roundCr(parseFloat(amountCr) || 0);
  if (a < 1) return 0.05;
  if (a >= 1 && a < 5) return 0.2;
  if (a < 10) return 0.5;
  return 1;
}

function roundCr(n) {
  return Math.round(n * 100) / 100;
}

function getNextBidUp(currentCr) {
  const c = parseFloat(currentCr) || 0;
  return roundCr(c + getBidIncrement(c));
}

function getNextBidDown(currentCr, baseCr) {
  const c = parseFloat(currentCr) || 0;
  const base = parseFloat(baseCr) || 0;
  if (c <= base) return base;
  const step = getBidIncrement(c - 0.001);
  const next = roundCr(c - step);
  return next < base ? base : next;
}

module.exports = { getBidIncrement, getNextBidUp, getNextBidDown, roundCr };
