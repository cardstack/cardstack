import { Job } from 'graphile-worker';
import { registry, setupHub, setupRegistry } from '../helpers/server';
import SendNotifications, { PushNotificationData } from '../../tasks/send-notifications';
import { expect } from 'chai';
import { makeJobHelpers } from 'graphile-worker/dist/helpers';
import SentPushNotificationsQueries from '../../queries/sent-push-notifications';
import { setupSentry, waitForSentryReport } from '../helpers/sentry';
import shortUUID from 'short-uuid';
import { PrismaClient } from '@prisma/client';

// https://github.com/graphile/worker/blob/e3176eab42ada8f4f3718192bada776c22946583/__tests__/helpers.ts#L135
function makeMockJob(taskIdentifier: string): Job {
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
  notificationId: shortUUID.uuid(),
  notificationTitle: `${prefix}notification-title`,
  notificationBody: `${prefix}notification-body`,
  notificationData: {},
  notificationType: `${prefix}mock`,
  pushClientId: 'push-client-id',
});
let existingNotification = createPushNotification('existing-');
let newlyAddedNotification = createPushNotification('newly-added-');
let expiredNotification = createPushNotification('expired-');
expiredNotification.sendBy = Date.now() - 1;
let evergreenNotification = createPushNotification('evergreen-');
evergreenNotification.sendBy = undefined;

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

class EntityNotFoundFirebasePushNotifications {
  send() {
    let error = {
      message: 'Entity not found',
      errorInfo: {
        code: 'messaging/registration-token-not-registered',
        message: 'Requested entity was not found',
      },
    };
    throw error;
  }
}

describe('SendNotificationsTask', function () {
  let subject: SendNotifications;
  let sentPushNotificationsQueries: SentPushNotificationsQueries;
  setupRegistry(this, ['firebase-push-notifications', StubFirebasePushNotifications]);
  let { instantiate, lookup } = setupHub(this);

  this.beforeEach(async function () {
    let dbManager = await lookup('database-manager');
    let db = await dbManager.getClient();
    await db.query(`DELETE FROM sent_push_notifications`);

    sentPushNotificationsQueries = (await lookup('sent-push-notifications', {
      type: 'query',
    })) as SentPushNotificationsQueries;
    sentPushNotificationsQueries.insert({
      ...existingNotification,
      messageId: 'existing-message-id',
    });

    lastSentData = undefined;
    notificationSent = false;

    subject = await instantiate(SendNotifications);
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

describe('SendNotificationsTask deduplication errors', async function () {
  setupRegistry(
    this,
    ['firebase-push-notifications', StubFirebasePushNotifications],
    [
      'sent-push-notifications',
      class ErroredSentPushNotificationsQueries {
        async insert() {
          throw new Error('insert fails');
        }

        async exists() {
          return false;
        }
      },
      { type: 'query' },
    ]
  );
  let { instantiate } = setupHub(this);

  setupSentry(this);

  this.beforeEach(async function () {
    lastSentData = undefined;
    notificationSent = false;
  });

  it('handles deduplication write failure by catching the error, and sends the notification', async function () {
    let subject = await instantiate(SendNotifications);

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

    let sentryReport = await waitForSentryReport();

    expect(sentryReport.tags).to.deep.equal({
      action: 'send-notifications-deduplication',
      notificationId: newlyAddedNotification.notificationId,
      notificationType: newlyAddedNotification.notificationType,
      messageId: messageID,
    });
  });
});

describe('SendNotificationsTask firebase errors', function () {
  setupRegistry(this, ['firebase-push-notifications', ErroredFirebasePushNotifications]);
  let { instantiate } = setupHub(this);
  setupSentry(this);

  it('should throw if sending a notification fails, and still log to sentry', async function () {
    let subject = await instantiate(SendNotifications);

    await expect(subject.perform(newlyAddedNotification, helpers)).to.be.rejectedWith(
      ErroredFirebasePushNotifications.message
    );

    let sentryReport = await waitForSentryReport();

    expect(sentryReport.tags).to.deep.equal({
      action: 'send-notifications',
      notificationId: newlyAddedNotification.notificationId,
      notificationType: newlyAddedNotification.notificationType,
    });
  });
});

describe('SendNotificationsTask requested entity not found', function () {
  let { instantiate, getPrisma } = setupHub(this);
  let prisma: PrismaClient;

  this.beforeEach(async function () {
    prisma = await getPrisma();
  });

  it('should disable the push notification registration', async function () {
    await prisma.pushNotificationRegistration.create({
      data: {
        id: shortUUID.uuid(),
        pushClientId: newlyAddedNotification.pushClientId,
        ownerAddress: 'existing-owner-address',
        disabledAt: null,
      },
    });

    registry(this).register('firebase-push-notifications', EntityNotFoundFirebasePushNotifications);
    let subject = await instantiate(SendNotifications);
    await subject.perform(newlyAddedNotification, helpers);

    let records = await prisma.pushNotificationRegistration.findMany({
      where: {
        ownerAddress: 'existing-owner-address',
        pushClientId: newlyAddedNotification.pushClientId,
      },
    });

    expect(records.length).to.equal(1);
    expect(records[0].disabledAt).to.exist;
  });
});

describe('SendNotificationsTask expired notifications', function () {
  let subject: SendNotifications;

  setupSentry(this);
  setupRegistry(this, ['firebase-push-notifications', StubFirebasePushNotifications]);
  let { instantiate } = setupHub(this);

  this.beforeEach(async function () {
    lastSentData = undefined;
    notificationSent = false;
    subject = await instantiate(SendNotifications);
  });

  it('should not send an expired notification', async function () {
    await subject.perform(expiredNotification, helpers);

    expect(lastSentData).to.equal(undefined);
    expect(notificationSent).to.equal(false);

    let sentryReport = await waitForSentryReport();

    expect(sentryReport.error?.message).to.equal('Notification is too old to send');
    expect(sentryReport.tags).to.deep.equal({
      action: 'send-notifications',
      notificationId: expiredNotification.notificationId,
      notificationType: expiredNotification.notificationType,
    });
  });

  it('should not expire a notification without a sendBy', async function () {
    await subject.perform(evergreenNotification, helpers);

    expect(lastSentData).to.deep.equal({
      notification: {
        body: evergreenNotification.notificationBody,
        title: evergreenNotification.notificationTitle,
      },
      data: evergreenNotification.notificationData,
      token: evergreenNotification.pushClientId,
    });
    expect(notificationSent).to.equal(true);
  });
});
