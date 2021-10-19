import Koa from 'koa';
import { inject } from '@cardstack/di';
import proxy from 'koa-proxies';
import DevelopmentConfig from './development-config';

export default class DevelopmentProxyMiddleware {
  developmentConfig: DevelopmentConfig = inject('development-config', { as: 'developmentConfig' });

  middleware() {
    return async (ctxt: Koa.Context, next: Koa.Next) => {
      let host = ctxt.host.split(':')[0];
      let config = this.developmentConfig;
      if (host === config.webAppDevHost) {
        let target = `http://${config.webAppDevHost}:${config.webAppDevPort}`;
        return proxy('/', { target, logs: true })(ctxt, next);
      } else if (host === this.developmentConfig.webAppAssetsDevHost) {
        let target = `http://${config.webAppAssetsDevHost}:${config.webAppDevPort}`;
        return proxy('/', { target, logs: true })(ctxt, next);
      }
      await next();
    };
  }
}

declare module '@cardstack/di' {
  interface KnownServices {
    'development-proxy-middleware': DevelopmentProxyMiddleware;
  }
}
