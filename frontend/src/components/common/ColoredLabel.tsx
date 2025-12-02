import React from 'react';
import { getEntityColor } from '../../utils/userColor';

export interface ColoredLabelProps {
  value?: string | null;
  fallback?: string;
  className?: string;
  showDot?: boolean;
  style?: React.CSSProperties;
}

export const ColoredLabel: React.FC<ColoredLabelProps> = ({
  value,
  fallback = '—',
  className = '',
  showDot = false,
  style,
}) => {
  const trimmedValue = value?.trim();
  const displayValue = trimmedValue || fallback;
  const color = trimmedValue ? getEntityColor(trimmedValue) : undefined;
  const combinedStyle = color ? { ...style, color } : style;

  return (
    <span
      className={`inline-flex items-center gap-1 whitespace-nowrap ${className}`}
      style={combinedStyle}
    >
      {showDot && color && (
        <span
          className="inline-flex h-2 w-2 rounded-full flex-shrink-0"
          style={{ backgroundColor: color }}
        />
      )}
      {displayValue}
    </span>
  );
};
