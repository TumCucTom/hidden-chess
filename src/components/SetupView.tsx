import { useMemo, useState } from 'react';
import type { PieceType } from '../engine/types';
import type { GameState, Action } from '../game/state';
import {
  placementSquares,
  fixedPawnSquares,
  remainingPieces,
  validatePlacement,
} from '../engine/board';
import { Piece, PIECE_NAMES } from './Piece';
import { BoardGrid, type SquareDeco } from './BoardGrid';
import { formatClock } from './format';

// ---------------------------------------------------------------------------
// The setup / army-design phase. The active player arranges their pieces in
// their placement zone while their setup clock counts down.
// ---------------------------------------------------------------------------

type Held = { kind: 'tray'; type: PieceType } | { kind: 'board'; square: number } | null;

const TRAY_ORDER: PieceType[] = ['k', 'q', 'r', 'b', 'n', 'p'];

interface SetupViewProps {
  state: GameState;
  dispatch: React.Dispatch<Action>;
}

export function SetupView({ state, dispatch }: SetupViewProps) {
  const color = state.setupColor;
  const variant = state.config!.variant;
  const placement = state.placements[color];
  const [held, setHeld] = useState<Held>(null);

  const zone = useMemo(() => new Set(placementSquares(color, variant)), [color, variant]);
  const fixedPawns = useMemo(
    () => (variant === '960' ? new Set(fixedPawnSquares(color)) : new Set<number>()),
    [variant, color],
  );

  const remaining = remainingPieces(variant, placement);
  const remainingCount = remaining.reduce<Record<string, number>>((acc, t) => {
    acc[t] = (acc[t] ?? 0) + 1;
    return acc;
  }, {});
  const validationError = validatePlacement(color, variant, placement);
  const ready = validationError === null;

  const placeStickyOrClear = (type: PieceType) => {
    // Keep the tray type selected while more of it remain (fast pawn placement).
    const left = (remainingCount[type] ?? 0) - 1;
    setHeld(left > 0 ? { kind: 'tray', type } : null);
  };

  const onSquareClick = (sq: number) => {
    const occupant = placement[sq];
    const inZone = zone.has(sq);

    if (occupant != null) {
      // Clicking a placed piece.
      if (held && held.kind === 'board' && held.square === sq) {
        dispatch({ type: 'SETUP_REMOVE', square: sq }); // second click removes
        setHeld(null);
      } else {
        setHeld({ kind: 'board', square: sq }); // lift it
      }
      return;
    }

    if (!inZone) {
      setHeld(null);
      return;
    }

    // Empty legal square.
    if (held?.kind === 'tray') {
      dispatch({ type: 'SETUP_PLACE', square: sq, pieceType: held.type });
      placeStickyOrClear(held.type);
    } else if (held?.kind === 'board') {
      dispatch({ type: 'SETUP_MOVE', from: held.square, to: sq });
      setHeld(null);
    }
  };

  const decoFor = (sq: number): SquareDeco => {
    const classes: string[] = [];
    const isFixed = fixedPawns.has(sq);
    if (zone.has(sq)) classes.push('in-zone');
    else if (isFixed) classes.push('fixed-pawn');
    else classes.push('out-of-zone');
    if (held?.kind === 'board' && held.square === sq) classes.push('selected');
    const showHint = zone.has(sq) && placement[sq] == null && held != null;
    return { className: classes.join(' '), overlay: showHint ? 'dot' : null };
  };

  const renderPiece = (sq: number) => {
    const type = placement[sq];
    if (type != null) return <Piece color={color} type={type} />;
    if (fixedPawns.has(sq)) return <Piece color={color} type="p" />; // fixed pawn preview
    return null;
  };

  const colorName = color === 'w' ? 'White' : 'Black';
  const setupMs = state.setupClock[color];
  const lowTime = setupMs < 15_000;

  return (
    <div className="setup">
      <div className="setup-head">
        <div className="setup-title">
          <span className={`turn-dot ${color === 'w' ? 'white' : 'black'}`} />
          <div>
            <h2>{colorName}: design your army</h2>
            <p>
              {variant === '960'
                ? 'Arrange your 8 back-rank pieces. Your pawns are fixed on the 2nd rank.'
                : 'Place all 16 pieces anywhere across your back two ranks.'}
            </p>
          </div>
        </div>
        <div className={`setup-clock ${lowTime ? 'low' : ''}`}>
          <span className="clock-label">Setup time</span>
          <span className="clock-value">{formatClock(setupMs)}</span>
        </div>
      </div>

      <div className="setup-body">
        <BoardGrid
          orientation={color}
          renderPiece={renderPiece}
          decoFor={decoFor}
          onSquareClick={onSquareClick}
          className="setup-board"
        />

        <div className="setup-side">
          <div className="tray">
            <h3>Your pieces</h3>
            <div className="tray-grid">
              {TRAY_ORDER.map((type) => {
                const count = remainingCount[type] ?? 0;
                if (variant === '960' && type === 'p') return null; // pawns fixed
                const total = armyCount(variant, type);
                if (total === 0) return null;
                const selected = held?.kind === 'tray' && held.type === type;
                return (
                  <button
                    key={type}
                    className={`tray-piece ${selected ? 'active' : ''} ${count === 0 ? 'depleted' : ''}`}
                    disabled={count === 0}
                    onClick={() => setHeld(selected ? null : { kind: 'tray', type })}
                    title={PIECE_NAMES[type]}
                  >
                    <span className="tray-icon">
                      <Piece color={color} type={type} />
                    </span>
                    <span className="tray-count">{count}</span>
                  </button>
                );
              })}
            </div>
            <p className="tray-hint">
              {held?.kind === 'tray'
                ? `Tap a highlighted square to place your ${PIECE_NAMES[held.type]}.`
                : held?.kind === 'board'
                  ? 'Tap an empty square to move it, or tap it again to remove.'
                  : 'Tap a piece, then tap a square. Tap a placed piece to move or remove it.'}
            </p>
          </div>

          <div className="setup-actions">
            <button className="btn" onClick={() => dispatch({ type: 'SETUP_RANDOM' })}>
              🎲 Random
            </button>
            <button
              className="btn"
              onClick={() => {
                dispatch({ type: 'SETUP_CLEAR' });
                setHeld(null);
              }}
            >
              Clear
            </button>
          </div>

          <button
            className="btn primary ready-btn"
            disabled={!ready}
            onClick={() => dispatch({ type: 'SETUP_SUBMIT' })}
          >
            {ready ? 'Ready ✓' : validationError}
          </button>
        </div>
      </div>
    </div>
  );
}

function armyCount(variant: 'full' | '960', type: PieceType): number {
  const counts: Record<PieceType, number> =
    variant === '960'
      ? { k: 1, q: 1, r: 2, b: 2, n: 2, p: 0 }
      : { k: 1, q: 1, r: 2, b: 2, n: 2, p: 8 };
  return counts[type];
}
