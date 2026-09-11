/** Date string se deterministic jitter nikalo — same date = same jitter hamesha */
export function predictionJitter(dateStr: string): number {
  const key = dateStr.split('T')[0];
  const seed = key.split('-').reduce((s, n) => s + parseInt(n, 10), 0);
  const abs = ((seed * 7) % 11) + 10; // 10 to 20
  return seed % 2 === 0 ? abs : -abs;
}
