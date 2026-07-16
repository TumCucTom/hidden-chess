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

/** The opponent's unrevealed piece: a coloured disc with a question mark. */
export function HiddenPiece({ color }: { color: Color }) {
  const light = color === 'w';
  const bg = light ? '#efeae0' : '#3a3733';
  const ring = light ? '#c3b9a6' : '#615c54';
  const q = light ? '#8a7f6c' : '#b8b0a2';
  return (
    <svg className="piece-svg hidden-piece" viewBox="0 0 45 45" role="img" aria-label="hidden piece">
      <circle cx="22.5" cy="22.5" r="15" fill={bg} stroke={ring} strokeWidth="2.2" />
      <text
        x="22.5"
        y="23"
        textAnchor="middle"
        dominantBaseline="central"
        fontSize="20"
        fontWeight="800"
        fill={q}
        fontFamily="Georgia, 'Times New Roman', serif"
      >
        ?
      </text>
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
