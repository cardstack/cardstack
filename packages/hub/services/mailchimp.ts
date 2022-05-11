// the types from Definitely Typed are not good enough.
// Mailchimp docs seem more reliable though the examples have the wrong node package name
// https://mailchimp.com/developer/marketing/api
// @ts-ignore
import client from '@mailchimp/mailchimp_marketing';
import config from 'config';

/**
 * # CONVENIENCES SCRIPTS WHILE DEVELOPING/DEBUGGING MAILCHIMP THINGS
 *
 * 1. check what the current list looks like (remove the fields option if you want all the data):
 *    client.lists.getListMembersInfo(listId, {fields: ['members.email_address', 'members.status', 'members.last_changed']}).then(v => console.log(v))
 *
 * 2. remove an email from the list:
 *    client.lists.deleteListMember(listId, email);
 *
 * 3. unsubscribe an email
 *    client.lists.setListMember(listId, email, { status: 'unsubscribed' });
 */
export default class Mailchimp {
  client = client;
  newsletterListId = config.get('mailchimp.newsletterListId') as string;

  constructor() {
    client.setConfig({
      apiKey: config.get('mailchimp.apiKey'),
      server: config.get('mailchimp.serverPrefix'),
    });
  }

  private async isSubscribed(email: string) {
    try {
      let member: { status: string } = await client.lists.getListMember(this.newsletterListId, email, {
        fields: ['status'],
      });
      return member.status === 'subscribed';
    } catch (e) {
      // mailchimp gives us a 404 if the member doesn't exist
      if ((e as Error & { status: number })?.status === 404) {
        return false;
      } else {
        throw e;
      }
    }
  }

  /**
   * If email is already subscribed, do nothing.
   * If email has previously been subscribed, resend confirmation email.
   * If email has never been subscribed, send confirmation email.
   */
  async subscribe(email: string) {
    if (await this.isSubscribed(email)) return;

    // this adds a list member if they aren't already in the list,
    // and updates the existing one if they do exist
    await client.lists.setListMember(this.newsletterListId, email, {
      email_address: email,
      status_if_new: 'pending', // pending status is needed to trigger a confirmation email
      status: 'pending',
    });
  }
}

declare module '@cardstack/di' {
  interface KnownServices {
    mailchimp: Mailchimp;
  }
}
