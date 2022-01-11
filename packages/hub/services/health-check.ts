import Router from '@koa/router';
import Koa from 'koa';
import { inject } from '@cardstack/di';
import DatabaseManager from '@cardstack/db';
import * as Sentry from '@sentry/node';
import logger from '@cardstack/logger';
import { httpLogging } from '../middleware';
import { Server } from 'http';

const log = logger('routes/health-check');
export default class HealthCheck {
  private healthCheckServer: Server | undefined;
  databaseManager: DatabaseManager = inject('database-manager', { as: 'databaseManager' });
  routes(name = 'Cardstack Hub') {
    let healthCheckRouter = new Router();
    healthCheckRouter.all('/', async (ctx: Koa.Context) => {
      let db = await this.databaseManager.getClient();
      await db.query('SELECT 1');
      ctx.status = 200;
      ctx.body = `${name} is up and running at ` + new Date().toISOString();
    });

    return healthCheckRouter.routes();
  }

  // This is a convenience method for running a health check server for
  // containers that would not otherwise run a web server (like the bot, or
  // worker)
  run(name: string, port: number) {
    if (this.healthCheckServer) {
      // server is already running
      return;
    }

    let app = new Koa();
    app.use(httpLogging);
    app.use(this.routes(name)); // Setup health-check at "/"
    app.on('error', (err: Error, ctx: Koa.Context) => {
      if ((err as any).intentionalTestError) {
        return;
      }
      log.error(`Unhandled error:`, err);
      Sentry.withScope(function (scope) {
        scope.addEventProcessor(function (event) {
          return Sentry.Handlers.parseRequest(event, ctx.request);
        });
        Sentry.captureException(err);
      });
    });
    this.healthCheckServer = app.listen(port);
    log.info(`Health check listening on port ${port}`);
  }

  teardown() {
    if (this.healthCheckServer) {
      this.healthCheckServer.close();
    }
  }
}

declare module '@cardstack/di' {
  interface KnownServices {
    'health-check': HealthCheck;
  }
}
