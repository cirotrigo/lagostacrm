export interface ClientConfig {
  id: string;
  name: string;
  shortName: string;
  initial: string;
  description: string;
  primaryColor: string;
  hasPublicLanding: boolean;
  hasDigitalMenu: boolean;
  metadata: {
    title: string;
    description: string;
  };
}
