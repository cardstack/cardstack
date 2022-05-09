import DropCardTask from '../../tasks/drop-card';
import { registry, setupHub } from '../helpers/server';
import EmailCardDropRequestsQueries from '../../queries/email-card-drop-requests';
import type { EmailCardDropRequest } from '../../routes/email-card-drop-requests';
import { CardDropConfig } from '../../services/discord-bots/hub-bot/types';
import config from 'config';
import * as Sentry from '@sentry/node';
import sentryTestkit from 'sentry-testkit';
import waitFor from '../utils/wait-for';

const { sku } = config.get('cardDrop') as CardDropConfig;

const { testkit, sentryTransport } = sentryTestkit();
const DUMMY_DSN = 'https://acacaeaccacacacabcaacdacdacadaca@sentry.io/000001';

let unclaimedEoa: EmailCardDropRequest = {
  id: 'b176521d-6009-41ff-8472-147a413da450',
  ownerAddress: '0xnotClaimedAddress',
  emailHash: 'unclaimedhash',
  verificationCode: 'unclaimedverificationcode',
  requestedAt: new Date(),
};

let emailCardDropRequestQueries: EmailCardDropRequestsQueries;

describe('drop-card-task', function () {
  let provisionedAddress = '0x123';
  let provisionedSku = 'sku';
  let mockTxnHash = '0x456';
  let provisionPrepaidCardCalls = 0;
  let provisioningShouldError = false;

  class StubRelayService {
    async provisionPrepaidCardV2(userAddress: string, requestedSku: string) {
      provisionPrepaidCardCalls++;

      if (provisioningShouldError) {
        throw new Error('provisioning should error');
      }

      provisionedAddress = userAddress;
      provisionedSku = requestedSku;
      return Promise.resolve(mockTxnHash);
    }
  }

  this.beforeEach(async function () {
    registry(this).register('relay', StubRelayService, { type: 'service' });
    provisionPrepaidCardCalls = 0;
    provisioningShouldError = false;

    Sentry.init({
      dsn: DUMMY_DSN,
      release: 'test',
      tracesSampleRate: 1,
      transport: sentryTransport,
    });
    testkit.reset();
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

  it('logs an error and does not call the relay service when the request is not found', async function () {
    let task = (await getContainer().lookup('drop-card')) as DropCardTask;
    let nonexistentUuid = '9abdd42e-abcc-4ce2-b4f8-e6a04efdc5ec';

    await task.perform({
      id: nonexistentUuid,
    });

    expect(provisionPrepaidCardCalls).to.equal(0);

    await waitFor(() => testkit.reports().length > 0);

    expect(testkit.reports()[0].error?.message).to.equal(
      `Could not find email card drop request with id ${nonexistentUuid}`
    );
    expect(testkit.reports()[0].tags).to.deep.equal({
      action: 'drop-card',
    });
  });

  it('logs an error when the relay server call fails', async function () {
    provisioningShouldError = true;

    let task = (await getContainer().lookup('drop-card')) as DropCardTask;

    await task.perform({
      id: unclaimedEoa.id,
    });

    expect(provisionPrepaidCardCalls).to.equal(1);

    await waitFor(() => testkit.reports().length > 0);

    expect(testkit.reports()[0].error?.message).to.equal('provisioning should error');
    expect(testkit.reports()[0].tags).to.deep.equal({
      action: 'drop-card',
    });

    let requests = await emailCardDropRequestQueries.query({ id: unclaimedEoa.id });
    let request = requests[0];

    expect(request.transactionHash).to.be.null;
  });
});
