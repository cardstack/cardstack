export default config;

/**
 * Type declarations for
 *    import config from 'my-app/config/environment'
 */
declare const config: {
  locationType: 'history' | 'hash' | 'none' | 'auto';
  modulePrefix: string;
  podModulePrefix: string;
  locationType: string;
  rootURL: string;
  APP: Record<string, unknown>;
};
