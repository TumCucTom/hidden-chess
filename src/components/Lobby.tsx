import { useState } from 'react';
import type { NetStatus } from '../game/net';

// ---------------------------------------------------------------------------
// The online lobby: shows the shareable code while hosting, a spinner while
// joining, or a friendly error. Rendered before the game itself begins.
// ---------------------------------------------------------------------------

export function Lobby({ net, onCancel }: { net: NetStatus; onCancel: () => void }) {
  const [copied, setCopied] = useState(false);
  const code = net.kind === 'hosting' ? net.code : '';

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard may be unavailable; the code is visible to copy by hand */
    }
  };

  return (
    <div className="handoff">
      <div className="handoff-card lobby-card">
        {net.kind === 'hosting' && (
          <>
            <h2>Share this code</h2>
            <p>Your friend enters it on their device to join. Waiting for them…</p>
            <button className="lobby-code" onClick={copy} title="Click to copy">
              {code}
            </button>
            <button className="btn" onClick={copy}>
              {copied ? 'Copied ✓' : 'Copy code'}
            </button>
            <div className="lobby-spinner" aria-hidden />
          </>
        )}

        {net.kind === 'joining' && (
          <>
            <h2>Connecting…</h2>
            <p>Reaching your friend's game.</p>
            <div className="lobby-spinner" aria-hidden />
          </>
        )}

        {net.kind === 'error' && (
          <>
            <h2>Couldn't connect</h2>
            <p className="lobby-error">{net.message}</p>
          </>
        )}

        <button className="btn ghost" onClick={onCancel}>
          Back to menu
        </button>
      </div>
    </div>
  );
}
