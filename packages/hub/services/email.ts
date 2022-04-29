import { PutSuppressedDestinationCommand, SendEmailCommand, SESv2Client } from '@aws-sdk/client-sesv2';
import config from 'config';

/**
 * This service sends email using SES. If trying things out using the staging
 * and/or production AWS accounts, please be aware that bounces and complaints
 * will affect our sender reputation.
 */
export default class Email {
  client = new SESv2Client({ region: config.get('aws.ses.region') });

  async send(email: { to: string; from: string; html: string; text: string; title: string }) {
    return this.client.send(
      new SendEmailCommand({
        Destination: {
          CcAddresses: [],
          ToAddresses: [email.to],
        },
        Content: {
          Simple: {
            Body: {
              Html: {
                Charset: 'UTF-8',
                Data: email.html,
              },
              Text: {
                Charset: 'UTF-8',
                Data: email.text,
              },
            },
            Subject: {
              Charset: 'UTF-8',
              Data: email.title,
            },
          },
        },
        FromEmailAddress: email.from,
        ReplyToAddresses: [email.from],
      })
    );
  }

  /**
   * Use this to add bad email addresses to our account level suppression list
   * so we don't send emails to them and damage our sender reputation
   */
  async addToSuppressionList(email: string, reason: 'BOUNCE' | 'COMPLAINT') {
    await this.client.send(
      new PutSuppressedDestinationCommand({
        EmailAddress: email,
        Reason: reason,
      })
    );
  }

  // TODO: add a utility to identify if an error is AWS telling us the email bounced
}

declare module '@cardstack/di' {
  interface KnownServices {
    email: Email;
  }
}
