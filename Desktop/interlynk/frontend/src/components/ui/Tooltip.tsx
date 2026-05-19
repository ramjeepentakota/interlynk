import React, { useState, useRef } from 'react';
import { cn } from '@/lib/utils';

export interface TooltipProps {
  content: React.ReactNode;
  children: React.ReactNode;
  side?: 'top' | 'bottom' | 'left' | 'right';
  delay?: number;
}

export function Tooltip({ content, children, side = 'top', delay = 300 }: TooltipProps) {
  const [isVisible, setIsVisible] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showTooltip = () => {
    timeoutRef.current = setTimeout(() => setIsVisible(true), delay);
  };

  const hideTooltip = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    setIsVisible(false);
  };

  const positionClasses = {
    top: 'bottom-full left-1/2 -translate-x-1/2 mb-2',
    bottom: 'top-full left-1/2 -translate-x-1/2 mt-2',
    left: 'right-full top-1/2 -translate-y-1/2 mr-2',
    right: 'left-full top-1/2 -translate-y-1/2 ml-2',
  };

  const arrowClasses = {
    top: 'top-full left-1/2 -translate-x-1/2 border-t-surface-overlay',
    bottom: 'bottom-full left-1/2 -translate-x-1/2 border-b-surface-overlay',
    left: 'left-full top-1/2 -translate-y-1/2 border-l-surface-overlay',
    right: 'right-full top-1/2 -translate-y-1/2 border-r-surface-overlay',
  };

  return (
    <div
      className="relative inline-block"
      onMouseEnter={showTooltip}
      onMouseLeave={hideTooltip}
    >
      {children}
      <div
        className={cn(
          'absolute z-50 px-2 py-1 text-xs text-text-primary bg-surface-overlay border border-border rounded-md shadow-lg',
          'opacity-0 invisible transition-all duration-200',
          positionClasses[side],
          isVisible && 'opacity-100 visible'
        )}
      >
        {content}
        <span
          className={cn(
            'absolute w-0 h-0 border-4 border-transparent',
            arrowClasses[side]
          )}
        />
      </div>
    </div>
  );
}
