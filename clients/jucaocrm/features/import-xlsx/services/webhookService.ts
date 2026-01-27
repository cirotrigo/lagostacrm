/**
 * Webhook Service - JucãoCRM
 *
 * Serviço para disparar webhooks para o N8N processar importações.
 * Isolado na feature import-xlsx do cliente JucãoCRM.
 */

/**
 * Payload enviado ao N8N para processar uma importação
 */
export interface WebhookPayload {
  jobId: string;
  organizationId: string;
  callbackUrl?: string;
}

/**
 * Resposta do webhook N8N
 */
export interface WebhookResponse {
  success: boolean;
  workflowId?: string;
  message?: string;
}

/**
 * Configuração do webhook
 */
interface WebhookConfig {
  url: string;
  secret?: string;
  timeout?: number;
}

/**
 * Obtém a configuração do webhook do ambiente
 */
function getWebhookConfig(): WebhookConfig | null {
  const url = process.env.N8N_WEBHOOK_IMPORT_PRODUCTS;

  if (!url) {
    console.warn('[webhookService] N8N_WEBHOOK_IMPORT_PRODUCTS não configurado');
    return null;
  }

  return {
    url,
    secret: process.env.N8N_WEBHOOK_SECRET,
    timeout: 30000, // 30 segundos
  };
}

export const webhookService = {
  /**
   * Dispara o webhook N8N para processar uma importação
   *
   * @param jobId - ID do job de importação
   * @param organizationId - ID da organização
   * @returns Resultado do disparo
   *
   * @example
   * ```typescript
   * const result = await webhookService.triggerImport(
   *   'job-uuid',
   *   'org-uuid'
   * );
   * if (result.success) {
   *   console.log('Workflow iniciado:', result.workflowId);
   * }
   * ```
   */
  async triggerImport(
    jobId: string,
    organizationId: string
  ): Promise<{ data: WebhookResponse | null; error: Error | null }> {
    try {
      const config = getWebhookConfig();

      if (!config) {
        return {
          data: null,
          error: new Error('Webhook N8N não configurado. Verifique N8N_WEBHOOK_IMPORT_PRODUCTS'),
        };
      }

      const payload: WebhookPayload = {
        jobId,
        organizationId,
        // Callback opcional para N8N atualizar progresso
        callbackUrl: process.env.NEXT_PUBLIC_APP_URL
          ? `${process.env.NEXT_PUBLIC_APP_URL}/api/clients/jucaocrm/import/callback`
          : undefined,
      };

      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };

      // Adicionar secret se configurado
      if (config.secret) {
        headers['X-Webhook-Secret'] = config.secret;
      }

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), config.timeout);

      try {
        const response = await fetch(config.url, {
          method: 'POST',
          headers,
          body: JSON.stringify(payload),
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          const errorText = await response.text();
          return {
            data: null,
            error: new Error(`N8N webhook falhou: ${response.status} - ${errorText}`),
          };
        }

        const data = await response.json();

        return {
          data: {
            success: true,
            workflowId: data.workflowId || data.executionId,
            message: data.message || 'Processamento iniciado',
          },
          error: null,
        };
      } catch (fetchError) {
        clearTimeout(timeoutId);

        if ((fetchError as Error).name === 'AbortError') {
          return {
            data: null,
            error: new Error('Timeout ao chamar webhook N8N'),
          };
        }

        throw fetchError;
      }
    } catch (e) {
      return { data: null, error: e as Error };
    }
  },

  /**
   * Verifica se o webhook N8N está configurado
   */
  isConfigured(): boolean {
    return !!process.env.N8N_WEBHOOK_IMPORT_PRODUCTS;
  },

  /**
   * Retorna a URL do webhook (para debugging)
   */
  getWebhookUrl(): string | null {
    return process.env.N8N_WEBHOOK_IMPORT_PRODUCTS || null;
  },

  /**
   * Testa a conectividade com o N8N (health check)
   *
   * Nota: Depende do N8N ter um endpoint de health configurado
   */
  async healthCheck(): Promise<{ healthy: boolean; error: Error | null }> {
    try {
      const config = getWebhookConfig();

      if (!config) {
        return { healthy: false, error: new Error('Webhook não configurado') };
      }

      // Tenta fazer um OPTIONS request para verificar se o endpoint existe
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);

      try {
        const response = await fetch(config.url, {
          method: 'OPTIONS',
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        // Se não der erro de CORS ou network, consideramos healthy
        return { healthy: response.ok || response.status === 405, error: null };
      } catch (fetchError) {
        clearTimeout(timeoutId);
        return { healthy: false, error: fetchError as Error };
      }
    } catch (e) {
      return { healthy: false, error: e as Error };
    }
  },
};
