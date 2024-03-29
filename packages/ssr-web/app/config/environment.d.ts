export default config;

interface UrlsOptions {
  about: string;
  appStoreLink: string;
  googlePlayLink: string;
  mailToSupportUrl: string;
  statusPageBase: string;
  statusPageUrl: string;
  cardPayLink: string;
}

/**
 * Type declarations for
 *    import config from 'my-app/config/environment'
 */
declare const config: {
  environment: string;
  modulePrefix: string;
  podModulePrefix: string;
  locationType: 'history' | 'hash' | 'none' | 'auto';
  rootURL: string;
  hubURL: string;
  previewSubdomainInfix: string;
  universalLinkDomain: string;
  version: string;
  urls: UrlsOptions;
  walletConnectIcons: string[];
  APP: Record<string, unknown>;
  profileHostnameSuffix: string;
  chains: {
    layer2: 'sokol' | 'gnosis' | 'test';
  };
};
