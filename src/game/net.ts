import Peer, { type DataConnection } from 'peerjs';

// ---------------------------------------------------------------------------
// Peer-to-peer transport for online play.
//
// Uses PeerJS: signaling goes through PeerJS's public broker, and the actual
// game data flows directly between the two browsers over a WebRTC data channel
// — no server of our own. The host is given a short shareable code; the guest
// types it in to connect.
//
// Secrecy note: this is a friendly, trust-based transport. Each client holds
// the full game state and the UI hides the opponent's piece types, but a
// determined peer could inspect the data. Fine for playing with a friend.
// ---------------------------------------------------------------------------

/** Namespace our peer ids so the short code can't collide with other apps. */
const NS = 'hidden-chess-v1-';

export type NetStatus =
  | { kind: 'idle' }
  | { kind: 'hosting'; code: string } // code ready, waiting for a guest
  | { kind: 'joining' } // connecting to a host
  | { kind: 'connected'; code?: string }
  | { kind: 'closed' } // peer left
  | { kind: 'error'; message: string };

export interface NetHandle {
  send: (msg: unknown) => void;
  close: () => void;
}

interface HostCallbacks {
  onCode: (code: string) => void;
  onConnected: () => void;
  onData: (msg: any) => void;
  onClose: () => void;
  onError: (message: string) => void;
}

interface JoinCallbacks {
  onConnected: () => void;
  onData: (msg: any) => void;
  onClose: () => void;
  onError: (message: string) => void;
}

// Human-friendly code alphabet (no 0/O/1/I confusables).
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
function makeCode(): string {
  const bytes = new Uint8Array(6);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => ALPHABET[b % ALPHABET.length]).join('');
}

export function normalizeCode(raw: string): string {
  return raw.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
}

function friendlyError(err: any): string {
  switch (err?.type) {
    case 'peer-unavailable':
      return 'No game found with that code. Double-check it and try again.';
    case 'network':
    case 'server-error':
    case 'socket-error':
    case 'socket-closed':
      return "Couldn't reach the connection service. Check your internet and retry.";
    case 'browser-incompatible':
      return "This browser doesn't support peer-to-peer play.";
    case 'unavailable-id':
      return 'That game code is already in use — try creating a new game.';
    default:
      return err?.message || 'Connection error.';
  }
}

function wireConnection(
  conn: DataConnection,
  cb: { onConnected: () => void; onData: (m: any) => void; onClose: () => void; onError: (m: string) => void },
) {
  conn.on('open', () => cb.onConnected());
  conn.on('data', (d) => cb.onData(d));
  conn.on('close', () => cb.onClose());
  conn.on('error', (e: any) => cb.onError(friendlyError(e)));
}

/** Create a game: opens a peer, reports a short code, waits for a guest. */
export function hostGame(cb: HostCallbacks): NetHandle {
  let peer: Peer;
  let conn: DataConnection | null = null;
  let attempts = 0;
  let closed = false;

  const create = () => {
    const code = makeCode();
    peer = new Peer(NS + code);
    peer.on('open', () => !closed && cb.onCode(code));
    peer.on('connection', (c) => {
      conn = c;
      wireConnection(c, cb);
    });
    peer.on('error', (err: any) => {
      if (err?.type === 'unavailable-id' && attempts < 5 && !closed) {
        attempts += 1;
        peer.destroy();
        create();
        return;
      }
      cb.onError(friendlyError(err));
    });
  };
  create();

  return {
    send: (msg) => conn?.send(msg),
    close: () => {
      closed = true;
      conn?.close();
      peer?.destroy();
    },
  };
}

/** Join a game by code. */
export function joinGame(code: string, cb: JoinCallbacks): NetHandle {
  const peer = new Peer();
  let conn: DataConnection | null = null;

  peer.on('open', () => {
    conn = peer.connect(NS + normalizeCode(code), { reliable: true });
    wireConnection(conn, cb);
  });
  peer.on('error', (err: any) => cb.onError(friendlyError(err)));

  return {
    send: (msg) => conn?.send(msg),
    close: () => {
      conn?.close();
      peer.destroy();
    },
  };
}
