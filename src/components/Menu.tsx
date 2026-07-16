import { useState } from 'react';
import type { Color, Mode, TimeControl, Variant } from '../engine/types';
import type { GameConfig } from '../game/state';

// ---------------------------------------------------------------------------
// Home screen: choose mode, setup style (variant), and time control, then
// start a game. Time control is written setup - play | increment
// (e.g. "1 - 1 | 1" = 1 min setup, 1 min play, +1s per move).
// ---------------------------------------------------------------------------

interface Preset {
  group: string;
  tc: TimeControl;
}

const PRESETS: Preset[] = [
  { group: 'Bullet', tc: { setupMinutes: 1, playMinutes: 1, incrementSeconds: 1 } },
  { group: 'Bullet', tc: { setupMinutes: 1, playMinutes: 2, incrementSeconds: 1 } },
  { group: 'Blitz', tc: { setupMinutes: 1, playMinutes: 3, incrementSeconds: 2 } },
  { group: 'Blitz', tc: { setupMinutes: 1, playMinutes: 5, incrementSeconds: 0 } },
  { group: 'Rapid', tc: { setupMinutes: 2, playMinutes: 10, incrementSeconds: 0 } },
  { group: 'Rapid', tc: { setupMinutes: 2, playMinutes: 15, incrementSeconds: 10 } },
  { group: 'Classical', tc: { setupMinutes: 3, playMinutes: 30, incrementSeconds: 0 } },
  { group: 'Classical', tc: { setupMinutes: 5, playMinutes: 45, incrementSeconds: 15 } },
];

export function formatTC(tc: TimeControl): string {
  return `${tc.setupMinutes} - ${tc.playMinutes} | ${tc.incrementSeconds}`;
}

function sameTC(a: TimeControl, b: TimeControl): boolean {
  return (
    a.setupMinutes === b.setupMinutes &&
    a.playMinutes === b.playMinutes &&
    a.incrementSeconds === b.incrementSeconds
  );
}

interface MenuProps {
  onStart: (config: GameConfig) => void;
}

export function Menu({ onStart }: MenuProps) {
  const [mode, setMode] = useState<Mode>('computer');
  const [humanColor, setHumanColor] = useState<Color | 'random'>('w');
  const [variant, setVariant] = useState<Variant>('960');
  const [tc, setTc] = useState<TimeControl>(PRESETS[3].tc);
  const [customOpen, setCustomOpen] = useState(false);
  const [custom, setCustom] = useState<TimeControl>({
    setupMinutes: 2,
    playMinutes: 10,
    incrementSeconds: 5,
  });

  const activeTc = customOpen ? custom : tc;
  const resolvedColor: Color =
    humanColor === 'random' ? (Math.random() < 0.5 ? 'w' : 'b') : humanColor;

  const start = () => {
    onStart({ mode, variant, time: activeTc, humanColor: resolvedColor });
  };

  return (
    <div className="menu">
      <header className="brand">
        <div className="brand-logo" aria-hidden>
          <span className="brand-mark">?</span>
        </div>
        <div className="brand-text">
          <h1>Hidden Chess</h1>
          <p>Design your own secret army. Your opponent can't see what your pieces are — until they're captured.</p>
        </div>
      </header>

      <section className="menu-card">
        <h2>Mode</h2>
        <div className="option-row">
          <OptionButton active={mode === 'computer'} onClick={() => setMode('computer')}>
            <strong>vs Computer</strong>
            <span>Play a bot solo</span>
          </OptionButton>
          <OptionButton active={mode === 'pass'} onClick={() => setMode('pass')}>
            <strong>Pass &amp; Play</strong>
            <span>Two players, one device</span>
          </OptionButton>
        </div>
        {mode === 'computer' && (
          <div className="subrow">
            <span className="subrow-label">You play</span>
            <div className="pill-row">
              {(['w', 'b', 'random'] as const).map((c) => (
                <button
                  key={c}
                  className={`pill ${humanColor === c ? 'active' : ''}`}
                  onClick={() => setHumanColor(c)}
                >
                  {c === 'w' ? 'White' : c === 'b' ? 'Black' : 'Random'}
                </button>
              ))}
            </div>
          </div>
        )}
      </section>

      <section className="menu-card">
        <h2>Setup Style</h2>
        <div className="option-row">
          <OptionButton active={variant === '960'} onClick={() => setVariant('960')}>
            <strong>Back-Rank Design</strong>
            <span>Arrange your 8 back-rank pieces any way you like. Pawns stay on the 2nd rank.</span>
          </OptionButton>
          <OptionButton active={variant === 'full'} onClick={() => setVariant('full')}>
            <strong>Free Placement</strong>
            <span>Place all 16 pieces — pawns included — anywhere across your back two ranks.</span>
          </OptionButton>
        </div>
      </section>

      <section className="menu-card">
        <h2>Time Control</h2>
        <p className="hint">
          Format <code>setup − play | increment</code> (minutes, minutes, seconds). You get separate
          time to design your army before the game begins.
        </p>
        <div className="tc-grid">
          {PRESETS.map((p, i) => (
            <button
              key={i}
              className={`tc-btn ${!customOpen && sameTC(tc, p.tc) ? 'active' : ''}`}
              onClick={() => {
                setTc(p.tc);
                setCustomOpen(false);
              }}
            >
              <span className="tc-group">{p.group}</span>
              <span className="tc-value">{formatTC(p.tc)}</span>
            </button>
          ))}
          <button
            className={`tc-btn ${customOpen ? 'active' : ''}`}
            onClick={() => setCustomOpen(true)}
          >
            <span className="tc-group">Custom</span>
            <span className="tc-value">{customOpen ? formatTC(custom) : 'Set…'}</span>
          </button>
        </div>

        {customOpen && (
          <div className="custom-tc">
            <NumberField
              label="Setup (min)"
              value={custom.setupMinutes}
              min={0}
              max={30}
              onChange={(v) => setCustom({ ...custom, setupMinutes: v })}
            />
            <NumberField
              label="Play (min)"
              value={custom.playMinutes}
              min={1}
              max={180}
              onChange={(v) => setCustom({ ...custom, playMinutes: v })}
            />
            <NumberField
              label="Increment (s)"
              value={custom.incrementSeconds}
              min={0}
              max={60}
              onChange={(v) => setCustom({ ...custom, incrementSeconds: v })}
            />
          </div>
        )}
      </section>

      <button className="start-btn" onClick={start}>
        Start Game <span className="start-tc">{formatTC(activeTc)}</span>
      </button>

      <footer className="menu-foot">
        <details>
          <summary>How to play Hidden Chess</summary>
          <ul>
            <li>
              <strong>Design phase.</strong> Each player secretly arranges their army in their back
              ranks. In Back-Rank Design you place your 8 pieces; in Free Placement you place all 16.
              You have your own setup clock.
            </li>
            <li>
              <strong>Hidden identities.</strong> During play you see <em>where</em> every piece is,
              but your opponent's pieces show as <span className="q">?</span> — you don't know what
              they are. A piece's type is only revealed when it's captured.
            </li>
            <li>
              <strong>Read the moves.</strong> Infer identities from how pieces move — but beware
              bluffs, like a rook that only ever steps one square to pose as a king.
            </li>
            <li>
              <strong>Everything else is normal chess:</strong> checkmate wins, plus en passant,
              promotion, stalemate, and the 50-move rule. (No castling — your king rarely starts where
              it could anyway.)
            </li>
          </ul>
        </details>
      </footer>
    </div>
  );
}

function OptionButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button className={`option-btn ${active ? 'active' : ''}`} onClick={onClick}>
      {children}
    </button>
  );
}

function NumberField({
  label,
  value,
  min,
  max,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (v: number) => void;
}) {
  return (
    <label className="number-field">
      <span>{label}</span>
      <div className="stepper">
        <button onClick={() => onChange(Math.max(min, value - 1))} aria-label={`decrease ${label}`}>
          −
        </button>
        <input
          type="number"
          value={value}
          min={min}
          max={max}
          onChange={(e) => {
            const v = Number(e.target.value);
            if (Number.isFinite(v)) onChange(Math.min(max, Math.max(min, Math.round(v))));
          }}
        />
        <button onClick={() => onChange(Math.min(max, value + 1))} aria-label={`increase ${label}`}>
          +
        </button>
      </div>
    </label>
  );
}
