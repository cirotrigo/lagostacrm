import React from 'react';
import { Key, ArrowDown } from 'lucide-react';

import { useOptionalToast } from '@/context/ToastContext';

import { SettingsSection } from './SettingsSection';

export const ApiKeysSection: React.FC = () => {
  const { addToast } = useOptionalToast();

  const scrollToAIConfig = () => {
    const el = document.getElementById('ai-config');
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      return;
    }
    window.location.hash = '#ai-config';
  };

  const handleRevoke = () => {
    // Hoje esta área ainda é um placeholder (não existe backend/tabela de API keys do CRM).
    // Evitamos “botão que não faz nada” e direcionamos para o local correto para IA.
    addToast('Chaves de API do CRM ainda não foram implementadas. Para revogar chave da IA, use a seção “Inteligência Artificial”.', 'info');
    scrollToAIConfig();
  };

  const handleGenerate = () => {
    addToast('Geração de chaves de API do CRM ainda não foi implementada.', 'info');
  };

  return (
    <SettingsSection title="Chaves de API" icon={Key}>
      <p className="text-sm text-slate-600 dark:text-slate-300 mb-4 leading-relaxed">
        Esta seção é para chaves de acesso à API do NossoCRM (integrações). Ela ainda não está implementada.
        <br />
        Para configurar/revogar chaves da <strong>IA</strong>, use a seção <strong>Inteligência Artificial</strong> abaixo.
      </p>

      <div className="flex flex-col gap-3 bg-slate-50 dark:bg-black/30 p-4 rounded-lg border border-slate-200 dark:border-white/10 mb-5">
        <div className="flex items-center justify-between gap-3">
          <span className="text-sm text-slate-700 dark:text-slate-200 font-medium">Nenhuma chave de API do CRM criada</span>
          <span className="text-xs text-slate-500 dark:text-slate-400">Em breve</span>
        </div>
        <div className="flex gap-2 flex-wrap">
          <button
            type="button"
            onClick={handleGenerate}
            className="px-4 py-2 bg-slate-200/70 dark:bg-white/10 text-slate-600 dark:text-slate-300 text-sm font-semibold rounded-lg cursor-not-allowed"
            disabled
          >
            Gerar Nova Chave (em breve)
          </button>
          <button
            type="button"
            onClick={handleRevoke}
            className="px-4 py-2 bg-white dark:bg-black/10 border border-slate-200 dark:border-white/10 text-slate-700 dark:text-slate-200 text-sm font-semibold rounded-lg hover:bg-slate-100 dark:hover:bg-white/5 transition-colors flex items-center gap-2"
          >
            Ir para IA
            <ArrowDown className="h-4 w-4" />
          </button>
        </div>
      </div>
    </SettingsSection>
  );
};
