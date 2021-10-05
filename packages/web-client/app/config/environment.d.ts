export default config;

interface ChainsOptions {
  layer1: string;
  layer2: string;
}

interface FeaturesOptions {
  createMerchant: boolean;
  enableCardSpace: boolean;
}

interface UrlsOptions {
  appStoreLink: string | undefined;
  googlePlayLink: string | undefined;
  testFlightLink: string;
  discordBetaChannelLink: string;
}

/**
 * Type declarations for
 *    import config from 'my-app/config/environment'
 */
declare const config: {
  environment: string;
  modulePrefix: string;
  podModulePrefix: string;
  locationType: string;
  rootURL: string;
  hubURL: string;
  universalLinkDomain: string;
  chains: ChainsOptions;
  features: FeaturesOptions;
  version: string;
  infuraId: string;
  urls: UrlsOptions;
  APP: Record<string, unknown>;
  threadAnimationInterval: number;
};
