import Router from '@koa/router';
import Koa from 'koa';
import { inject } from '../di/dependency-injection';
import DatabaseManager from './database-manager';

export default class HealthCheck {
  databaseManager: DatabaseManager = inject('database-manager', { as: 'databaseManager' });
  routes() {
    let healthCheckRouter = new Router();
    healthCheckRouter.all('/', async (ctx: Koa.Context) => {
      let db = await this.databaseManager.getClient();
      await db.query('SELECT 1');
      ctx.status = 200;
      ctx.body = 'Cardstack Hub is up and running at ' + new Date().toISOString();
    });

    return healthCheckRouter.routes();
  }
}

declare module '@cardstack/hub/di/dependency-injection' {
  interface KnownServices {
    'health-check': HealthCheck;
  }
}
