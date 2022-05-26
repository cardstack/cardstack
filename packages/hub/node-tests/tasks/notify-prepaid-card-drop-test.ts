import { Job, TaskSpec } from 'graphile-worker';
import { Clock } from '../../services/clock';
import { registry, setupHub } from '../helpers/server';
import NotifyPrepaidCardDrop, { PREPAID_CARD_DROP_EXPIRY_TIME } from '../../tasks/notify-prepaid-card-drop';
import { expect } from 'chai';
import { setupSentry } from '../helpers/sentry';

let addedJobIdentifiers: string[] = [];
let addedJobPayloads: string[] = [];

let fakeTime = 1650440847689;

class FrozenClock implements Clock {
  now() {
    return fakeTime;
  }

  hrNow(): bigint {
    throw new Error('Not implemented');
  }
}

class StubNotificationPreferenceService {
  async getEligiblePushClientIds(_ownerAddress: string, _notificationType: string) {
    return ['123', '456'];
  }
}

class StubWorkerClient {
  async addJob(identifier: string, payload?: any, _spec?: TaskSpec): Promise<Job> {
    addedJobIdentifiers.push(identifier);
    addedJobPayloads.push(payload);
    return Promise.resolve({} as Job);
  }
}

describe('NotifyPrepaidCardDropTask', function () {
  setupSentry(this);

  this.beforeEach(function () {
    registry(this).register('clock', FrozenClock);
    registry(this).register('notification-preference-service', StubNotificationPreferenceService);
    registry(this).register('worker-client', StubWorkerClient);
  });
  let { getContainer } = setupHub(this);

  this.afterEach(async function () {
    addedJobIdentifiers = [];
    addedJobPayloads = [];
  });

  it('adds a send-notifications job', async function () {
    let task = (await getContainer().lookup('notify-prepaid-card-drop')) as NotifyPrepaidCardDrop;

    await task.perform({ ownerAddress: 'eoa-address', transactionHash: 'a' });

    expect(addedJobIdentifiers).to.deep.equal(['send-notifications', 'send-notifications']);
    expect(addedJobPayloads).to.deep.equal([
      {
        notificationBody: 'You were issued a new prepaid card!',
        notificationId: 'sokol::a::123::eoa-address',
        notificationData: {
          notificationType: 'prepaid_card_drop',
          ownerAddress: 'eoa-address',
          network: 'sokol',
        },
        notificationType: 'prepaid_card_drop',
        pushClientId: '123',
        sendBy: fakeTime + PREPAID_CARD_DROP_EXPIRY_TIME,
      },
      {
        notificationBody: 'You were issued a new prepaid card!',
        notificationId: 'sokol::a::456::eoa-address',
        notificationData: {
          notificationType: 'prepaid_card_drop',
          ownerAddress: 'eoa-address',
          network: 'sokol',
        },
        notificationType: 'prepaid_card_drop',
        pushClientId: '456',
        sendBy: fakeTime + PREPAID_CARD_DROP_EXPIRY_TIME,
      },
    ]);
  });
});
