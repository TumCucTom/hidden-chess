import { useMemo, useState } from 'react';
import type { Board, Color, Move, PieceType } from '../engine/types';
import type { GameState, Action } from '../game/state';
import { currentViewer, orientation, allRevealed } from '../game/state';
import { squareName } from '../engine/board';
import { legalMoves, isInCheck, findKing } from '../engine/moves';
import { inferBelief } from '../engine/belief';
import { Piece } from './Piece';
import { BoardGrid, type SquareDeco } from './BoardGrid';
import { formatClock } from './format';

// ---------------------------------------------------------------------------
// The play phase: the board, both clocks, move history, revealed captures,
// and game controls. Opponent pieces render face-down until captured.
// ---------------------------------------------------------------------------

const PIECE_VALUE: Record<PieceType, number> = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 };

interface PlayViewProps {
  state: GameState;
  dispatch: React.Dispatch<Action>;
}

export function PlayView({ state, dispatch }: PlayViewProps) {
  const play = state.play!;
  const config = state.config!;
  const viewer = currentViewer(state);
  const orient = orientation(state);
  const revealed = allRevealed(state);

  const [selected, setSelected] = useState<number | null>(null);
  const [promo, setPromo] = useState<{ to: number; moves: Move[] } | null>(null);

  const botColor: Color | null = config.mode === 'computer' ? (config.humanColor === 'w' ? 'b' : 'w') : null;
  const botThinking = botColor != null && play.turn === botColor && state.phase === 'play';

  const canInteract =
    state.phase === 'play' &&
    !promo &&
    (config.mode === 'pass' || play.turn === config.humanColor);

  const targets = useMemo<Move[]>(
    () => (selected != null ? legalMoves(play, selected) : []),
    [selected, play],
  );
  const targetSquares = useMemo(() => new Map(targets.map((m) => [m.to, m])), [targets]);

  const inCheck = isInCheck(play.board, play.turn);
  const checkSquare = inCheck ? findKing(play.board, play.turn) : -1;

  // Deduction hints: for each enemy piece that has moved, the types it could be.
  const opponent: Color = viewer === 'w' ? 'b' : 'w';
  const hintMap = useMemo(() => {
    const m = new Map<number, PieceType[]>();
    if (!config.hints || revealed) return m;
    for (const pc of inferBelief(play, opponent, config.variant).pieces) {
      if (pc.moved) m.set(pc.square, pc.allowed);
    }
    return m;
  }, [config.hints, revealed, play, opponent, config.variant]);

  const resetSelection = () => {
    setSelected(null);
  };

  const onSquareClick = (sq: number) => {
    if (!canInteract) return;
    const piece = play.board[sq];

    // Clicking a legal destination for the selected piece.
    if (selected != null && targetSquares.has(sq)) {
      const matching = targets.filter((m) => m.to === sq);
      if (matching[0].promotion) {
        setPromo({ to: sq, moves: matching });
      } else {
        dispatch({ type: 'MOVE', move: matching[0] });
        resetSelection();
      }
      return;
    }

    // Selecting / reselecting one of the side-to-move's own pieces.
    if (piece && piece.color === play.turn) {
      setSelected(sq === selected ? null : sq);
      return;
    }

    resetSelection();
  };

  const choosePromotion = (type: PieceType) => {
    if (!promo) return;
    const move = promo.moves.find((m) => m.promotion === type);
    if (move) dispatch({ type: 'MOVE', move });
    setPromo(null);
    resetSelection();
  };

  const decoFor = (sq: number): SquareDeco => {
    const classes: string[] = [];
    if (state.lastMove && (state.lastMove.from === sq || state.lastMove.to === sq)) {
      classes.push('last-move');
    }
    if (sq === selected) classes.push('selected');
    if (sq === checkSquare) classes.push('check');
    let overlay: 'dot' | 'ring' | null = null;
    if (targetSquares.has(sq)) overlay = play.board[sq] ? 'ring' : 'dot';
    return { className: classes.join(' '), overlay };
  };

  const renderPiece = (sq: number) => {
    const piece = play.board[sq];
    if (!piece) return null;
    const showReal = revealed || piece.color === viewer;
    if (showReal) return <Piece color={piece.color} type={piece.type} />;
    const hint = hintMap.get(sq);
    return (
      <>
        <Piece color={piece.color} type={piece.type} hidden />
        {hint && <HintBadge types={hint} />}
      </>
    );
  };

  // Captured material (revealed). White's captures are black pieces, etc.
  const captured = useMemo(() => collectCaptured(play.history), [play.history]);
  const material = materialDiff(play.board);

  const topColor = orient === 'w' ? 'b' : 'w';
  const bottomColor = orient;

  const statusText = botThinking
    ? 'Opponent is thinking…'
    : inCheck
      ? 'Check!'
      : `${play.turn === 'w' ? 'White' : 'Black'} to move`;

  return (
    <div className="play">
      <div className="board-column">
        <PlayerBar
          color={topColor}
          config={config}
          clockMs={state.clock[topColor]}
          active={play.turn === topColor}
          captured={captured[topColor]}
          advantage={topColor === 'w' ? material : -material}
        />

        <div className="board-wrap">
          <BoardGrid
            orientation={orient}
            renderPiece={renderPiece}
            decoFor={decoFor}
            onSquareClick={onSquareClick}
            className={botThinking ? 'thinking' : ''}
          />
          {promo && (
            <PromotionDialog color={play.turn} onChoose={choosePromotion} onCancel={() => setPromo(null)} />
          )}
        </div>

        <PlayerBar
          color={bottomColor}
          config={config}
          clockMs={state.clock[bottomColor]}
          active={play.turn === bottomColor}
          captured={captured[bottomColor]}
          advantage={bottomColor === 'w' ? material : -material}
        />
      </div>

      <aside className="panel">
        <div className="panel-status">
          <span className={`status-dot ${play.turn === 'w' ? 'white' : 'black'} ${inCheck ? 'check' : ''}`} />
          {statusText}
        </div>

        <button
          className={`hint-toggle ${config.hints ? 'on' : ''}`}
          onClick={() => dispatch({ type: 'TOGGLE_HINTS' })}
          title="Mark moved enemy pieces with the types they could be"
        >
          💡 Deduction hints: <strong>{config.hints ? 'On' : 'Off'}</strong>
        </button>

        <MoveList history={play.history} />

        <div className="panel-controls">
          {config.mode === 'pass' && (
            <button className="btn" onClick={() => dispatch({ type: 'DRAW' })}>
              ½ Draw
            </button>
          )}
          <button
            className="btn danger"
            onClick={() => {
              const who = config.mode === 'computer' ? config.humanColor : play.turn;
              dispatch({ type: 'RESIGN', color: who });
            }}
          >
            Resign
          </button>
          <button className="btn" onClick={() => dispatch({ type: 'NEW_GAME' })}>
            Exit
          </button>
        </div>
      </aside>
    </div>
  );
}

function PlayerBar({
  color,
  config,
  clockMs,
  active,
  captured,
  advantage,
}: {
  color: Color;
  config: GameState['config'];
  clockMs: number;
  active: boolean;
  captured: PieceType[];
  advantage: number;
}) {
  const isBot = config?.mode === 'computer' && config.humanColor !== color;
  const name = isBot ? 'Computer' : color === 'w' ? 'White' : 'Black';
  const low = clockMs < 15_000 && active;

  return (
    <div className={`player-bar ${active ? 'active' : ''}`}>
      <div className="player-info">
        <span className={`turn-dot ${color === 'w' ? 'white' : 'black'}`} />
        <span className="player-name">{name}</span>
        <span className="captured-row">
          {captured.map((t, i) => (
            <span className="cap" key={i}>
              <Piece color={color === 'w' ? 'b' : 'w'} type={t} />
            </span>
          ))}
          {advantage > 0 && <span className="advantage">+{advantage}</span>}
        </span>
      </div>
      <div className={`clock ${active ? 'active' : ''} ${low ? 'low' : ''}`}>
        {formatClock(clockMs)}
      </div>
    </div>
  );
}

function MoveList({ history }: { history: Move[] }) {
  const rows: { n: number; w?: Move; b?: Move }[] = [];
  history.forEach((m, i) => {
    const row = Math.floor(i / 2);
    if (!rows[row]) rows[row] = { n: row + 1 };
    if (i % 2 === 0) rows[row].w = m;
    else rows[row].b = m;
  });

  return (
    <div className="move-list">
      <div className="move-list-head">Moves</div>
      <div className="move-list-body">
        {rows.length === 0 && <div className="move-empty">No moves yet.</div>}
        {rows.map((r) => (
          <div className="move-row" key={r.n}>
            <span className="move-num">{r.n}.</span>
            <span className="move-cell">{r.w ? notate(r.w) : ''}</span>
            <span className="move-cell">{r.b ? notate(r.b) : ''}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// Type-hidden coordinate notation so the move list never leaks piece identity.
function notate(m: Move): string {
  const sep = m.captured != null ? '×' : '–';
  const promo = m.promotion ? '=?' : '';
  const suffix = m.givesMate ? '#' : m.givesCheck ? '+' : '';
  return `${squareName(m.from)}${sep}${squareName(m.to)}${promo}${suffix}`;
}

// Order used when listing a piece's possible identities (strongest first).
const HINT_ORDER: PieceType[] = ['k', 'q', 'r', 'b', 'n', 'p'];

function HintBadge({ types }: { types: PieceType[] }) {
  const label = HINT_ORDER.filter((t) => types.includes(t))
    .map((t) => t.toUpperCase())
    .join('');
  return <span className="hint-badge">{label}</span>;
}

function PromotionDialog({
  color,
  onChoose,
  onCancel,
}: {
  color: Color;
  onChoose: (t: PieceType) => void;
  onCancel: () => void;
}) {
  return (
    <div className="promo-overlay" onClick={onCancel}>
      <div className="promo-dialog" onClick={(e) => e.stopPropagation()}>
        <span className="promo-title">Promote to</span>
        <div className="promo-choices">
          {(['q', 'r', 'b', 'n'] as PieceType[]).map((t) => (
            <button key={t} className="promo-choice" onClick={() => onChoose(t)}>
              <Piece color={color} type={t} />
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function collectCaptured(history: Move[]): Record<Color, PieceType[]> {
  const out: Record<Color, PieceType[]> = { w: [], b: [] };
  for (const m of history) {
    if (m.captured != null) out[m.color].push(m.captured);
  }
  const order: PieceType[] = ['q', 'r', 'b', 'n', 'p'];
  const sortByValue = (a: PieceType, b: PieceType) => order.indexOf(a) - order.indexOf(b);
  out.w.sort(sortByValue);
  out.b.sort(sortByValue);
  return out;
}

/** Material difference (white minus black) in pawn units. */
function materialDiff(board: Board): number {
  let diff = 0;
  for (const sq of board) {
    if (!sq) continue;
    diff += sq.color === 'w' ? PIECE_VALUE[sq.type] : -PIECE_VALUE[sq.type];
  }
  return diff;
}
