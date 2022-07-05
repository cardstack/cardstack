import { registry, setupHub } from '../helpers/server';
import { expect } from 'chai';
import CreateProfile from '../../tasks/create-profile';
import shortUUID from 'short-uuid';
import JobTicketsQueries from '../../queries/job-tickets';
import { setupSentry, waitForSentryReport } from '../helpers/sentry';
import { setupStubWorkerClient } from '../helpers/stub-worker-client';
import { encodeDID } from '@cardstack/did-resolver';

let jobTicketsQueries: JobTicketsQueries, jobTicketId: string, merchantInfoQueries, merchantInfosId: string;

describe('CreateProfileTask', function () {
  let subject: CreateProfile;

  let registeredAddress = '0x123';
  let registeredDid = 'sku';
  let mockTransactionHash = '0xABC';
  let mockMerchantSafeAddress = '0x456';
  let registerProfileCalls = 0;
  let registeringShouldError = false;
  let subgraphQueryShouldBeNull = false;

  class StubRelayService {
    async registerProfile(userAddress: string, did: string) {
      registerProfileCalls++;

      if (registeringShouldError) {
        throw new Error('registering should error');
      }

      registeredAddress = userAddress;
      registeredDid = did;
      return Promise.resolve(mockTransactionHash);
    }
  }

  class StubCardPay {
    async gqlQuery(_network: string, _query: string, _variables: { txn: string }) {
      return {
        data: {
          transaction: subgraphQueryShouldBeNull
            ? null
            : {
                merchantCreations: [
                  {
                    merchant: {
                      id: '0x323B2318F35c6b31113342830204335Dac715AA8',
                    },
                    merchantSafe: {
                      id: mockMerchantSafeAddress,
                    },
                  },
                ],
              },
        },
      };
    }

    async waitForTransactionConsistency(_web3: any, txHash: string) {
      return Promise.resolve(txHash);
    }
  }

  setupSentry(this);
  let { getJobIdentifiers, getJobPayloads } = setupStubWorkerClient(this);

  this.beforeEach(function () {
    registry(this).register('cardpay', StubCardPay);
    registry(this).register('relay', StubRelayService, { type: 'service' });

    registeringShouldError = false;
    subgraphQueryShouldBeNull = false;
  });

  let { getContainer } = setupHub(this);

  this.beforeEach(async function () {
    jobTicketsQueries = await getContainer().lookup('job-tickets', { type: 'query' });
    jobTicketId = shortUUID.uuid();
    await jobTicketsQueries.insert({ id: jobTicketId, jobType: 'create-profile', ownerAddress: '0x000' });

    merchantInfoQueries = await getContainer().lookup('merchant-info', { type: 'query' });
    merchantInfosId = shortUUID.uuid();
    await merchantInfoQueries.insert({
      id: merchantInfosId,
      ownerAddress: '0x000',
      name: '',
      slug: '',
      color: '',
      textColor: '',
    });

    subject = (await getContainer().instantiate(CreateProfile)) as CreateProfile;
  });

  it('calls the relay server endpoint to register a profile and queues persist-off-chain-merchant-info', async function () {
    await subject.perform({
      'job-ticket-id': jobTicketId,
      'merchant-info-id': merchantInfosId,
    });

    expect(registerProfileCalls).to.equal(1);
    expect(registeredAddress).to.equal('0x000');
    expect(registeredDid).to.equal(encodeDID({ type: 'MerchantInfo', uniqueId: merchantInfosId }));

    expect(getJobIdentifiers()[0]).to.equal('persist-off-chain-merchant-info');
    expect(getJobPayloads()[0]).to.deep.equal({ 'merchant-safe-id': merchantInfosId });

    let jobTicket = await jobTicketsQueries.find(jobTicketId);
    expect(jobTicket?.state).to.equal('success');
    expect(jobTicket?.result).to.deep.equal({ 'merchant-safe-id': mockMerchantSafeAddress });
  });

  it('fails the job ticket and logs to Sentry if the profile provisioning fails', async function () {
    registeringShouldError = true;

    await subject.perform({
      'job-ticket-id': jobTicketId,
      'merchant-info-id': merchantInfosId,
    });

    let jobTicket = await jobTicketsQueries.find(jobTicketId);
    expect(jobTicket?.state).to.equal('failed');
    expect(jobTicket?.result).to.deep.equal({ error: 'Error: registering should error' });

    let sentryReport = await waitForSentryReport();

    expect(sentryReport.error?.message).to.equal('registering should error');

    expect(getJobIdentifiers()).to.be.empty;
  });

  it('fails the job ticket and logs to Sentry if the merchantCreations subgraph query does not return a merchant address', async function () {
    subgraphQueryShouldBeNull = true;

    await subject.perform({
      'job-ticket-id': jobTicketId,
      'merchant-info-id': merchantInfosId,
    });

    let jobTicket = await jobTicketsQueries.find(jobTicketId);
    expect(jobTicket?.state).to.equal('failed');
    expect(jobTicket?.result).to.deep.equal({
      error: `Error: subgraph query for transaction ${mockTransactionHash} returned no results`,
    });

    let sentryReport = await waitForSentryReport();

    expect(sentryReport.error?.message).to.equal(
      `subgraph query for transaction ${mockTransactionHash} returned no results`
    );

    expect(getJobIdentifiers()).to.be.empty;
  });
});
