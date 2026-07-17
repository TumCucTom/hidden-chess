// Shown to a p2p player who has locked in their setup and is waiting for the
// opponent to finish designing their army.
export function WaitingView() {
  return (
    <div className="handoff">
      <div className="handoff-card">
        <div className="lobby-spinner" aria-hidden />
        <h2>Ready ✓</h2>
        <p>Waiting for your opponent to finish designing their army…</p>
      </div>
    </div>
  );
}
