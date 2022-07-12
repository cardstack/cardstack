import { Helpers } from 'graphile-worker';
import config from 'config';
import { query } from '@cardstack/hub/queries';
import { inject } from '@cardstack/di';
import * as Sentry from '@sentry/node';

export default class SendEmailCardDropVerification {
  email = inject('email');
  emailCardDropRequests = query('email-card-drop-requests', { as: 'emailCardDropRequests' });

  async perform(
    payload: {
      id: string;
      email: string;
    },
    helpers: Helpers
  ) {
    const request = (
      await this.emailCardDropRequests.query({
        id: payload.id,
      })
    )[0];

    if (!request) {
      let e = new Error(`Unable to find card drop request with id ${payload.id}`);
      Sentry.captureException(e, {
        tags: {
          event: 'send-email-card-drop-verification',
          alert: 'web-team',
        },
      });
      return;
    }

    if (request.isExpired) {
      let e = new Error(`Request with id ${payload.id} expired before sending verification link`);
      Sentry.captureException(e, {
        tags: {
          event: 'send-email-card-drop-verification',
          alert: 'web-team',
        },
      });
      return;
    }

    const params = new URLSearchParams();
    params.append('eoa', request.ownerAddress);
    params.append('verification-code', request.verificationCode);
    params.append('email-hash', request.emailHash);
    const verificationLink = config.get('cardDrop.verificationUrl') + '?' + params.toString();

    const senderEmailAddress = config.get('aws.ses.supportEmail') as string;

    try {
      await this.email.sendTemplate({
        to: payload.email,
        from: senderEmailAddress,
        templateName: 'card-drop-email',
        templateData: {
          verificationUrl: verificationLink,
        },
      });
    } catch (e) {
      helpers.logger.error('Failed to send verification email');
      helpers.logger.error((e as Error).toString());
      if ((e as Error).stack) helpers.logger.error((e as Error).stack!);

      Sentry.captureException(e, {
        tags: {
          event: 'send-email-card-drop-verification',
          alert: 'web-team',
        },
      });
      throw e;
    }
  }
}

declare module '@cardstack/hub/tasks' {
  interface KnownTasks {
    'send-email-card-drop-verification': SendEmailCardDropVerification;
  }
}
