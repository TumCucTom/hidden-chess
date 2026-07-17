import { useCallback, useEffect, useReducer, useRef, useState } from 'react';
import type { Color } from '../engine/types';
import { reducer, initialState, type GameState, type Action, type GameConfig } from './state';
import { chooseHiddenMove, DIFFICULTY } from '../engine/ai';
import { hostGame, joinGame, type NetHandle, type NetStatus } from './net';

// ---------------------------------------------------------------------------
// Drives the reducer plus the three time/IO concerns:
//   1. a ticking clock,
//   2. the computer opponent (computer mode),
//   3. the peer-to-peer connection (p2p mode) — local moves are sent to the
//      peer, and messages from the peer are applied via the raw dispatch so
//      they never echo back out.
// ---------------------------------------------------------------------------

const TICK_MS = 100;

export interface UseGame {
  state: GameState;
  dispatch: React.Dispatch<Action>;
  net: NetStatus;
  host: (config: GameConfig) => void;
  join: (code: string) => void;
  leave: () => void;
}

export function useGame(): UseGame {
  const [state, rawDispatch] = useReducer(reducer, initialState);
  const [net, setNet] = useState<NetStatus>({ kind: 'idle' });

  const stateRef = useRef(state);
  stateRef.current = state;
  const netHandle = useRef<NetHandle | null>(null);

  const closeNet = useCallback(() => {
    netHandle.current?.close();
    netHandle.current = null;
  }, []);

  // Apply a message received from the peer (raw dispatch = no echo).
  const onData = useCallback((msg: any) => {
    if (!msg || typeof msg !== 'object') return;
    switch (msg.type) {
      case 'start':
        // Guest receives the host's config; it plays Black.
        rawDispatch({ type: 'START_GAME', config: { ...msg.config, mode: 'p2p', localColor: 'b' } });
        setNet({ kind: 'connected' });
        break;
      case 'setup':
        rawDispatch({ type: 'P2P_REMOTE_SETUP', color: msg.color, placement: msg.placement });
        break;
      case 'move':
        rawDispatch({ type: 'MOVE', move: msg.move });
        break;
      case 'resign':
        rawDispatch({ type: 'RESIGN', color: msg.color });
        break;
      case 'rematch':
        rawDispatch({ type: 'REMATCH' });
        break;
    }
  }, []);

  const host = useCallback(
    (config: GameConfig) => {
      closeNet();
      setNet({ kind: 'joining' }); // brief, until the code is issued
      const hostConfig: GameConfig = { ...config, mode: 'p2p', localColor: 'w' };
      netHandle.current = hostGame({
        onCode: (code) => setNet({ kind: 'hosting', code }),
        onConnected: () => {
          netHandle.current?.send({ type: 'start', config: hostConfig });
          rawDispatch({ type: 'START_GAME', config: hostConfig });
          setNet({ kind: 'connected' });
        },
        onData,
        onClose: () => setNet({ kind: 'closed' }),
        onError: (message) => setNet({ kind: 'error', message }),
      });
    },
    [closeNet, onData],
  );

  const join = useCallback(
    (code: string) => {
      closeNet();
      setNet({ kind: 'joining' });
      netHandle.current = joinGame(code, {
        onConnected: () => {
          /* wait for the host's 'start' message to begin */
        },
        onData,
        onClose: () => setNet({ kind: 'closed' }),
        onError: (message) => setNet({ kind: 'error', message }),
      });
    },
    [closeNet, onData],
  );

  const leave = useCallback(() => {
    closeNet();
    setNet({ kind: 'idle' });
    rawDispatch({ type: 'NEW_GAME' });
  }, [closeNet]);

  // Wrapped dispatch used by the UI: apply locally, then relay to the peer.
  const dispatch = useCallback<React.Dispatch<Action>>((action) => {
    rawDispatch(action);
    const cur = stateRef.current;
    if (action.type === 'NEW_GAME' && netHandle.current) {
      netHandle.current.close();
      netHandle.current = null;
      setNet({ kind: 'idle' });
      return;
    }
    if (cur.config?.mode !== 'p2p' || !netHandle.current) return;
    const local = cur.config.localColor ?? 'w';
    switch (action.type) {
      case 'MOVE':
        netHandle.current.send({ type: 'move', move: action.move });
        break;
      case 'SETUP_SUBMIT':
        netHandle.current.send({ type: 'setup', color: local, placement: cur.placements[local] });
        break;
      case 'RESIGN':
        netHandle.current.send({ type: 'resign', color: action.color });
        break;
      case 'REMATCH':
        netHandle.current.send({ type: 'rematch' });
        break;
    }
  }, []);

  // --- Clock -------------------------------------------------------------
  const lastRef = useRef<number>(Date.now());
  useEffect(() => {
    lastRef.current = Date.now();
    const id = window.setInterval(() => {
      const now = Date.now();
      const elapsed = now - lastRef.current;
      lastRef.current = now;
      rawDispatch({ type: 'TICK', elapsed });
    }, TICK_MS);
    return () => window.clearInterval(id);
  }, []);

  // --- Computer opponent -------------------------------------------------
  const thinkingRef = useRef(false);
  useEffect(() => {
    if (!state.config || state.config.mode !== 'computer') return;
    if (state.phase !== 'play' || !state.play) return;
    const botColor: Color = state.config.humanColor === 'w' ? 'b' : 'w';
    if (state.play.turn !== botColor) return;
    if (thinkingRef.current) return;

    thinkingRef.current = true;
    const delay = 350 + Math.floor(Math.random() * 450);
    const id = window.setTimeout(() => {
      const { samples, depth } = DIFFICULTY[state.config!.difficulty];
      const move = chooseHiddenMove(state.play!, state.config!.variant, { samples, depth });
      thinkingRef.current = false;
      if (move) rawDispatch({ type: 'MOVE', move });
    }, delay);

    return () => {
      window.clearTimeout(id);
      thinkingRef.current = false;
    };
  }, [state.phase, state.play?.turn, state.gameId, state.config]);

  // Tear down the peer connection when the component unmounts.
  useEffect(() => () => closeNet(), [closeNet]);

  return { state, dispatch, net, host, join, leave };
}
