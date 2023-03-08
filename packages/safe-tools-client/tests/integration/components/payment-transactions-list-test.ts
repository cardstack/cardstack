/* eslint-disable @typescript-eslint/no-empty-function */
import SchedulePaymentSDKService from '@cardstack/safe-tools-client/services/scheduled-payment-sdk';
import {
  ScheduledPaymentAttempt,
  type ScheduledPaymentAttemptStatus,
} from '@cardstack/safe-tools-client/services/scheduled-payments';
import TokenQuantity from '@cardstack/safe-tools-client/utils/token-quantity';
import Service from '@ember/service';
import { click, render, TestContext } from '@ember/test-helpers';
import { addYears, subDays, addMinutes, format } from 'date-fns';
import { BigNumber } from 'ethers';
import hbs from 'htmlbars-inline-precompile';
import { module, test } from 'qunit';

import { setupRenderingTest } from '../../helpers';

class WalletServiceStub extends Service {
  isConnected = true;
}
class HubAuthenticationServiceStub extends Service {
  isAuthenticated = true;
}

class SafesServiceStub extends Service {
  currentSafe = {
    address: '0xc0ffee254729296a45a3885639AC7E10F9d54979',
  };
  reloadTokenBalances() {}
}

let returnEmptyScheduledPaymentAttempts = false;
let returnScheduledPaymentAttemptsWithBlankTxHash = false;
let returnScheduledPaymentAttemptsWithExceedMaxGasPriceError = false;
let returnScheduledPaymentAttemptsOfCanceledScheduledPayment = false;
const now = new Date();

class ScheduledPaymentsStub extends Service {
  fetchScheduledPaymentAttempts = (
    chainId: number,
    senderSafeAddress: string,
    status?: ScheduledPaymentAttemptStatus,
    startedAt?: Date
  ): Promise<ScheduledPaymentAttempt[]> => {
    const paymentToken = {
      address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
      symbol: 'USDC',
      name: 'Example USDC',
      decimals: 6,
    };

    const addPaymentTokenQuantity = (amount: string) =>
      new TokenQuantity(paymentToken, BigNumber.from(amount));
    if (returnEmptyScheduledPaymentAttempts) {
      return Promise.resolve([]);
    } else if (returnScheduledPaymentAttemptsWithBlankTxHash) {
      return Promise.resolve([
        {
          id: '1',
          startedAt: subDays(now, 10),
          endedAt: addMinutes(subDays(now, 10), 120),
          status: 'failed',
          failureReason: '',
          transactionHash: undefined,
          executionGasPrice: BigNumber.from('10000'),
          scheduledPayment: {
            id: '01234',
            paymentTokenQuantity: addPaymentTokenQuantity('10000000'),
            feeFixedUSD: '0',
            feePercentage: '0',
            gasToken: paymentToken,
            chainId,
            payeeAddress: '0xeBCC5516d44FFf5E9aBa2AcaeB65BbB49bC3EBe1',
            payAt: addMinutes(subDays(now, 10), 120),
            maxGasPrice: BigNumber.from('10000'),
            nextRetryAttemptAt: new Date('2022-11-11T01:00Z'),
            scheduledPaymentAttemptsInLastPaymentCycleCount: 2,
            lastScheduledPaymentAttemptId: '1',
            retriesLeft: 2,
          },
        },
      ]);
    } else if (returnScheduledPaymentAttemptsWithExceedMaxGasPriceError) {
      return Promise.resolve([
        {
          id: '11',
          startedAt: subDays(now, 10),
          endedAt: addMinutes(subDays(now, 10), 120),
          status: 'failed',
          failureReason: 'ExceedMaxGasPrice',
          transactionHash: undefined,
          executionGasPrice: BigNumber.from('10000'),
          scheduledPayment: {
            id: '01234',
            paymentTokenQuantity: addPaymentTokenQuantity('10000000'),
            feeFixedUSD: '0',
            feePercentage: '0',
            gasToken: paymentToken,
            chainId,
            payeeAddress: '0xeBCC5516d44FFf5E9aBa2AcaeB65BbB49bC3EBe1',
            payAt: addMinutes(subDays(now, 10), 120),
            maxGasPrice: BigNumber.from('5000'),
            recurringDayOfMonth: undefined,
            recurringUntil: undefined,
            nextRetryAttemptAt: new Date('2022-11-11T01:00Z'),
            scheduledPaymentAttemptsInLastPaymentCycleCount: 2,
            lastScheduledPaymentAttemptId: '11',
            retriesLeft: 2,
          },
        },
      ]);
    } else if (returnScheduledPaymentAttemptsOfCanceledScheduledPayment) {
      return Promise.resolve([
        {
          id: '111',
          startedAt: subDays(now, 10),
          endedAt: addMinutes(subDays(now, 10), 120),
          status: 'failed',
          executionGasPrice: BigNumber.from('10000'),
          failureReason: 'PaymentExecutionFailed',
          transactionHash: '0x123',
          scheduledPayment: {
            id: '34234',
            paymentTokenQuantity: addPaymentTokenQuantity('10000000'),
            feeFixedUSD: '0',
            feePercentage: '0',
            gasToken: paymentToken,
            chainId,
            senderSafeAddress,
            payeeAddress: '0xeBCC5516d44FFf5E9aBa2AcaeB65BbB49bC3EBe1',
            payAt: addMinutes(subDays(now, 10), 120),
            maxGasPrice: BigNumber.from('10000'),
            recurringDayOfMonth: undefined,
            recurringUntil: undefined,
            isCanceled: true,
            nextRetryAttemptAt: new Date('2022-11-11T01:00Z'),
            scheduledPaymentAttemptsInLastPaymentCycleCount: 2,
            lastScheduledPaymentAttemptId: '111',
            retriesLeft: 2,
          },
        },
        {
          id: '2',
          startedAt: subDays(now, 10),
          endedAt: addMinutes(subDays(now, 10), 100),
          status: 'failed',
          failureReason: '',
          executionGasPrice: BigNumber.from('10000'),
          transactionHash: '0x123',
          scheduledPayment: {
            id: '323232',
            paymentTokenQuantity: addPaymentTokenQuantity('15000000'),
            feeFixedUSD: '0',
            feePercentage: '0',
            gasToken: paymentToken,
            chainId,
            senderSafeAddress,
            payeeAddress: '0xeBCC5516d44FFf5E9aBa2AcaeB65BbB49bC3EBe1',
            payAt: addMinutes(subDays(now, 10), 120),
            maxGasPrice: BigNumber.from('10000'),
            recurringDayOfMonth: undefined,
            recurringUntil: undefined,
            isCanceled: true,
            nextRetryAttemptAt: new Date('2022-11-11T01:00Z'),
            scheduledPaymentAttemptsInLastPaymentCycleCount: 2,
            lastScheduledPaymentAttemptId: '222',
            retriesLeft: 2,
          },
        },
      ]);
    } else {
      return Promise.resolve(
        [
          {
            id: '1',
            startedAt: subDays(now, 10),
            endedAt: addMinutes(subDays(now, 10), 120),
            status: 'succeeded',
            failureReason: '',
            executionGasPrice: BigNumber.from('10000'),
            transactionHash:
              '0x6f7c54719c0901e30ef018206c37df4daa059224549a08d55acb3360f01094e2',
            scheduledPayment: {
              id: '01234',
              paymentTokenQuantity: addPaymentTokenQuantity('10000000'),
              feeFixedUSD: '0',
              feePercentage: '0',
              gasToken: paymentToken,
              chainId,
              senderSafeAddress,
              payeeAddress: '0xeBCC5516d44FFf5E9aBa2AcaeB65BbB49bC3EBe1',
              payAt: addMinutes(subDays(now, 10), 120),
              maxGasPrice: BigNumber.from('10000'),
              recurringDayOfMonth: undefined,
              recurringUntil: undefined,
              nextRetryAttemptAt: null,
              scheduledPaymentAttemptsInLastPaymentCycleCount: 1,
              lastScheduledPaymentAttemptId: '1',
              retriesLeft: 0,
            },
          },
          {
            id: '2',
            startedAt: subDays(now, 20),
            endedAt: addMinutes(subDays(now, 20), 120),
            status: 'failed',
            executionGasPrice: BigNumber.from('10000'),
            failureReason: 'PaymentExecutionFailed',
            transactionHash: '0x123',
            scheduledPayment: {
              id: '34234',
              paymentTokenQuantity: addPaymentTokenQuantity('10000000'),
              feeFixedUSD: '0',
              feePercentage: '0',
              gasToken: paymentToken,
              chainId,
              senderSafeAddress,
              payeeAddress: '0xeBCC5516d44FFf5E9aBa2AcaeB65BbB49bC3EBe1',
              payAt: addMinutes(subDays(now, 20), 120),
              maxGasPrice: BigNumber.from('10000'),
              recurringDayOfMonth: subDays(now, 20).getDate(),
              recurringUntil: addYears(now, 1),
              nextRetryAttemptAt: new Date('2022-11-11T01:00Z'),
              scheduledPaymentAttemptsInLastPaymentCycleCount: 2,
              lastScheduledPaymentAttemptId: '2',
              retriesLeft: 2,
            },
          },
          {
            id: '3',
            startedAt: subDays(now, 60),
            endedAt: addMinutes(subDays(now, 60), 120),
            status: 'succeeded',
            failureReason: '',
            executionGasPrice: BigNumber.from('10000'),
            transactionHash: '0x123',
            scheduledPayment: {
              id: '323232',
              paymentTokenQuantity: addPaymentTokenQuantity('15000000'),
              feeFixedUSD: '0',
              feePercentage: '0',
              gasToken: paymentToken,
              chainId,
              senderSafeAddress,
              payeeAddress: '0xeBCC5516d44FFf5E9aBa2AcaeB65BbB49bC3EBe1',
              payAt: addMinutes(subDays(now, 60), 120),
              maxGasPrice: BigNumber.from('10000'),
              recurringDayOfMonth: undefined,
              recurringUntil: undefined,
              nextRetryAttemptAt: null,
              scheduledPaymentAttemptsInLastPaymentCycleCount: 1,
              lastScheduledPaymentAttemptId: '1',
              retriesLeft: 0,
            },
          },
        ]
          .filter((r) => (startedAt ? r.startedAt > startedAt : true))
          .filter((r) => (status ? r.status === status : true))
      );
    }
  };
}

module('Integration | Component | payment-transactions-list', function (hooks) {
  setupRenderingTest(hooks);

  hooks.beforeEach(function (this: TestContext) {
    this.owner.register('service:wallet', WalletServiceStub);
    this.owner.register('service:scheduled-payments', ScheduledPaymentsStub);
    this.owner.register(
      'service:hub-authentication',
      HubAuthenticationServiceStub
    );
    returnEmptyScheduledPaymentAttempts = false;
    returnScheduledPaymentAttemptsWithBlankTxHash = false;
    returnScheduledPaymentAttemptsWithExceedMaxGasPriceError = false;
    returnScheduledPaymentAttemptsOfCanceledScheduledPayment = false;
    this.owner.register('service:safes', SafesServiceStub);
  });

  test('It renders transactions', async function (assert) {
    await render(hbs`
      <PaymentTransactionsList />
    `);

    assert.dom('[data-test-scheduled-payment-attempts]').exists();
    assert
      .dom('[data-test-scheduled-payment-attempts-item]')
      .exists({ count: 2 });

    assert
      .dom(
        '[data-test-scheduled-payment-attempts-item="0"] [data-test-scheduled-payment-attempts-item-timestamp]'
      )
      .containsText(format(now, 'HH:mm'));

    assert
      .dom(
        '[data-test-scheduled-payment-attempts-item="0"] [data-test-scheduled-payment-attempts-item-timestamp]'
      )
      .containsText(format(subDays(now, 10), 'dd/MM/yyyy'));

    assert
      .dom(
        '[data-test-scheduled-payment-attempts-item="0"] [data-test-scheduled-payment-attempts-item-payee]'
      )
      .containsText('0xeBCC...EBe1');

    assert
      .dom(
        '[data-test-scheduled-payment-attempts-item="0"] [data-test-scheduled-payment-attempts-item-amount]'
      )
      .hasText('10.0 USDC');

    assert
      .dom(
        '[data-test-scheduled-payment-attempts-item="0"] [data-test-scheduled-payment-attempts-item-status]'
      )
      .includesText('Confirmed');

    assert
      .dom(
        '[data-test-scheduled-payment-attempts-item="1"] [data-test-scheduled-payment-attempts-item-status]'
      )
      .includesText('Failed')
      .includesText('Insufficient funds to execute the payment')
      .includesText(
        `Next retry: ${format(
          new Date('2022-11-11T01:00Z'),
          'HH:mm dd/MM/yyyy'
        )}`
      )
      .includesText('Retries left: 2');

    assert
      .dom(
        '[data-test-scheduled-payment-attempts-item="0"] [data-test-scheduled-payment-attempts-item-explorer-button]'
      )
      .hasText('Etherscan')
      .hasAttribute(
        'href',
        'https://etherscan.io/tx/0x6f7c54719c0901e30ef018206c37df4daa059224549a08d55acb3360f01094e2'
      )
      .hasAttribute('title', 'View transaction on Etherscan');
  });

  test('it can filter by status', async function (assert) {
    this.set('wallet', { isConnected: true });

    await render(hbs`
      <PaymentTransactionsList />
    `);
    assert
      .dom('[data-test-scheduled-payment-attempts-item]')
      .exists({ count: 2 });
    assert
      .dom('[data-test-scheduled-payment-status-filter]')
      .containsText('Status: All');
    await click('[data-test-scheduled-payment-status-filter]');
    assert.dom('.boxel-menu').containsText('All Succeeded Failed In Progress');
    await click('[data-test-boxel-menu-item-text="Failed"]');
    assert
      .dom('[data-test-scheduled-payment-attempts-item]')
      .exists({ count: 1 });
    assert
      .dom(
        '[data-test-scheduled-payment-attempts-item="0"] [data-test-scheduled-payment-attempts-item-status]'
      )
      .includesText('Failed');
    await click('[data-test-scheduled-payment-status-filter]');
    await click('[data-test-boxel-menu-item-text="Succeeded"]');

    assert
      .dom('[data-test-scheduled-payment-attempts-item]')
      .exists({ count: 1 });
    assert
      .dom(
        '[data-test-scheduled-payment-attempts-item="0"] [data-test-scheduled-payment-attempts-item-status]'
      )
      .includesText('Confirmed');
    await click('[data-test-scheduled-payment-status-filter]');
    await click('[data-test-boxel-menu-item-text="All"]');
    assert
      .dom('[data-test-scheduled-payment-attempts-item]')
      .exists({ count: 2 });
  });

  test('it can filter by date', async function (assert) {
    this.set('wallet', { isConnected: true });

    await render(hbs`
      <PaymentTransactionsList />
    `);

    assert
      .dom('[data-test-scheduled-payment-attempts-item]')
      .exists({ count: 2 });
    assert
      .dom('[data-test-scheduled-payment-date-filter]')
      .containsText('Date: Last 30 days');
    await click('[data-test-scheduled-payment-date-filter]');
    assert
      .dom('.boxel-menu')
      .containsText('Last 30 days Last 90 days Last 120 days');
    await click('[data-test-boxel-menu-item-text="Last 90 days"]');
    assert
      .dom('[data-test-scheduled-payment-attempts-item]')
      .exists({ count: 3 });

    await click('[data-test-scheduled-payment-date-filter]');
    await click('[data-test-boxel-menu-item-text="Last 120 days"]');
    assert
      .dom('[data-test-scheduled-payment-attempts-item]')
      .exists({ count: 3 });
  });

  test('It adds explanation when there are no payment attempts', async function (assert) {
    returnEmptyScheduledPaymentAttempts = true;

    await render(hbs`
      <PaymentTransactionsList />
    `);

    assert
      .dom('[data-test-scheduled-payment-attempts-empty]')
      .hasText('No payments found.');
  });

  test('It disables block-explorer-button if tx hash is blank', async function (assert) {
    returnScheduledPaymentAttemptsWithBlankTxHash = true;

    await render(hbs`
      <PaymentTransactionsList />
    `);

    assert.strictEqual(
      document.querySelectorAll(`.boxel-button--with-tooltip`).length,
      1
    );
  });

  test('It returns details of execution gas price', async function (assert) {
    returnScheduledPaymentAttemptsWithExceedMaxGasPriceError = true;
    await render(hbs`
      <PaymentTransactionsList />
    `);

    assert
      .dom('.transactions-table-item-status-line')
      .includesText(
        'Gas cost exceeded the maximum you set. Actual: 0.010 / Max allowed: 0.005'
      );
  });

  test('It can cancel incomplete payment', async function (assert) {
    this.set('wallet', { isConnected: true });
    const scheduledPaymentSdkService = this.owner.lookup(
      'service:scheduled-payment-sdk'
    ) as SchedulePaymentSDKService;

    scheduledPaymentSdkService.cancelScheduledPayment = (): Promise<void> => {
      return Promise.resolve();
    };

    await render(hbs`
      <PaymentTransactionsList />
    `);

    await click(
      '[data-test-scheduled-payment-attempts-item="1"] [data-test-scheduled-payment-card-options-button]'
    );
    await click('[data-test-boxel-menu-item-text="Cancel Payment"]');
    await click('[data-test-cancel-payment-button]');

    assert
      .dom('[data-test-cancel-scheduled-payment-modal]')
      .includesText(
        "Your scheduled payment was canceled and removed successfully, and it won't be attempted in the future."
      );
    assert.dom('[data-test-cancel-payment-button]').doesNotExist();
  });

  test('It cannot cancel a completed payment', async function (assert) {
    const scheduledPaymentSdkService = this.owner.lookup(
      'service:scheduled-payment-sdk'
    ) as SchedulePaymentSDKService;

    scheduledPaymentSdkService.cancelScheduledPayment = (): Promise<void> => {
      return Promise.resolve();
    };

    this.set('wallet', { isConnected: true });

    await render(hbs`
      <PaymentTransactionsList />
    `);
    await click(
      '[data-test-scheduled-payment-attempts-item="0"] [data-test-scheduled-payment-card-options-button]'
    );
    assert.dom('.boxel-menu__item--disabled').containsText('Cancel Payment');
  });

  test('It displays the latest attempts of canceled scheduled payment with status cancel', async function (assert) {
    returnScheduledPaymentAttemptsOfCanceledScheduledPayment = true;
    await render(hbs`
      <PaymentTransactionsList />
    `);

    assert
      .dom('[data-test-scheduled-payment-attempts-item]')
      .exists({ count: 2 });
    assert
      .dom('[data-test-scheduled-payment-attempts-item-status-canceled]')
      .exists({ count: 1 });
  });
});
