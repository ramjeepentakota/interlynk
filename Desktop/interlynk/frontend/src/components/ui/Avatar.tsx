import React from 'react';
import { cn, getInitials } from '@/lib/utils';
import type { UserStatus } from '@/types';

export interface AvatarProps {
  src?: string;
  alt?: string;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  status?: UserStatus;
  className?: string;
  fallback?: string;
}

const sizeClasses = {
  xs: 'w-6 h-6 text-xs',
  sm: 'w-8 h-8 text-sm',
  md: 'w-10 h-10 text-base',
  lg: 'w-12 h-12 text-lg',
  xl: 'w-16 h-16 text-xl',
};

const statusSizes = {
  xs: 'w-2 h-2',
  sm: 'w-2.5 h-2.5',
  md: 'w-3 h-3',
  lg: 'w-3.5 h-3.5',
  xl: 'w-4 h-4',
};

const statusClasses = {
  online: 'bg-success',
  away: 'bg-warning',
  busy: 'bg-error',
  offline: 'bg-text-muted',
};

export function Avatar({
  src,
  alt,
  size = 'md',
  status,
  className,
  fallback,
}: AvatarProps) {
  const [imageError, setImageError] = React.useState(false);
  const showFallback = !src || imageError;

  return (
    <div className={cn('relative inline-block', className)}>
      <div
        className={cn(
          'rounded-full overflow-hidden bg-surface-elevated flex items-center justify-center',
          'ring-2 ring-offset-2 ring-offset-background-primary ring-border',
          sizeClasses[size]
        )}
      >
        {showFallback ? (
          <span className="font-medium text-text-secondary">
            {fallback ? getInitials(fallback) : '?'}
          </span>
        ) : (
          <img
            src={src}
            alt={alt}
            className="w-full h-full object-cover"
            onError={() => setImageError(true)}
          />
        )}
      </div>
      {status && (
        <span
          className={cn(
            'absolute bottom-0 right-0 rounded-full border-2 border-background-primary',
            statusSizes[size],
            statusClasses[status]
          )}
        />
      )}
    </div>
  );
}

export interface AvatarGroupProps {
  avatars: Array<{ src?: string; alt?: string; fallback?: string }>;
  max?: number;
  size?: 'xs' | 'sm' | 'md' | 'lg';
}

export function AvatarGroup({ avatars, max = 4, size = 'sm' }: AvatarGroupProps) {
  const visibleAvatars = avatars.slice(0, max);
  const remainingCount = avatars.length - max;

  return (
    <div className="flex -space-x-2">
      {visibleAvatars.map((avatar, index) => (
        <Avatar
          key={index}
          src={avatar.src}
          alt={avatar.alt}
          fallback={avatar.fallback}
          size={size}
          className="ring-2 ring-offset-background-primary ring-offset-2 ring-background-primary"
        />
      ))}
      {remainingCount > 0 && (
        <div
          className={cn(
            'rounded-full bg-surface-elevated flex items-center justify-center',
            'text-xs font-medium text-text-secondary ring-2',
            'ring-offset-background-primary ring-offset-2 ring-background-primary',
            sizeClasses[size]
          )}
        >
          +{remainingCount}
        </div>
      )}
    </div>
  );
}
