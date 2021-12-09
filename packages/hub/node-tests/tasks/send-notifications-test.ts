import { Job } from 'graphile-worker';
import { registry, setupHub } from '../helpers/server';
import SendNotifications, { PushNotificationData } from '../../tasks/send-notifications';
import { expect } from 'chai';
import { makeJobHelpers } from 'graphile-worker/dist/helpers';
import SentPushNotificationsQueries from '../../services/queries/sent-push-notifications';
import waitFor from '../utils/wait-for';
import * as Sentry from '@sentry/node';
import sentryTestkit from 'sentry-testkit';

// https://github.com/graphile/worker/blob/e3176eab42ada8f4f3718192bada776c22946583/__tests__/helpers.ts#L135
export function makeMockJob(taskIdentifier: string): Job {
  const createdAt = new Date(Date.now() - 12345678);
  return {
    id: String(Math.floor(Math.random() * 4294967296)),
    queue_name: null,
    task_identifier: taskIdentifier,
    payload: {},
    priority: 0,
    run_at: new Date(Date.now() - Math.random() * 2000),
    attempts: 0,
    max_attempts: 25,
    last_error: null,
    created_at: createdAt,
    updated_at: createdAt,
    locked_at: null,
    locked_by: null,
    revision: 0,
    key: null,
    flags: null,
  };
}

let helpers = makeJobHelpers({}, makeMockJob('send-notifications'), {
  withPgClient: () => {
    throw new Error('withPgClient is not implemented in test');
  },
});

const messageID = 'firebase-message-id';
let createPushNotification: (prefix: string) => PushNotificationData = (prefix = '') => ({
  notificationId: `${prefix}-mock-notification-id`,
  notificationTitle: `${prefix}notification-title`,
  notificationBody: `${prefix}notification-body`,
  notificationData: [],
  notificationType: `${prefix}mock`,
  pushClientId: 'push-client-id',
});
let existingNotification = createPushNotification('existing-');
let newlyAddedNotification = createPushNotification('newly-added-');

let lastSentData: any;
let notificationSent = false;
class StubFirebasePushNotifications {
  async send(data: any) {
    lastSentData = data;
    notificationSent = true;
    return messageID;
  }
}

class ErroredFirebasePushNotifications {
  static message = 'mock firebase push notifications error';

  send() {
    throw new Error(ErroredFirebasePushNotifications.message);
  }
}

describe('SendNotificationsTask', function () {
  let subject: SendNotifications;
  let sentPushNotificationsQueries: SentPushNotificationsQueries;
  let { getContainer } = setupHub(this);

  this.beforeEach(async function () {
    let dbManager = await getContainer().lookup('database-manager');
    let db = await dbManager.getClient();
    await db.query(`DELETE FROM sent_push_notifications`);

    sentPushNotificationsQueries = (await getContainer().lookup(
      'sent-push-notifications-queries'
    )) as SentPushNotificationsQueries;
    sentPushNotificationsQueries.insert({
      ...existingNotification,
      messageId: 'existing-message-id',
    });

    registry(this).register('firebase-push-notifications', StubFirebasePushNotifications);
    lastSentData = undefined;
    notificationSent = false;

    subject = (await getContainer().lookup('send-notifications')) as SendNotifications;
  });

  it('will not send a notification if it already exists in the db', async function () {
    await subject.perform(existingNotification, helpers);
    expect(lastSentData).equal(undefined);
    expect(notificationSent).equal(false);
  });

  it('will send a notification if it does not already exists in the db', async function () {
    await subject.perform(newlyAddedNotification, helpers);
    expect(lastSentData).to.deep.equal({
      notification: {
        body: newlyAddedNotification.notificationBody,
        title: newlyAddedNotification.notificationTitle,
      },
      data: newlyAddedNotification.notificationData,
      token: newlyAddedNotification.pushClientId,
    });
    expect(notificationSent).equal(true);

    let newNotificationInDatabase = await sentPushNotificationsQueries.exists({
      notificationId: newlyAddedNotification.notificationId,
    });

    expect(newNotificationInDatabase).equal(true);
  });
});

describe('SendNotificationsTask Errors', async function () {
  let { getContainer } = setupHub(this);

  const { testkit, sentryTransport } = sentryTestkit();

  this.beforeEach(async function () {
    Sentry.init({
      dsn: 'https://SendNotificationsTaskErrors@sentry.io/000001',
      release: 'test',
      tracesSampleRate: 1,
      transport: sentryTransport,
    });
    testkit.reset();
  });

  it('handles deduplication mechanism failure and sends the notification', async function () {
    registry(this).register(
      'sent-push-notifications-queries',
      class ErroredSentPushNotificationsQueries {
        async insert() {
          throw new Error('insert fails');
        }

        async exists() {
          throw new Error('exists fails');
        }
      }
    );
    lastSentData = undefined;
    notificationSent = false;
    registry(this).register('firebase-push-notifications', StubFirebasePushNotifications);
    let subject = (await getContainer().lookup('send-notifications')) as SendNotifications;

    // This should not error despite db reads and writes erroring
    await subject.perform(newlyAddedNotification, helpers);

    expect(lastSentData).to.deep.equal({
      notification: {
        body: newlyAddedNotification.notificationBody,
        title: newlyAddedNotification.notificationTitle,
      },
      data: newlyAddedNotification.notificationData,
      token: newlyAddedNotification.pushClientId,
    });
    expect(notificationSent).equal(true);

    await waitFor(() => testkit.reports().length == 2);

    expect(testkit.reports()[0].tags).to.deep.equal({
      action: 'send-notifications-deduplication-read',
      notificationId: newlyAddedNotification.notificationId,
      notificationType: newlyAddedNotification.notificationType,
    });

    expect(testkit.reports()[1].tags).to.deep.equal({
      action: 'send-notifications-deduplication-write',
      notificationId: newlyAddedNotification.notificationId,
      notificationType: newlyAddedNotification.notificationType,
      messageId: messageID,
    });
  });

  it('should throw if sending a notification fails, and still log to sentry', async function () {
    registry(this).register('firebase-push-notifications', ErroredFirebasePushNotifications);
    let subject = (await getContainer().lookup('send-notifications')) as SendNotifications;

    await expect(subject.perform(newlyAddedNotification, helpers)).to.be.rejectedWith(
      ErroredFirebasePushNotifications.message
    );

    await waitFor(() => testkit.reports().length > 0);

    expect(testkit.reports()[1].tags).to.deep.equal({
      action: 'send-notifications',
      notificationId: newlyAddedNotification.notificationId,
      notificationType: newlyAddedNotification.notificationType,
    });
  });
});
