import * as Sentry from '@sentry/node';
import { NodeOptions } from '@sentry/node/types/types';
import config from 'config';
import packageJson from '../package.json';
import { ExtraErrorData as ExtraErrorDataIntegration } from '@sentry/integrations';

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
      ],
    } as NodeOptions);
  }
}
