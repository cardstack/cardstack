import { PrismaClient } from '@prisma/client';
import shortUuid from 'short-uuid';

import { registry, setupHub } from '../helpers/server';

class StubAuthenticationUtils {
  validateAuthToken(encryptedAuthToken: string) {
    return handleValidateAuthToken(encryptedAuthToken);
  }
}

let stubUserAddress = '0x2f58630CA445Ab1a6DE2Bb9892AA2e1d60876C13';
function handleValidateAuthToken(encryptedString: string) {
  expect(encryptedString).to.equal('abc123--def456--ghi789');
  return stubUserAddress;
}

describe('GET /api/scheduled-payment-attempts', async function () {
  let prisma: PrismaClient;

  this.beforeEach(async function () {
    registry(this).register('authentication-utils', StubAuthenticationUtils);
  });

  let { request, getContainer } = setupHub(this);

  this.beforeEach(async function () {
    let container = getContainer();
    prisma = await (await container.lookup('prisma-manager')).getClient();
  });

  it('returns a 401 if the auth token is invalid', async function () {
    await request()
      .get('/api/scheduled-payment-attempts')
      .set('Accept', 'application/vnd.api+json')
      .set('Content-Type', 'application/vnd.api+json')
      .expect(401)
      .expect({
        errors: [
          {
            status: '401',
            title: 'No valid auth token',
          },
        ],
      })
      .expect('Content-Type', 'application/vnd.api+json');
  });

  it('returns scheduled payment attempts', async function () {
    let sp = await prisma.scheduledPayment.create({
      data: {
        id: shortUuid.uuid(),
        senderSafeAddress: '0xc0ffee254729296a45a3885639AC7E10F9d54979',
        moduleAddress: '0x7E7d0B97D663e268bB403eb4d72f7C0C7650a6dd',
        tokenAddress: '0xa455bbB2A81E09E0337c13326BBb302Cb37D7cf6',
        gasTokenAddress: '0x6A50E3807FB9cD0B07a79F64e561B9873D3b132E',
        amount: '100',
        payeeAddress: '0x821f3Ee0FbE6D1aCDAC160b5d120390Fb8D2e9d3',
        executionGasEstimation: 100000,
        maxGasPrice: '1000000000',
        feeFixedUsd: '0',
        feePercentage: '0',
        salt: '54lt',
        payAt: '2022-11-14T18:49:13.000Z',
        spHash: '0x123',
        chainId: 1,
        userAddress: stubUserAddress,
        creationTransactionHash: null,
      },
    });

    let spa1 = await prisma.scheduledPaymentAttempt.create({
      data: {
        id: shortUuid.uuid(),
        startedAt: '2022-11-22T12:14:25.000Z',
        endedAt: '2022-11-22T13:14:25.000Z',
        status: 'succeeded',
        scheduledPaymentId: sp.id,
        transactionHash: '0x123',
      },
    });

    // From some other user to ensure we're filtering by user address
    let spOther = await prisma.scheduledPayment.create({
      data: {
        id: shortUuid.uuid(),
        senderSafeAddress: '0xc0ffee254729296a45a3885639AC7E10F9d54979',
        moduleAddress: '0x7E7d0B97D663e268bB403eb4d72f7C0C7650a6dd',
        tokenAddress: '0xa455bbB2A81E09E0337c13326BBb302Cb37D7cf6',
        gasTokenAddress: '0x6A50E3807FB9cD0B07a79F64e561B9873D3b132E',
        amount: '100',
        payeeAddress: '0x821f3Ee0FbE6D1aCDAC160b5d120390Fb8D2e9d3',
        executionGasEstimation: 100000,
        maxGasPrice: '1000000000',
        feeFixedUsd: '0',
        feePercentage: '0',
        salt: '54lt',
        payAt: '2022-11-14T18:49:13.000Z',
        spHash: '0x1234',
        chainId: 1,
        userAddress: '0x2f58630CA445Ab1a6DE2Bb9892AA2e1d60876C14',
        creationTransactionHash: null,
      },
    });

    await prisma.scheduledPaymentAttempt.create({
      data: {
        id: shortUuid.uuid(),
        startedAt: '2022-11-22T12:14:25.000Z',
        endedAt: '2022-11-22T13:14:25.000Z',
        status: 'succeeded',
        scheduledPaymentId: spOther.id,
        transactionHash: '0x123',
      },
    });

    // One older than the other to ensure we're sorting by startedAt
    let spa2 = await prisma.scheduledPaymentAttempt.create({
      data: {
        id: shortUuid.uuid(),
        startedAt: '2022-10-22T12:14:25.000Z',
        endedAt: '2022-10-22T13:14:25.000Z',
        status: 'succeeded',
        scheduledPaymentId: sp.id,
        transactionHash: '0x1234',
      },
    });

    // One failed to ensure we're filtering by status
    await prisma.scheduledPaymentAttempt.create({
      data: {
        id: shortUuid.uuid(),
        startedAt: '2022-10-23T12:14:25.000Z',
        endedAt: '2022-10-23T13:14:25.000Z',
        status: 'failed',
        scheduledPaymentId: sp.id,
        transactionHash: '0x12345',
      },
    });

    // One much older than the others to ensure we're filtering by startedAt
    await prisma.scheduledPaymentAttempt.create({
      data: {
        id: shortUuid.uuid(),
        startedAt: '2022-01-22T12:14:25.000Z',
        endedAt: '2022-01-22T13:14:25.000Z',
        status: 'failed',
        scheduledPaymentId: sp.id,
        transactionHash: '0x123',
      },
    });

    await request()
      .get(`/api/scheduled-payment-attempts?filter[started-at][gt]=2022-10-01&filter[status]=succeeded`)
      .set('Authorization', 'Bearer abc123--def456--ghi789')
      .set('Accept', 'application/vnd.api+json')
      .set('Content-Type', 'application/vnd.api+json')
      .expect(200)
      .expect({
        data: [
          {
            id: spa1.id,
            type: 'scheduled-payment-attempts',
            attributes: {
              'ended-at': '2022-11-22T13:14:25.000Z',
              'failure-reason': null,
              'started-at': '2022-11-22T12:14:25.000Z',
              status: 'succeeded',
              'transaction-hash': '0x123',
            },
            relationships: {
              'scheduled-payment': {
                data: {
                  id: sp.id,
                  type: 'scheduled-payments',
                },
              },
            },
          },
          {
            id: spa2.id,
            type: 'scheduled-payment-attempts',
            attributes: {
              'ended-at': '2022-10-22T13:14:25.000Z',
              'failure-reason': null,
              'started-at': '2022-10-22T12:14:25.000Z',
              status: 'succeeded',
              'transaction-hash': '0x1234',
            },
            relationships: {
              'scheduled-payment': {
                data: {
                  id: sp.id,
                  type: 'scheduled-payments',
                },
              },
            },
          },
        ],
        included: [
          {
            id: sp.id,
            type: 'scheduled-payments',
            attributes: {
              amount: '100',
              'fee-fixed-usd': '0',
              'fee-percentage': '0',
              'gas-token-address': '0x6A50E3807FB9cD0B07a79F64e561B9873D3b132E',
              'pay-at': '2022-11-14T18:49:13.000Z',
              'recurring-day-of-month': null,
              'recurring-until': null,
              'sender-safe-address': '0xc0ffee254729296a45a3885639AC7E10F9d54979',
              'token-address': '0xa455bbB2A81E09E0337c13326BBb302Cb37D7cf6',
            },
          },
        ],
      });
  });
});
