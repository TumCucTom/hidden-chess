/** Format milliseconds as a chess clock: M:SS, or S.d under 20 seconds. */
export function formatClock(ms: number): string {
  const clamped = Math.max(0, ms);
  const totalSeconds = clamped / 1000;
  if (clamped < 20_000) {
    return totalSeconds.toFixed(1);
  }
  const mins = Math.floor(totalSeconds / 60);
  const secs = Math.floor(totalSeconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}
