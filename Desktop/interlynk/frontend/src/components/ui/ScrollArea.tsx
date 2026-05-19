import React from 'react';
import { cn } from '@/lib/utils';

export interface ScrollAreaProps extends React.HTMLAttributes<HTMLDivElement> {
  orientation?: 'vertical' | 'horizontal';
}

export function ScrollArea({
  children,
  className,
  orientation = 'vertical',
  ...props
}: ScrollAreaProps) {
  const orientationClasses = {
    vertical: 'overflow-y-auto',
    horizontal: 'overflow-x-auto',
  };

  return (
    <div
      className={cn(
        'relative',
        orientationClasses[orientation],
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}
