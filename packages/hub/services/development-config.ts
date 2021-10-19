export default class DevelopmentConfig {
  get webAppDevHost() {
    return process.env.WEB_APP_DEV_HOST || 'app.cardstack.test';
  }
  get webAppAssetsDevHost() {
    return process.env.WEB_APP_ASSETS_DEV_HOST || 'app-assets.cardstack.test';
  }
  get webAppDevPort() {
    return process.env.WEB_APP_DEV_PORT || 4200;
  }
}

declare module '@cardstack/di' {
  interface KnownServices {
    'development-config': DevelopmentConfig;
  }
}
