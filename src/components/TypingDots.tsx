import React from 'react';

interface TypingDotsProps {
  size?: 'xs' | 'sm' | 'md' | 'lg';
  className?: string;
}

export const TypingDots: React.FC<TypingDotsProps> = ({ size = 'md', className = '' }) => {
  const dotClass =
    size === 'xs'
      ? 'w-1 h-1'
      : size === 'sm'
        ? 'w-1.5 h-1.5'
        : size === 'lg'
          ? 'w-2.5 h-2.5'
          : 'w-2 h-2';

  return (
    <span
      className={`inline-flex items-center gap-1 px-1 py-0.5 select-none ${className}`}
      aria-label="Typing"
    >
      <span className={`${dotClass} rounded-full bg-current animate-typing-dot-1`} />
      <span className={`${dotClass} rounded-full bg-current animate-typing-dot-2`} />
      <span className={`${dotClass} rounded-full bg-current animate-typing-dot-3`} />
    </span>
  );
};
