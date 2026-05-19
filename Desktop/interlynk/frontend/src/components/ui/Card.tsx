import React from 'react';
import { cn } from '@/lib/utils';

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'elevated' | 'outlined';
  hoverable?: boolean;
}

export function Card({
  children,
  className,
  variant = 'default',
  hoverable = false,
  ...props
}: CardProps) {
  const baseStyles = 'rounded-xl';
  
  const variants = {
    default: 'bg-surface-elevated border border-border',
    elevated: 'bg-surface-elevated shadow-lg',
    outlined: 'bg-transparent border border-border',
  };

  return (
    <div
      className={cn(
        baseStyles,
        variants[variant],
        hoverable && 'hover:border-border-highlight hover:shadow-lg transition-all duration-200 cursor-pointer',
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}

export interface CardHeaderProps extends React.HTMLAttributes<HTMLDivElement> {}

export function CardHeader({ children, className, ...props }: CardHeaderProps) {
  return (
    <div className={cn('px-6 py-4 border-b border-border', className)} {...props}>
      {children}
    </div>
  );
}

export interface CardTitleProps extends React.HTMLAttributes<HTMLHeadingElement> {
  as?: 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6';
}

export function CardTitle({ as: Tag = 'h3', children, className, ...props }: CardTitleProps) {
  return (
    <Tag className={cn('text-lg font-semibold text-text-primary', className)} {...props}>
      {children}
    </Tag>
  );
}

export interface CardDescriptionProps extends React.HTMLAttributes<HTMLParagraphElement> {}

export function CardDescription({ children, className, ...props }: CardDescriptionProps) {
  return (
    <p className={cn('text-sm text-text-secondary mt-1', className)} {...props}>
      {children}
    </p>
  );
}

export interface CardContentProps extends React.HTMLAttributes<HTMLDivElement> {}

export function CardContent({ children, className, ...props }: CardContentProps) {
  return (
    <div className={cn('px-6 py-4', className)} {...props}>
      {children}
    </div>
  );
}

export interface CardFooterProps extends React.HTMLAttributes<HTMLDivElement> {}

export function CardFooter({ children, className, ...props }: CardFooterProps) {
  return (
    <div className={cn('px-6 py-4 border-t border-border', className)} {...props}>
      {children}
    </div>
  );
}
