import DropCardTask from '../../tasks/drop-card';
import { registry, setupHub } from '../helpers/server';
import EmailCardDropRequestsQueries from '../../queries/email-card-drop-requests';
import type { EmailCardDropRequest } from '../../routes/email-card-drop-requests';
import { CardDropConfig } from '../../services/discord-bots/hub-bot/types';
import config from 'config';

const { sku } = config.get('cardDrop') as CardDropConfig;

let unclaimedEoa: EmailCardDropRequest = {
  id: 'b176521d-6009-41ff-8472-147a413da450',
  ownerAddress: '0xnotClaimedAddress',
  emailHash: 'unclaimedhash',
  verificationCode: 'unclaimedverificationcode',
  requestedAt: new Date(),
};

let emailCardDropRequestQueries: EmailCardDropRequestsQueries;

describe('wyre-transfer-task', function () {
  let provisionedAddress = '0x123';
  let provisionedSku = 'sku';
  let mockTxnHash = '0x456';
  let provisionPrepaidCardCalls = 0;

  class StubRelayService {
    async provisionPrepaidCardV2(userAddress: string, requestedSku: string) {
      provisionPrepaidCardCalls++;
      provisionedAddress = userAddress;
      provisionedSku = requestedSku;
      return Promise.resolve(mockTxnHash);
    }
  }

  this.beforeEach(async function () {
    registry(this).register('relay', StubRelayService, { type: 'service' });
    provisionPrepaidCardCalls = 0;
  });

  let { getContainer } = setupHub(this);

  this.beforeEach(async function () {
    emailCardDropRequestQueries = await getContainer().lookup('email-card-drop-requests', { type: 'query' });
    await emailCardDropRequestQueries.insert(unclaimedEoa);
  });

  it('calls the relay service to provision a prepaid card', async function () {
    let task = (await getContainer().lookup('drop-card')) as DropCardTask;

    await task.perform({
      id: unclaimedEoa.id,
    });

    expect(provisionPrepaidCardCalls).to.equal(1);
    expect(provisionedAddress).to.equal(unclaimedEoa.ownerAddress);
    expect(provisionedSku).to.equal(sku);

    let requests = await emailCardDropRequestQueries.query({ id: unclaimedEoa.id });
    let request = requests[0];

    expect(request.transactionHash).to.equal(mockTxnHash);
  });
});
