import { inject } from '@cardstack/di';
import { Helpers } from 'graphile-worker';
import * as Sentry from '@sentry/node';

export default class SubscribeEmail {
  mailchimp = inject('mailchimp');

  async perform(payload: { email: string }, helpers: Helpers) {
    try {
      await this.mailchimp.subscribe(payload.email);
    } catch (e) {
      helpers.logger.error('Failed to subscribe user to newsletter');
      helpers.logger.error(JSON.stringify(e, null, 2));
      Sentry.captureException(e, {
        tags: {
          action: 'subscribe-email',
          alert: 'web-team',
        },
      });
      throw e;
    }
  }
}
