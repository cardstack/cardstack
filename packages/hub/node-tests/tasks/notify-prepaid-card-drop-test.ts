import { Job, TaskSpec } from 'graphile-worker';
import { registry, setupHub } from '../helpers/server';
import NotifyPrepaidCardDrop from '../../tasks/notify-prepaid-card-drop';
import { expect } from 'chai';
import { setupSentry } from '../helpers/sentry';
import { EventData } from 'web3-eth-contract';

let addedJobIdentifiers: string[] = [];
let addedJobPayloads: string[] = [];

class StubNotificationPreferenceService {
  async getEligiblePushClientIds(_ownerAddress: string, notificationType: string) {
    expect(notificationType).to.equal('prepaid_card_drop');
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
    registry(this).register('notification-preference-service', StubNotificationPreferenceService);
    registry(this).register('worker-client', StubWorkerClient);
  });
  let { getContainer } = setupHub(this);

  this.afterEach(async function () {
    addedJobIdentifiers = [];
    addedJobPayloads = [];
  });

  it('adds send-notifications jobs', async function () {
    let task = (await getContainer().lookup('notify-prepaid-card-drop')) as NotifyPrepaidCardDrop;

    await task.perform({ returnValues: { owner: 'eoa-address' }, transactionHash: 'a' } as unknown as EventData);

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
      },
    ]);
  });
});
