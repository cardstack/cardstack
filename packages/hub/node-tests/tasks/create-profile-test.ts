import { registry, setupHub } from '../helpers/server';
import { expect } from 'chai';
import CreateProfile from '../../tasks/create-profile';
import shortUUID from 'short-uuid';
import { setupSentry, waitForSentryReport } from '../helpers/sentry';
import { setupStubWorkerClient } from '../helpers/stub-worker-client';
import { encodeDID } from '@cardstack/did-resolver';
import { rest } from 'msw';
import { setupServer, SetupServerApi } from 'msw/node';
import config from 'config';
import { getConstantByNetwork } from '@cardstack/cardpay-sdk';
import { ExtendedPrismaClient } from '../../services/prisma-manager';

let relayUrl = getConstantByNetwork('relayServiceURL', config.get('web3.layer2Network'));

let exampleEthereumAddress = '0x323B2318F35c6b31113342830204335Dac715AA8';
let prisma: ExtendedPrismaClient, jobTicketId: string, merchantInfosId: string;

describe('CreateProfileTask', function () {
  let subject: CreateProfile;
  let mockServer: SetupServerApi;
  let dataSentToServer: any;
  let did: string;

  let mockTransactionHash = '0xABC';
  let mockMerchantSafeAddress = '0x456';
  let registerProfileCalls = 0;
  let registeringShouldError = false;
  let subgraphQueryShouldBeNull = false;

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

  this.beforeEach(async function () {
    registry(this).register('cardpay', StubCardPay);

    registeringShouldError = false;
    registerProfileCalls = 0;
    subgraphQueryShouldBeNull = false;

    mockServer = setupServer(
      rest.post(`${relayUrl}/v1/merchant/register`, (req, res, ctx) => {
        dataSentToServer = req.body as string;
        registerProfileCalls++;
        let status = registeringShouldError ? 400 : 200;
        let response = registeringShouldError ? {} : { txHash: mockTransactionHash };
        return res(ctx.status(status), ctx.json(response));
      })
    );

    mockServer.listen({ onUnhandledRequest: 'error' });
  });

  this.afterEach(function () {
    mockServer.close();
  });

  let { getContainer } = setupHub(this);

  this.beforeEach(async function () {
    prisma = await (await getContainer().lookup('prisma-manager')).getClient();

    registeringShouldError = false;
    subgraphQueryShouldBeNull = false;

    jobTicketId = shortUUID.uuid();
    await prisma.jobTicket.create({
      data: {
        id: jobTicketId,
        jobType: 'create-profile',
        ownerAddress: exampleEthereumAddress,
      },
    });

    merchantInfosId = shortUUID.uuid();
    await prisma.merchantInfo.create({
      data: {
        id: merchantInfosId,
        ownerAddress: exampleEthereumAddress,
        name: '',
        slug: '',
        color: '',
        textColor: '',
      },
    });

    did = encodeDID({ type: 'MerchantInfo', uniqueId: merchantInfosId });

    subject = (await getContainer().instantiate(CreateProfile)) as CreateProfile;
  });

  it('calls the relay server endpoint to register a profile and queues persist-off-chain-merchant-info', async function () {
    await subject.perform({
      'job-ticket-id': jobTicketId,
      'merchant-info-id': merchantInfosId,
    });
    expect(registerProfileCalls).to.equal(1);

    expect(getJobIdentifiers()[0]).to.equal('persist-off-chain-merchant-info');
    expect(getJobPayloads()[0]).to.deep.equal({ id: merchantInfosId });

    let jobTicket = await prisma.jobTicket.findUnique({ where: { id: jobTicketId } });
    expect(jobTicket?.state).to.equal('success');
    expect(jobTicket?.result).to.deep.equal({ id: mockMerchantSafeAddress });

    expect(dataSentToServer).to.deep.equal({
      owner: exampleEthereumAddress,
      infoDid: did,
    });
  });

  it('fails the job ticket and logs to Sentry if the profile provisioning fails', async function () {
    registeringShouldError = true;

    await subject.perform({
      'job-ticket-id': jobTicketId,
      'merchant-info-id': merchantInfosId,
    });

    let errorText = `Could not register profile card v2 for customer ${exampleEthereumAddress}, did ${did}, received 400 from relay server: {}`;
    let jobTicket = await prisma.jobTicket.findUnique({ where: { id: jobTicketId } });

    expect(jobTicket?.state).to.equal('failed');
    expect(jobTicket?.result).to.deep.equal({
      error: `Error: ${errorText}`,
    });

    let sentryReport = await waitForSentryReport();

    expect(sentryReport.error?.message).to.equal(errorText);

    expect(getJobIdentifiers()).to.be.empty;
  });

  it('fails the job ticket and logs to Sentry if the merchantCreations subgraph query does not return a merchant address', async function () {
    subgraphQueryShouldBeNull = true;

    await subject.perform({
      'job-ticket-id': jobTicketId,
      'merchant-info-id': merchantInfosId,
    });

    let jobTicket = await prisma.jobTicket.findUnique({ where: { id: jobTicketId } });
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
