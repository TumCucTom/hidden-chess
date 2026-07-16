import type { ReactNode } from 'react';
import type { Color } from '../engine/types';
import { orderedSquares, isLightSquare, fileLabel, rankLabel } from './boardLayout';

export interface SquareDeco {
  /** Extra state classes, e.g. "selected last-move check". */
  className?: string;
  /** A translucent move dot (empty target) or capture ring (occupied target). */
  overlay?: 'dot' | 'ring' | null;
}

interface BoardGridProps {
  orientation: Color;
  renderPiece: (square: number) => ReactNode;
  decoFor?: (square: number) => SquareDeco;
  onSquareClick?: (square: number) => void;
  coordinates?: boolean;
  /** Optional extra class on the board element (e.g. "dimmed"). */
  className?: string;
}

export function BoardGrid({
  orientation,
  renderPiece,
  decoFor,
  onSquareClick,
  coordinates = true,
  className = '',
}: BoardGridProps) {
  const squares = orderedSquares(orientation);
  return (
    <div className={`board ${className}`.trim()}>
      {squares.map((sq) => {
        const deco = decoFor?.(sq) ?? {};
        const light = isLightSquare(sq);
        const fl = coordinates ? fileLabel(sq, orientation) : null;
        const rl = coordinates ? rankLabel(sq, orientation) : null;
        return (
          <div
            key={sq}
            className={`square ${light ? 'light' : 'dark'} ${deco.className ?? ''}`.trim()}
            onClick={onSquareClick ? () => onSquareClick(sq) : undefined}
            role={onSquareClick ? 'button' : undefined}
            data-square={sq}
          >
            {rl && <span className="coord coord-rank">{rl}</span>}
            {fl && <span className="coord coord-file">{fl}</span>}
            <div className="piece-layer">{renderPiece(sq)}</div>
            {deco.overlay === 'dot' && <span className="move-dot" />}
            {deco.overlay === 'ring' && <span className="capture-ring" />}
          </div>
        );
      })}
    </div>
  );
}
