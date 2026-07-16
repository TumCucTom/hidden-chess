import type { Color } from '../engine/types';
import { fileOf, rankOf, FILES } from '../engine/board';

/** The 64 square indices in display order for a given orientation (top row first). */
export function orderedSquares(orientation: Color): number[] {
  const ranks = orientation === 'w' ? [7, 6, 5, 4, 3, 2, 1, 0] : [0, 1, 2, 3, 4, 5, 6, 7];
  const files = orientation === 'w' ? [0, 1, 2, 3, 4, 5, 6, 7] : [7, 6, 5, 4, 3, 2, 1, 0];
  const out: number[] = [];
  for (const r of ranks) for (const f of files) out.push(r * 8 + f);
  return out;
}

/** a1 is a dark square; light squares have (file + rank) odd. */
export function isLightSquare(i: number): boolean {
  return (fileOf(i) + rankOf(i)) % 2 === 1;
}

/** File letter to show on the bottom edge of a square (or null). */
export function fileLabel(i: number, orientation: Color): string | null {
  const bottomRank = orientation === 'w' ? 0 : 7;
  return rankOf(i) === bottomRank ? FILES[fileOf(i)] : null;
}

/** Rank number to show on the side edge of a square (or null). */
export function rankLabel(i: number, orientation: Color): string | null {
  const sideFile = orientation === 'w' ? 0 : 7;
  return fileOf(i) === sideFile ? String(rankOf(i) + 1) : null;
}
