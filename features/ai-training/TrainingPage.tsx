'use client';

import React from 'react';
import { GraduationCap } from 'lucide-react';
import { AITrainingSection } from './AITrainingSection';

/**
 * Página dedicada ao Treinamento do Agente IA
 * Permite adicionar documentos, textos e Q&A para a base de conhecimento
 */
const TrainingPage: React.FC = () => {
    return (
        <div className="max-w-4xl mx-auto">
            {/* Header */}
            <div className="mb-6">
                <div className="flex items-center gap-3 mb-2">
                    <div className="p-2 rounded-xl bg-primary-500/10">
                        <GraduationCap className="h-6 w-6 text-primary-500" />
                    </div>
                    <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
                        Treinamento do Agente
                    </h1>
                </div>
                <p className="text-slate-500 dark:text-slate-400">
                    Adicione documentos, textos e perguntas frequentes para enriquecer a base de
                    conhecimento do agente de atendimento.
                </p>
            </div>

            {/* Training Section */}
            <AITrainingSection />
        </div>
    );
};

export default TrainingPage;
