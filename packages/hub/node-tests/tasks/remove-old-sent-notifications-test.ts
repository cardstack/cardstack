import { Helpers, Job } from 'graphile-worker';
import { makeJobHelpers } from 'graphile-worker/dist/helpers';
import { registry, setupHub } from '../helpers/server';
import RemoveOldSentNotificationsTask from '../../tasks/remove-old-sent-notifications';
import { Client } from 'pg';

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

let helpers: Helpers = makeJobHelpers({}, makeMockJob('remove-old-sent-notifications'), {
  withPgClient: async () => {
    throw new Error('not implemented');
  },
});

describe('RemoveOldSentNotificationsTask', function () {
  let { getContainer } = setupHub(this);
  let subject: RemoveOldSentNotificationsTask;
  let db: Client;

  this.beforeAll(async function () {
    registry(this).register;
  });

  this.beforeEach(async function () {
    db = await (await getContainer().lookup('database-manager')).getClient();

    // 7 days old, old
    for (let item of ['old 1', 'old 2']) {
      await db.query('INSERT INTO sent_push_notifications (notification_id, created_at) VALUES($1, $2)', [
        item,
        new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toUTCString(),
      ]);
    }

    // 6 days old, not old yet
    for (let item of ['recent 1', 'recent 2']) {
      await db.query('INSERT INTO sent_push_notifications (notification_id, created_at) VALUES($1, $2)', [
        item,
        new Date(Date.now() - 6 * 24 * 60 * 60 * 1000).toUTCString(),
      ]);
    }

    subject = (await getContainer().lookup('remove-old-sent-notifications')) as RemoveOldSentNotificationsTask;
  });

  it('deletes old items and keeps recent', async function () {
    let initial = await db.query(`SELECT * FROM sent_push_notifications`);

    expect(initial.rows.map((v) => v.notification_id)).to.deep.equal(['old 1', 'old 2', 'recent 1', 'recent 2']);

    await subject.perform({}, helpers);

    let remaining = await db.query(`SELECT * FROM sent_push_notifications`);

    expect(remaining.rows.map((v) => v.notification_id)).to.deep.equal(['recent 1', 'recent 2']);
  });
});
