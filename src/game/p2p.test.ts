// Simulates two clients (host = White, guest = Black) exchanging the p2p
// message protocol through the reducer, and checks they stay perfectly in sync.
// Run via esbuild bundle (see package.json "test").

import { reducer, initialState, type GameState, type GameConfig, type Action } from './state';
import { allLegalMoves } from '../engine/moves';
import type { Color, PieceType } from '../engine/types';

let passed = 0;
function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(`FAIL: ${msg}`);
  passed += 1;
}

/** Colour+type per square, ignoring piece ids (which differ per client). */
function boardSig(s: GameState): string {
  return (s.play?.board ?? [])
    .map((p) => (p ? `${p.color}${p.type}` : '.'))
    .join('');
}

const baseConfig: GameConfig = {
  mode: 'p2p',
  variant: '960',
  time: { setupMinutes: 2, playMinutes: 5, incrementSeconds: 0 },
  humanColor: 'w',
  difficulty: 'balanced',
  hints: false,
};

// A fixed valid 960 back rank for each colour.
function placement(color: Color): Record<number, PieceType> {
  const rank = color === 'w' ? 0 : 7;
  const army: PieceType[] = ['r', 'n', 'b', 'q', 'k', 'b', 'n', 'r'];
  const p: Record<number, PieceType> = {};
  army.forEach((t, f) => (p[rank * 8 + f] = t));
  return p;
}

// Two independent reducer states.
let host: GameState = initialState;
let guest: GameState = initialState;
const toHost = (a: Action) => (host = reducer(host, a));
const toGuest = (a: Action) => (guest = reducer(guest, a));

// 1. Both start the game with their own localColor.
toHost({ type: 'START_GAME', config: { ...baseConfig, localColor: 'w' } });
toGuest({ type: 'START_GAME', config: { ...baseConfig, localColor: 'b' } });
assert(host.phase === 'setup' && host.setupColor === 'w', 'host sets up White');
assert(guest.phase === 'setup' && guest.setupColor === 'b', 'guest sets up Black');

// 2. Host designs White and submits -> message goes to guest.
host = { ...host, placements: { ...host.placements, w: placement('w') } };
toHost({ type: 'SETUP_SUBMIT' });
assert(host.phase === 'waiting', 'host waits after submitting first');
toGuest({ type: 'P2P_REMOTE_SETUP', color: 'w', placement: placement('w') });
assert(guest.phase === 'setup', 'guest still designing after receiving White');

// 3. Guest designs Black and submits -> both should now be in play.
guest = { ...guest, placements: { ...guest.placements, b: placement('b') } };
toGuest({ type: 'SETUP_SUBMIT' });
assert(guest.phase === 'play', 'guest enters play once both are set');
toHost({ type: 'P2P_REMOTE_SETUP', color: 'b', placement: placement('b') });
assert(host.phase === 'play', 'host enters play once both are set');

assert(boardSig(host) === boardSig(guest), 'both clients assemble the same board');
assert(host.play!.turn === 'w' && guest.play!.turn === 'w', 'White to move on both');

// 4. Exchange a few moves; boards must remain identical.
for (let i = 0; i < 6; i++) {
  const mover = host.play!.turn; // same on both
  const src = mover === 'w' ? host : guest; // the client whose turn it is
  const moves = allLegalMoves(src.play!);
  assert(moves.length > 0, `legal moves exist on move ${i}`);
  const move = moves[i % moves.length];
  // Local client applies + "sends"; the other applies the same move.
  if (mover === 'w') {
    toHost({ type: 'MOVE', move });
    toGuest({ type: 'MOVE', move });
  } else {
    toGuest({ type: 'MOVE', move });
    toHost({ type: 'MOVE', move });
  }
  assert(boardSig(host) === boardSig(guest), `boards match after move ${i}`);
  assert(host.play!.turn === guest.play!.turn, `turn matches after move ${i}`);
}

// 5. A resign is mirrored to the same result on both clients.
toHost({ type: 'RESIGN', color: 'w' });
toGuest({ type: 'RESIGN', color: 'w' });
assert(host.phase === 'over' && guest.phase === 'over', 'both end on resign');
assert(
  host.result?.kind === 'resign' && host.result.winner === 'b' &&
    guest.result?.kind === 'resign' && guest.result.winner === 'b',
  'both agree Black wins by resignation',
);

console.log(`\n  ✓ all ${passed} p2p-sync assertions passed\n`);
