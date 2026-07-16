import { useGame } from './game/useGame';
import { Menu } from './components/Menu';
import { SetupView } from './components/SetupView';
import { HandoffView } from './components/HandoffView';
import { PlayView } from './components/PlayView';
import { GameOverView } from './components/GameOverView';
import { formatTC } from './components/Menu';

export default function App() {
  const [state, dispatch] = useGame();

  if (state.phase === 'menu' || !state.config) {
    return (
      <div className="app">
        <Menu onStart={(config) => dispatch({ type: 'START_GAME', config })} />
      </div>
    );
  }

  const variantName = state.config.variant === '960' ? 'Back-Rank Design' : 'Free Placement';
  const modeName = state.config.mode === 'computer' ? 'vs Computer' : 'Pass & Play';

  return (
    <div className="app in-game">
      <header className="appbar">
        <button className="appbar-brand" onClick={() => dispatch({ type: 'NEW_GAME' })} title="Exit to menu">
          <span className="appbar-mark">?</span>
          <span>Hidden Chess</span>
        </button>
        <div className="appbar-meta">
          <span className="tag">{modeName}</span>
          {state.config.mode === 'computer' && (
            <span className="tag">
              {state.config.difficulty[0].toUpperCase() + state.config.difficulty.slice(1)}
            </span>
          )}
          <span className="tag">{variantName}</span>
          <span className="tag mono">{formatTC(state.config.time)}</span>
        </div>
      </header>

      <main className="stage">
        {state.phase === 'setup' && <SetupView state={state} dispatch={dispatch} />}
        {state.phase === 'handoff' && <HandoffView state={state} dispatch={dispatch} />}
        {state.phase === 'play' && <PlayView state={state} dispatch={dispatch} />}
        {state.phase === 'over' && (
          <>
            <PlayView state={state} dispatch={dispatch} />
            <GameOverView state={state} dispatch={dispatch} />
          </>
        )}
      </main>
    </div>
  );
}
