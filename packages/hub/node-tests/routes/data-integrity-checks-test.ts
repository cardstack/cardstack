import cryptoRandomString from 'crypto-random-string';
import { subMinutes } from 'date-fns';
import { ethers } from 'ethers';
import shortUuid from 'short-uuid';
import { CREATION_WITHOUT_TX_HASH_ALLOWED_MINUTES } from '../../services/data-integrity-checks/scheduled-payments';
import { ExtendedPrismaClient } from '../../services/prisma-manager';
import { nowUtc } from '../../utils/dates';
import { setupHub } from '../helpers/server';
import { Client as DBClient } from 'pg';
import { setupKnownCrontabs } from '../../services/data-integrity-checks/utils';

describe('GET /api/data-integrity-checks/scheduled-payments', async function () {
  let prisma: ExtendedPrismaClient;
  let { getPrisma, request, getContainer } = setupHub(this);

  this.beforeEach(async function () {
    prisma = await getPrisma();
    let service = await getContainer().lookup('data-integrity-checks-scheduled-payments');
    service.getRelayerFunderBalance = () => Promise.resolve(ethers.utils.parseEther('1'));
    service.getCrankBalance = () => Promise.resolve(ethers.utils.parseEther('1'));
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
});

describe('GET /api/data-integrity-checks/cron-tasks', async function () {
  let db: DBClient;
  let { request, getContainer } = setupHub(this);

  this.beforeEach(async function () {
    let dbManager = await getContainer().lookup('database-manager');
    db = await dbManager.getClient();
  });

  it('returns an operational status for provided check', async function () {
    await setupKnownCrontabs(db, {
      'check-reward-roots': { minutesAgo: 5 },
      'execute-scheduled-payments': { minutesAgo: 10 },
      'print-queued-jobs': { minutesAgo: 5 },
      'remove-old-sent-notifications': { minutesAgo: 600 },
    });

    await request()
      .get('/api/data-integrity-checks/cron-tasks')
      .set('X-Data-Integrity-Checks-Authorization', '123')
      .set('Accept', 'application/vnd.api+json')
      .set('Content-Type', 'application/vnd.api+json')
      .expect(200)
      .expect({
        data: {
          type: 'data-integrity-check',
          attributes: {
            'cron-tasks': {
              message: null,
              status: 'operational',
            },
          },
        },
      })
      .expect('Content-Type', 'application/vnd.api+json');
  });

  it('returns degraded status for provided check', async function () {
    await setupKnownCrontabs(db, {
      'check-reward-roots': { minutesAgo: 31 }, // lagging
      'execute-scheduled-payments': { minutesAgo: 5 },
      'print-queued-jobs': { minutesAgo: 2 },
      'remove-old-sent-notifications': { minutesAgo: 5760 }, // lagging 4 days
    });

    await request()
      .get('/api/data-integrity-checks/cron-tasks')
      .set('X-Data-Integrity-Checks-Authorization', '123')
      .set('Accept', 'application/vnd.api+json')
      .set('Content-Type', 'application/vnd.api+json')
      .expect(200)
      .expect((res) => {
        const o = res.body.data.attributes['cron-tasks'];
        expect(o.status).to.include('degraded');
        expect(o.message).to.include(
          '"check-reward-roots" has not run within 30 minutes tolerance (supposed to be every 10 minutes)'
        );
        expect(
          o.message?.includes(
            `"remove-old-sent-notifications" has not run within 4320 minutes tolerance (suposed to be every 1440 minutes).`
          )
        );
        expect(o.message).to.not.include('"execute-scheduled-payments"');
        expect(o.message).to.not.include('"print-queued-jobs"');
      })
      .expect('Content-Type', 'application/vnd.api+json');
  });
});
