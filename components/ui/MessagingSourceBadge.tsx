import React from 'react';
import { Instagram, MessageCircle } from 'lucide-react';
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
  const Icon = isInstagram ? Instagram : MessageCircle;
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

