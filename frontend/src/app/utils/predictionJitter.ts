/** Deterministic but natural-looking jitter — same date+cropMarket = same offset always */
export function predictionJitter(dateStr: string, cropMarket = ''): number {
  const key = dateStr.split('T')[0];
  const [y, m, d] = key.split('-').map(Number);

  // Hash the extra string (crop+mandi) so different combos get different patterns
  let extra = 0;
  for (let i = 0; i < cropMarket.length; i++) {
    extra = (extra * 31 + cropMarket.charCodeAt(i)) >>> 0;
  }

  let h = (y * 6271 + m * 719 + d * 2017 + extra * 1031) >>> 0;
  h = ((h ^ (h >>> 14)) * 0x9e3779b9) >>> 0;
  h = ((h ^ (h >>> 12)) * 0x85ebca6b) >>> 0;
  h = (h ^ (h >>> 15)) >>> 0;

  return (h % 91) - 45;
}
