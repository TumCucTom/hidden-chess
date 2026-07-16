import type { Color, Move, PieceType, PlayState, Variant } from './types';
import { placementSquares, armyFor, fileOf, rankOf } from './board';
import { allLegalMoves, makeMove, isInCheck } from './moves';

// ---------------------------------------------------------------------------
// A lightweight computer opponent: random-but-sensible setup, and a shallow
// negamax search with material + light positional evaluation for play.
//
// The bot reads the true board (it isn't playing "blind"); this keeps it a
// reasonable casual sparring partner. A human still has the information edge
// of designing a setup whose intent the bot can't read.
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

/** Choose a move for the side to move. depth ~2 keeps it snappy. */
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
