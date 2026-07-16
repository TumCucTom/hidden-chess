import type { Board, Color, Piece, PieceType, Variant } from './types';

// ---------------------------------------------------------------------------
// Board / coordinate helpers and setup construction.
// ---------------------------------------------------------------------------

export const FILES = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];

export const fileOf = (i: number) => i % 8;
export const rankOf = (i: number) => Math.floor(i / 8);
export const idx = (file: number, rank: number) => rank * 8 + file;
export const onBoard = (file: number, rank: number) =>
  file >= 0 && file < 8 && rank >= 0 && rank < 8;

/** Human-readable square name, e.g. 12 -> "e2". */
export function squareName(i: number): string {
  return `${FILES[fileOf(i)]}${rankOf(i) + 1}`;
}

export function emptyBoard(): Board {
  return new Array(64).fill(null);
}

let idCounter = 0;
export function makePiece(color: Color, type: PieceType): Piece {
  idCounter += 1;
  return { id: `${color}${type}${idCounter}`, color, type, hasMoved: false };
}

/** The multiset of back-rank pieces a player arranges in 960 mode. */
export const BACK_RANK_PIECES: PieceType[] = ['k', 'q', 'r', 'r', 'b', 'b', 'n', 'n'];

/** The full 16-piece army a player arranges in full-placement mode. */
export const FULL_ARMY: PieceType[] = [
  'k', 'q', 'r', 'r', 'b', 'b', 'n', 'n',
  'p', 'p', 'p', 'p', 'p', 'p', 'p', 'p',
];

export function armyFor(variant: Variant): PieceType[] {
  return variant === '960' ? [...BACK_RANK_PIECES] : [...FULL_ARMY];
}

/**
 * The board-square indices a given color may place pieces on.
 *  - 960 mode: only the home rank (8 squares); pawns are fixed on the 2nd rank.
 *  - full mode: both home ranks (16 squares).
 */
export function placementSquares(color: Color, variant: Variant): number[] {
  const ranks = color === 'w'
    ? (variant === '960' ? [0] : [0, 1])
    : (variant === '960' ? [7] : [6, 7]);
  const squares: number[] = [];
  for (const r of ranks) for (let f = 0; f < 8; f++) squares.push(idx(f, r));
  return squares;
}

/** In 960 mode the pawns sit on the 2nd rank; return those fixed squares. */
export function fixedPawnSquares(color: Color): number[] {
  const rank = color === 'w' ? 1 : 6;
  const squares: number[] = [];
  for (let f = 0; f < 8; f++) squares.push(idx(f, rank));
  return squares;
}

/** Combine two per-color placements into a full board. */
export function assembleBoard(
  variant: Variant,
  whitePlacement: Record<number, PieceType>,
  blackPlacement: Record<number, PieceType>,
): Board {
  const board = emptyBoard();
  const place = (color: Color, placement: Record<number, PieceType>) => {
    for (const [sq, type] of Object.entries(placement)) {
      board[Number(sq)] = makePiece(color, type);
    }
    if (variant === '960') {
      for (const sq of fixedPawnSquares(color)) board[sq] = makePiece(color, 'p');
    }
  };
  place('w', whitePlacement);
  place('b', blackPlacement);
  return board;
}

/**
 * Validate a placement for one color. Returns an error string, or null if OK.
 */
export function validatePlacement(
  color: Color,
  variant: Variant,
  placement: Record<number, PieceType>,
): string | null {
  const legalSquares = new Set(placementSquares(color, variant));
  const entries = Object.entries(placement);

  for (const [sq] of entries) {
    if (!legalSquares.has(Number(sq))) return 'A piece is outside your placement zone.';
  }

  const need = armyFor(variant).slice().sort();
  const have = entries.map(([, t]) => t).sort();

  if (have.length < need.length) {
    return `Place all your pieces (${need.length - have.length} left).`;
  }
  if (have.length > need.length) return 'Too many pieces placed.';
  for (let i = 0; i < need.length; i++) {
    if (have[i] !== need[i]) return 'Piece counts do not match your army.';
  }
  return null;
}

/** Count how many of each type still need placing given a partial placement. */
export function remainingPieces(
  variant: Variant,
  placement: Record<number, PieceType>,
): PieceType[] {
  const remaining = armyFor(variant);
  for (const type of Object.values(placement)) {
    const i = remaining.indexOf(type);
    if (i >= 0) remaining.splice(i, 1);
  }
  return remaining;
}
