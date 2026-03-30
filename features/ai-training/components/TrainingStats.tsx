'use client';

import React from 'react';
import { FileText, Package, Hash } from 'lucide-react';
import type { TrainingStats as TrainingStatsType } from '@/lib/ai-training/types';

interface TrainingStatsProps {
    stats: TrainingStatsType;
    isLoading?: boolean;
}

function formatNumber(num: number): string {
    if (num >= 1000000) {
        return `${(num / 1000000).toFixed(1)}M`;
    }
    if (num >= 1000) {
        return `${(num / 1000).toFixed(1)}k`;
    }
    return num.toString();
}

export const TrainingStats: React.FC<TrainingStatsProps> = ({ stats, isLoading }) => {
    const items = [
        {
            icon: FileText,
            value: stats.totalDocuments,
            label: 'Documentos',
            color: 'text-blue-500',
        },
        {
            icon: Package,
            value: stats.totalChunks,
            label: 'Chunks',
            color: 'text-purple-500',
        },
        {
            icon: Hash,
            value: stats.totalTokens,
            label: 'Tokens',
            color: 'text-green-500',
        },
    ];

    return (
        <div className="grid grid-cols-3 gap-3">
            {items.map((item) => (
                <div
                    key={item.label}
                    className="flex flex-col items-center justify-center p-4 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50/60 dark:bg-white/3"
                >
                    <item.icon className={`h-5 w-5 ${item.color} mb-2`} />
                    <div className={`text-2xl font-bold text-slate-900 dark:text-white ${isLoading ? 'animate-pulse' : ''}`}>
                        {isLoading ? '-' : formatNumber(item.value)}
                    </div>
                    <div className="text-xs text-slate-500 dark:text-slate-400">
                        {item.label}
                    </div>
                </div>
            ))}
        </div>
    );
};
