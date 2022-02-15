export default config;

interface ChainsOptions {
  layer1: string;
  layer2: string;
}

interface FeaturesOptions {
  createMerchant: boolean;
  enableCardSpace: boolean;
  enableCardPay: boolean;
}

interface UrlsOptions {
  about: string;
  appStoreLink: string;
  googlePlayLink: string;
  mailToSupportUrl: string;
  statusPageBase: string;
  statusPageUrl: string;
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
  cardSpaceHostnameSuffix: string;
  chains: ChainsOptions;
  features: FeaturesOptions;
  version: string;
  infuraId: string;
  urls: UrlsOptions;
  walletConnectIcons: string[];
  APP: Record<string, unknown>;
  threadAnimationInterval: number;
};
