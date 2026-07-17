import type { GameResult } from '../engine/types';
import type { GameState, Action } from '../game/state';

// ---------------------------------------------------------------------------
// Result modal shown over the fully-revealed final board.
// ---------------------------------------------------------------------------

interface GameOverViewProps {
  state: GameState;
  dispatch: React.Dispatch<Action>;
}

function describe(result: GameResult, botColor: 'w' | 'b' | null): { title: string; sub: string; won: 'w' | 'b' | null } {
  const name = (c: 'w' | 'b') => (c === botColor ? 'Computer' : c === 'w' ? 'White' : 'Black');
  switch (result.kind) {
    case 'checkmate':
      return { title: `${name(result.winner)} wins`, sub: 'by checkmate', won: result.winner };
    case 'timeout':
      return { title: `${name(result.winner)} wins`, sub: 'on time', won: result.winner };
    case 'resign':
      return { title: `${name(result.winner)} wins`, sub: 'by resignation', won: result.winner };
    case 'stalemate':
      return { title: 'Draw', sub: 'by stalemate', won: null };
    case 'fifty-move':
      return { title: 'Draw', sub: 'by the 50-move rule', won: null };
    case 'insufficient':
      return { title: 'Draw', sub: 'insufficient material', won: null };
    case 'agreed-draw':
      return { title: 'Draw', sub: 'agreed', won: null };
  }
}

export function GameOverView({ state, dispatch }: GameOverViewProps) {
  if (!state.result) return null;
  const botColor = state.config?.mode === 'computer'
    ? (state.config.humanColor === 'w' ? 'b' : 'w')
    : null;
  const { title, sub, won } = describe(state.result, botColor);

  return (
    <div className="over-overlay">
      <div className="over-card">
        {won && <span className={`turn-dot big ${won === 'w' ? 'white' : 'black'}`} />}
        {!won && <span className="draw-mark">½–½</span>}
        <h2>{title}</h2>
        <p>{sub}</p>
        <p className="over-note">All pieces are now revealed — watch the replay to see how it unfolded.</p>
        <div className="over-actions">
          <button className="btn primary" onClick={() => dispatch({ type: 'REVIEW_ENTER' })}>
            ▶ Watch replay
          </button>
          <button className="btn" onClick={() => dispatch({ type: 'REMATCH' })}>
            Rematch
          </button>
          <button className="btn" onClick={() => dispatch({ type: 'NEW_GAME' })}>
            New Game
          </button>
        </div>
      </div>
    </div>
  );
}
