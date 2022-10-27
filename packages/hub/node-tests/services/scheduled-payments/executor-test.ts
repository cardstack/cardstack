import { registry, setupHub } from '../../helpers/server';
import { nowUtc } from '../../../utils/dates';
import { ExtendedPrismaClient } from '../../../services/prisma-manager';
import ScheduledPaymentsExecutorService from '../../../services/scheduled-payments/executor';
import { setupStubWorkerClient } from '../../helpers/stub-worker-client';
import BN from 'bn.js';
import NonceLock from '../../../services/nonce-lock';

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
            _maxGasPrice: 'any',
            _gasTokenAddress: any,
            _salt: any,
            _payAt: any,
            _gasPrice: any,
            _recurringDayOfMonth: any,
            _recurringUntil: any,
            { onTxnHash }: any
          ) => {
            if (sdkError) {
              throw sdkError;
            }
            await onTxnHash('0x123');
            return Promise.resolve();
          },
        });
      default:
        throw new Error(`unsupported mock cardpay sdk: ${sdk}`);
    }
  }
}

describe('executing scheduled payments', function () {
  let { getJobIdentifiers, getJobPayloads } = setupStubWorkerClient(this);
  let subject: ScheduledPaymentsExecutorService;
  let prisma: ExtendedPrismaClient;
  let nonceLock: NonceLock;

  this.beforeEach(async function () {
    registry(this).register('cardpay', StubCardpaySDK);
  });

  let { getPrisma, getContainer } = setupHub(this);

  this.beforeEach(async function () {
    subject = (await getContainer().lookup('scheduled-payment-executor')) as ScheduledPaymentsExecutorService;
    subject.getCurrentGasPrice = async () => new BN('1000000000');
    prisma = await getPrisma();
    nonceLock = (await getContainer().lookup('nonce-lock')) as NonceLock;
    nonceLock.withNonce = async (accountAddress: string, chainId: number, cb: (nonce: BN) => Promise<any>) => {
      if (accountAddress && chainId) {
        let nonce = new BN(1);
        return await cb(nonce);
      }
    };
  });

  it('executes a scheduled payment and spawns the task to wait for the transaction to finish', async function () {
    let scheduledPayment = await prisma.scheduledPayment.create({
      data: {
        id: '73994d4b-bb3a-4d73-969f-6fa24da16fb4',
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
        spHash: '0x123',
        chainId: 1,
        userAddress: '0x57022DA74ec3e6d8274918C732cf8864be7da833',
        creationTransactionHash: null,
      },
    });

    await subject.executePayment(scheduledPayment);

    let scheduledPaymentAttempts = await prisma.scheduledPaymentAttempt.findMany({
      where: {
        scheduledPaymentId: scheduledPayment.id,
      },
    });

    expect(scheduledPaymentAttempts.length).to.equal(1);
    expect(scheduledPaymentAttempts[0].status).to.equal('inProgress');
    expect(getJobIdentifiers()[0]).to.equal('scheduled-payment-on-chain-execution-waiter');
    expect(getJobPayloads()[0]).to.deep.equal({ scheduledPaymentAttemptId: scheduledPaymentAttempts[0].id });
  });

  it("sets the scheduled payment's status to 'failed' if the transaction fails", async function () {
    sdkError = new Error('UnknownHash');

    let scheduledPayment = await prisma.scheduledPayment.create({
      data: {
        id: '73994d4b-bb3a-4d73-969f-6fa24da16fb4',
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
        spHash: '0x123',
        chainId: 1,
        userAddress: '0x57022DA74ec3e6d8274918C732cf8864be7da833',
        creationTransactionHash: null,
      },
    });

    await expect(subject.executePayment(scheduledPayment)).to.be.rejected;

    let scheduledPaymentAttempts = await prisma.scheduledPaymentAttempt.findMany({
      where: {
        scheduledPaymentId: scheduledPayment.id,
      },
    });

    expect(scheduledPaymentAttempts.length).to.equal(1);
    expect(scheduledPaymentAttempts[0].status).to.equal('failed');
    expect(scheduledPaymentAttempts[0].failureReason).to.equal('UnknownHash');
  });
});
