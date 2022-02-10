import * as Sentry from '@sentry/node';
import config from 'config';
import packageJson from '../package.json';

export default function initSentry() {
  if (config.get('sentry.enabled')) {
    Sentry.init({
      dsn: config.get('sentry.dsn'),
      enabled: config.get('sentry.enabled'),
      environment: config.get('sentry.environment'),
      release: 'hub@' + packageJson.version,
      beforeSend(event, hint) {
        if (hint?.originalException?.toString() === 'Error: USER_REJECTION') {
          return null;
        }
        return event;
      },
    });
  }
}
