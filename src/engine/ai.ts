import type { Color, Move, PieceType, PlayState, Variant } from './types';
import { placementSquares, armyFor, fileOf, rankOf } from './board';
import { allLegalMoves, makeMove, isInCheck, pseudoMoves } from './moves';
import { inferBelief, sampleAssignment } from './belief';

// ---------------------------------------------------------------------------
// The computer opponent.
//
//  * randomPlacement    — a random-but-sensible army design.
//  * chooseMove         — perfect-information negamax (material + light
//                         positional eval). Used by the tests and as the search
//                         core below.
//  * chooseHiddenMove   — how the bot actually plays: it does NOT see opponent
//                         piece types. It infers a belief about them (see
//                         belief.ts), samples plausible "worlds", and plays the
//                         move that scores best on average — so it can be
//                         bluffed, just like a human.
// ---------------------------------------------------------------------------

const VALUE: Record<PieceType, number> = { p: 100, n: 320, b: 330, r: 500, q: 900, k: 0 };
const MATE = 900000;

/** Positional nudge: reward centrality and forward progress for `color`. */
function positional(state: PlayState, color: Color): number {
  let score = 0;
  for (let i = 0; i < 64; i++) {
    const p = state.board[i];
    if (!p || p.color !== color) continue;
    const centrality = 3.5 - Math.abs(3.5 - fileOf(i));
    score += centrality * 2;
    const advance = color === 'w' ? rankOf(i) : 7 - rankOf(i);
    score += advance * (p.type === 'p' ? 4 : 1);
  }
  return score;
}

/** Static evaluation from `forColor`'s point of view. */
function evaluate(state: PlayState, forColor: Color): number {
  const other: Color = forColor === 'w' ? 'b' : 'w';
  let score = 0;
  for (const sq of state.board) {
    if (!sq) continue;
    score += sq.color === forColor ? VALUE[sq.type] : -VALUE[sq.type];
  }
  score += positional(state, forColor) - positional(state, other);
  return score;
}

/** Order captures/promotions first to help alpha-beta pruning. */
function orderMoves(moves: Move[]): Move[] {
  return moves.slice().sort((a, b) => {
    const av = (a.captured ? VALUE[a.captured] : 0) + (a.promotion ? VALUE[a.promotion] : 0);
    const bv = (b.captured ? VALUE[b.captured] : 0) + (b.promotion ? VALUE[b.promotion] : 0);
    return bv - av;
  });
}

/** Standard negamax with alpha-beta; score is from the side-to-move's view. */
function negamax(state: PlayState, depth: number, alpha: number, beta: number): number {
  const moves = allLegalMoves(state);
  if (moves.length === 0) {
    // No moves: mated (very bad for side to move) or stalemate (neutral).
    return isInCheck(state.board, state.turn) ? -MATE - depth : 0;
  }
  if (depth === 0) return evaluate(state, state.turn);

  let best = -Infinity;
  for (const move of orderMoves(moves)) {
    const child = makeMove(state, move);
    const score = -negamax(child, depth - 1, -beta, -alpha);
    if (score > best) best = score;
    if (best > alpha) alpha = best;
    if (alpha >= beta) break;
  }
  return best;
}

/**
 * Perfect-information move choice (reads the true board). Kept for tests and as
 * the search core reused by the hidden-information bot below.
 */
export function chooseMove(state: PlayState, depth = 2): Move | null {
  const moves = orderMoves(allLegalMoves(state));
  if (moves.length === 0) return null;

  let bestMove = moves[0];
  let bestScore = -Infinity;
  for (let i = 0; i < moves.length; i++) {
    const child = makeMove(state, moves[i]);
    // Negate: child is the opponent's node. Tiny per-index jitter breaks ties
    // so the bot doesn't always pick the first of several equal moves.
    const score = -negamax(child, depth - 1, -Infinity, Infinity) + (i % 5) * 0.001;
    if (score > bestScore) {
      bestScore = score;
      bestMove = moves[i];
    }
  }
  return bestMove;
}

const other = (c: Color): Color => (c === 'w' ? 'b' : 'w');

// A move that walks the bot's own king into check *in a sampled world* is
// heavily penalised — that's how the bot learns to fear a piece that might be
// more dangerous than it has let on (a rook posing as a king, say).
const REFUTED = -100000;

/**
 * Hidden Chess move choice — the bot plays without seeing opponent piece types.
 *
 * It infers what each opponent piece could be, samples several concrete
 * "determinized" worlds consistent with that belief, and scores every legal
 * move by its average outcome across those worlds (Perfect-Information Monte
 * Carlo). A move that leaves the king in check in some plausible world is
 * penalised in proportion to how many worlds refute it — so the bot respects
 * threats that *might* exist, and can be genuinely bluffed.
 */
export function chooseHiddenMove(
  state: PlayState,
  variant: Variant,
  { depth = 2, samples = 8 }: { depth?: number; samples?: number } = {},
): Move | null {
  const bot = state.turn;
  const hidden = other(bot);
  const roots = orderMoves(allLegalMoves(state));
  if (roots.length === 0) return null;

  const belief = inferBelief(state, hidden, variant);
  const sums = new Array(roots.length).fill(0);

  for (let s = 0; s < samples; s++) {
    const assign = sampleAssignment(belief);
    const worldBoard = state.board.map((p, i) =>
      p && p.color === hidden ? { ...p, type: assign.get(i) ?? p.type } : p,
    );
    const worldState: PlayState = { ...state, board: worldBoard };

    for (let r = 0; r < roots.length; r++) {
      const m = roots[r];
      // Rebuild the move against this world (capture target/type may differ).
      const wm = pseudoMoves(worldState, m.from).find(
        (x) => x.to === m.to && (x.promotion ?? null) === (m.promotion ?? null),
      );
      if (!wm) continue;
      const child = makeMove(worldState, wm);
      if (isInCheck(child.board, bot)) {
        sums[r] += REFUTED; // illegal / king-losing in this world
      } else {
        sums[r] += -negamax(child, depth - 1, -Infinity, Infinity);
      }
    }
  }

  let bestMove = roots[0];
  let bestScore = -Infinity;
  for (let r = 0; r < roots.length; r++) {
    const score = sums[r] + (r % 5) * 0.001; // tie-break jitter
    if (score > bestScore) {
      bestScore = score;
      bestMove = roots[r];
    }
  }
  return bestMove;
}

// ---------------------------------------------------------------------------
// Random setup generation for the computer.
// ---------------------------------------------------------------------------

// xorshift PRNG seeded from a mutable global so successive games differ.
// (Math.random is intentionally avoided so the engine stays usable in
// execution contexts that stub it out; seeding is reseeded per call below.)
let rngState = 0x9e3779b9;
export function reseed(seed: number) {
  rngState = seed >>> 0 || 0x9e3779b9;
}
function nextRand(): number {
  rngState ^= rngState << 13;
  rngState ^= rngState >>> 17;
  rngState ^= rngState << 5;
  return (rngState >>> 0) / 0xffffffff;
}
function shuffle<T>(arr: T[]): T[] {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(nextRand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** 0 for the player's home rank, higher toward the enemy. */
function rankTowardEnemy(color: Color, square: number): number {
  return color === 'w' ? rankOf(square) : 7 - rankOf(square);
}

/**
 * Generate a random-but-reasonable placement: pawns pushed toward the front
 * rank, heavier pieces (and the king) kept on the back rank.
 */
export function randomPlacement(color: Color, variant: Variant): Record<number, PieceType> {
  const squares = placementSquares(color, variant);
  const army = shuffle(armyFor(variant));
  const placement: Record<number, PieceType> = {};

  if (variant === '960') {
    squares.forEach((sq, i) => (placement[sq] = army[i]));
    return placement;
  }

  // full mode: keep non-pawns on the back rank, pawns on the front rank.
  const back = shuffle(squares.filter((sq) => rankTowardEnemy(color, sq) === 0));
  const front = shuffle(squares.filter((sq) => rankTowardEnemy(color, sq) !== 0));
  const nonPawns = shuffle(army.filter((p) => p !== 'p'));
  const pawns = army.filter((p) => p === 'p');

  back.forEach((sq, i) => (placement[sq] = nonPawns[i]));
  front.forEach((sq, i) => (placement[sq] = pawns[i]));
  return placement;
}
