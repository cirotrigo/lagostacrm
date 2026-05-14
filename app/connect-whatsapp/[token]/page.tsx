'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { use } from 'react';
import { CheckCircle2, XCircle, RefreshCw, Loader2, Smartphone } from 'lucide-react';

type QrResponse = {
  state: 'open' | 'connecting' | 'close' | 'qrcode' | 'unknown';
  qrBase64?: string | null;
  pairingCode?: string | null;
  instanceName?: string;
  profileName?: string | null;
  profilePictureUrl?: string | null;
  phoneNumber?: string | null;
  error?: string;
};

export default function ConnectWhatsAppPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = use(params);
  const [data, setData] = useState<QrResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchQr = useCallback(async () => {
    try {
      const res = await fetch(`/api/public/evolution-qr/${token}`, { cache: 'no-store' });
      const body = await res.json();
      if (!res.ok) {
        setError(body?.error || `HTTP ${res.status}`);
        setLoading(false);
        return;
      }
      setData(body);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao buscar QR');
    } finally {
      setLoading(false);
    }
  }, [token]);

  // Initial fetch + polling
  useEffect(() => {
    fetchQr();
    const id = setInterval(() => {
      fetchQr();
    }, 8000); // 8s polling — QR rotates every ~20s, status updates fast
    return () => clearInterval(id);
  }, [fetchQr]);

  if (loading && !data) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-6">
        <div className="bg-white rounded-2xl shadow-lg max-w-md w-full p-8 text-center">
          <XCircle className="h-12 w-12 text-red-500 mx-auto mb-3" />
          <h1 className="text-xl font-bold text-slate-900 mb-2">Não foi possível abrir esta conexão</h1>
          <p className="text-sm text-slate-600">{error}</p>
          <p className="text-xs text-slate-500 mt-4">
            Peça ao responsável que gerou esse link para criar um novo.
          </p>
        </div>
      </div>
    );
  }

  const isConnected = data?.state === 'open';

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 p-4">
      <div className="bg-white rounded-2xl shadow-xl max-w-md w-full overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-green-500 to-emerald-600 p-6 text-white text-center">
          <Smartphone className="h-10 w-10 mx-auto mb-2" />
          <h1 className="text-xl font-bold">Conectar WhatsApp</h1>
          {data?.instanceName && (
            <p className="text-sm text-white/80 mt-1">{data.instanceName}</p>
          )}
        </div>

        {/* Body */}
        <div className="p-6">
          {isConnected ? (
            <div className="text-center py-4">
              <CheckCircle2 className="h-14 w-14 text-green-500 mx-auto mb-3" />
              <h2 className="text-lg font-bold text-slate-900 mb-1">Conectado!</h2>
              {data?.profileName && (
                <p className="text-sm text-slate-600">{data.profileName}</p>
              )}
              {data?.phoneNumber && (
                <p className="text-xs text-slate-500 mt-0.5">+{data.phoneNumber}</p>
              )}
              <p className="text-xs text-slate-500 mt-4">
                Você pode fechar esta página.
              </p>
            </div>
          ) : data?.qrBase64 ? (
            <div className="text-center">
              <p className="text-sm text-slate-700 mb-4">
                Escaneie o QR Code com o WhatsApp do seu celular:
              </p>
              <ol className="text-xs text-slate-600 text-left mb-4 space-y-1.5 bg-slate-50 rounded-lg p-4">
                <li>1. Abra o WhatsApp no celular</li>
                <li>2. Toque em <strong>Menu</strong> (⋮) ou <strong>Ajustes</strong></li>
                <li>3. Toque em <strong>Aparelhos conectados</strong></li>
                <li>4. Toque em <strong>Conectar um aparelho</strong></li>
                <li>5. Aponte o celular para esta tela</li>
              </ol>
              <div className="inline-block p-3 bg-white border-2 border-slate-200 rounded-xl shadow-sm">
                <img
                  src={data.qrBase64}
                  alt="QR Code para conectar WhatsApp"
                  className="w-64 h-64 block"
                />
              </div>
              {data.pairingCode && (
                <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                  <p className="text-xs text-blue-700 mb-1">Ou digite este código no WhatsApp:</p>
                  <p className="text-2xl font-bold tracking-widest text-blue-900 tabular-nums">
                    {data.pairingCode}
                  </p>
                </div>
              )}
              <p className="text-[11px] text-slate-400 mt-3 flex items-center justify-center gap-1">
                <RefreshCw className="h-3 w-3 animate-spin" />
                QR atualiza automaticamente a cada poucos segundos
              </p>
            </div>
          ) : (
            <div className="text-center py-6">
              <Loader2 className="h-10 w-10 animate-spin text-slate-400 mx-auto mb-3" />
              <p className="text-sm text-slate-600">Aguardando QR Code…</p>
              <p className="text-xs text-slate-500 mt-1">Status: {data?.state ?? '—'}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
