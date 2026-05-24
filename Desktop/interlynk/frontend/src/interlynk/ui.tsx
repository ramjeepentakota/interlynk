/* InterLynk UI primitives + hooks — ported from il-base.jsx */
import { useState } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import { STATUS_COLORS, type User } from './data';

export const cx = (...c: (string | false | null | undefined)[]) =>
  c.filter(Boolean).join(' ');

export const useHover = () => {
  const [h, sH] = useState(false);
  return [h, { onMouseEnter: () => sH(true), onMouseLeave: () => sH(false) }] as const;
};

/* ── Avatar ─────────────────────────────────────────────── */
export function Avatar({
  user,
  size = 32,
  showStatus = false,
  style,
}: {
  user?: Partial<User>;
  size?: number;
  showStatus?: boolean;
  style?: CSSProperties;
}) {
  const initials = (user?.name || '?')
    .split(' ')
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
  const bg = user?.color || 'var(--primary)';
  return (
    <div style={{ position: 'relative', flexShrink: 0, width: size, height: size, ...style }}>
      <div
        style={{
          width: size,
          height: size,
          borderRadius: '50%',
          background: bg,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#fff',
          fontWeight: 700,
          fontSize: size * 0.375,
          fontFamily: 'var(--ff-body)',
          userSelect: 'none',
          overflow: 'hidden',
        }}
      >
        {user?.avatar ? (
          <img src={user.avatar} alt={user.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        ) : (
          initials
        )}
      </div>
      {showStatus && (
        <div
          style={{
            position: 'absolute',
            bottom: -1,
            right: -1,
            width: size * 0.34,
            height: size * 0.34,
            borderRadius: '50%',
            background: STATUS_COLORS[user?.status || 'offline'],
            border: '2px solid var(--bg-sidebar)',
          }}
        />
      )}
    </div>
  );
}

/* ── AvatarStack ─────────────────────────────────────────── */
export function AvatarStack({ users, size = 22 }: { users: User[]; size?: number }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center' }}>
      {users.slice(0, 4).map((u, i) => (
        <div key={u.id} style={{ marginLeft: i === 0 ? 0 : -size * 0.3, zIndex: 4 - i }}>
          <Avatar user={u} size={size} />
        </div>
      ))}
    </div>
  );
}

/* ── Badge ───────────────────────────────────────────────── */
export function Badge({
  children,
  variant = 'primary',
  style,
}: {
  children: ReactNode;
  variant?: 'primary' | 'success' | 'warning' | 'error' | 'muted' | 'dimmed';
  style?: CSSProperties;
}) {
  const vs: Record<string, { bg: string; color: string }> = {
    primary: { bg: 'var(--primary)', color: '#fff' },
    success: { bg: 'var(--ok)', color: '#fff' },
    warning: { bg: 'var(--warn)', color: '#fff' },
    error: { bg: 'var(--err)', color: '#fff' },
    muted: { bg: 'var(--bd2)', color: 'var(--t2)' },
    dimmed: { bg: 'var(--primary-dim)', color: 'var(--primary)' },
  };
  const v = vs[variant] || vs.primary;
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        minWidth: 18,
        height: 18,
        padding: '0 5px',
        borderRadius: 9,
        fontSize: 11,
        fontWeight: 700,
        lineHeight: 1,
        background: v.bg,
        color: v.color,
        flexShrink: 0,
        ...style,
      }}
    >
      {children}
    </span>
  );
}

/* ── Button ──────────────────────────────────────────────── */
export function Btn({
  children,
  variant = 'ghost',
  size = 'md',
  onClick,
  disabled,
  style,
  className,
  title,
}: {
  children: ReactNode;
  variant?: 'primary' | 'ghost' | 'outline' | 'danger' | 'success' | 'active' | 'dim';
  size?: 'sm' | 'md' | 'lg' | 'icon' | 'icon-sm';
  onClick?: () => void;
  disabled?: boolean;
  style?: CSSProperties;
  className?: string;
  title?: string;
}) {
  const [h, hp] = useHover();
  const vs: Record<string, CSSProperties> = {
    primary: { background: h ? 'var(--primary-h)' : 'var(--primary)', color: '#fff', border: 'none' },
    ghost: { background: h ? 'var(--bg-hover)' : 'transparent', color: 'var(--t2)', border: 'none' },
    outline: { background: h ? 'var(--bg-hover)' : 'transparent', color: 'var(--t1)', border: '1px solid var(--bd2)' },
    danger: { background: h ? '#dc2626' : 'var(--err)', color: '#fff', border: 'none' },
    success: { background: h ? '#16a34a' : 'var(--ok)', color: '#fff', border: 'none' },
    active: { background: 'var(--primary-dim)', color: 'var(--primary)', border: 'none' },
    dim: { background: 'var(--bg-hover)', color: 'var(--t2)', border: 'none' },
  };
  const ss: Record<string, CSSProperties> = {
    sm: { padding: '4px 10px', fontSize: 12, height: 28, borderRadius: 'var(--r)' },
    md: { padding: '6px 14px', fontSize: 13.5, height: 34, borderRadius: 'var(--r)' },
    lg: { padding: '9px 20px', fontSize: 15, height: 40, borderRadius: 'var(--r)' },
    icon: { padding: '7px', fontSize: 13, height: 34, width: 34, borderRadius: 'var(--r)' },
    'icon-sm': { padding: '5px', fontSize: 12, height: 28, width: 28, borderRadius: 6 },
  };
  const v = vs[variant] || vs.ghost;
  const s = ss[size] || ss.md;
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={title}
      {...hp}
      className={className}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        fontFamily: 'var(--ff-body)',
        fontWeight: 500,
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.5 : 1,
        transition: 'all .14s',
        ...v,
        ...s,
        ...style,
      }}
    >
      {children}
    </button>
  );
}

/* ── Input ───────────────────────────────────────────────── */
export function Input({
  label,
  type = 'text',
  value,
  onChange,
  placeholder,
  icon,
  rightIcon,
  autoFocus,
  style,
}: {
  label?: string;
  type?: string;
  value?: string;
  onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
  placeholder?: string;
  icon?: ReactNode;
  rightIcon?: ReactNode;
  autoFocus?: boolean;
  style?: CSSProperties;
}) {
  const [focused, setFocused] = useState(false);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
      {label && (
        <label
          style={{
            fontSize: 12,
            fontWeight: 600,
            color: 'var(--t2)',
            textTransform: 'uppercase',
            letterSpacing: '.05em',
          }}
        >
          {label}
        </label>
      )}
      <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
        {icon && (
          <div style={{ position: 'absolute', left: 11, color: 'var(--t3)', pointerEvents: 'none', display: 'flex' }}>
            {icon}
          </div>
        )}
        <input
          type={type}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          autoFocus={autoFocus}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          style={{
            width: '100%',
            padding: `9px ${rightIcon ? 36 : 12}px 9px ${icon ? 36 : 12}px`,
            fontSize: 14,
            fontFamily: 'var(--ff-body)',
            background: 'var(--bg-hover)',
            border: `1.5px solid ${focused ? 'var(--primary)' : 'var(--bd)'}`,
            borderRadius: 'var(--r)',
            color: 'var(--t1)',
            outline: 'none',
            transition: 'border-color .15s',
            ...style,
          }}
        />
        {rightIcon && (
          <div style={{ position: 'absolute', right: 10, color: 'var(--t3)', display: 'flex', cursor: 'pointer' }}>
            {rightIcon}
          </div>
        )}
      </div>
    </div>
  );
}

/* ── Tooltip ─────────────────────────────────────────────── */
// The user explicitly asked to remove hover-label tooltips across the UI
// (settings/schedule/etc. were calling out their names on cursor-over).
// Keeping <Tip> as a passthrough preserves call sites without leaking
// floating chips into the page.
export function Tip({
  children,
}: {
  children: ReactNode;
  label?: string;
  pos?: 'top' | 'bottom' | 'right' | 'left';
}) {
  return <>{children}</>;
}
