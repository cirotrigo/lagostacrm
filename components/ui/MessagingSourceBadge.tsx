import React from 'react';
import type { MessagingSource } from '@/types';
import { cn } from '@/lib/utils';

type MessagingSourceLike = MessagingSource | string | null | undefined;

type BadgeSize = 'xs' | 'sm';

interface MessagingSourceBadgeProps {
  source?: MessagingSourceLike;
  size?: BadgeSize;
  iconOnly?: boolean;
  className?: string;
}

const sizeClasses: Record<BadgeSize, string> = {
  xs: 'text-[10px] px-1.5 py-0.5',
  sm: 'text-xs px-2 py-0.5',
};

const iconSizeByBadge: Record<BadgeSize, string> = {
  xs: 'w-3 h-3',
  sm: 'w-3.5 h-3.5',
};

const iconOnlySizeClasses: Record<BadgeSize, string> = {
  xs: 'w-5 h-5',
  sm: 'w-6 h-6',
};

interface IconProps {
  className?: string;
}

const WhatsAppBrandIcon: React.FC<IconProps> = ({ className }) => (
  <svg viewBox="0 0 16 16" fill="currentColor" aria-hidden="true" className={className}>
    <path d="M13.601 2.326A7.854 7.854 0 0 0 8.055 0C3.714 0 .187 3.526.187 7.865c0 1.387.362 2.741 1.048 3.934L0 16l4.305-1.128a7.9 7.9 0 0 0 3.75.954h.003c4.341 0 7.868-3.525 7.868-7.864A7.86 7.86 0 0 0 13.6 2.326zM8.055 14.53h-.002a6.57 6.57 0 0 1-3.347-.916l-.24-.143-2.554.67.682-2.49-.156-.255a6.56 6.56 0 0 1-1.005-3.503c0-3.623 2.948-6.57 6.575-6.57 1.754 0 3.402.683 4.641 1.922a6.56 6.56 0 0 1 1.923 4.64c-.001 3.624-2.949 6.571-6.575 6.571z" />
    <path d="M11.446 9.054c-.185-.092-1.094-.54-1.263-.6-.169-.062-.292-.092-.415.092-.123.185-.477.6-.585.723-.108.123-.215.139-.4.046-.184-.092-.778-.286-1.482-.912-.547-.487-.915-1.088-1.023-1.272-.108-.185-.011-.285.082-.377.084-.083.185-.215.277-.323.092-.108.123-.185.185-.308.062-.123.03-.231-.015-.323-.046-.092-.415-.999-.569-1.37-.149-.36-.301-.31-.415-.315a8 8 0 0 0-.354-.006c-.123 0-.323.046-.492.231s-.646.631-.646 1.539.662 1.785.754 1.908c.092.123 1.303 1.99 3.158 2.79.441.19.785.303 1.054.388.443.141.846.121 1.164.073.355-.053 1.094-.446 1.248-.878.154-.431.154-.8.108-.877-.046-.077-.169-.123-.354-.215z" />
  </svg>
);

const InstagramBrandIcon: React.FC<IconProps> = ({ className }) => (
  <svg viewBox="0 0 16 16" fill="currentColor" aria-hidden="true" className={className}>
    <path d="M8 0C5.829 0 5.556.01 4.703.048 3.85.088 3.269.222 2.76.42a5.5 5.5 0 0 0-1.985 1.293A5.5 5.5 0 0 0 .48 3.698C.282 4.207.148 4.788.108 5.641.072 6.494.062 6.767.062 8.938c0 2.171.01 2.444.046 3.297.04.853.174 1.434.372 1.943.205.527.48.974.88 1.373.4.4.846.675 1.373.88.509.198 1.09.332 1.943.372.853.036 1.126.046 3.297.046 2.171 0 2.444-.01 3.297-.046.853-.04 1.434-.174 1.943-.372a5.5 5.5 0 0 0 1.373-.88c.4-.4.675-.846.88-1.373.198-.509.332-1.09.372-1.943.036-.853.046-1.126.046-3.297 0-2.171-.01-2.444-.046-3.297-.04-.853-.174-1.434-.372-1.943a5.5 5.5 0 0 0-.88-1.373A5.5 5.5 0 0 0 13.24.42c-.509-.198-1.09-.332-1.943-.372C10.444.01 10.171 0 8 0zm0 1.441c2.134 0 2.389.008 3.232.046.78.036 1.204.166 1.486.275.374.145.64.318.92.598.28.28.453.546.598.92.109.282.239.705.275 1.486.038.843.046 1.098.046 3.232s-.008 2.389-.046 3.232c-.036.78-.166 1.204-.275 1.486a4.1 4.1 0 0 1-.598.92 4.1 4.1 0 0 1-.92.598c-.282.109-.705.239-1.486.275-.843.038-1.098.046-3.232.046s-2.389-.008-3.232-.046c-.78-.036-1.204-.166-1.486-.275a4.1 4.1 0 0 1-.92-.598 4.1 4.1 0 0 1-.598-.92c-.109-.282-.239-.705-.275-1.486-.038-.843-.046-1.098-.046-3.232s.008-2.389.046-3.232c.036-.78.166-1.204.275-1.486.145-.374.318-.64.598-.92.28-.28.546-.453.92-.598.282-.109.705-.239 1.486-.275.843-.038 1.098-.046 3.232-.046z" />
    <path d="M8 3.896a4.104 4.104 0 1 0 0 8.208 4.104 4.104 0 0 0 0-8.208zm0 6.767a2.663 2.663 0 1 1 0-5.326 2.663 2.663 0 0 1 0 5.326zM13.224 3.733a.96.96 0 1 1-1.92 0 .96.96 0 0 1 1.92 0z" />
  </svg>
);

export function normalizeMessagingSource(source?: MessagingSourceLike): MessagingSource | null {
  if (!source) return null;
  const normalized = source.toString().trim().toUpperCase();

  if (normalized.includes('INSTAGRAM')) return 'INSTAGRAM';
  if (normalized.includes('WHATSAPP') || normalized === 'WPP') return 'WHATSAPP';
  return null;
}

export const MessagingSourceBadge: React.FC<MessagingSourceBadgeProps> = ({
  source,
  size = 'sm',
  iconOnly = false,
  className,
}) => {
  const normalizedSource = normalizeMessagingSource(source);
  if (!normalizedSource) return null;

  const isInstagram = normalizedSource === 'INSTAGRAM';
  const Icon = isInstagram ? InstagramBrandIcon : WhatsAppBrandIcon;
  const label = isInstagram ? 'Instagram' : 'WhatsApp';
  const tone = isInstagram
    ? 'bg-pink-100 text-pink-700 border-pink-200 dark:bg-pink-500/15 dark:text-pink-300 dark:border-pink-500/30'
    : 'bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-500/15 dark:text-emerald-300 dark:border-emerald-500/30';

  if (iconOnly) {
    return (
      <span
        title={label}
        aria-label={label}
        className={cn(
          'inline-flex items-center justify-center rounded-full border',
          tone,
          iconOnlySizeClasses[size],
          className
        )}
      >
        <Icon className={iconSizeByBadge[size]} />
      </span>
    );
  }

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full border font-semibold',
        tone,
        sizeClasses[size],
        className
      )}
    >
      <Icon className={iconSizeByBadge[size]} />
      {label}
    </span>
  );
};
