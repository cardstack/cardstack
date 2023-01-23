import cryptoRandomString from 'crypto-random-string';
import { subMinutes } from 'date-fns';
import shortUuid from 'short-uuid';
import { CREATION_WITHOUT_TX_HASH_ALLOWED_MINUTES } from '../../services/data-integrity-checks/scheduled-payments';
import { ExtendedPrismaClient } from '../../services/prisma-manager';
import { nowUtc } from '../../utils/dates';
import { setupHub } from '../helpers/server';

describe('GET /api/data-integrity-checks/scheduled-payments', async function () {
  let prisma: ExtendedPrismaClient;
  let { getPrisma, request } = setupHub(this);

  this.beforeEach(async function () {
    prisma = await getPrisma();
  });

  it('returns operational status for provided check', async function () {
    await request()
      .get('/api/data-integrity-checks/scheduled-payments')
      .set('X-Data-Integrity-Checks-Authorization', '123')
      .set('Accept', 'application/vnd.api+json')
      .set('Content-Type', 'application/vnd.api+json')
      .expect(200)
      .expect({
        data: {
          type: 'data-integrity-check',
          attributes: {
            'scheduled-payments': {
              message: null,
              status: 'operational',
            },
          },
        },
      })
      .expect('Content-Type', 'application/vnd.api+json');
  });

  it('returns degraded status for provided check', async function () {
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
        payAt: nowUtc(),
        spHash: cryptoRandomString({ length: 10 }),
        chainId: 1,
        userAddress: '0x57022DA74ec3e6d8274918C732cf8864be7da833',
        creationTransactionHash: null,
        createdAt: subMinutes(nowUtc(), CREATION_WITHOUT_TX_HASH_ALLOWED_MINUTES + 1),
      },
    });

    await request()
      .get('/api/data-integrity-checks/scheduled-payments')
      .set('X-Data-Integrity-Checks-Authorization', '123')
      .set('Accept', 'application/vnd.api+json')
      .set('Content-Type', 'application/vnd.api+json')
      .expect(200)
      .expect({
        data: {
          type: 'data-integrity-check',
          attributes: {
            'scheduled-payments': {
              message: `scheduled payments without creationTransactionHash: ${sp.id}`,
              status: 'degraded',
            },
          },
        },
      })
      .expect('Content-Type', 'application/vnd.api+json');
  });

  it('returns not found for unknown check name', async function () {
    await request()
      .get('/api/data-integrity-checks/unknown-check')
      .set('X-Data-Integrity-Checks-Authorization', '123')
      .set('Accept', 'application/vnd.api+json')
      .set('Content-Type', 'application/vnd.api+json')
      .expect(404);
  });

  it('returns not allowed for wrong or missing route authorization', async function () {
    await request()
      .get('/api/data-integrity-checks/scheduled-payments')
      .set('X-Data-Integrity-Checks-Authorization', 'wrongauth')
      .set('Accept', 'application/vnd.api+json')
      .set('Content-Type', 'application/vnd.api+json')
      .expect(403);

    await request()
      .get('/api/data-integrity-checks/scheduled-payments')
      .set('Accept', 'application/vnd.api+json')
      .set('Content-Type', 'application/vnd.api+json')
      .expect(403);
  });
});
