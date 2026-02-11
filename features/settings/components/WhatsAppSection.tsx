'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { SettingsSection } from './SettingsSection';
import {
  MessageCircle,
  QrCode,
  RefreshCw,
  CheckCircle2,
  XCircle,
  Loader2,
  Phone,
  Wifi,
  WifiOff,
  Power,
  PowerOff,
} from 'lucide-react';
import type { WhatsAppSessionStatus } from '@/types/types';

interface SessionData {
  session: {
    id: string;
    session_name: string;
    phone_number: string | null;
    profile_name: string | null;
    profile_picture_url: string | null;
    status: WhatsAppSessionStatus;
    connected_at: string | null;
  } | null;
  wppStatus: {
    status: string;
    qrcode?: string;
  } | null;
  sessionName: string;
  isConfigured: boolean;
}

interface QRCodeData {
  qrCode: string | null;
  status: string;
}

const statusConfig: Record<
  WhatsAppSessionStatus,
  { label: string; color: string; icon: React.ElementType }
> = {
  connected: {
    label: 'Conectado',
    color: 'text-green-600 dark:text-green-400 bg-green-100 dark:bg-green-900/30',
    icon: CheckCircle2,
  },
  connecting: {
    label: 'Conectando...',
    color: 'text-yellow-600 dark:text-yellow-400 bg-yellow-100 dark:bg-yellow-900/30',
    icon: Loader2,
  },
  qr_pending: {
    label: 'Aguardando QR Code',
    color: 'text-blue-600 dark:text-blue-400 bg-blue-100 dark:bg-blue-900/30',
    icon: QrCode,
  },
  disconnected: {
    label: 'Desconectado',
    color: 'text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-slate-900/30',
    icon: WifiOff,
  },
  error: {
    label: 'Erro',
    color: 'text-red-600 dark:text-red-400 bg-red-100 dark:bg-red-900/30',
    icon: XCircle,
  },
};

export const WhatsAppSection: React.FC = () => {
  const [sessionData, setSessionData] = useState<SessionData | null>(null);
  const [qrCodeData, setQrCodeData] = useState<QRCodeData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isActionLoading, setIsActionLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchSession = useCallback(async () => {
    try {
      const response = await fetch('/api/whatsapp/session', {
        credentials: 'include',
      });
      if (!response.ok) throw new Error('Falha ao buscar sessão');
      const data = await response.json();
      setSessionData(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro desconhecido');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const fetchQRCode = useCallback(async () => {
    try {
      const response = await fetch('/api/whatsapp/session/qr', {
        credentials: 'include',
      });
      if (!response.ok) throw new Error('Falha ao buscar QR Code');
      const data = await response.json();
      setQrCodeData(data);
    } catch (err) {
      console.error('Erro ao buscar QR:', err);
    }
  }, []);

  useEffect(() => {
    fetchSession();
  }, [fetchSession]);

  // Polling para QR Code quando status é qr_pending ou connecting
  useEffect(() => {
    const status = sessionData?.session?.status || sessionData?.wppStatus?.status;
    if (status === 'qr_pending' || status === 'connecting') {
      fetchQRCode();
      const interval = setInterval(fetchQRCode, 5000);
      return () => clearInterval(interval);
    }
  }, [sessionData, fetchQRCode]);

  // Polling para status quando não está conectado
  useEffect(() => {
    const status = sessionData?.session?.status;
    if (status && status !== 'connected') {
      const interval = setInterval(fetchSession, 10000);
      return () => clearInterval(interval);
    }
  }, [sessionData, fetchSession]);

  const handleSessionAction = async (action: 'start' | 'stop' | 'logout') => {
    setIsActionLoading(true);
    try {
      const response = await fetch('/api/whatsapp/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
        credentials: 'include',
      });
      if (!response.ok) throw new Error('Falha na ação');
      await fetchSession();
      if (action === 'start') {
        setTimeout(fetchQRCode, 2000);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao executar ação');
    } finally {
      setIsActionLoading(false);
    }
  };

  const currentStatus: WhatsAppSessionStatus =
    (sessionData?.session?.status as WhatsAppSessionStatus) ||
    (sessionData?.wppStatus?.status as WhatsAppSessionStatus) ||
    'disconnected';

  const statusInfo = statusConfig[currentStatus] || statusConfig.disconnected;
  const StatusIcon = statusInfo.icon;

  if (isLoading) {
    return (
      <SettingsSection title="WhatsApp" icon={MessageCircle}>
        <div className="mt-6 flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary-500" />
        </div>
      </SettingsSection>
    );
  }

  if (!sessionData?.isConfigured) {
    return (
      <SettingsSection title="WhatsApp" icon={MessageCircle}>
        <div className="mt-6 p-6 bg-yellow-50 dark:bg-yellow-900/20 rounded-xl border border-yellow-200 dark:border-yellow-800">
          <div className="flex items-start gap-3">
            <WifiOff className="h-5 w-5 text-yellow-600 dark:text-yellow-400 mt-0.5" />
            <div>
              <h4 className="font-medium text-yellow-800 dark:text-yellow-200">
                WPPConnect não configurado
              </h4>
              <p className="text-sm text-yellow-700 dark:text-yellow-300 mt-1">
                Configure as variáveis de ambiente WPPCONNECT_HOST e WPPCONNECT_SECRET_KEY para
                habilitar a integração com WhatsApp.
              </p>
            </div>
          </div>
        </div>
      </SettingsSection>
    );
  }

  return (
    <SettingsSection title="WhatsApp" icon={MessageCircle}>
      <div className="mt-6 space-y-6">
        {error && (
          <div className="p-4 bg-red-50 dark:bg-red-900/20 rounded-xl border border-red-200 dark:border-red-800">
            <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
          </div>
        )}

        {/* Status Card */}
        <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-black/20 rounded-xl">
          <div className="flex items-center gap-4">
            {sessionData?.session?.profile_picture_url ? (
              <img
                src={sessionData.session.profile_picture_url}
                alt="Profile"
                className="h-12 w-12 rounded-full object-cover"
              />
            ) : (
              <div className="h-12 w-12 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center">
                <Phone className="h-6 w-6 text-slate-500" />
              </div>
            )}
            <div>
              <div className="flex items-center gap-2">
                <span className="font-medium text-slate-900 dark:text-white">
                  {sessionData?.session?.profile_name || sessionData?.sessionName || 'WhatsApp'}
                </span>
                <span
                  className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${statusInfo.color}`}
                >
                  <StatusIcon
                    className={`h-3 w-3 ${currentStatus === 'connecting' ? 'animate-spin' : ''}`}
                  />
                  {statusInfo.label}
                </span>
              </div>
              {sessionData?.session?.phone_number && (
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  +{sessionData.session.phone_number}
                </p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => fetchSession()}
              disabled={isActionLoading}
              className="p-2 text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-white/10 transition-colors"
              title="Atualizar status"
            >
              <RefreshCw className={`h-4 w-4 ${isActionLoading ? 'animate-spin' : ''}`} />
            </button>

            {currentStatus === 'connected' ? (
              <button
                onClick={() => handleSessionAction('logout')}
                disabled={isActionLoading}
                className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors disabled:opacity-50"
              >
                <PowerOff className="h-4 w-4" />
                Desconectar
              </button>
            ) : (
              <button
                onClick={() => handleSessionAction('start')}
                disabled={isActionLoading || currentStatus === 'connecting'}
                className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-white bg-primary-600 rounded-lg hover:bg-primary-700 transition-colors disabled:opacity-50"
              >
                {isActionLoading || currentStatus === 'connecting' ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Power className="h-4 w-4" />
                )}
                Conectar
              </button>
            )}
          </div>
        </div>

        {/* QR Code */}
        {(currentStatus === 'qr_pending' || currentStatus === 'connecting') && (
          <div className="flex flex-col items-center p-6 bg-white dark:bg-black/20 rounded-xl border border-slate-200 dark:border-white/10">
            <h4 className="text-lg font-medium text-slate-900 dark:text-white mb-4">
              Escaneie o QR Code
            </h4>
            {qrCodeData?.qrCode ? (
              <div className="p-4 bg-white rounded-xl">
                <img
                  src={qrCodeData.qrCode}
                  alt="QR Code"
                  className="w-64 h-64"
                />
              </div>
            ) : (
              <div className="w-64 h-64 flex items-center justify-center bg-slate-100 dark:bg-slate-800 rounded-xl">
                <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
              </div>
            )}
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-4 text-center">
              Abra o WhatsApp no seu celular, vá em Configurações &gt; Aparelhos conectados &gt;
              Conectar um aparelho e escaneie o código acima.
            </p>
          </div>
        )}

        {/* Connection Info */}
        {currentStatus === 'connected' && sessionData?.session?.connected_at && (
          <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
            <Wifi className="h-4 w-4 text-green-500" />
            <span>
              Conectado desde{' '}
              {new Date(sessionData.session.connected_at).toLocaleDateString('pt-BR', {
                day: '2-digit',
                month: 'short',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
              })}
            </span>
          </div>
        )}
      </div>
    </SettingsSection>
  );
};
