import { Helpers } from 'graphile-worker';
import config from 'config';
import { query } from '@cardstack/hub/queries';
import { inject } from '@cardstack/di';

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

    if (!request.ownerAddress || !request.verificationCode) {
      throw new Error(
        `Cannot create verification link due to missing owner address or verification code for request ${payload.id}`
      );
    }

    const params = new URLSearchParams();
    params.append('eoa', request.ownerAddress);
    params.append('verification-code', request.verificationCode);
    params.append('email-hash', request.emailHash);
    const verificationLink = config.get('emailCardDrop.verificationUrl') + '?' + params.toString();

    const senderEmailAddress = config.get('aws.ses.supportEmail') as string;

    const emailTitle = 'Claim your Card Drop';
    const emailBodyHtml = `<h1></h1> This is your verification link: <a href="${verificationLink}">${verificationLink}</a>`;
    const emailBodyText = `This is your verification link: ${verificationLink}`;

    try {
      await this.email.send({
        to: payload.email,
        from: senderEmailAddress,
        text: emailBodyText,
        html: emailBodyHtml,
        title: emailTitle,
      });
    } catch (e) {
      helpers.logger.error('Failed to send verification email');
      helpers.logger.error((e as Error).toString());
      if ((e as Error).stack) helpers.logger.error((e as Error).stack!);

      // TODO: Sentry alerts for errors + maybe adding to suppression list
      // https://docs.aws.amazon.com/ses/latest/dg/troubleshoot-error-messages.html
    }
  }
}
