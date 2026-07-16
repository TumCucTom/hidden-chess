// Lightweight assertion-based smoke tests for the engine.
// Run with:  node --experimental-strip-types src/engine/engine.test.ts
// (No test framework needed — just throws on failure.)

import type { PlayState, PieceType } from './types';
import { emptyBoard, makePiece, idx, assembleBoard, validatePlacement } from './board';
import {
  allLegalMoves,
  legalMoves,
  makeMove,
  isInCheck,
  checkTermination,
  isSquareAttacked,
} from './moves';

let passed = 0;
function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(`FAIL: ${msg}`);
  passed += 1;
}

function fresh(board = emptyBoard(), turn: 'w' | 'b' = 'w'): PlayState {
  return { board, turn, enPassant: null, halfmoveClock: 0, fullmove: 1, history: [] };
}

// --- Pawn double-step only from home rank ---------------------------------
{
  const b = emptyBoard();
  b[idx(4, 1)] = makePiece('w', 'p'); // e2 pawn on home rank
  b[idx(4, 0)] = makePiece('w', 'p'); // e1 pawn on back rank (full-mode style)
  const st = fresh(b);
  const homeMoves = legalMoves(st, idx(4, 1)).map((m) => m.to);
  assert(homeMoves.includes(idx(4, 2)), 'home pawn can single-step');
  assert(homeMoves.includes(idx(4, 3)), 'home pawn can double-step');
  const backMoves = legalMoves(st, idx(4, 0)).map((m) => m.to);
  // e1 pawn's single-step to e2 is blocked by the e2 pawn.
  assert(backMoves.length === 0, 'back-rank pawn blocked by pawn ahead has no move');
}

// --- Knight movement -------------------------------------------------------
{
  const b = emptyBoard();
  b[idx(3, 3)] = makePiece('w', 'n'); // d4
  const st = fresh(b);
  const moves = legalMoves(st, idx(3, 3));
  assert(moves.length === 8, `central knight has 8 moves, got ${moves.length}`);
}

// --- Rook pretending: sliding + blocking -----------------------------------
{
  const b = emptyBoard();
  b[idx(0, 0)] = makePiece('w', 'r'); // a1
  b[idx(0, 3)] = makePiece('w', 'p'); // a4 friendly blocker
  const st = fresh(b);
  const moves = legalMoves(st, idx(0, 0)).map((m) => m.to);
  assert(moves.includes(idx(0, 1)) && moves.includes(idx(0, 2)), 'rook slides up file');
  assert(!moves.includes(idx(0, 3)), 'rook cannot capture friendly blocker');
  assert(!moves.includes(idx(0, 4)), 'rook blocked past friendly piece');
  assert(moves.includes(idx(7, 0)), 'rook slides along rank');
}

// --- Check detection + can't move into check -------------------------------
{
  const b = emptyBoard();
  b[idx(4, 0)] = makePiece('w', 'k'); // e1
  b[idx(4, 7)] = makePiece('b', 'r'); // e8 rook pins the e-file
  const st = fresh(b);
  assert(isInCheck(b, 'w'), 'white king in check from rook down the file');
  const kMoves = legalMoves(st, idx(4, 0)).map((m) => m.to);
  assert(!kMoves.includes(idx(4, 1)), 'king cannot stay on checked file');
  assert(kMoves.includes(idx(3, 0)) && kMoves.includes(idx(5, 0)), 'king steps off file');
}

// --- Back-rank checkmate ---------------------------------------------------
{
  const b = emptyBoard();
  b[idx(6, 0)] = makePiece('w', 'k'); // g1
  b[idx(5, 1)] = makePiece('w', 'p'); // f2
  b[idx(6, 1)] = makePiece('w', 'p'); // g2
  b[idx(7, 1)] = makePiece('w', 'p'); // h2
  b[idx(0, 0)] = makePiece('b', 'r'); // a1 delivers mate along the back rank
  const st = fresh(b, 'w');
  assert(isInCheck(b, 'w'), 'white in check');
  const term = checkTermination(st);
  assert(term.over && term.reason === 'checkmate' && term.winner === 'b', 'back-rank mate detected');
}

// --- En passant ------------------------------------------------------------
{
  const b = emptyBoard();
  b[idx(4, 4)] = makePiece('w', 'p'); // e5
  b[idx(4, 0)] = makePiece('w', 'k');
  b[idx(4, 7)] = makePiece('b', 'k');
  let st = fresh(b, 'b');
  // Black plays d7-d5 (double step) creating an en-passant target on d6.
  b[idx(3, 6)] = makePiece('b', 'p'); // d7
  st = fresh(st.board, 'b');
  const dMoves = legalMoves(st, idx(3, 6));
  const dbl = dMoves.find((m) => m.to === idx(3, 4));
  assert(!!dbl && !!dbl.isDouble, 'black pawn can double-step');
  const afterDbl = makeMove(st, dbl!);
  assert(afterDbl.enPassant === idx(3, 5), 'en-passant target set to d6');
  const epMoves = legalMoves(afterDbl, idx(4, 4));
  const ep = epMoves.find((m) => m.to === idx(3, 5) && m.isEnPassant);
  assert(!!ep, 'white can capture en passant');
  const afterEp = makeMove(afterDbl, ep!);
  assert(afterEp.board[idx(3, 4)] === null, 'captured pawn removed by en passant');
  assert(afterEp.board[idx(3, 5)]?.type === 'p', 'capturing pawn advanced to d6');
}

// --- Promotion -------------------------------------------------------------
{
  const b = emptyBoard();
  b[idx(0, 6)] = makePiece('w', 'p'); // a7
  b[idx(7, 0)] = makePiece('w', 'k');
  b[idx(7, 7)] = makePiece('b', 'k');
  const st = fresh(b, 'w');
  const moves = legalMoves(st, idx(0, 6));
  const promos = moves.filter((m) => m.to === idx(0, 7));
  assert(promos.length === 4, `4 promotion options, got ${promos.length}`);
  const q = promos.find((m) => m.promotion === 'q')!;
  const after = makeMove(st, q);
  assert(after.board[idx(0, 7)]?.type === 'q', 'pawn promoted to queen');
}

// --- Setup validation ------------------------------------------------------
{
  // 960: exactly the back-rank army on the home rank.
  const good: Record<number, PieceType> = {};
  const army: PieceType[] = ['r', 'n', 'b', 'q', 'k', 'b', 'n', 'r'];
  army.forEach((t, f) => (good[idx(f, 0)] = t));
  assert(validatePlacement('w', '960', good) === null, '960 valid placement passes');

  const missingKing = { ...good };
  missingKing[idx(4, 0)] = 'q'; // two queens, no king
  assert(validatePlacement('w', '960', missingKing) !== null, '960 wrong army rejected');

  const outside: Record<number, PieceType> = { ...good };
  delete outside[idx(0, 0)];
  outside[idx(0, 2)] = 'r'; // a piece on rank 3 (outside zone)
  assert(validatePlacement('w', '960', outside) !== null, 'placement outside zone rejected');
}

// --- Full assembly + a couple of legal moves exist -------------------------
{
  const wp: Record<number, PieceType> = {};
  const bp: Record<number, PieceType> = {};
  const army: PieceType[] = ['r', 'n', 'b', 'q', 'k', 'b', 'n', 'r'];
  army.forEach((t, f) => {
    wp[idx(f, 0)] = t;
    bp[idx(f, 7)] = t;
  });
  const board = assembleBoard('960', wp, bp);
  const st = fresh(board, 'w');
  assert(allLegalMoves(st).length > 0, 'assembled 960 board has legal moves');
  assert(!isSquareAttacked(board, idx(4, 3), 'b'), 'empty central square not attacked at start');
}

console.log(`\n  ✓ all ${passed} engine assertions passed\n`);
