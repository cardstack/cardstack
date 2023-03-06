import { ScheduledPayment } from '@prisma/client';
import { expect } from 'chai';
import cryptoRandomString from 'crypto-random-string';
import { subDays, subMinutes, subSeconds } from 'date-fns';
import shortUuid from 'short-uuid';
import shortUUID from 'short-uuid';
import ScheduledPaymentOnChainExecutionWaiter from '../../tasks/scheduled-payment-on-chain-execution-waiter';
import { nowUtc } from '../../utils/dates';
import { registry, setupHub } from '../helpers/server';
import { setupStubWorkerClient } from '../helpers/stub-worker-client';
let sdkError: Error | null = null;

class StubCardpaySDK {
  getSDK(sdk: string) {
    switch (sdk) {
      case 'ScheduledPaymentModule':
        return Promise.resolve({
          executeScheduledPayment: async (
            _moduleAddress: any,
            _tokenAddress: any,
            _amount: any,
            _payeeAddress: any,
            _feeFixedUsd: any,
            _feePercentage: any,
            _executionGasEstimation: any,
            _maxGasPrice: any,
            _gasTokenAddress: any,
            _salt: any,
            _payAt: any,
            _gasPrice: any,
            _recurringDayOfMonth: any,
            _recurringUntil: any
          ) => {
            if (sdkError) {
              throw sdkError;
            }
            return Promise.resolve();
          },
        });
      default:
        throw new Error(`unsupported mock cardpay sdk: ${sdk}`);
    }
  }
}

describe('ScheduledPaymentOnChainExecutionWaiter', function () {
  let { getJobIdentifiers, getJobPayloads } = setupStubWorkerClient(this);

  this.beforeEach(async function () {
    registry(this).register('cardpay', StubCardpaySDK);
  });

  let { getPrisma, getContainer } = setupHub(this);

  it('waits for the transaction to be mined and updates the status', async function () {
    let prisma = await getPrisma();
    let task = await getContainer().instantiate(ScheduledPaymentOnChainExecutionWaiter);
    let scheduledPayment = await prisma.scheduledPayment.create({
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
        feeFixedUsd: 0,
        feePercentage: 0,
        salt: '54lt',
        payAt: new Date(),
        spHash: cryptoRandomString({ length: 10 }),
        chainId: 1,
        userAddress: '0x57022DA74ec3e6d8274918C732cf8864be7da833',
        creationTransactionHash: '0xc13d7905be5c989378a945487cd2a1193627ae606009e28e296d48ddaec66162',
      },
    });

    let scheduledPaymentAttempt = await prisma.scheduledPaymentAttempt.create({
      data: {
        id: shortUUID.uuid(),
        startedAt: nowUtc(),
        endedAt: null,
        status: 'inProgress',
        scheduledPaymentId: scheduledPayment.id,
        transactionHash: '0x123',
        executionGasPrice: '10000',
      },
    });

    await task.perform({ scheduledPaymentAttemptId: scheduledPaymentAttempt.id });

    scheduledPaymentAttempt = await prisma.scheduledPaymentAttempt.findUniqueOrThrow({
      where: {
        id: scheduledPaymentAttempt.id,
      },
    });

    expect(scheduledPaymentAttempt.status).to.eq('succeeded');
    expect(scheduledPaymentAttempt.endedAt).to.gt(subSeconds(nowUtc(), 1));

    // Reload the payment to ensure that scheduledPaymentAttemptsInLastPaymentCycleCount and nextRetryAttemptAt were updated
    scheduledPayment = (await prisma.scheduledPayment.findUnique({
      where: {
        id: scheduledPayment.id,
      },
    })) as ScheduledPayment;

    expect(scheduledPayment.scheduledPaymentAttemptsInLastPaymentCycleCount).to.equal(0);
    expect(scheduledPayment.nextRetryAttemptAt).to.be.null;
  });

  it('spawns a new waiter if timeout occurs', async function () {
    sdkError = new Error('Transaction took too long to complete, waited 600 seconds. txn hash: 0x123');

    let prisma = await getPrisma();
    let task = await getContainer().instantiate(ScheduledPaymentOnChainExecutionWaiter);
    let scheduledPayment = await prisma.scheduledPayment.create({
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
        feeFixedUsd: 0,
        feePercentage: 0,
        salt: '54lt',
        payAt: new Date(),
        spHash: cryptoRandomString({ length: 10 }),
        chainId: 1,
        userAddress: '0x57022DA74ec3e6d8274918C732cf8864be7da833',
        creationTransactionHash: '0xc13d7905be5c989378a945487cd2a1193627ae606009e28e296d48ddaec66162',
      },
    });

    let scheduledPaymentAttempt = await prisma.scheduledPaymentAttempt.create({
      data: {
        id: shortUUID.uuid(),
        startedAt: nowUtc(),
        endedAt: null,
        status: 'inProgress',
        scheduledPaymentId: scheduledPayment.id,
        transactionHash: '0x123',
        executionGasPrice: '10000',
      },
    });

    await task.perform({ scheduledPaymentAttemptId: scheduledPaymentAttempt.id });

    scheduledPaymentAttempt = await prisma.scheduledPaymentAttempt.findUniqueOrThrow({
      where: {
        id: scheduledPaymentAttempt.id,
      },
    });

    expect(scheduledPaymentAttempt.status).to.eq('inProgress');
    expect(scheduledPaymentAttempt.endedAt).to.be.null;
    expect(getJobIdentifiers()[0]).to.equal('scheduled-payment-on-chain-execution-waiter');
    expect(getJobPayloads()[0]).to.deep.equal({ scheduledPaymentAttemptId: scheduledPaymentAttempt.id });
  });

  it('does not spawn a new waiter if we are waiting for more than a day', async function () {
    sdkError = new Error('Transaction took too long to complete, waited 600 seconds. txn hash: 0x123');
    let prisma = await getPrisma();
    let task = await getContainer().instantiate(ScheduledPaymentOnChainExecutionWaiter);
    let scheduledPayment = await prisma.scheduledPayment.create({
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
        feeFixedUsd: 0,
        feePercentage: 0,
        salt: '54lt',
        payAt: new Date(),
        spHash: cryptoRandomString({ length: 10 }),
        chainId: 1,
        userAddress: '0x57022DA74ec3e6d8274918C732cf8864be7da833',
        creationTransactionHash: '0xc13d7905be5c989378a945487cd2a1193627ae606009e28e296d48ddaec66162',
      },
    });

    let scheduledPaymentAttempt = await prisma.scheduledPaymentAttempt.create({
      data: {
        id: shortUUID.uuid(),
        startedAt: subMinutes(subDays(nowUtc(), 1), 1),
        endedAt: null,
        status: 'inProgress',
        scheduledPaymentId: scheduledPayment.id,
        transactionHash: '0x123',
        executionGasPrice: '10000',
      },
    });

    await task.perform({ scheduledPaymentAttemptId: scheduledPaymentAttempt.id });

    scheduledPaymentAttempt = await prisma.scheduledPaymentAttempt.findUniqueOrThrow({
      where: {
        id: scheduledPaymentAttempt.id,
      },
    });

    expect(scheduledPaymentAttempt.status).to.eq('failed');
    expect(scheduledPaymentAttempt.endedAt).to.not.be.null;
    expect(scheduledPaymentAttempt.failureReason).to.eq(
      "Waited for more than 1 day for the transaction to be mined, but it wasn't"
    );
  });

  it('updates failure reason on error', async function () {
    sdkError = new Error('ExceedMaxGasPrice');

    let prisma = await getPrisma();
    let task = await getContainer().instantiate(ScheduledPaymentOnChainExecutionWaiter);
    let scheduledPayment = await prisma.scheduledPayment.create({
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
        feeFixedUsd: 0,
        feePercentage: 0,
        salt: '54lt',
        payAt: new Date(),
        spHash: cryptoRandomString({ length: 10 }),
        chainId: 1,
        userAddress: '0x57022DA74ec3e6d8274918C732cf8864be7da833',
        creationTransactionHash: '0xc13d7905be5c989378a945487cd2a1193627ae606009e28e296d48ddaec66162',
      },
    });

    let scheduledPaymentAttempt = await prisma.scheduledPaymentAttempt.create({
      data: {
        id: shortUUID.uuid(),
        startedAt: nowUtc(),
        endedAt: null,
        status: 'inProgress',
        scheduledPaymentId: scheduledPayment.id,
        transactionHash: '0x123',
        executionGasPrice: '10000',
      },
    });

    await task.perform({ scheduledPaymentAttemptId: scheduledPaymentAttempt.id });

    scheduledPaymentAttempt = await prisma.scheduledPaymentAttempt.findUniqueOrThrow({
      where: {
        id: scheduledPaymentAttempt.id,
      },
    });

    expect(scheduledPaymentAttempt.status).to.eq('failed');
    expect(scheduledPaymentAttempt.failureReason).to.eq('ExceedMaxGasPrice');
    expect(scheduledPaymentAttempt.endedAt).to.not.be.null;

    // Reload the payment to ensure that scheduledPaymentAttemptsInLastPaymentCycleCount and nextRetryAttemptAt were updated
    scheduledPayment = (await prisma.scheduledPayment.findUnique({
      where: {
        id: scheduledPayment.id,
      },
    })) as ScheduledPayment;

    expect(scheduledPayment.scheduledPaymentAttemptsInLastPaymentCycleCount).to.equal(0);
    expect(scheduledPayment.nextRetryAttemptAt).to.be.null;
  });
});
