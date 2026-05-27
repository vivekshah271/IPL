/** All amounts in Crores (Cr). 5L = 0.05 Cr */

export function getBidIncrement(amountCr) {
  const a = roundCr(parseFloat(amountCr) || 0);
  if (a < 1) return 0.05;
  if (a >= 1 && a < 5) return 0.2;
  if (a < 10) return 0.5;
  return 1;
}

export function getIncrementLabel(amountCr) {
  const inc = getBidIncrement(amountCr);
  if (inc >= 1) return '+1 Cr';
  if (inc === 0.5) return '+50 L';
  if (inc === 0.2) return '+20 L';
  if (inc === 0.25) return '+25 L';
  return '+5 L';
}

export function roundCr(n) {
  return Math.round(n * 100) / 100;
}

export function getNextBidUp(currentCr) {
  const c = parseFloat(currentCr) || 0;
  return roundCr(c + getBidIncrement(c));
}

export function getNextBidDown(currentCr, baseCr) {
  const c = parseFloat(currentCr) || 0;
  const base = parseFloat(baseCr) || 0;
  if (c <= base) return base;
  const step = getBidIncrement(c - 0.001);
  const next = roundCr(c - step);
  return next < base ? base : next;
}

export const BID_RULES = [
  { range: 'Till ₹1 Cr', step: '₹5 L' },
  { range: '₹1 Cr – ₹5 Cr', step: '₹20 L' },
  { range: '₹5 Cr – ₹10 Cr', step: '₹50 L' },
  { range: '₹10 Cr+', step: '₹1 Cr' }
];
