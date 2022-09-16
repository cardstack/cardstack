import { PrismaClient } from '@prisma/client';

import { registry, setupHub } from '../helpers/server';
import { setupStubWorkerClient } from '../helpers/stub-worker-client';

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

let prisma: PrismaClient;
let forceSchedulePaymentOnChainTimeout = false;
let mockTxnHash = '0xc13d7905be5c989378a945487cd2a1193627ae606009e28e296d48ddaec66162';

class StubCardpaySDK {
  getSDK(sdk: string) {
    switch (sdk) {
      case 'ScheduledPaymentModule':
        return Promise.resolve({
          schedulePayment: async (
            _safeAddress: any,
            _moduleAddress: any,
            _tokenAddress: any,
            _spHash: any,
            _signature: any,
            { onTxnHash }: any
          ) => {
            if (forceSchedulePaymentOnChainTimeout) {
              // no-op. txn hash will never be returned
            } else {
              await onTxnHash(mockTxnHash);
            }
          },
        });
      default:
        throw new Error(`unsupported mock cardpay sdk: ${sdk}`);
    }
  }
}

describe('POST /api/scheduled-payments', async function () {
  let { getJobIdentifiers, getJobPayloads } = setupStubWorkerClient(this);

  this.beforeEach(async function () {
    registry(this).register('authentication-utils', StubAuthenticationUtils);
    registry(this).register('cardpay', StubCardpaySDK);
  });

  let { getPrisma, request } = setupHub(this);

  this.beforeEach(async function () {
    prisma = await getPrisma();
  });

  it('returns a 401 if the auth token is invalid', async function () {
    await request()
      .post('/api/scheduled-payments')
      .send({})
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

  it('responds with errors when attrs are missing', async function () {
    await request()
      .post('/api/scheduled-payments')
      .send({
        data: {
          type: 'scheduled-payments',
          attributes: {},
        },
      })
      .set('Accept', 'application/vnd.api+json')
      .set('Authorization', 'Bearer abc123--def456--ghi789')
      .set('Content-Type', 'application/vnd.api+json')
      .expect(422)
      .expect({
        errors: [
          {
            detail: 'is required',
            source: {
              pointer: '/data/attributes/sender-safe-address',
            },
            status: '422',
            title: 'Invalid attribute',
          },
          {
            detail: 'is required',
            source: {
              pointer: '/data/attributes/module-address',
            },
            status: '422',
            title: 'Invalid attribute',
          },
          {
            detail: 'is required',
            source: {
              pointer: '/data/attributes/token-address',
            },
            status: '422',
            title: 'Invalid attribute',
          },
          {
            detail: 'is required',
            source: {
              pointer: '/data/attributes/amount',
            },
            status: '422',
            title: 'Invalid attribute',
          },
          {
            detail: 'is required',
            source: {
              pointer: '/data/attributes/payee-address',
            },
            status: '422',
            title: 'Invalid attribute',
          },
          {
            detail: 'is required',
            source: {
              pointer: '/data/attributes/execution-gas-estimation',
            },
            status: '422',
            title: 'Invalid attribute',
          },
          {
            detail: 'is required',
            source: {
              pointer: '/data/attributes/max-gas-price',
            },
            status: '422',
            title: 'Invalid attribute',
          },
          {
            detail: 'is required',
            source: {
              pointer: '/data/attributes/fee-fixed-usd',
            },
            status: '422',
            title: 'Invalid attribute',
          },
          {
            detail: 'is required',
            source: {
              pointer: '/data/attributes/fee-percentage',
            },
            status: '422',
            title: 'Invalid attribute',
          },
          {
            detail: 'is required',
            source: {
              pointer: '/data/attributes/salt',
            },
            status: '422',
            title: 'Invalid attribute',
          },
          {
            detail: 'is required',
            source: {
              pointer: '/data/attributes/sp-hash',
            },
            status: '422',
            title: 'Invalid attribute',
          },
          {
            detail: 'is required',
            source: {
              pointer: '/data/attributes/signature',
            },
            status: '422',
            title: 'Invalid attribute',
          },
          {
            detail: 'is required',
            source: {
              pointer: '/data/attributes/chain-id',
            },
            status: '422',
            title: 'Invalid attribute',
          },
        ],
      });
  });

  // TODO add a test for recurring scheduled payment

  it('persists scheduled payment, submits a transaction and transaction waiter task', async function () {
    let scheduledPaymentId;
    await request()
      .post('/api/scheduled-payments')
      .send({
        data: {
          type: 'scheduled-payments',
          attributes: {
            'sender-safe-address': '0xc0ffee254729296a45a3885639AC7E10F9d54979',
            'module-address': '0x7E7d0B97D663e268bB403eb4d72f7C0C7650a6dd',
            'token-address': '0xa455bbB2A81E09E0337c13326BBb302Cb37D7cf6',
            amount: 100,
            'payee-address': '0x821f3Ee0FbE6D1aCDAC160b5d120390Fb8D2e9d3',
            'execution-gas-estimation': 100000,
            'max-gas-price': 1000000000,
            'fee-fixed-usd': 0,
            'fee-percentage': 0,
            salt: '54lt',
            'pay-at': '2021-01-01T00:00:00.000Z',
            'sp-hash': '0x123',
            'chain-id': 1,
            signature: '0x123',
          },
        },
      })
      .set('Accept', 'application/vnd.api+json')
      .set('Authorization', 'Bearer abc123--def456--ghi789')
      .set('Content-Type', 'application/vnd.api+json')
      .expect(201)
      .expect(function (res) {
        scheduledPaymentId = res.body.data.id;
        res.body.data.id = 'id';
      })
      .expect({
        data: {
          id: 'id',
          type: 'scheduled-payment',
          attributes: {
            'sender-safe-address': '0xc0ffee254729296a45a3885639AC7E10F9d54979',
            'module-address': '0x7E7d0B97D663e268bB403eb4d72f7C0C7650a6dd',
            'token-address': '0xa455bbB2A81E09E0337c13326BBb302Cb37D7cf6',
            amount: 100,
            'payee-address': '0x821f3Ee0FbE6D1aCDAC160b5d120390Fb8D2e9d3',
            'execution-gas-estimation': 100000,
            'max-gas-price': 1000000000,
            'fee-fixed-usd': 0,
            'fee-percentage': 0,
            salt: '54lt',
            'pay-at': '2021-01-01T00:00:00.000Z',
            'sp-hash': '0x123',
            'chain-id': 1,
            signature: '0x123',
            'creation-transaction-hash': mockTxnHash,
            'creation-block-number': null,
            'cancelation-transaction-hash': null,
            'cancelation-block-number': null,
            'recurring-day-of-month': null,
            'recurring-until': null,
          },
        },
      })
      .expect('Content-Type', 'application/vnd.api+json');

    expect(getJobIdentifiers()[0]).to.equal('scheduled-payment-on-chain-creation-waiter');
    expect(getJobPayloads()[0]).to.deep.equal({ scheduledPaymentId });
  });

  it('does not persist a scheduled payment when something goes wrong with on chain call', async function () {
    forceSchedulePaymentOnChainTimeout = true;

    await request()
      .post('/api/scheduled-payments')
      .send({
        data: {
          type: 'scheduled-payments',
          attributes: {
            'sender-safe-address': '0xc0ffee254729296a45a3885639AC7E10F9d54979',
            'module-address': '0x7E7d0B97D663e268bB403eb4d72f7C0C7650a6dd',
            'token-address': '0xa455bbB2A81E09E0337c13326BBb302Cb37D7cf6',
            amount: 100,
            'payee-address': '0x821f3Ee0FbE6D1aCDAC160b5d120390Fb8D2e9d3',
            'execution-gas-estimation': 100000,
            'max-gas-price': 1000000000,
            'fee-fixed-usd': 0,
            'fee-percentage': 0,
            salt: '54lt',
            'pay-at': '2021-01-01T00:00:00.000',
            'sp-hash': '0x123',
            'chain-id': 1,
            signature: '0x123',
          },
        },
      })
      .set('Accept', 'application/vnd.api+json')
      .set('Authorization', 'Bearer abc123--def456--ghi789')
      .set('Content-Type', 'application/vnd.api+json')
      .expect(422);

    let scheduledPayments = await prisma.scheduledPayment.findMany();

    expect(scheduledPayments).to.be.empty;
  });
});
