import type { EmailCardDropRequest } from '../../routes/email-card-drop-requests';
import { registry, setupHub } from '../helpers/server';
import EmailCardDropRequestsQueries from '../../queries/email-card-drop-requests';
import config from 'config';
import { setupSentry, waitForSentryReport } from '../helpers/sentry';

const { sku } = config.get('cardDrop');
const { url: webClientUrl } = config.get('webClient');
const { alreadyClaimed, error, success } = config.get('webClient.paths.cardDrop');

let claimedEoa: EmailCardDropRequest = {
  id: '2850a954-525d-499a-a5c8-3c89192ad40e',
  ownerAddress: '0xclaimedAddress',
  emailHash: 'claimedhash',
  verificationCode: 'claimedverificationcode',
  claimedAt: new Date(),
  requestedAt: new Date(),
  transactionHash: '0xclaimedAddressTxnHash',
};
let unclaimedEoa: EmailCardDropRequest = {
  id: 'b176521d-6009-41ff-8472-147a413da450',
  ownerAddress: '0xnotClaimedAddress',
  emailHash: 'unclaimedhash',
  verificationCode: 'unclaimedverificationcode',
  requestedAt: new Date(),
};
let unclaimedEoaOlderEntry: EmailCardDropRequest = {
  id: '6f1579d7-be47-4260-9629-702c4e2a7182',
  ownerAddress: unclaimedEoa.ownerAddress,
  emailHash: 'unclaimedhash',
  verificationCode: 'OLD_unclaimedverificationcode',
  requestedAt: new Date(Number(unclaimedEoa.requestedAt) - 1000),
};
let unclaimedButExpiredEoa: EmailCardDropRequest = {
  id: 'b6507a8e-086f-4d76-9e6d-4e8c7606a749',
  ownerAddress: '0xunclaimedButExpiredAddress',
  emailHash: 'unclaimedButExpiredhash',
  verificationCode: 'unclaimedButExpiredverificationcode',
  requestedAt: new Date(Date.now() - 61 * 60 * 1000),
};
let unclaimedEoaWithClaimedEmailHash: EmailCardDropRequest = {
  id: 'f0847258-9326-4e08-8043-f9def30c6359',
  ownerAddress: '0xnotClaimedAddress2',
  emailHash: 'claimedhash',
  verificationCode: 'unclaimedverificationcode2',
  requestedAt: new Date(),
};

let emailCardDropRequestsQueries: EmailCardDropRequestsQueries;

describe('GET /email-card-drop/verify', function () {
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

  setupSentry(this);

  this.beforeEach(async function () {
    registry(this).register('relay', StubRelayService, { type: 'service' });
    provisionPrepaidCardCalls = 0;
    provisioningShouldError = false;
  });

  let { request, getContainer } = setupHub(this);

  this.beforeEach(async function () {
    emailCardDropRequestsQueries = await getContainer().lookup('email-card-drop-requests', { type: 'query' });
    await emailCardDropRequestsQueries.insert(claimedEoa);
    await emailCardDropRequestsQueries.insert(unclaimedEoa);
    await emailCardDropRequestsQueries.insert(unclaimedEoaOlderEntry);
  });

  it('accepts a valid verification, marks it claimed, calls the relay service, and redirects to a success page', async function () {
    let response = await request().get(
      `/email-card-drop/verify?eoa=${unclaimedEoa.ownerAddress}&verification-code=${unclaimedEoa.verificationCode}&email-hash=${unclaimedEoa.emailHash}`
    );

    let newlyClaimed = (
      await emailCardDropRequestsQueries!.query({
        id: unclaimedEoa.id,
      })
    )[0]!;

    expect(newlyClaimed.claimedAt).to.exist;
    expect(newlyClaimed.transactionHash).to.equal(mockTxnHash);

    expect(provisionPrepaidCardCalls).to.equal(1);
    expect(provisionedAddress).to.equal(unclaimedEoa.ownerAddress);
    expect(provisionedSku).to.equal(sku);

    expect(response.status).to.equal(302);
    expect(response.headers['location']).to.equal(`${webClientUrl}${success}`);
  });

  it('rejects older verification link', async function () {
    let response = await request().get(
      `/email-card-drop/verify?eoa=${unclaimedEoaOlderEntry.ownerAddress}&verification-code=${unclaimedEoaOlderEntry.verificationCode}&email-hash=${unclaimedEoaOlderEntry.emailHash}`
    );
    expect(response.status).to.equal(400);
    expect(response.text).to.equal('Invalid verification link');
  });

  it('rejects an expired verification link', async function () {
    await emailCardDropRequestsQueries.insert(unclaimedButExpiredEoa);

    let response = await request().get(
      `/email-card-drop/verify?eoa=${unclaimedButExpiredEoa.ownerAddress}&verification-code=${unclaimedButExpiredEoa.verificationCode}&email-hash=${unclaimedButExpiredEoa.emailHash}`
    );

    expect(provisionPrepaidCardCalls).to.equal(0);
    expect(response.status).to.equal(400);
    expect(response.text).to.equal('Verification link is expired');
  });

  it('rejects a used email hash', async function () {
    await emailCardDropRequestsQueries.insert(unclaimedEoaWithClaimedEmailHash);

    let response = await request().get(
      `/email-card-drop/verify?eoa=${unclaimedEoaWithClaimedEmailHash.ownerAddress}&verification-code=${unclaimedEoaWithClaimedEmailHash.verificationCode}&email-hash=${unclaimedEoaWithClaimedEmailHash.emailHash}`
    );

    expect(provisionPrepaidCardCalls).to.equal(0);

    expect(response.status).to.equal(400);
    expect(response.text).to.equal('Email has already been used to claim a prepaid card');
  });

  it('rejects a verification that has been used and redirects to an already-claimed page', async function () {
    let response = await request().get(
      `/email-card-drop/verify?eoa=${claimedEoa.ownerAddress}&verification-code=${claimedEoa.verificationCode}&email-hash=${claimedEoa.emailHash}`
    );

    expect(provisionPrepaidCardCalls).to.equal(0);

    expect(response.status).to.equal(302);
    expect(response.headers['location']).to.equal(`${webClientUrl}${alreadyClaimed}`);
  });

  it('rejects an unknown verification', async function () {
    let response = await request().get(
      `/email-card-drop/verify?eoa=${unclaimedEoa.ownerAddress}&verification-code=wha&email-hash=${unclaimedEoa.emailHash}`
    );

    expect(provisionPrepaidCardCalls).to.equal(0);

    expect(response.status).to.equal(400);
    expect(response.text).to.equal('Invalid verification link');
  });

  it('rejects an unknown email-hash', async function () {
    let response = await request().get(
      `/email-card-drop/verify?eoa=${unclaimedEoa.ownerAddress}&verification-code=${unclaimedEoa.verificationCode}&email-hash=wha`
    );

    expect(provisionPrepaidCardCalls).to.equal(0);

    expect(response.status).to.equal(400);
    expect(response.text).to.equal('Invalid verification link');
  });

  it('redirects with the error if the relay call fails', async function () {
    provisioningShouldError = true;

    let response = await request().get(
      `/email-card-drop/verify?eoa=${unclaimedEoa.ownerAddress}&verification-code=${unclaimedEoa.verificationCode}&email-hash=${unclaimedEoa.emailHash}`
    );

    let newlyClaimed = (
      await emailCardDropRequestsQueries!.query({
        id: unclaimedEoa.id,
      })
    )[0]!;

    expect(newlyClaimed.claimedAt).to.exist;
    expect(newlyClaimed.transactionHash).to.be.null;

    expect(provisionPrepaidCardCalls).to.equal(1);
    expect(provisionedAddress).to.equal(unclaimedEoa.ownerAddress);
    expect(provisionedSku).to.equal(sku);

    expect(response.status).to.equal(302);
    expect(response.headers['location']).to.equal(
      `${webClientUrl}${error}?message=${encodeURIComponent(new Error('provisioning should error').toString())}`
    );

    let sentryReport = await waitForSentryReport();

    expect(sentryReport.error?.message).to.equal('provisioning should error');
    expect(sentryReport.tags).to.deep.equal({
      action: 'drop-card',
      alert: 'web-team',
    });
  });

  it('errors if the eoa query parameter is not provided', async function () {
    let response = await request().get(
      `/email-card-drop/verify?verification-code=${unclaimedEoa.verificationCode}&email-hash=${unclaimedEoa.emailHash}`
    );

    expect(provisionPrepaidCardCalls).to.equal(0);

    expect(response.status).to.equal(400);
    expect(response.text).to.equal('eoa is required');
  });

  it('errors if the email-hash query parameter is not provided', async function () {
    let response = await request().get(
      `/email-card-drop/verify?verification-code=${unclaimedEoa.verificationCode}&eoa=${unclaimedEoa.ownerAddress}`
    );

    expect(provisionPrepaidCardCalls).to.equal(0);

    expect(response.status).to.equal(400);
    expect(response.text).to.equal('email-hash is required');
  });
});
