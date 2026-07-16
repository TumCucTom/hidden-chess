// ---------------------------------------------------------------------------
// Core type definitions for the Hidden Chess engine.
//
// Coordinate system (used everywhere):
//   index = rank * 8 + file          (0..63)
//   file  = index % 8                (0 = a-file ... 7 = h-file)
//   rank  = Math.floor(index / 8)    (0 = rank 1 / White's home ... 7 = rank 8)
//
// White pieces live on ranks 0 & 1 and advance toward rank 7 (promotion).
// Black pieces live on ranks 6 & 7 and advance toward rank 0 (promotion).
// ---------------------------------------------------------------------------

export type Color = 'w' | 'b';

export type PieceType = 'k' | 'q' | 'r' | 'b' | 'n' | 'p';

export interface Piece {
  /** Stable identity so the UI can animate a specific piece across moves. */
  id: string;
  color: Color;
  type: PieceType;
  hasMoved: boolean;
}

export type SquareContent = Piece | null;

/** The board is a flat array of 64 squares (see coordinate note above). */
export type Board = SquareContent[];

export interface Move {
  from: number;
  to: number;
  /** Type of the moving piece (engine-internal; not shown to the opponent). */
  piece: PieceType;
  color: Color;
  /** Type of a captured piece, if any (revealed to the capturer). */
  captured?: PieceType | null;
  capturedId?: string | null;
  /** Square the captured piece actually sat on (differs from `to` on en passant). */
  capturedSquare?: number | null;
  isEnPassant?: boolean;
  /** Pawn advanced two squares (creates an en-passant opportunity). */
  isDouble?: boolean;
  /** Piece a pawn promoted to, if this move is a promotion. */
  promotion?: PieceType | null;
  /** Set when this move gives check / delivers mate (public information). */
  givesCheck?: boolean;
  givesMate?: boolean;
}

/** The two ways a game can be set up. */
export type Variant = '960' | 'full';

export type Mode = 'pass' | 'computer';

/** Computer strength (search breadth/depth + setup effort). */
export type Difficulty = 'casual' | 'balanced' | 'sharp';

/** A full time control: setup minutes | play minutes | increment seconds. */
export interface TimeControl {
  setupMinutes: number;
  playMinutes: number;
  incrementSeconds: number;
}

export interface PlayState {
  board: Board;
  turn: Color;
  /** En-passant target square (the skipped square), or null. */
  enPassant: number | null;
  /** Half-moves since last capture or pawn move (for the 50-move rule). */
  halfmoveClock: number;
  fullmove: number;
  history: Move[];
}

export type GameResult =
  | { kind: 'checkmate'; winner: Color }
  | { kind: 'timeout'; winner: Color }
  | { kind: 'resign'; winner: Color }
  | { kind: 'stalemate' }
  | { kind: 'fifty-move' }
  | { kind: 'insufficient' }
  | { kind: 'agreed-draw' };
