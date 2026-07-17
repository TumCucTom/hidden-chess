import { useGame } from './game/useGame';
import { Menu, formatTC } from './components/Menu';
import { SetupView } from './components/SetupView';
import { HandoffView } from './components/HandoffView';
import { WaitingView } from './components/WaitingView';
import { PlayView } from './components/PlayView';
import { GameOverView } from './components/GameOverView';
import { Lobby } from './components/Lobby';

export default function App() {
  const { state, dispatch, net, host, join, leave } = useGame();

  // Before a game starts, a p2p connection shows the lobby (code / connecting / error).
  const inLobby =
    state.phase === 'menu' &&
    (net.kind === 'hosting' || net.kind === 'joining' || net.kind === 'error');

  if (state.phase === 'menu' || !state.config) {
    return (
      <div className="app">
        {inLobby ? (
          <Lobby net={net} onCancel={leave} />
        ) : (
          <Menu
            onStart={(config) => dispatch({ type: 'START_GAME', config })}
            onHost={host}
            onJoin={join}
          />
        )}
      </div>
    );
  }

  const modeName =
    state.config.mode === 'computer'
      ? 'vs Computer'
      : state.config.mode === 'p2p'
        ? 'Online'
        : 'Pass & Play';
  const variantName = state.config.variant === '960' ? 'Back-Rank Design' : 'Free Placement';

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
        {state.phase === 'waiting' && <WaitingView />}
        {state.phase === 'play' && <PlayView state={state} dispatch={dispatch} />}
        {state.phase === 'over' && (
          <>
            <PlayView state={state} dispatch={dispatch} />
            <GameOverView state={state} dispatch={dispatch} />
          </>
        )}
      </main>

      {net.kind === 'closed' && state.phase !== 'over' && (
        <div className="over-overlay">
          <div className="over-card">
            <h2>Opponent left</h2>
            <p>The connection to your opponent was closed.</p>
            <div className="over-actions">
              <button className="btn primary" onClick={leave}>
                Back to menu
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
