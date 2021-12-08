import { Job } from 'graphile-worker';
import { registry, setupHub } from '../helpers/server';
import SendNotifications, { PushNotificationData } from '../../tasks/send-notifications';
import { expect } from 'chai';
import { makeJobHelpers } from 'graphile-worker/dist/helpers';
import { Client } from 'pg';
import { buildConditions } from '../../utils/queries';

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
  transactionHash: `${prefix}transaction-hash`,
  // keep owner-address and pushClientId the same since this is a likely occurence in prod
  // when we send several notifications for different transactions
  ownerAddress: `owner-address`,
  pushClientId: `push-client-id`,
  notificationTitle: `${prefix}notification-title`,
  notificationBody: `${prefix}notification-body`,
  notificationData: [],
  notificationType: `${prefix}mock`,
  network: 'test-network',
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

describe('SendNotificationsTask', function () {
  let subject: SendNotifications;
  let db: Client;
  let { getContainer } = setupHub(this);

  this.beforeEach(async function () {
    let dbManager = await getContainer().lookup('database-manager');
    db = await dbManager.getClient();
    await db.query(`DELETE FROM sent_push_notifications`);
    await db.query(
      `INSERT INTO sent_push_notifications (transaction_hash, owner_address, push_client_id, notification_type, notification_title, notification_body, notification_data, message_id, network) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [
        existingNotification.transactionHash,
        existingNotification.ownerAddress,
        existingNotification.pushClientId,
        existingNotification.notificationType,
        existingNotification.notificationTitle,
        existingNotification.notificationBody,
        existingNotification.notificationData,
        'existing-message-id',
        existingNotification.network,
      ]
    );
    subject = (await getContainer().lookup('send-notifications')) as SendNotifications;
    registry(this).register('firebase-push-notifications', StubFirebasePushNotifications);

    lastSentData = undefined;
    notificationSent = false;
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

    const conditions = buildConditions({
      transactionHash: newlyAddedNotification.transactionHash,
      pushClientId: newlyAddedNotification.pushClientId,
      ownerAddress: newlyAddedNotification.ownerAddress,
    });
    const queryResult = await db.query(
      `SELECT transaction_hash FROM sent_push_notifications WHERE ${conditions.where}`,
      conditions.values
    );
    expect(queryResult.rowCount).equal(1);
  });
});
