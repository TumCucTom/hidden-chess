import type { Color, PieceType } from '../engine/types';

// ---------------------------------------------------------------------------
// Chess piece rendering as inline SVG silhouettes (no external assets).
// A single fill per piece with a contrasting outline reads cleanly on both
// board colours, and a "hidden" glyph is used for the opponent's unrevealed
// pieces — the core of Hidden Chess.
// ---------------------------------------------------------------------------

// All shapes are authored in a 45x45 viewBox (the de-facto chess-SVG grid).
const SHAPES: Record<PieceType, string> = {
  // King: cross finial, crown body, flared base.
  k: `M22.5 6.5 L22.5 12 M20 9 L25 9
      M22.5 12 C17 12 13 16 13 21 C13 25 16 28 18 30
      L15 37 L30 37 L27 30 C29 28 32 25 32 21 C32 16 28 12 22.5 12 Z
      M12 38 L33 38 L33 41.5 L12 41.5 Z`,
  // Queen: five-point crown, body, base.
  q: `M9 14 L13 30 L32 30 L36 14 L30 26 L27 13 L22.5 27 L18 13 L15 26 Z
      M13 30 L32 30 L31 37 L14 37 Z
      M11.5 38 L33.5 38 L33.5 41.5 L11.5 41.5 Z`,
  // Rook: crenellated top, straight body, wide base.
  r: `M11 12 L11 18 L15 18 L15 15 L20 15 L20 18 L25 18 L25 15 L30 15 L30 18 L34 18 L34 12 Z
      M13 18 L32 18 L30 24 L30 34 L15 34 L15 24 Z
      M11 35 L34 35 L34 41.5 L11 41.5 Z`,
  // Bishop: mitre with a slit, collar, base.
  b: `M22.5 7 C25 7 26.5 9 26.5 11 C26.5 12.5 25.5 13.5 25 14
      C28 16 31 20 31 26 C31 30 27 33 22.5 33 C18 33 14 30 14 26
      C14 20 17 16 20 14 C19.5 13.5 18.5 12.5 18.5 11 C18.5 9 20 7 22.5 7 Z
      M20 20 L25 20 M22.5 17.5 L22.5 22.5
      M14 34 L31 34 L31 37 L14 37 Z
      M12 38 L33 38 L33 41.5 L12 41.5 Z`,
  // Knight: horse head facing left, with an eye cut-out.
  n: `M24 9 C19 9 15 12 13 17 C12 20 12 22 10 24
      C9 26 10 29 13 29 C12 31 12 33 12 35 L11.5 38
      L11 41.5 L34 41.5 L34 33 C34 23 31 16 24 13
      C25 11 25.5 9 24 9 Z
      M15.5 20 C14.5 21.5 15.5 23 17 22.2 C18 21.5 18 19.6 17 18.8
      C16 18.3 15.6 19 15.5 20 Z`,
  // Pawn: round head, tapered body, base.
  p: `M22.5 10 C25 10 27 12 27 14.5 C27 16.3 26 17.8 24.6 18.7
      C27.5 20.2 29 23 29 26 L16 26 C16 23 17.5 20.2 20.4 18.7
      C19 17.8 18 16.3 18 14.5 C18 12 20 10 22.5 10 Z
      M15 27 L30 27 L33 37 L12 37 Z
      M12 38 L33 38 L33 41.5 L12 41.5 Z`,
};

interface PieceProps {
  color: Color;
  type: PieceType;
  /** Render as a face-down hidden piece regardless of type. */
  hidden?: boolean;
}

export function Piece({ color, type, hidden }: PieceProps) {
  if (hidden) return <HiddenPiece color={color} />;

  const fill = color === 'w' ? '#f4f4f4' : '#2b2926';
  const stroke = color === 'w' ? '#5a5147' : '#c9c2b6';

  return (
    <svg
      className="piece-svg"
      viewBox="0 0 45 45"
      role="img"
      aria-label={`${color === 'w' ? 'white' : 'black'} ${PIECE_NAMES[type]}`}
    >
      <path
        d={SHAPES[type]}
        fill={fill}
        stroke={stroke}
        strokeWidth={1.4}
        strokeLinejoin="round"
        strokeLinecap="round"
        fillRule="evenodd"
      />
    </svg>
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
