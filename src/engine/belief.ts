import type { Board, Color, PieceType, PlayState, Variant } from './types';
import { fileOf, rankOf } from './board';

// ---------------------------------------------------------------------------
// Opponent belief model — the heart of playing Hidden Chess "honestly".
//
// A player never sees an opponent piece's *type*, only its position and how it
// has moved. From that public information we infer, for every hidden piece, the
// set of types it could still be:
//
//   * army composition   — both sides field {K, Q, 2R, 2B, 2N, 8P}; captured
//                          (revealed) pieces shrink the remaining multiset.
//   * 960 pawn prior     — in Back-Rank mode a piece that *started* on the 2nd
//                          rank is a pawn; one that started on the back rank is
//                          not (pawns are fixed there).
//   * movement geometry  — a knight-jump means knight; a 2+ square diagonal
//                          means bishop/queen; a piece that only ever stepped
//                          one square could still be a king… or a bluffing rook.
//
// Nothing here reads a hidden piece's true type — only public data (square,
// move from/to, the fact of a capture/promotion, and revealed captures).
// ---------------------------------------------------------------------------

const ALL_TYPES: PieceType[] = ['k', 'q', 'r', 'b', 'n', 'p'];

/** The fixed army each side fields, as a type→count multiset. */
export function fullArmyCounts(): Record<PieceType, number> {
  return { k: 1, q: 1, r: 2, b: 2, n: 2, p: 8 };
}

export interface PieceBelief {
  square: number;
  /** Types this piece could still be (non-empty). */
  allowed: PieceType[];
}

export interface Belief {
  pieces: PieceBelief[];
  /** Remaining hidden army still on the board (type→count). */
  counts: Record<PieceType, number>;
}

/** Forward direction (in ranks) for a pawn of `color`. */
const forward = (color: Color) => (color === 'w' ? 1 : -1);

/**
 * Which piece types could have made a single move with this displacement?
 * Blockers are ignored — the move happened, so its path was clear.
 */
export function typesForMove(
  df: number,
  dr: number,
  capture: boolean,
  color: Color,
): PieceType[] {
  const adf = Math.abs(df);
  const adr = Math.abs(dr);
  const fwd = forward(color);

  // Knight jump — nothing else moves this way.
  if ((adf === 1 && adr === 2) || (adf === 2 && adr === 1)) return ['n'];

  const out: PieceType[] = [];
  if (adf === adr && adf >= 1) {
    // Diagonal.
    out.push('b', 'q');
    if (adf === 1) out.push('k');
    if (adf === 1 && capture && dr === fwd) out.push('p'); // pawn capture
    return out;
  }
  if ((df === 0) !== (dr === 0)) {
    // Orthogonal (exactly one axis moves).
    out.push('r', 'q');
    if (adf + adr === 1) out.push('k');
    if (df === 0 && !capture) {
      if (dr === fwd || dr === 2 * fwd) out.push('p'); // single / double push
    }
    return out;
  }
  return out; // unreachable for a real move
}

interface Track {
  startSquare: number;
  deltas: Array<{ df: number; dr: number; capture: boolean }>;
  promoted: boolean;
}

/**
 * Replay the public move history to reconstruct each hidden piece's trajectory,
 * tracking pieces by the squares they occupy (never by their type).
 */
function trackHidden(state: PlayState, hidden: Color): Map<number, Track> {
  const occ = new Map<number, Track>();
  const bot: Color = hidden === 'w' ? 'b' : 'w';

  for (const m of state.history) {
    if (m.color === hidden) {
      const track = occ.get(m.from) ?? { startSquare: m.from, deltas: [], promoted: false };
      if (m.promotion) {
        // Post-promotion the piece is a fresh unknown Q/R/B/N; drop prior moves.
        track.deltas = [];
        track.promoted = true;
      } else {
        track.deltas.push({
          df: fileOf(m.to) - fileOf(m.from),
          dr: rankOf(m.to) - rankOf(m.from),
          capture: m.captured != null,
        });
      }
      occ.delete(m.from);
      occ.set(m.to, track);
    } else if (m.color === bot && m.captured != null && m.capturedSquare != null) {
      // We captured (revealed) a hidden piece; it leaves the board.
      occ.delete(m.capturedSquare);
    }
  }
  return occ;
}

/** All squares currently holding a piece of `color`. */
function pieceSquares(board: Board, color: Color): number[] {
  const out: number[] = [];
  for (let i = 0; i < 64; i++) {
    const p = board[i];
    if (p && p.color === color) out.push(i);
  }
  return out;
}

/** Build the belief about `hidden`'s pieces from the bot's public knowledge. */
export function inferBelief(state: PlayState, hidden: Color, variant: Variant): Belief {
  const bot: Color = hidden === 'w' ? 'b' : 'w';

  // Remaining hidden army = full army minus the pieces we've captured/revealed.
  const counts = fullArmyCounts();
  for (const m of state.history) {
    if (m.color === bot && m.captured != null) {
      counts[m.captured] = Math.max(0, counts[m.captured] - 1);
    }
  }

  const tracks = trackHidden(state, hidden);
  const secondRank = hidden === 'w' ? 1 : 6;

  const pieces: PieceBelief[] = pieceSquares(state.board, hidden).map((square) => {
    const track = tracks.get(square) ?? { startSquare: square, deltas: [], promoted: false };

    // Base: any type still remaining in the army.
    let allowed = ALL_TYPES.filter((t) => counts[t] > 0);

    if (track.promoted) {
      allowed = allowed.filter((t) => t !== 'p' && t !== 'k'); // promoted to Q/R/B/N
    } else if (variant === '960') {
      // Back-Rank prior: 2nd-rank starters are pawns; others are not.
      if (rankOf(track.startSquare) === secondRank) allowed = allowed.filter((t) => t === 'p');
      else allowed = allowed.filter((t) => t !== 'p');
    }

    // Intersect with what each observed move implies.
    for (const d of track.deltas) {
      const canDo = new Set(typesForMove(d.df, d.dr, d.capture, hidden));
      allowed = allowed.filter((t) => canDo.has(t));
    }

    // Robustness: never return an empty set (fall back to the army pool).
    if (allowed.length === 0) allowed = ALL_TYPES.filter((t) => counts[t] > 0);
    return { square, allowed };
  });

  return { pieces, counts };
}

// ---------------------------------------------------------------------------
// Determinization sampling: draw a concrete type for every hidden piece that
// is consistent with its allowed set and the remaining army multiset.
// ---------------------------------------------------------------------------

// Self-contained xorshift so sampling never depends on Math.random.
let rng = 0x51ed270b;
export function reseedBelief(seed: number) {
  rng = seed >>> 0 || 0x51ed270b;
}
function rand(): number {
  rng ^= rng << 13;
  rng ^= rng >>> 17;
  rng ^= rng << 5;
  return (rng >>> 0) / 0xffffffff;
}
function shuffled<T>(arr: T[]): T[] {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * Sample a full assignment of types to hidden pieces consistent with the
 * belief. Returns a square→type map. Falls back to a best-effort assignment if
 * the constraints can't be satisfied exactly (keeps the bot robust).
 */
export function sampleAssignment(belief: Belief): Map<number, PieceType> {
  const counts: Record<PieceType, number> = { ...belief.counts };
  // Most-constrained pieces first makes the backtracking search converge fast.
  const order = belief.pieces.slice().sort((a, b) => a.allowed.length - b.allowed.length);
  const result = new Map<number, PieceType>();
  let steps = 0;

  const backtrack = (i: number): boolean => {
    if (i === order.length) return true;
    if (steps++ > 20000) return false; // safety valve
    const piece = order[i];
    for (const t of shuffled(piece.allowed)) {
      if (counts[t] <= 0) continue;
      counts[t] -= 1;
      result.set(piece.square, t);
      if (backtrack(i + 1)) return true;
      counts[t] += 1;
      result.delete(piece.square);
    }
    return false;
  };

  if (backtrack(0)) return result;

  // Fallback: greedily hand out whatever remains.
  const pool: PieceType[] = [];
  for (const t of ALL_TYPES) for (let k = 0; k < belief.counts[t]; k++) pool.push(t);
  const bag = shuffled(pool);
  belief.pieces.forEach((p, i) => result.set(p.square, bag[i] ?? p.allowed[0] ?? 'p'));
  return result;
}
