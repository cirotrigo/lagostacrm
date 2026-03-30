import type { ClientConfig } from './types';
import type { ComponentType } from 'react';

import defaultConfig from './default/config';
import emporiofonsecaConfig from './emporiofonseca/config';
import lagostacrmConfig from './lagostacrm/config';
import coronelpicanhaConfig from './coronelpicanha/config';
import jucaocrmConfig from './jucaocrm/config';

export type { ClientConfig } from './types';

const configs: Record<string, ClientConfig> = {
  emporiofonseca: emporiofonsecaConfig,
  lagostacrm: lagostacrmConfig,
  coronelpicanha: coronelpicanhaConfig,
  jucaocrm: jucaocrmConfig,
  default: defaultConfig,
};

/**
 * Get client config by CLIENT_ID.
 * Falls back to 'default' if not found.
 */
export function getClientConfigById(clientId: string): ClientConfig {
  return configs[clientId] || configs.default;
}

/**
 * Dynamic import of client's public landing page.
 * Returns null if client has no custom landing (redirect to /login).
 */
export async function getClientPublicPage(
  clientId: string
): Promise<ComponentType<{ featured?: any[] }> | null> {
  try {
    switch (clientId) {
      case 'emporiofonseca': {
        const mod = await import('./emporiofonseca/public-page/LandingPage');
        return mod.default;
      }
      // Add new client landings here:
      // case 'coronelpicanha': {
      //   const mod = await import('./coronelpicanha/public-page/LandingPage');
      //   return mod.default;
      // }
      default:
        return null; // No landing → redirect to /login
    }
  } catch {
    return null;
  }
}
