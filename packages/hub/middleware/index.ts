import type Koa from 'koa';
import KoaBody from 'koa-body';
import { CardstackError } from '@cardstack/core/src/utils/errors';
import logger from '@cardstack/logger';
import * as Sentry from '@sentry/node';

const serverLog = logger('hub/server');

export { default as errorMiddleware } from './error';

export async function httpLogging(ctxt: Koa.Context, next: Koa.Next) {
  let userIp = getClientIp(ctxt.request);
  serverLog.info('start [%s] %s %s', userIp, ctxt.request.method, ctxt.request.originalUrl);
  await next();
  serverLog.info('finish [%s] %s %s %s', userIp, ctxt.request.method, ctxt.request.originalUrl, ctxt.response.status);
}

export let parseBody = KoaBody({
  jsonLimit: '16mb',
  urlencoded: false,
  text: false,
  onError(error: Error) {
    throw new CardstackError(`error while parsing body: ${error.message}`, { status: 400 });
  },
});

export function reportDeprecatedRoute(tags: any) {
  return async function (ctx: Koa.Context, next: Koa.Next) {
    Sentry.captureException(new Error(`Deprecated route usage: ${ctx.request.method} ${ctx.request.path}`), {
      tags,
    });

    await next();
  };
}

function getClientIp(req: Koa.Request) {
  let headerValue = req.headers['x-forwarded-for'] as string | undefined;
  if (headerValue?.split) {
    return headerValue.split(',').slice(-1)[0];
  }
  return req.ip;
}
