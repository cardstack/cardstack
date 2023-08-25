import { setupHub } from '../helpers/server';
import { nowUtc } from '../../utils/dates';
import { ExtendedPrismaClient } from '../../services/prisma-manager';
import { subMinutes } from 'date-fns';
import DataIntegrityChecksScheduledPayments, {
  CREATION_UNMINED_ALLOWED_MINUTES,
  CREATION_WITHOUT_TX_HASH_ALLOWED_MINUTES,
  CANCELATION_WITHOUT_TX_HASH_ALLOWED_MINUTES,
  CANCELATION_UNMINED_ALLOWED_MINUTES,
} from '../../services/data-integrity-checks/scheduled-payments';
import shortUuid from 'short-uuid';
import cryptoRandomString from 'crypto-random-string';
import { ethers } from 'ethers';
import { Client as DBClient } from 'pg';
import DataIntegrityChecksCronTasks, { type TaskIdentifier } from '../../services/data-integrity-checks/cron-tasks';

describe('data integrity checks', function () {
  let prisma: ExtendedPrismaClient;

  let { getPrisma, getContainer } = setupHub(this);

  this.beforeEach(async function () {
    prisma = await getPrisma();
  });

  describe('scheduled payments', function () {
    let service: DataIntegrityChecksScheduledPayments;

    this.beforeEach(async function () {
      service = await getContainer().lookup('data-integrity-checks-scheduled-payments');
      service.getRelayerFunderBalance = () => Promise.resolve(ethers.utils.parseEther('1'));
      service.getCrankBalance = () => Promise.resolve(ethers.utils.parseEther('1'));
    });

    it('returns a degraded check when there are scheduled payments that should have a creation transaction hash or should be mined by now', async function () {
      let sp1 = await prisma.scheduledPayment.create({
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

      let sp2 = await prisma.scheduledPayment.create({
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
          creationTransactionHash: '0x123',
          createdAt: subMinutes(nowUtc(), CREATION_UNMINED_ALLOWED_MINUTES + 1),
        },
      });

      let result = await service.check();

      expect(result).to.deep.equal({
        status: 'degraded',
        name: 'scheduled-payments',
        message: `scheduled payments without creationTransactionHash: ${sp1.id}; scheduled payment creations that should be mined by now: ${sp2.id}`,
      });
    });

    it('returns a degraded check when there are scheduled payments that should have a deletion transaction hash or should be mined by now', async function () {
      let sp1 = await prisma.scheduledPayment.create({
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
          cancelationTransactionHash: null,
          cancelationBlockNumber: null,
          canceledAt: subMinutes(nowUtc(), CANCELATION_WITHOUT_TX_HASH_ALLOWED_MINUTES + 1),
        },
      });

      let sp2 = await prisma.scheduledPayment.create({
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
          cancelationTransactionHash: '0x123',
          cancelationBlockNumber: null,
          canceledAt: subMinutes(nowUtc(), CANCELATION_UNMINED_ALLOWED_MINUTES + 1),
        },
      });

      // A scheduled payment that has a cancelationTransactionError should not be considered unmined
      await prisma.scheduledPayment.create({
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
          cancelationTransactionHash: '0x123',
          cancelationTransactionError: 'unknown error',
          cancelationBlockNumber: null,
          canceledAt: subMinutes(nowUtc(), CANCELATION_UNMINED_ALLOWED_MINUTES + 1),
        },
      });

      let result = await service.check();

      expect(result).to.deep.equal({
        status: 'degraded',
        name: 'scheduled-payments',
        message: `scheduled payments without cancelationTransactionHash: ${sp1.id}; scheduled payment cancelations that should be mined by now: ${sp2.id}`,
      });
    });

    it('returns a degraded check when there are unattempted scheduled payments', async function () {
      let sp1 = await prisma.scheduledPayment.create({
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
          payAt: subMinutes(nowUtc(), 61),
          spHash: cryptoRandomString({ length: 10 }),
          chainId: 1,
          userAddress: '0x57022DA74ec3e6d8274918C732cf8864be7da833',
          creationTransactionHash: '0x123',
          creationBlockNumber: 1,
        },
      });

      // Below is a canceled scheduled payment that should not be considered unattempted
      await prisma.scheduledPayment.create({
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
          payAt: subMinutes(nowUtc(), 61),
          spHash: cryptoRandomString({ length: 10 }),
          chainId: 1,
          canceledAt: nowUtc(),
          userAddress: '0x57022DA74ec3e6d8274918C732cf8864be7da833',
          creationTransactionHash: '0x123',
          creationBlockNumber: 1,
        },
      });

      // Below is a scheduled payment whose creation transaction was reverted, which should not be considered unattempted
      await prisma.scheduledPayment.create({
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
          payAt: subMinutes(nowUtc(), 61),
          spHash: cryptoRandomString({ length: 10 }),
          chainId: 1,
          canceledAt: nowUtc(),
          userAddress: '0x57022DA74ec3e6d8274918C732cf8864be7da833',
          creationTransactionHash: '0x123',
          creationTransactionError: 'reverted',
          creationBlockNumber: 1,
        },
      });

      // Below is a scheduled payment that does not have a creation block number, which should not be considered as unattempted
      await prisma.scheduledPayment.create({
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
          payAt: subMinutes(nowUtc(), 61),
          spHash: cryptoRandomString({ length: 10 }),
          chainId: 1,
          canceledAt: nowUtc(),
          userAddress: '0x57022DA74ec3e6d8274918C732cf8864be7da833',
          creationTransactionHash: '0x123',
          creationBlockNumber: null,
        },
      });

      let result = await service.check();

      expect(result).to.deep.equal({
        status: 'degraded',
        name: 'scheduled-payments',
        message: `scheduled payments that should have been attempted by now: ${sp1.id}`,
      });
    });

    it('returns a degraded check when there are stuck payment attempts', async function () {
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
          payAt: subMinutes(nowUtc(), 60 * 24),
          spHash: cryptoRandomString({ length: 10 }),
          chainId: 1,
          userAddress: '0x57022DA74ec3e6d8274918C732cf8864be7da833',
          creationTransactionHash: '0x123',
        },
      });

      let spa = await prisma.scheduledPaymentAttempt.create({
        data: {
          id: shortUuid.uuid(),
          startedAt: subMinutes(nowUtc(), 60 * 24),
          endedAt: null,
          status: 'inProgress',
          scheduledPaymentId: sp.id,
          transactionHash: '0x123',
          executionGasPrice: '10000',
        },
      });

      let result = await service.check();

      expect(result).to.deep.equal({
        status: 'degraded',
        name: 'scheduled-payments',
        message: `stuck scheduled payment attempts: ${spa.id}`,
      });
    });

    it('returns a degraded check when there are payment attempts without transaction hash', async function () {
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
          payAt: subMinutes(nowUtc(), 60 * 24),
          spHash: cryptoRandomString({ length: 10 }),
          chainId: 1,
          userAddress: '0x57022DA74ec3e6d8274918C732cf8864be7da833',
          creationTransactionHash: '0x123',
        },
      });

      let spa = await prisma.scheduledPaymentAttempt.create({
        data: {
          id: shortUuid.uuid(),
          startedAt: subMinutes(nowUtc(), 60),
          endedAt: null,
          status: 'inProgress',
          scheduledPaymentId: sp.id,
          transactionHash: null,
          executionGasPrice: '10000',
        },
      });

      let result = await service.check();

      expect(result).to.deep.equal({
        status: 'degraded',
        name: 'scheduled-payments',
        message: `scheduled payment attempts without transaction hash: ${spa.id}`,
      });
    });

    it('returns a degraded check when relay funds are low', async function () {
      service.getRelayerFunderBalance = () => Promise.resolve(ethers.utils.parseEther('0.5'));

      let result = await service.check();
      expect(result).to.deep.equal({
        status: 'degraded',
        name: 'scheduled-payments',
        message: `Relayer balance low on goerli: 0.5 ETH`,
      });
    });

    it('returns a degraded check when crank funds are low', async function () {
      service.getCrankBalance = () => Promise.resolve(ethers.utils.parseEther('0.5'));

      let result = await service.check();
      expect(result).to.deep.equal({
        status: 'degraded',
        name: 'scheduled-payments',
        message: `Crank balance low on goerli: 0.5 ETH`,
      });
    });
  });

  describe('cron-tasks', function () {
    let service: DataIntegrityChecksCronTasks;
    let db: DBClient;
    let { getContainer } = setupHub(this);
    type CronState = {
      [key in TaskIdentifier]: { minutesAgo: number };
    };

    let setupKnownCrontabs = async (db: DBClient, task: CronState) => {
      const tasks = Object.entries(task).map(async ([identifier, config]) => {
        const query = `
          INSERT INTO graphile_worker.known_crontabs (identifier, known_since, last_execution) 
          VALUES ($1, current_timestamp, current_timestamp - interval '${config.minutesAgo} minutes');
        `;
        await db.query(query, [identifier]);
      });

      await Promise.all(tasks);
    };

    this.beforeEach(async function () {
      let dbManager = await getContainer().lookup('database-manager');
      db = await dbManager.getClient();
      service = await getContainer().lookup('data-integrity-checks-cron-tasks');
      await db.query('DELETE FROM graphile_worker.known_crontabs;');
    });

    it('returns an operational check when all task have not stopped', async function () {
      await setupKnownCrontabs(db, {
        'check-reward-roots': { minutesAgo: 5 },
        'execute-scheduled-payments': { minutesAgo: 10 },
        'print-queued-jobs': { minutesAgo: 5 },
        'remove-old-sent-notifications': { minutesAgo: 600 },
      });

      let result = await service.check();
      expect(result).to.deep.equal({
        status: 'operational',
        name: 'cron-tasks',
        message: null,
      });
    });

    it('returns a degraded check when there is at least one task stopped outside of multiplier tolerance', async function () {
      await setupKnownCrontabs(db, {
        'check-reward-roots': { minutesAgo: 31 }, // stopped
        'execute-scheduled-payments': { minutesAgo: 5 },
        'print-queued-jobs': { minutesAgo: 2 },
        'remove-old-sent-notifications': { minutesAgo: 5000 }, // stopped
      });

      let result = await service.check();
      expect(result.name).to.equal('cron-tasks');
      expect(result.status).to.equal('degraded');
      expect(
        result.message?.includes(
          '"check-reward-roots" has not run within 30 minutes tolerance (supposed to be every 10 minutes)'
        )
      ).to.be.true;
      expect(
        result.message?.includes(
          '"remove-old-sent-notifications" has not run within 1800 minutes tolerance (supposed to be every 600 minutes).'
        )
      ).to.be.true;
      expect(result.message?.includes('"execute-scheduled-payments"')).to.be.false;
      expect(result.message?.includes('"print-queued-jobs"')).to.be.false;
    });
  });
});
