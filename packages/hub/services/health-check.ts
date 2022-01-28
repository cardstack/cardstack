import Router from '@koa/router';
import Koa from 'koa';
import { inject } from '@cardstack/di';
import DatabaseManager from '@cardstack/db';

export default class HealthCheck {
  databaseManager: DatabaseManager = inject('database-manager', { as: 'databaseManager' });
  routes() {
    let healthCheckRouter = new Router();
    healthCheckRouter.all('/', async (ctx: Koa.Context) => {
      let db = await this.databaseManager.getClient();
      await db.query('SELECT 1');
      ctx.status = 200;
      let body = `
Cardstack Hub
-------------
Up and running at ${new Date().toISOString()}
${
  process.env.WAYPOINT_DEPLOYMENT_ID
    ? `Deployment ID: ${process.env.WAYPOINT_DEPLOYMENT_ID}`
    : 'Running outside of Waypoint'
}
`;
      ctx.body = body;
    });

    return healthCheckRouter.routes();
  }
}

declare module '@cardstack/hub/services' {
  interface HubServices {
    'health-check': HealthCheck;
  }
}
