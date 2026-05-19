import React from 'react';
import { cn } from '@/lib/utils';

export interface BadgeProps {
  variant?: 'primary' | 'success' | 'warning' | 'error' | 'info' | 'secondary' | 'outline';
  size?: 'sm' | 'md';
  children: React.ReactNode;
  className?: string;
}

const variantClasses = {
  primary: 'bg-primary/20 text-primary',
  success: 'bg-success/20 text-success',
  warning: 'bg-warning/20 text-warning',
  error: 'bg-error/20 text-error',
  info: 'bg-info/20 text-info',
  secondary: 'bg-surface-elevated text-text-secondary',
  outline: 'bg-transparent border border-border text-text-secondary',
};

const sizeClasses = {
  sm: 'px-2 py-0.5 text-xs',
  md: 'px-2.5 py-1 text-sm',
};

export function Badge({ variant = 'secondary', size = 'sm', children, className }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center font-medium rounded-full',
        variantClasses[variant],
        sizeClasses[size],
        className
      )}
    >
      {children}
    </span>
  );
}

export interface StatusBadgeProps {
  status: 'online' | 'away' | 'busy' | 'offline';
  showLabel?: boolean;
  className?: string;
}

const statusConfig = {
  online: { label: 'Online', color: 'bg-success' },
  away: { label: 'Away', color: 'bg-warning' },
  busy: { label: 'Do Not Disturb', color: 'bg-error' },
  offline: { label: 'Offline', color: 'bg-text-muted' },
};

export function StatusBadge({ status, showLabel = false, className }: StatusBadgeProps) {
  const config = statusConfig[status];

  return (
    <div className={cn('flex items-center gap-1.5', className)}>
      <span className={cn('w-2 h-2 rounded-full', config.color)} />
      {showLabel && <span className="text-xs text-text-secondary">{config.label}</span>}
    </div>
  );
}
