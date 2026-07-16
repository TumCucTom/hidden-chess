import { useEffect, useReducer, useRef } from 'react';
import { reducer, initialState, type GameState, type Action } from './state';
import { chooseHiddenMove, DIFFICULTY } from '../engine/ai';

// ---------------------------------------------------------------------------
// Wraps the reducer with the two time-driven concerns:
//   1. a ticking clock that decrements the active player's time
//   2. the computer opponent, which moves on its turn in computer mode
// ---------------------------------------------------------------------------

const TICK_MS = 100;

export function useGame(): [GameState, React.Dispatch<Action>] {
  const [state, dispatch] = useReducer(reducer, initialState);

  // --- Clock -------------------------------------------------------------
  const lastRef = useRef<number>(Date.now());
  useEffect(() => {
    lastRef.current = Date.now();
    const id = window.setInterval(() => {
      const now = Date.now();
      const elapsed = now - lastRef.current;
      lastRef.current = now;
      // The reducer ignores ticks outside setup/play, returning the same
      // state reference, so no re-render happens in menu/handoff/over.
      dispatch({ type: 'TICK', elapsed });
    }, TICK_MS);
    return () => window.clearInterval(id);
  }, []);

  // --- Computer opponent -------------------------------------------------
  const thinkingRef = useRef(false);
  useEffect(() => {
    if (!state.config || state.config.mode !== 'computer') return;
    if (state.phase !== 'play' || !state.play) return;
    const botColor = state.config.humanColor === 'w' ? 'b' : 'w';
    if (state.play.turn !== botColor) return;
    if (thinkingRef.current) return;

    thinkingRef.current = true;
    // A brief, human-ish pause before moving.
    const delay = 350 + Math.floor(Math.random() * 450);
    const id = window.setTimeout(() => {
      // The bot plays without seeing opponent piece types — it reasons over a
      // belief about what they could be (see chooseHiddenMove). Strength scales
      // with the chosen difficulty.
      const { samples, depth } = DIFFICULTY[state.config!.difficulty];
      const move = chooseHiddenMove(state.play!, state.config!.variant, { samples, depth });
      thinkingRef.current = false;
      if (move) dispatch({ type: 'MOVE', move });
    }, delay);

    return () => {
      window.clearTimeout(id);
      thinkingRef.current = false;
    };
    // Re-evaluate whenever the turn, phase, or game changes.
  }, [state.phase, state.play?.turn, state.gameId, state.config]);

  return [state, dispatch];
}
