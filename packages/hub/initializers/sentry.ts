import * as Sentry from '@sentry/node';
import { NodeOptions } from '@sentry/node/types/types';
import config from 'config';
import packageJson from '../package.json';
import { ExtraErrorData as ExtraErrorDataIntegration } from '@sentry/integrations';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime';

// eslint-disable-next-line node/no-unpublished-import
import { Event, EventHint } from '@sentry/types';

export default function initSentry() {
  if (config.get('sentry.enabled')) {
    Sentry.init({
      dsn: config.get('sentry.dsn'),
      enabled: config.get('sentry.enabled'),
      environment: config.get('sentry.environment'),
      release: 'hub@' + packageJson.version,
      maxValueLength: 2000, // Sentry will truncate errors, and Prisma likes to send long errors
      integrations: [
        new ExtraErrorDataIntegration({
          // this will go down 5 levels. Anything deeper than limit will
          // be replaced with standard Node.js REPL notation of [Object], [Array], [Function] or a primitive value
          depth: 5,
        }),
        new SentryPrisma(),
      ],
    } as NodeOptions);
  }
}

export class SentryPrisma {
  public readonly name = 'SentryPrisma';
  public static id = 'SentryPrisma';

  setupOnce() {
    Sentry.addGlobalEventProcessor((event: Event, hint?: EventHint) => {
      if (hint?.originalException instanceof PrismaClientKnownRequestError) {
        let prismaError = hint.originalException as PrismaClientKnownRequestError;

        event.tags ??= {};
        event.tags['prisma.error_code'] = prismaError.code;

        let errorShouldTriggerAlert = prismaError.code.startsWith('P1');

        if (errorShouldTriggerAlert) {
          event.tags.alert = 'web-team';
        }
      }
      return event;
    });
  }
}
