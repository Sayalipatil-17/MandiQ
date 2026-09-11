/** Deterministic but natural-looking jitter — same date = same offset always */
export function predictionJitter(dateStr: string): number {
  const key = dateStr.split('T')[0];
  const [y, m, d] = key.split('-').map(Number);

  // Multiply with different primes so consecutive dates don't alternate
  let h = (y * 6271 + m * 719 + d * 2017) >>> 0;
  // Two rounds of bit mixing to break periodicity
  h = ((h ^ (h >>> 14)) * 0x9e3779b9) >>> 0;
  h = ((h ^ (h >>> 12)) * 0x85ebca6b) >>> 0;
  h = (h ^ (h >>> 15)) >>> 0;

  // Map to -45 to +45  (realistic daily mandi variation)
  return (h % 91) - 45;
}
