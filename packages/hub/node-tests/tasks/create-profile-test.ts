import { registry, setupHub } from '../helpers/server';
import { expect } from 'chai';
import CreateProfile from '../../tasks/create-profile';
import shortUUID from 'short-uuid';
import JobTicketsQueries from '../../queries/job-tickets';
import { setupSentry, waitForSentryReport } from '../helpers/sentry';
import { setupStubWorkerClient } from '../helpers/stub-worker-client';

let jobTicketsQueries: JobTicketsQueries, jobTicketId: string;

describe('CreateProfileTask', function () {
  let subject: CreateProfile;

  let registeredAddress = '0x123';
  let registeredDid = 'sku';
  let mockMerchantSafeAddress = '0x456';
  let registerProfileCalls = 0;
  let registeringShouldError = false;

  class StubRelayService {
    async registerProfile(userAddress: string, did: string) {
      registerProfileCalls++;

      if (registeringShouldError) {
        throw new Error('registering should error');
      }

      registeredAddress = userAddress;
      registeredDid = did;
      return Promise.resolve(mockMerchantSafeAddress);
    }
  }

  setupSentry(this);
  let { getJobIdentifiers, getJobPayloads } = setupStubWorkerClient(this);

  this.beforeEach(function () {
    registry(this).register('relay', StubRelayService, { type: 'service' });
  });

  let { getContainer } = setupHub(this);

  this.beforeEach(async function () {
    jobTicketsQueries = await getContainer().lookup('job-tickets', { type: 'query' });
    jobTicketId = shortUUID.uuid();

    await jobTicketsQueries.insert(jobTicketId, 'create-profile', '0x000');

    subject = (await getContainer().lookup('create-profile')) as CreateProfile;
  });

  it('calls the relay server endpoint to register a profile and queues persist-off-chain-merchant-info', async function () {
    await subject.perform({
      'job-ticket-id': jobTicketId,
      'merchant-infos': {
        'owner-address': '0x000',
      },
    });

    expect(registerProfileCalls).to.equal(1);
    expect(registeredAddress).to.equal('0x000');
    expect(registeredDid).to.equal('fixme');

    expect(getJobIdentifiers()[0]).to.equal('persist-off-chain-merchant-info');
    expect(getJobPayloads()[0]).to.deep.equal({ 'merchant-safe-id': 'fixme' });

    let jobTicket = await jobTicketsQueries.find(jobTicketId);
    expect(jobTicket.state).to.equal('success');
    expect(jobTicket.result).to.deep.equal({ 'merchant-safe-id': mockMerchantSafeAddress });
  });

  it('fails the job ticket and logs to Sentry if the profile provisioning fails', async function () {
    registeringShouldError = true;

    await subject.perform({
      'job-ticket-id': jobTicketId,
      'merchant-infos': {
        'owner-address': '0x000',
      },
    });

    let jobTicket = await jobTicketsQueries.find(jobTicketId);
    expect(jobTicket.state).to.equal('failed');
    expect(jobTicket.result).to.deep.equal({ error: 'Error: registering should error' });

    let sentryReport = await waitForSentryReport();

    expect(sentryReport.error?.message).to.equal('registering should error');

    expect(getJobIdentifiers()).to.be.empty;
  });
});
