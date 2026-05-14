'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Smartphone,
  QrCode,
  CheckCircle2,
  XCircle,
  Loader2,
  Wifi,
  WifiOff,
  RefreshCw,
  Power,
  Link2,
  Copy,
  Settings as SettingsIcon,
  AlertTriangle,
} from 'lucide-react';
import { Modal } from '@/components/ui/Modal';

type EvolutionState = 'open' | 'connecting' | 'close' | 'qrcode' | 'unknown';

type InstanceResponse = {
  configured: boolean;
  instance: {
    id: string;
    instance_name: string;
    base_url: string;
    phone_number: string | null;
    profile_name: string | null;
    profile_picture_url: string | null;
    last_status: EvolutionState;
    last_synced_at: string | null;
  } | null;
  liveError?: string | null;
};

const STATE_CONFIG: Record<
  EvolutionState,
  { label: string; bg: string; text: string; icon: React.ElementType; description: string }
> = {
  open: {
    label: 'Conectado',
    bg: 'bg-green-100 dark:bg-green-500/20 border-green-300 dark:border-green-500/40',
    text: 'text-green-700 dark:text-green-300',
    icon: CheckCircle2,
    description: 'WhatsApp ativo e recebendo mensagens.',
  },
  connecting: {
    label: 'Conectando',
    bg: 'bg-amber-100 dark:bg-amber-500/20 border-amber-300 dark:border-amber-500/40',
    text: 'text-amber-700 dark:text-amber-300',
    icon: Loader2,
    description: 'Aguardando finalizar a conexão.',
  },
  qrcode: {
    label: 'Aguardando QR',
    bg: 'bg-blue-100 dark:bg-blue-500/20 border-blue-300 dark:border-blue-500/40',
    text: 'text-blue-700 dark:text-blue-300',
    icon: QrCode,
    description: 'Sessão aguardando ser escaneada.',
  },
  close: {
    label: 'Desconectado',
    bg: 'bg-red-100 dark:bg-red-500/20 border-red-300 dark:border-red-500/40',
    text: 'text-red-700 dark:text-red-300',
    icon: WifiOff,
    description: 'WhatsApp offline. A Sofia não está recebendo mensagens.',
  },
  unknown: {
    label: 'Desconhecido',
    bg: 'bg-slate-100 dark:bg-white/10 border-slate-300 dark:border-white/20',
    text: 'text-slate-700 dark:text-slate-300',
    icon: AlertTriangle,
    description: 'Não foi possível consultar o estado.',
  },
};

export const EvolutionSection: React.FC = () => {
  const [data, setData] = useState<InstanceResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const [qrModalOpen, setQrModalOpen] = useState(false);
  const [qrBase64, setQrBase64] = useState<string | null>(null);
  const [pairingCode, setPairingCode] = useState<string | null>(null);
  const qrRefreshTimer = useRef<NodeJS.Timeout | null>(null);

  const [setupOpen, setSetupOpen] = useState(false);
  const [setupName, setSetupName] = useState('');
  const [setupUrl, setSetupUrl] = useState('');
  const [setupKey, setSetupKey] = useState('');

  const [shareOpen, setShareOpen] = useState(false);
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [shareCopied, setShareCopied] = useState(false);
  const [shareTtl, setShareTtl] = useState<number>(60);

  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch('/api/integrations/evolution', { credentials: 'include' });
      const body: InstanceResponse = await res.json();
      if (!res.ok) {
        setError((body as any)?.error || `HTTP ${res.status}`);
        return;
      }
      setData(body);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro de rede');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStatus();
    const t = setInterval(fetchStatus, 10000); // refresh status every 10s
    return () => clearInterval(t);
  }, [fetchStatus]);

  const fetchQR = useCallback(async () => {
    try {
      const res = await fetch('/api/integrations/evolution/connect', {
        method: 'POST',
        credentials: 'include',
      });
      const body = await res.json();
      if (!res.ok) {
        setError(body?.error || `Falha ao gerar QR (HTTP ${res.status})`);
        return;
      }
      setQrBase64(body.qrBase64 ?? null);
      setPairingCode(body.pairingCode ?? null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao gerar QR');
    }
  }, []);

  const openQrModal = async () => {
    setQrModalOpen(true);
    setActionLoading('connect');
    await fetchQR();
    setActionLoading(null);
    // refresh QR a cada 20s enquanto modal estiver aberto
    qrRefreshTimer.current = setInterval(() => {
      fetchQR();
      fetchStatus();
    }, 20000);
  };

  const closeQrModal = () => {
    setQrModalOpen(false);
    setQrBase64(null);
    setPairingCode(null);
    if (qrRefreshTimer.current) {
      clearInterval(qrRefreshTimer.current);
      qrRefreshTimer.current = null;
    }
  };

  useEffect(() => {
    // se conectar enquanto modal aberto, fecha
    if (qrModalOpen && data?.instance?.last_status === 'open') {
      closeQrModal();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data?.instance?.last_status]);

  const handleDisconnect = async () => {
    if (!confirm('Desconectar o WhatsApp? Será preciso escanear um novo QR Code para reconectar.')) return;
    setActionLoading('disconnect');
    try {
      const res = await fetch('/api/integrations/evolution/disconnect', {
        method: 'POST',
        credentials: 'include',
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        alert(body?.error || `Falha (HTTP ${res.status})`);
      }
      await fetchStatus();
    } finally {
      setActionLoading(null);
    }
  };

  const handleRestart = async () => {
    setActionLoading('restart');
    try {
      const res = await fetch('/api/integrations/evolution/restart', {
        method: 'POST',
        credentials: 'include',
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        alert(body?.error || `Falha (HTTP ${res.status})`);
      }
      await fetchStatus();
    } finally {
      setActionLoading(null);
    }
  };

  const handleSetupSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setActionLoading('setup');
    try {
      const res = await fetch('/api/integrations/evolution', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          instance_name: setupName.trim(),
          base_url: setupUrl.trim(),
          api_key: setupKey.trim(),
        }),
      });
      const body = await res.json();
      if (!res.ok) {
        alert(body?.error || `Falha (HTTP ${res.status})`);
        return;
      }
      setSetupOpen(false);
      setSetupName('');
      setSetupUrl('');
      setSetupKey('');
      await fetchStatus();
    } finally {
      setActionLoading(null);
    }
  };

  const handleShareGenerate = async () => {
    setActionLoading('share');
    setShareUrl(null);
    setShareCopied(false);
    try {
      const res = await fetch('/api/integrations/evolution/share', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ ttlMinutes: shareTtl }),
      });
      const body = await res.json();
      if (!res.ok) {
        alert(body?.error || `Falha (HTTP ${res.status})`);
        return;
      }
      setShareUrl(body.url);
    } finally {
      setActionLoading(null);
    }
  };

  const copyShareUrl = async () => {
    if (!shareUrl) return;
    try {
      await navigator.clipboard.writeText(shareUrl);
      setShareCopied(true);
      setTimeout(() => setShareCopied(false), 2500);
    } catch {
      // ignore
    }
  };

  if (loading) {
    return (
      <div className="bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-2xl p-6 flex items-center gap-3">
        <Loader2 className="h-5 w-5 animate-spin text-slate-400" />
        <span className="text-sm text-slate-500">Carregando configuração…</span>
      </div>
    );
  }

  if (!data?.configured) {
    return (
      <>
        <div className="bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-2xl p-6">
          <div className="flex items-start gap-3 mb-4">
            <div className="p-2 bg-green-500/10 rounded-lg">
              <Smartphone className="h-5 w-5 text-green-600 dark:text-green-400" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-slate-900 dark:text-white">WhatsApp (Evolution)</h3>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Nenhuma instância configurada para esta organização.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setSetupOpen(true)}
            className="inline-flex items-center gap-2 px-4 py-2 bg-primary-600 hover:bg-primary-500 text-white text-sm font-semibold rounded-lg shadow-md shadow-primary-600/20"
          >
            <SettingsIcon className="h-4 w-4" />
            Configurar instância
          </button>
        </div>
        <SetupModal
          open={setupOpen}
          onClose={() => setSetupOpen(false)}
          name={setupName}
          url={setupUrl}
          apiKey={setupKey}
          setName={setSetupName}
          setUrl={setSetupUrl}
          setApiKey={setSetupKey}
          onSubmit={handleSetupSubmit}
          loading={actionLoading === 'setup'}
        />
      </>
    );
  }

  const inst = data.instance!;
  const state = inst.last_status;
  const cfg = STATE_CONFIG[state] ?? STATE_CONFIG.unknown;
  const Icon = cfg.icon;
  const isOpen = state === 'open';

  return (
    <>
      <div className="bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-2xl overflow-hidden">
        {/* Header */}
        <div className="p-6 border-b border-slate-200 dark:border-white/10">
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div className="flex items-start gap-3">
              <div className="p-2 bg-green-500/10 rounded-lg">
                <Smartphone className="h-5 w-5 text-green-600 dark:text-green-400" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-slate-900 dark:text-white">WhatsApp (Evolution)</h3>
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  Instância <strong>{inst.instance_name}</strong> usada pelo agente de IA.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setSetupOpen(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-white/5 hover:bg-slate-200 dark:hover:bg-white/10 rounded-lg"
            >
              <SettingsIcon className="h-3.5 w-3.5" />
              Editar configuração
            </button>
          </div>
        </div>

        {/* Status card */}
        <div className="p-6">
          <div className={`flex items-start gap-4 p-4 border rounded-xl ${cfg.bg}`}>
            <Icon
              className={`h-8 w-8 flex-shrink-0 ${cfg.text} ${state === 'connecting' ? 'animate-spin' : ''}`}
            />
            <div className="flex-1 min-w-0">
              <div className={`text-base font-bold ${cfg.text}`}>{cfg.label}</div>
              <p className={`text-sm mt-0.5 ${cfg.text}`}>{cfg.description}</p>
              {inst.phone_number && (
                <p className="text-xs text-slate-600 dark:text-slate-400 mt-2">
                  Número: <strong>+{inst.phone_number}</strong>
                  {inst.profile_name && ` · ${inst.profile_name}`}
                </p>
              )}
              {inst.last_synced_at && (
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                  Última verificação: {new Date(inst.last_synced_at).toLocaleString('pt-BR')}
                </p>
              )}
              {data.liveError && (
                <p className="text-[11px] text-red-600 dark:text-red-400 mt-1">
                  ⚠ {data.liveError}
                </p>
              )}
            </div>
            <button
              type="button"
              onClick={fetchStatus}
              className="p-1.5 rounded-lg hover:bg-white/30 dark:hover:bg-black/20"
              title="Atualizar"
            >
              <RefreshCw className="h-4 w-4 text-slate-500 dark:text-slate-300" />
            </button>
          </div>

          {/* Action buttons */}
          <div className="mt-5 flex flex-wrap gap-2">
            {!isOpen && (
              <button
                type="button"
                onClick={openQrModal}
                disabled={actionLoading !== null}
                className="inline-flex items-center gap-2 px-4 py-2 bg-primary-600 hover:bg-primary-500 disabled:opacity-50 text-white text-sm font-semibold rounded-lg shadow-md shadow-primary-600/20"
              >
                <QrCode className="h-4 w-4" />
                Conectar (escanear QR)
              </button>
            )}
            <button
              type="button"
              onClick={() => {
                setShareOpen(true);
                setShareUrl(null);
                setShareCopied(false);
              }}
              disabled={actionLoading !== null}
              className="inline-flex items-center gap-2 px-4 py-2 bg-slate-100 dark:bg-white/10 hover:bg-slate-200 dark:hover:bg-white/15 disabled:opacity-50 text-slate-700 dark:text-white text-sm font-semibold rounded-lg border border-slate-200 dark:border-white/10"
            >
              <Link2 className="h-4 w-4" />
              Gerar link para o cliente
            </button>
            {isOpen && (
              <>
                <button
                  type="button"
                  onClick={handleRestart}
                  disabled={actionLoading !== null}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-slate-100 dark:bg-white/10 hover:bg-slate-200 dark:hover:bg-white/15 disabled:opacity-50 text-slate-700 dark:text-white text-sm font-semibold rounded-lg border border-slate-200 dark:border-white/10"
                >
                  {actionLoading === 'restart' ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <RefreshCw className="h-4 w-4" />
                  )}
                  Reiniciar
                </button>
                <button
                  type="button"
                  onClick={handleDisconnect}
                  disabled={actionLoading !== null}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-red-50 dark:bg-red-500/10 hover:bg-red-100 dark:hover:bg-red-500/20 disabled:opacity-50 text-red-700 dark:text-red-300 text-sm font-semibold rounded-lg border border-red-200 dark:border-red-500/30"
                >
                  {actionLoading === 'disconnect' ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Power className="h-4 w-4" />
                  )}
                  Desconectar
                </button>
              </>
            )}
          </div>

          {error && (
            <div className="mt-4 p-3 bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/30 rounded-lg flex items-start gap-2 text-sm text-red-700 dark:text-red-300">
              <XCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}
        </div>
      </div>

      {/* QR Modal */}
      <Modal
        isOpen={qrModalOpen}
        onClose={closeQrModal}
        title={`Conectar ${inst.instance_name}`}
        size="md"
      >
        <div className="text-center space-y-4">
          {actionLoading === 'connect' && !qrBase64 ? (
            <div className="py-8">
              <Loader2 className="h-10 w-10 animate-spin text-slate-400 mx-auto mb-2" />
              <p className="text-sm text-slate-500">Gerando QR Code…</p>
            </div>
          ) : qrBase64 ? (
            <>
              <ol className="text-xs text-slate-600 dark:text-slate-400 text-left space-y-1.5 bg-slate-50 dark:bg-white/5 rounded-lg p-4">
                <li>1. Abra o WhatsApp no celular</li>
                <li>
                  2. Toque em <strong>Menu</strong> (⋮) ou <strong>Ajustes</strong>
                </li>
                <li>
                  3. Toque em <strong>Aparelhos conectados</strong>
                </li>
                <li>
                  4. Toque em <strong>Conectar um aparelho</strong>
                </li>
                <li>5. Aponte o celular para esta tela</li>
              </ol>
              <div className="inline-block p-3 bg-white border-2 border-slate-200 rounded-xl">
                <img src={qrBase64} alt="QR Code" className="w-64 h-64 block" />
              </div>
              {pairingCode && (
                <div className="p-3 bg-blue-50 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-500/30 rounded-lg">
                  <p className="text-xs text-blue-700 dark:text-blue-300 mb-1">
                    Ou digite este código no WhatsApp:
                  </p>
                  <p className="text-2xl font-bold tracking-widest text-blue-900 dark:text-blue-200 tabular-nums">
                    {pairingCode}
                  </p>
                </div>
              )}
              <p className="text-[11px] text-slate-400 flex items-center justify-center gap-1">
                <RefreshCw className="h-3 w-3 animate-spin" />
                QR atualiza a cada 20s
              </p>
            </>
          ) : (
            <div className="py-8 text-sm text-red-600 dark:text-red-400">
              Não foi possível gerar o QR Code. Tente novamente.
            </div>
          )}
        </div>
      </Modal>

      {/* Setup Modal */}
      <SetupModal
        open={setupOpen}
        onClose={() => setSetupOpen(false)}
        name={setupName}
        url={setupUrl}
        apiKey={setupKey}
        setName={setSetupName}
        setUrl={setSetupUrl}
        setApiKey={setSetupKey}
        onSubmit={handleSetupSubmit}
        loading={actionLoading === 'setup'}
        currentInstance={inst.instance_name}
        currentUrl={inst.base_url}
      />

      {/* Share Modal */}
      <Modal isOpen={shareOpen} onClose={() => setShareOpen(false)} title="Gerar link para o cliente" size="md">
        <div className="space-y-4">
          <p className="text-sm text-slate-600 dark:text-slate-400">
            Crie um link temporário que o cliente final pode abrir no celular dele para escanear o QR Code, sem precisar logar no CRM.
          </p>
          <div>
            <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1.5">
              Validade do link
            </label>
            <select
              value={shareTtl}
              onChange={(e) => setShareTtl(Number(e.target.value))}
              className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-white/5 text-sm dark:text-white outline-none focus:ring-2 focus:ring-primary-500"
            >
              <option value={15}>15 minutos</option>
              <option value={30}>30 minutos</option>
              <option value={60}>1 hora</option>
              <option value={180}>3 horas</option>
              <option value={720}>12 horas</option>
              <option value={1440}>24 horas</option>
            </select>
          </div>

          {!shareUrl ? (
            <button
              type="button"
              onClick={handleShareGenerate}
              disabled={actionLoading === 'share'}
              className="w-full inline-flex items-center justify-center gap-2 px-4 py-2 bg-primary-600 hover:bg-primary-500 disabled:opacity-50 text-white text-sm font-semibold rounded-lg"
            >
              {actionLoading === 'share' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Link2 className="h-4 w-4" />}
              Gerar link
            </button>
          ) : (
            <div className="space-y-2">
              <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase">
                Link para enviar ao cliente
              </label>
              <div className="flex gap-2">
                <input
                  readOnly
                  value={shareUrl}
                  onClick={(e) => (e.target as HTMLInputElement).select()}
                  className="flex-1 px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-white/5 text-sm dark:text-white font-mono"
                />
                <button
                  type="button"
                  onClick={copyShareUrl}
                  className="inline-flex items-center gap-1.5 px-3 py-2 bg-primary-600 hover:bg-primary-500 text-white text-sm font-semibold rounded-lg"
                >
                  {shareCopied ? <CheckCircle2 className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                  {shareCopied ? 'Copiado!' : 'Copiar'}
                </button>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Envie este link para o cliente. Ele vai abrir no celular, escanear o QR e a conexão será automática.
              </p>
            </div>
          )}
        </div>
      </Modal>
    </>
  );
};

const SetupModal: React.FC<{
  open: boolean;
  onClose: () => void;
  name: string;
  url: string;
  apiKey: string;
  setName: (v: string) => void;
  setUrl: (v: string) => void;
  setApiKey: (v: string) => void;
  onSubmit: (e: React.FormEvent) => void;
  loading: boolean;
  currentInstance?: string;
  currentUrl?: string;
}> = ({ open, onClose, name, url, apiKey, setName, setUrl, setApiKey, onSubmit, loading, currentInstance, currentUrl }) => (
  <Modal isOpen={open} onClose={onClose} title="Configurar instância Evolution" size="md">
    <form onSubmit={onSubmit} className="space-y-4">
      <div>
        <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1.5">
          Nome da instância
        </label>
        <input
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={currentInstance ?? 'Ex: Empório Fonseca'}
          className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-white/5 text-sm dark:text-white outline-none focus:ring-2 focus:ring-primary-500"
        />
      </div>
      <div>
        <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1.5">
          URL base do Evolution
        </label>
        <input
          required
          type="url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder={currentUrl ?? 'https://evolution.exemplo.com'}
          className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-white/5 text-sm dark:text-white outline-none focus:ring-2 focus:ring-primary-500 font-mono"
        />
      </div>
      <div>
        <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1.5">
          API Key
        </label>
        <input
          required
          type="password"
          value={apiKey}
          onChange={(e) => setApiKey(e.target.value)}
          placeholder={currentInstance ? '••••••••• (deixe vazio pra manter)' : 'API key do Evolution'}
          className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-white/5 text-sm dark:text-white outline-none focus:ring-2 focus:ring-primary-500 font-mono"
        />
        <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
          Armazenada com segurança no servidor. Nunca exposta ao frontend.
        </p>
      </div>
      <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-200 dark:border-white/10">
        <button
          type="button"
          onClick={onClose}
          disabled={loading}
          className="px-4 py-2 text-sm font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/5 rounded-lg disabled:opacity-50"
        >
          Cancelar
        </button>
        <button
          type="submit"
          disabled={loading}
          className="px-4 py-2 text-sm font-semibold text-white bg-primary-600 hover:bg-primary-500 disabled:opacity-50 rounded-lg flex items-center gap-2"
        >
          {loading && <Loader2 className="h-4 w-4 animate-spin" />}
          Salvar
        </button>
      </div>
    </form>
  </Modal>
);
