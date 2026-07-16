import type { GameState, Action } from '../game/state';

// ---------------------------------------------------------------------------
// Privacy handoff for pass-and-play: covers the board while the device changes
// hands so neither player sees the other's hidden information.
// ---------------------------------------------------------------------------

interface HandoffViewProps {
  state: GameState;
  dispatch: React.Dispatch<Action>;
}

export function HandoffView({ state, dispatch }: HandoffViewProps) {
  const color = state.handoffTo ?? 'w';
  const colorName = color === 'w' ? 'White' : 'Black';
  const next = state.afterHandoff === 'setup' ? 'design your army' : 'make your move';

  return (
    <div className="handoff">
      <div className={`handoff-card ${color === 'w' ? 'white' : 'black'}`}>
        <div className="handoff-mark">
          <span className={`turn-dot big ${color === 'w' ? 'white' : 'black'}`} />
        </div>
        <h2>Pass the device to {colorName}</h2>
        <p>Make sure only {colorName} is looking — you're about to {next}.</p>
        <button className="btn primary big" onClick={() => dispatch({ type: 'HANDOFF_CONTINUE' })}>
          I'm {colorName} — continue
        </button>
      </div>
    </div>
  );
}
