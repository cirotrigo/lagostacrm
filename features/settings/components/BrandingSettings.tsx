'use client';

import React, { useState, useEffect } from 'react';
import { Palette, Save, Loader2, Check } from 'lucide-react';
import { useBrandingContext } from '@/context/BrandingContext';

/**
 * Cores pré-definidas para facilitar a escolha.
 * O admin também pode digitar um hex customizado.
 */
const PRESET_COLORS = [
  { hex: '#3B82F6', name: 'Azul' },
  { hex: '#16A34A', name: 'Verde' },
  { hex: '#F97316', name: 'Laranja' },
  { hex: '#EF4444', name: 'Vermelho' },
  { hex: '#B91C1C', name: 'Vermelho Escuro' },
  { hex: '#8B5CF6', name: 'Roxo' },
  { hex: '#EC4899', name: 'Rosa' },
  { hex: '#F59E0B', name: 'Amarelo' },
  { hex: '#14B8A6', name: 'Teal' },
  { hex: '#6366F1', name: 'Indigo' },
  { hex: '#0EA5E9', name: 'Azul Claro' },
  { hex: '#84CC16', name: 'Lima' },
];

/**
 * Seção de configurações de branding na página de Settings.
 * Permite ao admin alterar nome, nome curto, cor primária e descrição.
 * Apenas visível para admins.
 */
export const BrandingSettings: React.FC = () => {
  const { brand } = useBrandingContext();

  const [brandName, setBrandName] = useState('');
  const [brandShortName, setBrandShortName] = useState('');
  const [brandPrimaryColor, setBrandPrimaryColor] = useState('#3B82F6');
  const [brandDescription, setBrandDescription] = useState('');

  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Carregar valores atuais do banco quando o branding context atualizar
  useEffect(() => {
    if (brand.name) {
      setBrandName(brand.name);
      setBrandShortName(brand.shortName || '');
      setBrandPrimaryColor(brand.primaryColor || '#3B82F6');
      setBrandDescription(brand.description || '');
    }
  }, [brand]);

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    setSaved(false);

    try {
      const res = await fetch('/api/branding', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          brandName: brandName.trim(),
          brandShortName: brandShortName.trim() || brandName.trim(),
          brandPrimaryColor,
          brandDescription: brandDescription.trim(),
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Erro ao salvar');
      }

      setSaved(true);
      // Recarregar a página para aplicar o novo branding em todos os componentes
      setTimeout(() => {
        window.location.reload();
      }, 1000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao salvar configurações');
    } finally {
      setSaving(false);
    }
  };

  const isHexValid = /^#[0-9A-Fa-f]{6}$/.test(brandPrimaryColor);

  return (
    <div className="mb-12">
      <div className="bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-2xl p-6">
        <div className="mb-6">
          <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-1 flex items-center gap-2">
            <Palette className="h-5 w-5" /> Personalização da Marca
          </h3>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Configure o nome, cor e identidade visual do seu CRM.
          </p>
        </div>

        <div className="space-y-6">
          {/* Nome da marca */}
          <div>
            <label
              htmlFor="brand-name"
              className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5"
            >
              Nome da Marca
            </label>
            <input
              id="brand-name"
              type="text"
              value={brandName}
              onChange={(e) => setBrandName(e.target.value)}
              placeholder="Ex: Coronel Picanha, SosPet..."
              className="w-full max-w-md px-4 py-2.5 bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-white/10 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-slate-900 dark:text-white transition-all"
              maxLength={100}
            />
            <p className="text-xs text-slate-400 mt-1">
              Exibido na sidebar, chat IA e título do navegador.
            </p>
          </div>

          {/* Nome curto */}
          <div>
            <label
              htmlFor="brand-short-name"
              className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5"
            >
              Nome Curto
            </label>
            <input
              id="brand-short-name"
              type="text"
              value={brandShortName}
              onChange={(e) => setBrandShortName(e.target.value)}
              placeholder="Ex: Coronel, Pet..."
              className="w-full max-w-xs px-4 py-2.5 bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-white/10 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-slate-900 dark:text-white transition-all"
              maxLength={50}
            />
            <p className="text-xs text-slate-400 mt-1">
              Usado em dispositivos móveis e quando o espaço é limitado.
            </p>
          </div>

          {/* Cor primária */}
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
              Cor Primária
            </label>

            {/* Grade de cores pré-definidas */}
            <div className="flex flex-wrap gap-2 mb-3">
              {PRESET_COLORS.map((color) => (
                <button
                  key={color.hex}
                  type="button"
                  onClick={() => setBrandPrimaryColor(color.hex)}
                  title={color.name}
                  className={`w-9 h-9 rounded-xl border-2 transition-all ${
                    brandPrimaryColor === color.hex
                      ? 'border-slate-900 dark:border-white scale-110 shadow-lg'
                      : 'border-transparent hover:border-slate-300 dark:hover:border-white/30 hover:scale-105'
                  }`}
                  style={{ backgroundColor: color.hex }}
                />
              ))}
            </div>

            {/* Input hex customizado */}
            <div className="flex items-center gap-3 max-w-xs">
              <div
                className="w-10 h-10 rounded-xl border border-slate-200 dark:border-white/10 shrink-0"
                style={{ backgroundColor: isHexValid ? brandPrimaryColor : '#ccc' }}
              />
              <input
                id="brand-color"
                type="text"
                value={brandPrimaryColor}
                onChange={(e) => setBrandPrimaryColor(e.target.value)}
                placeholder="#FF6B00"
                className={`w-full px-4 py-2.5 bg-slate-50 dark:bg-black/20 border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500 text-slate-900 dark:text-white transition-all font-mono text-sm ${
                  isHexValid
                    ? 'border-slate-200 dark:border-white/10'
                    : 'border-red-400 dark:border-red-500'
                }`}
                maxLength={7}
              />
            </div>
            {!isHexValid && brandPrimaryColor.length > 0 && (
              <p className="text-xs text-red-500 mt-1">
                Formato inválido. Use hex com 6 dígitos (ex: #FF6B00)
              </p>
            )}
          </div>

          {/* Descrição */}
          <div>
            <label
              htmlFor="brand-description"
              className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5"
            >
              Descrição
            </label>
            <input
              id="brand-description"
              type="text"
              value={brandDescription}
              onChange={(e) => setBrandDescription(e.target.value)}
              placeholder="Ex: CRM Inteligente para Gestão de Atendimento"
              className="w-full max-w-lg px-4 py-2.5 bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-white/10 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-slate-900 dark:text-white transition-all"
              maxLength={200}
            />
            <p className="text-xs text-slate-400 mt-1">
              Usado em SEO e no manifesto PWA.
            </p>
          </div>

          {/* Preview */}
          <div className="mt-6 p-4 bg-slate-50 dark:bg-black/20 rounded-xl border border-slate-200 dark:border-white/10">
            <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-3 uppercase tracking-wider">
              Preview
            </p>
            <div className="flex items-center gap-3">
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold text-lg shadow-lg shrink-0"
                style={{
                  background: isHexValid
                    ? `linear-gradient(135deg, ${brandPrimaryColor}, ${brandPrimaryColor}dd)`
                    : '#ccc',
                }}
              >
                {brandName?.[0]?.toUpperCase() || 'N'}
              </div>
              <div>
                <span className="text-lg font-bold text-slate-900 dark:text-white">
                  {brandName || 'Nome da Marca'}
                </span>
                {brandShortName && brandShortName !== brandName && (
                  <span className="text-sm text-slate-400 ml-2">({brandShortName})</span>
                )}
              </div>
            </div>
          </div>

          {/* Botão salvar */}
          <div className="flex items-center gap-3 pt-2">
            <button
              type="button"
              onClick={handleSave}
              disabled={saving || !brandName.trim() || !isHexValid}
              className="flex items-center gap-2 px-5 py-2.5 bg-primary-600 hover:bg-primary-700 disabled:bg-slate-300 dark:disabled:bg-slate-700 text-white rounded-xl font-medium text-sm transition-colors"
            >
              {saving ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : saved ? (
                <Check className="h-4 w-4" />
              ) : (
                <Save className="h-4 w-4" />
              )}
              {saving ? 'Salvando...' : saved ? 'Salvo!' : 'Salvar'}
            </button>

            {error && (
              <p className="text-sm text-red-500">{error}</p>
            )}

            {saved && (
              <p className="text-sm text-green-600 dark:text-green-400">
                Configurações salvas. Recarregando...
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
