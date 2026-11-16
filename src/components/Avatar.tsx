import React, { useState } from 'react';
import { Bookmark, Users } from 'lucide-react';
import { getAvatarColor, getInitials } from '../utils/formatters';

interface AvatarProps {
  name?: string;
  src?: string;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  online?: boolean;
  isSelf?: boolean;
  isGroup?: boolean;
  hasRing?: boolean;
  ringSeen?: boolean;
  className?: string;
}

const SIZE_MAP = {
  xs: 'w-7 h-7 text-xs',
  sm: 'w-9 h-9 text-xs',
  md: 'w-11 h-11 text-sm',
  lg: 'w-14 h-14 text-base',
  xl: 'w-24 h-24 text-2xl',
};

const DOT_MAP = {
  xs: 'w-2 h-2 right-0 bottom-0 border',
  sm: 'w-2.5 h-2.5 right-0 bottom-0 border-2',
  md: 'w-3 h-3 right-0 bottom-0 border-2',
  lg: 'w-3.5 h-3.5 right-0.5 bottom-0.5 border-2',
  xl: 'w-4 h-4 right-1 bottom-1 border-2',
};

export const Avatar: React.FC<AvatarProps> = ({
  name = 'User',
  src,
  size = 'md',
  online,
  isSelf,
  isGroup,
  hasRing,
  ringSeen,
  className = '',
}) => {
  const [imgError, setImgError] = useState(false);
  const bgColor = getAvatarColor(name);

  const ringClasses = hasRing
    ? ringSeen
      ? 'ring-2 ring-[#8fa7cc] ring-offset-2 ring-offset-[#0a1630]'
      : 'ring-2 ring-[#3b82f6] ring-offset-2 ring-offset-[#0a1630]'
    : '';

  return (
    <div className={`relative inline-flex shrink-0 select-none ${className}`}>
      <div
        className={`${SIZE_MAP[size]} ${ringClasses} rounded-full overflow-hidden flex items-center justify-center font-semibold text-white shadow-xs`}
        style={{
          backgroundColor: isSelf ? '#3b82f6' : isGroup && (!src || imgError) ? '#0284c7' : bgColor,
        }}
      >
        {isSelf && (!src || imgError) ? (
          <Bookmark className="w-1/2 h-1/2 text-white" />
        ) : src && !imgError ? (
          <img
            src={src}
            alt={name}
            referrerPolicy="no-referrer"
            onError={() => setImgError(true)}
            className="w-full h-full object-cover"
          />
        ) : isGroup ? (
          <Users className="w-1/2 h-1/2 text-white" />
        ) : (
          <span>{getInitials(name)}</span>
        )}
      </div>

      {online && (
        <span
          className={`absolute ${DOT_MAP[size]} rounded-full bg-[#3b82f6] border-[#0a1630]`}
          title="Online"
        />
      )}
    </div>
  );
};
