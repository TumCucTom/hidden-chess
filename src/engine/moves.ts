import type { Board, Color, Move, PieceType, PlayState } from './types';
import { fileOf, rankOf, idx, onBoard } from './board';

// ---------------------------------------------------------------------------
// Move generation, attack/check detection, and move application.
//
// Notes on the Hidden Chess ruleset:
//   * There is no castling — pieces start in player-chosen squares, so the
//     classical king/rook castling contract does not apply.
//   * En passant and promotion work exactly as in standard chess.
//   * A pawn may advance two squares only from its own home rank
//     (rank index 1 for White, 6 for Black), so pawns placed on the very
//     back rank in full-placement mode only ever step one square.
// ---------------------------------------------------------------------------

const opposite = (c: Color): Color => (c === 'w' ? 'b' : 'w');

const KNIGHT_DELTAS: Array<[number, number]> = [
  [1, 2], [2, 1], [2, -1], [1, -2],
  [-1, -2], [-2, -1], [-2, 1], [-1, 2],
];

const KING_DELTAS: Array<[number, number]> = [
  [1, 0], [1, 1], [0, 1], [-1, 1],
  [-1, 0], [-1, -1], [0, -1], [1, -1],
];

const BISHOP_DIRS: Array<[number, number]> = [[1, 1], [1, -1], [-1, 1], [-1, -1]];
const ROOK_DIRS: Array<[number, number]> = [[1, 0], [-1, 0], [0, 1], [0, -1]];

/** Rank a pawn of `color` promotes on. */
export const promotionRank = (color: Color) => (color === 'w' ? 7 : 0);
/** Home rank a pawn of `color` may double-step from. */
const pawnHomeRank = (color: Color) => (color === 'w' ? 1 : 6);
/** Forward rank direction for a pawn of `color`. */
const pawnDir = (color: Color) => (color === 'w' ? 1 : -1);

/**
 * Is `square` attacked by any piece of `byColor`?
 * Used for check detection and legality. Does not consider en passant
 * (en passant can never be the move that gives check to a king directly in a
 * way that matters for legality here — a king is never captured en passant).
 */
export function isSquareAttacked(board: Board, square: number, byColor: Color): boolean {
  const tf = fileOf(square);
  const tr = rankOf(square);

  // Pawn attacks: a pawn of byColor attacks diagonally "forward".
  const dir = pawnDir(byColor);
  for (const df of [-1, 1]) {
    const f = tf + df;
    const r = tr - dir; // a pawn on (f, tr-dir) would attack (tf, tr)
    if (onBoard(f, r)) {
      const p = board[idx(f, r)];
      if (p && p.color === byColor && p.type === 'p') return true;
    }
  }

  // Knight attacks.
  for (const [df, dr] of KNIGHT_DELTAS) {
    const f = tf + df;
    const r = tr + dr;
    if (onBoard(f, r)) {
      const p = board[idx(f, r)];
      if (p && p.color === byColor && p.type === 'n') return true;
    }
  }

  // King attacks (adjacency).
  for (const [df, dr] of KING_DELTAS) {
    const f = tf + df;
    const r = tr + dr;
    if (onBoard(f, r)) {
      const p = board[idx(f, r)];
      if (p && p.color === byColor && p.type === 'k') return true;
    }
  }

  // Sliding attacks: bishops/queens on diagonals, rooks/queens on orthogonals.
  const slide = (dirs: Array<[number, number]>, types: PieceType[]) => {
    for (const [df, dr] of dirs) {
      let f = tf + df;
      let r = tr + dr;
      while (onBoard(f, r)) {
        const p = board[idx(f, r)];
        if (p) {
          if (p.color === byColor && types.includes(p.type)) return true;
          break;
        }
        f += df;
        r += dr;
      }
    }
    return false;
  };
  if (slide(BISHOP_DIRS, ['b', 'q'])) return true;
  if (slide(ROOK_DIRS, ['r', 'q'])) return true;

  return false;
}

export function findKing(board: Board, color: Color): number {
  for (let i = 0; i < 64; i++) {
    const p = board[i];
    if (p && p.color === color && p.type === 'k') return i;
  }
  return -1;
}

export function isInCheck(board: Board, color: Color): boolean {
  const k = findKing(board, color);
  if (k < 0) return false;
  return isSquareAttacked(board, k, opposite(color));
}

/**
 * Pseudo-legal moves for the piece on `from` (ignores leaving own king in
 * check). Promotions are expanded into one move per promotion piece.
 */
export function pseudoMoves(state: PlayState, from: number): Move[] {
  const board = state.board;
  const piece = board[from];
  if (!piece) return [];
  const { color, type } = piece;
  const moves: Move[] = [];
  const f0 = fileOf(from);
  const r0 = rankOf(from);

  const pushMove = (to: number, opts: Partial<Move> = {}) => {
    const target = board[to];
    moves.push({
      from,
      to,
      piece: type,
      color,
      captured: target ? target.type : null,
      capturedId: target ? target.id : null,
      capturedSquare: target ? to : null,
      ...opts,
    });
  };

  if (type === 'p') {
    const dir = pawnDir(color);
    const promo = promotionRank(color);
    const oneR = r0 + dir;

    // Single push.
    if (onBoard(f0, oneR) && !board[idx(f0, oneR)]) {
      if (oneR === promo) {
        for (const pr of ['q', 'r', 'b', 'n'] as PieceType[]) {
          pushMove(idx(f0, oneR), { promotion: pr });
        }
      } else {
        pushMove(idx(f0, oneR));
        // Double push from home rank.
        const twoR = r0 + 2 * dir;
        if (r0 === pawnHomeRank(color) && !board[idx(f0, twoR)]) {
          pushMove(idx(f0, twoR), { isDouble: true });
        }
      }
    }

    // Captures (including promotion captures) and en passant.
    for (const df of [-1, 1]) {
      const cf = f0 + df;
      const cr = r0 + dir;
      if (!onBoard(cf, cr)) continue;
      const to = idx(cf, cr);
      const target = board[to];
      if (target && target.color !== color) {
        if (cr === promo) {
          for (const pr of ['q', 'r', 'b', 'n'] as PieceType[]) {
            pushMove(to, { promotion: pr });
          }
        } else {
          pushMove(to);
        }
      } else if (!target && state.enPassant === to) {
        // En passant: capture the pawn sitting beside us on rank r0.
        const capSq = idx(cf, r0);
        const capPiece = board[capSq];
        moves.push({
          from,
          to,
          piece: 'p',
          color,
          captured: capPiece ? capPiece.type : 'p',
          capturedId: capPiece ? capPiece.id : null,
          capturedSquare: capSq,
          isEnPassant: true,
        });
      }
    }
    return moves;
  }

  if (type === 'n') {
    for (const [df, dr] of KNIGHT_DELTAS) {
      const f = f0 + df;
      const r = r0 + dr;
      if (!onBoard(f, r)) continue;
      const to = idx(f, r);
      const target = board[to];
      if (!target || target.color !== color) pushMove(to);
    }
    return moves;
  }

  if (type === 'k') {
    for (const [df, dr] of KING_DELTAS) {
      const f = f0 + df;
      const r = r0 + dr;
      if (!onBoard(f, r)) continue;
      const to = idx(f, r);
      const target = board[to];
      if (!target || target.color !== color) pushMove(to);
    }
    return moves;
  }

  // Sliding pieces.
  let dirs: Array<[number, number]> = [];
  if (type === 'b') dirs = BISHOP_DIRS;
  else if (type === 'r') dirs = ROOK_DIRS;
  else if (type === 'q') dirs = [...BISHOP_DIRS, ...ROOK_DIRS];

  for (const [df, dr] of dirs) {
    let f = f0 + df;
    let r = r0 + dr;
    while (onBoard(f, r)) {
      const to = idx(f, r);
      const target = board[to];
      if (!target) {
        pushMove(to);
      } else {
        if (target.color !== color) pushMove(to);
        break;
      }
      f += df;
      r += dr;
    }
  }
  return moves;
}

/** Apply a move to a board copy (no state bookkeeping). Returns the new board. */
export function applyMoveToBoard(board: Board, move: Move): Board {
  const next = board.slice();
  const piece = next[move.from];
  if (!piece) return next;

  // Remove any captured piece (en passant removes from a different square).
  if (move.capturedSquare != null && move.capturedSquare !== move.to) {
    next[move.capturedSquare] = null;
  }

  const moved = { ...piece, hasMoved: true };
  if (move.promotion) moved.type = move.promotion;
  next[move.to] = moved;
  next[move.from] = null;
  return next;
}

/** Would this move leave `color`'s own king in check? */
function leavesKingInCheck(board: Board, move: Move, color: Color): boolean {
  const after = applyMoveToBoard(board, move);
  return isInCheck(after, color);
}

/** Fully legal moves for the piece on `from`. */
export function legalMoves(state: PlayState, from: number): Move[] {
  const piece = state.board[from];
  if (!piece || piece.color !== state.turn) return [];
  return pseudoMoves(state, from).filter(
    (m) => !leavesKingInCheck(state.board, m, piece.color),
  );
}

/** All legal moves for the side to move. */
export function allLegalMoves(state: PlayState): Move[] {
  const out: Move[] = [];
  for (let i = 0; i < 64; i++) {
    const p = state.board[i];
    if (p && p.color === state.turn) out.push(...legalMoves(state, i));
  }
  return out;
}

/**
 * Apply a move and return the next PlayState WITHOUT touching history or
 * computing check/mate annotations. This is the lean path used by the search
 * (thousands of nodes), where history/annotations are never read.
 */
export function applyMoveToState(state: PlayState, move: Move): PlayState {
  const board = applyMoveToBoard(state.board, move);
  const enPassant = move.isDouble
    ? idx(fileOf(move.from), (rankOf(move.from) + rankOf(move.to)) / 2)
    : null;
  const isCapture = move.captured != null;
  const isPawnMove = move.piece === 'p';
  return {
    board,
    turn: opposite(state.turn),
    enPassant,
    halfmoveClock: isCapture || isPawnMove ? 0 : state.halfmoveClock + 1,
    fullmove: state.turn === 'b' ? state.fullmove + 1 : state.fullmove,
    history: state.history, // shared reference; never mutated during search
  };
}

/**
 * Apply a legal move and return the next PlayState, appending it to history and
 * annotating check/mate. Used for real game moves (not the search).
 */
export function makeMove(state: PlayState, move: Move): PlayState {
  const base = applyMoveToState(state, move);
  const givesCheck = isInCheck(base.board, base.turn);
  const nextState: PlayState = {
    ...base,
    history: [...state.history, { ...move, givesCheck }],
  };
  if (givesCheck && allLegalMoves(nextState).length === 0) {
    nextState.history[nextState.history.length - 1].givesMate = true;
  }
  return nextState;
}

export type Termination =
  | { over: false }
  | { over: true; reason: 'checkmate' | 'stalemate'; winner?: Color };

/** Detect natural end of game for the side to move. */
export function checkTermination(state: PlayState): Termination {
  const hasMoves = allLegalMoves(state).length > 0;
  if (hasMoves) return { over: false };
  if (isInCheck(state.board, state.turn)) {
    return { over: true, reason: 'checkmate', winner: opposite(state.turn) };
  }
  return { over: true, reason: 'stalemate' };
}

/**
 * Very rough insufficient-material check (K vs K, K+minor vs K). Used only to
 * award a draw instead of a win on timeout would be too strict, so we keep it
 * for natural draw detection convenience.
 */
export function isInsufficientMaterial(board: Board): boolean {
  const pieces = board.filter(Boolean) as NonNullable<Board[number]>[];
  const nonKings = pieces.filter((p) => p.type !== 'k');
  if (nonKings.length === 0) return true;
  if (nonKings.length === 1 && (nonKings[0].type === 'b' || nonKings[0].type === 'n')) {
    return true;
  }
  return false;
}
