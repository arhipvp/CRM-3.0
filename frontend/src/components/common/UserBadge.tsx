import React from 'react';
import { getUserColor, hexToRgba } from '../../utils/userColor';

interface UserBadgeProps {
  username?: string | null;
  displayName?: string | null;
  className?: string;
  size?: 'sm' | 'md';
}

export const UserBadge: React.FC<UserBadgeProps> = ({
  username,
  displayName,
  className = '',
  size = 'md',
}) => {
  const identifier = username ?? displayName;
  const color = getUserColor(identifier ?? undefined);
  const backgroundColor = color ? hexToRgba(color, 0.12) : undefined;
  const text = displayName || username || '—';
  const baseClasses =
    'inline-flex items-center gap-2 rounded-full border font-semibold tracking-wide';
  const sizeClasses = size === 'sm' ? 'px-2 py-0.5 text-[11px]' : 'px-3 py-1 text-xs';

  return (
    <span
      className={`${baseClasses} ${sizeClasses} ${className}`}
      style={
        color
          ? {
              color,
              borderColor: color,
              backgroundColor,
            }
          : undefined
      }
    >
      <span
        className="h-2 w-2 rounded-full"
        style={color ? { backgroundColor: color } : undefined}
      />
      {text}
    </span>
  );
};
