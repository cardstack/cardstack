import Koa from 'koa';
import * as Sentry from '@sentry/node';

export function captureSentryMessage(message: string, ctx: Koa.Context) {
  Sentry.withScope(function (scope) {
    scope.addEventProcessor(function (event) {
      return Sentry.Handlers.parseRequest(event, ctx.request);
    });
    Sentry.captureMessage(message);
  });
}
