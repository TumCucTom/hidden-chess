import type {
  Color,
  Difficulty,
  GameResult,
  Mode,
  Move,
  PieceType,
  PlayState,
  TimeControl,
  Variant,
} from '../engine/types';
import { assembleBoard, placementSquares, remainingPieces } from '../engine/board';
import {
  makeMove,
  checkTermination,
  isInsufficientMaterial,
} from '../engine/moves';
import { randomPlacement, smartPlacement, reseed, DIFFICULTY } from '../engine/ai';

// ---------------------------------------------------------------------------
// Top-level game state machine. Phases:
//   menu   -> configure a game
//   setup  -> a player arranges their army (their setup clock ticks)
//   handoff-> "pass the device" privacy screen (pass-and-play only)
//   play   -> normal play with the side-to-move's clock ticking
//   over   -> result shown, all pieces revealed
// ---------------------------------------------------------------------------

export interface GameConfig {
  variant: Variant;
  mode: Mode;
  time: TimeControl;
  /** In computer mode, the colour the human plays. Ignored in pass mode. */
  humanColor: Color;
  /** Computer strength. Only meaningful in computer mode. */
  difficulty: Difficulty;
  /** Show deduction hints: mark moved opponent pieces with their possible types. */
  hints: boolean;
}

export type Phase = 'menu' | 'setup' | 'handoff' | 'play' | 'over';

export interface GameState {
  phase: Phase;
  config: GameConfig | null;

  placements: Record<Color, Record<number, PieceType>>;
  setupClock: Record<Color, number>; // ms remaining
  setupDone: Record<Color, boolean>;
  setupColor: Color; // whose setup is currently active

  play: PlayState | null;
  clock: Record<Color, number>; // ms remaining
  lastMove: { from: number; to: number } | null;

  handoffTo: Color | null;
  afterHandoff: 'setup' | 'play' | null;

  result: GameResult | null;
  /** Bumps each game so effects (seeding etc.) can react to a new game. */
  gameId: number;
}

export type Action =
  | { type: 'START_GAME'; config: GameConfig }
  | { type: 'SETUP_PLACE'; square: number; pieceType: PieceType }
  | { type: 'SETUP_REMOVE'; square: number }
  | { type: 'SETUP_MOVE'; from: number; to: number }
  | { type: 'SETUP_RANDOM' }
  | { type: 'SETUP_CLEAR' }
  | { type: 'SETUP_SUBMIT' }
  | { type: 'HANDOFF_CONTINUE' }
  | { type: 'MOVE'; move: Move }
  | { type: 'RESIGN'; color: Color }
  | { type: 'DRAW' }
  | { type: 'TICK'; elapsed: number }
  | { type: 'TOGGLE_HINTS' }
  | { type: 'NEW_GAME' }
  | { type: 'REMATCH' };

const other = (c: Color): Color => (c === 'w' ? 'b' : 'w');

export const initialState: GameState = {
  phase: 'menu',
  config: null,
  placements: { w: {}, b: {} },
  setupClock: { w: 0, b: 0 },
  setupDone: { w: false, b: false },
  setupColor: 'w',
  play: null,
  clock: { w: 0, b: 0 },
  lastMove: null,
  handoffTo: null,
  afterHandoff: null,
  result: null,
  gameId: 0,
};

/** Fill any unplaced pieces into empty legal squares to make a valid army. */
function completePlacement(
  color: Color,
  variant: Variant,
  placement: Record<number, PieceType>,
): Record<number, PieceType> {
  const legal = placementSquares(color, variant);
  const occupied = new Set(Object.keys(placement).map(Number));
  const empty = legal.filter((sq) => !occupied.has(sq));
  const remaining = remainingPieces(variant, placement);
  // remaining.length === empty.length by construction of a valid army.
  const merged = { ...placement };
  empty.forEach((sq, i) => {
    if (remaining[i] != null) merged[sq] = remaining[i];
  });
  return merged;
}

/** Build initial setup-phase fields for a fresh game with the given config. */
function initSetupFields(config: GameConfig, gameId: number): GameState {
  reseed(0x1234abcd ^ (gameId * 2654435761));
  const unlimited = config.time.unlimited === true;
  const setupMs = unlimited ? Infinity : config.time.setupMinutes * 60_000;
  const playMs = unlimited ? Infinity : config.time.playMinutes * 60_000;
  const placements: Record<Color, Record<number, PieceType>> = { w: {}, b: {} };
  const setupDone: Record<Color, boolean> = { w: false, b: false };

  let setupColor: Color = 'w';
  if (config.mode === 'computer') {
    const bot = other(config.humanColor);
    placements[bot] = smartPlacement(bot, config.variant, DIFFICULTY[config.difficulty].setupCandidates);
    setupDone[bot] = true;
    setupColor = config.humanColor;
  }

  return {
    ...initialState,
    phase: 'setup',
    config,
    placements,
    setupClock: { w: setupMs, b: setupMs },
    setupDone,
    setupColor,
    clock: { w: playMs, b: playMs },
    gameId,
  };
}

/** Transition from a completed setup into play (or a handoff before play). */
function beginPlay(state: GameState): GameState {
  const config = state.config!;
  const board = assembleBoard(config.variant, state.placements.w, state.placements.b);
  const play: PlayState = {
    board,
    turn: 'w',
    enPassant: null,
    halfmoveClock: 0,
    fullmove: 1,
    history: [],
  };
  const base: GameState = { ...state, play, lastMove: null };

  if (config.mode === 'pass') {
    // The device is currently with Black (who set up last); hand off to White.
    return { ...base, phase: 'handoff', handoffTo: 'w', afterHandoff: 'play' };
  }
  return { ...base, phase: 'play', handoffTo: null, afterHandoff: null };
}

/** Lock in the active player's setup and advance the state machine. */
function submitSetup(state: GameState): GameState {
  const config = state.config!;
  const color = state.setupColor;
  const setupDone = { ...state.setupDone, [color]: true };
  const next = { ...state, setupDone };

  if (config.mode === 'computer') {
    return beginPlay(next);
  }

  // pass mode
  const opp = other(color);
  if (!setupDone[opp]) {
    // Hand off to the opponent to set up.
    return {
      ...next,
      phase: 'handoff',
      handoffTo: opp,
      afterHandoff: 'setup',
      setupColor: opp,
    };
  }
  return beginPlay(next);
}

/** Apply a play move, handle increment, terminations, and pass-mode handoff. */
function applyMove(state: GameState, move: Move): GameState {
  const config = state.config!;
  const play = state.play!;
  const mover = play.turn;
  const nextPlay = makeMove(play, move);

  // Fischer increment: add after completing the move.
  const inc = config.time.incrementSeconds * 1000;
  const clock = { ...state.clock, [mover]: state.clock[mover] + inc };

  const withMove: GameState = {
    ...state,
    play: nextPlay,
    clock,
    lastMove: { from: move.from, to: move.to },
  };

  // Natural terminations.
  const term = checkTermination(nextPlay);
  if (term.over) {
    const result: GameResult =
      term.reason === 'checkmate'
        ? { kind: 'checkmate', winner: term.winner! }
        : { kind: 'stalemate' };
    return { ...withMove, phase: 'over', result, handoffTo: null, afterHandoff: null };
  }
  if (nextPlay.halfmoveClock >= 100) {
    return { ...withMove, phase: 'over', result: { kind: 'fifty-move' } };
  }
  if (isInsufficientMaterial(nextPlay.board)) {
    return { ...withMove, phase: 'over', result: { kind: 'insufficient' } };
  }

  if (config.mode === 'pass') {
    return {
      ...withMove,
      phase: 'handoff',
      handoffTo: nextPlay.turn,
      afterHandoff: 'play',
    };
  }
  return withMove;
}

export function reducer(state: GameState, action: Action): GameState {
  switch (action.type) {
    case 'START_GAME':
      return initSetupFields(action.config, state.gameId + 1);

    case 'SETUP_PLACE': {
      if (state.phase !== 'setup') return state;
      const color = state.setupColor;
      const current = state.placements[color];
      // Only place if we still have a piece of this type available.
      const remaining = remainingPieces(state.config!.variant, current);
      if (!remaining.includes(action.pieceType)) return state;
      const placement = { ...current, [action.square]: action.pieceType };
      return { ...state, placements: { ...state.placements, [color]: placement } };
    }

    case 'SETUP_REMOVE': {
      if (state.phase !== 'setup') return state;
      const color = state.setupColor;
      const placement = { ...state.placements[color] };
      delete placement[action.square];
      return { ...state, placements: { ...state.placements, [color]: placement } };
    }

    case 'SETUP_MOVE': {
      if (state.phase !== 'setup') return state;
      const color = state.setupColor;
      const placement = { ...state.placements[color] };
      const piece = placement[action.from];
      if (piece == null) return state;
      delete placement[action.from];
      placement[action.to] = piece;
      return { ...state, placements: { ...state.placements, [color]: placement } };
    }

    case 'SETUP_RANDOM': {
      if (state.phase !== 'setup') return state;
      const color = state.setupColor;
      const placement = randomPlacement(color, state.config!.variant);
      return { ...state, placements: { ...state.placements, [color]: placement } };
    }

    case 'SETUP_CLEAR': {
      if (state.phase !== 'setup') return state;
      const color = state.setupColor;
      return { ...state, placements: { ...state.placements, [color]: {} } };
    }

    case 'SETUP_SUBMIT':
      if (state.phase !== 'setup') return state;
      return submitSetup(state);

    case 'HANDOFF_CONTINUE': {
      if (state.phase !== 'handoff') return state;
      const target = state.afterHandoff ?? 'play';
      return { ...state, phase: target, handoffTo: null, afterHandoff: null };
    }

    case 'MOVE':
      if (state.phase !== 'play' || !state.play) return state;
      return applyMove(state, action.move);

    case 'RESIGN':
      if (state.phase !== 'play' && state.phase !== 'handoff') return state;
      return {
        ...state,
        phase: 'over',
        result: { kind: 'resign', winner: other(action.color) },
      };

    case 'DRAW':
      if (state.phase !== 'play' && state.phase !== 'handoff') return state;
      return { ...state, phase: 'over', result: { kind: 'agreed-draw' } };

    case 'TICK':
      return tick(state, action.elapsed);

    case 'TOGGLE_HINTS':
      if (!state.config) return state;
      return { ...state, config: { ...state.config, hints: !state.config.hints } };

    case 'NEW_GAME':
      return { ...initialState, gameId: state.gameId };

    case 'REMATCH':
      if (!state.config) return state;
      return initSetupFields(state.config, state.gameId + 1);

    default:
      return state;
  }
}

/** Decrement the active clock by `elapsed` ms and handle flag-falls. */
function tick(state: GameState, elapsed: number): GameState {
  if (state.config?.time.unlimited) return state; // no clocks in unlimited mode

  if (state.phase === 'setup') {
    const color = state.setupColor;
    if (state.setupDone[color]) return state;
    const remainingMs = state.setupClock[color] - elapsed;
    if (remainingMs <= 0) {
      // Setup flag fell: auto-complete this player's army and lock in.
      const completed = completePlacement(color, state.config!.variant, state.placements[color]);
      const filled: GameState = {
        ...state,
        placements: { ...state.placements, [color]: completed },
        setupClock: { ...state.setupClock, [color]: 0 },
      };
      return submitSetup(filled);
    }
    return { ...state, setupClock: { ...state.setupClock, [color]: remainingMs } };
  }

  if (state.phase === 'play' && state.play) {
    const color = state.play.turn;
    const remainingMs = state.clock[color] - elapsed;
    if (remainingMs <= 0) {
      return {
        ...state,
        clock: { ...state.clock, [color]: 0 },
        phase: 'over',
        result: { kind: 'timeout', winner: other(color) },
      };
    }
    return { ...state, clock: { ...state.clock, [color]: remainingMs } };
  }

  return state;
}

// --- Selectors -------------------------------------------------------------

/** Which colour's pieces the person currently at the device should see truly. */
export function currentViewer(state: GameState): Color {
  if (state.phase === 'over') return state.play?.turn ?? 'w';
  if (state.config?.mode === 'computer') return state.config.humanColor;
  if (state.phase === 'setup') return state.setupColor;
  if (state.phase === 'handoff') return state.handoffTo ?? 'w';
  return state.play?.turn ?? 'w';
}

/** Board orientation (which colour sits at the bottom). */
export function orientation(state: GameState): Color {
  if (state.config?.mode === 'computer') return state.config.humanColor;
  if (state.phase === 'setup') return state.setupColor;
  if (state.phase === 'handoff') return state.handoffTo ?? 'w';
  if (state.play) return state.play.turn;
  return 'w';
}

/** True when the game reveals every piece (game over). */
export function allRevealed(state: GameState): boolean {
  return state.phase === 'over';
}
