import type { Color, PieceType } from '../engine/types';

// ---------------------------------------------------------------------------
// Chess piece rendering.
//
// Real pieces use the open-source "Cburnett" Staunton set (the crisp piece
// art used across online chess), bundled as SVG assets so the app stays fully
// self-contained. The opponent's unrevealed pieces render as a "hidden" glyph
// — the core of Hidden Chess — until they're captured.
//
// The piece set is a one-place swap: drop a different set of {w,b}{K,Q,R,B,N,P}
// SVGs into src/assets/pieces/ and update the imports below.
// ---------------------------------------------------------------------------

import wK from '../assets/pieces/wK.svg';
import wQ from '../assets/pieces/wQ.svg';
import wR from '../assets/pieces/wR.svg';
import wB from '../assets/pieces/wB.svg';
import wN from '../assets/pieces/wN.svg';
import wP from '../assets/pieces/wP.svg';
import bK from '../assets/pieces/bK.svg';
import bQ from '../assets/pieces/bQ.svg';
import bR from '../assets/pieces/bR.svg';
import bB from '../assets/pieces/bB.svg';
import bN from '../assets/pieces/bN.svg';
import bP from '../assets/pieces/bP.svg';

const PIECE_URLS: Record<Color, Record<PieceType, string>> = {
  w: { k: wK, q: wQ, r: wR, b: wB, n: wN, p: wP },
  b: { k: bK, q: bQ, r: bR, b: bB, n: bN, p: bP },
};

interface PieceProps {
  color: Color;
  type: PieceType;
  /** Render as a face-down hidden piece regardless of type. */
  hidden?: boolean;
}

export function Piece({ color, type, hidden }: PieceProps) {
  if (hidden) return <HiddenPiece color={color} />;
  return (
    <img
      className="piece-img"
      src={PIECE_URLS[color][type]}
      draggable={false}
      alt={`${color === 'w' ? 'white' : 'black'} ${PIECE_NAMES[type]}`}
    />
  );
}

/**
 * The opponent's unrevealed piece: a domed, beveled medallion with an embossed
 * "?" — the visual heart of Hidden Chess. Rendered as a self-contained SVG
 * (gradient ids are namespaced per colour so many can coexist on one board).
 */
export function HiddenPiece({ color }: { color: Color }) {
  const w = color === 'w';
  const id = w ? 'hpW' : 'hpB';
  const s = w
    ? { g0: '#fdfbf6', g1: '#ece4d4', g2: '#d3c9b6', ring: '#bfb49f',
        bevel: 'rgba(255,255,255,.7)', q: '#8b8474', qShadow: 'rgba(255,255,255,.75)' }
    : { g0: '#5c574f', g1: '#34302b', g2: '#201e1b', ring: '#17140f',
        bevel: 'rgba(255,255,255,.16)', q: '#cdc5b6', qShadow: 'rgba(0,0,0,.5)' };
  const qFont = { fontSize: 20, fontWeight: 800 as const, fontFamily: "Georgia, 'Times New Roman', serif" };
  return (
    <svg className="piece-svg hidden-piece" viewBox="0 0 45 45" role="img" aria-label="hidden piece">
      <defs>
        <radialGradient id={`${id}-fill`} cx="38%" cy="30%" r="80%">
          <stop offset="0%" stopColor={s.g0} />
          <stop offset="58%" stopColor={s.g1} />
          <stop offset="100%" stopColor={s.g2} />
        </radialGradient>
      </defs>
      {/* domed body + rim */}
      <circle cx="22.5" cy="22.5" r="16.5" fill={`url(#${id}-fill)`} stroke={s.ring} strokeWidth="1.3" />
      {/* inner bevel highlight */}
      <circle cx="22.5" cy="22.5" r="13.6" fill="none" stroke={s.bevel} strokeWidth="1.1" />
      {/* embossed "?" — offset shadow copy under the main glyph */}
      <text x="22.5" y="24.1" textAnchor="middle" dominantBaseline="central" fill={s.qShadow} {...qFont}>?</text>
      <text x="22.5" y="23.2" textAnchor="middle" dominantBaseline="central" fill={s.q} {...qFont}>?</text>
    </svg>
  );
}

export const PIECE_NAMES: Record<PieceType, string> = {
  k: 'king',
  q: 'queen',
  r: 'rook',
  b: 'bishop',
  n: 'knight',
  p: 'pawn',
};
