/**
 * JucãoCRM Client Configuration
 *
 * Configurações específicas para o cliente JucãoCRM.
 * Este arquivo é carregado condicionalmente quando CLIENT_ID=jucaocrm.
 */

export const JUCAO_CONFIG = {
  clientId: 'jucaocrm',
  clientName: 'JucãoCRM',

  features: {
    xlsxImport: true,      // Importação de produtos via XLSX
    customBranding: false, // Branding customizado (futuro)
  },

  branding: {
    primaryColor: '#3B82F6',
    logo: '/clients/jucaocrm/assets/logo.png',
  },
} as const;

export type JucaoConfig = typeof JUCAO_CONFIG;
