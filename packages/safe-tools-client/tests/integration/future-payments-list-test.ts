/* eslint-disable @typescript-eslint/no-empty-function */
import SchedulePaymentSDKService from '@cardstack/safe-tools-client/services/scheduled-payments-sdk';
import Service from '@ember/service';
import { render, click, TestContext } from '@ember/test-helpers';
import percySnapshot from '@percy/ember';
import { addMinutes, addMonths, addHours } from 'date-fns';

import hbs from 'htmlbars-inline-precompile';
import { module, test } from 'qunit';

import { setupRenderingTest } from '../helpers';

class WalletServiceStub extends Service {
  isConnected = true;
}
class HubAuthenticationServiceStub extends Service {
  isAuthenticated = true;
}

let returnEmptyScheduledPayments = false;

class ScheduledPaymentsStub extends Service {
  fetchScheduledPayments = (chainId: number, minPayAt?: Date) => {
    if (returnEmptyScheduledPayments || !minPayAt) {
      return Promise.resolve([]);
    }
    return Promise.resolve([
      {
        amount: '10000000',
        feeFixedUSD: '0',
        feePercentage: '0',
        gasTokenAddress: '0x123',
        tokenAddress: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
        chainId,
        payeeAddress: '0xeBCC5516d44FFf5E9aBa2AcaeB65BbB49bC3EBe1',
        payAt: addMinutes(addHours(minPayAt, 1), 5),
      },
      {
        amount: '10000000',
        feeFixedUSD: '0',
        feePercentage: '0',
        gasTokenAddress: '0x123',
        tokenAddress: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
        chainId,
        payeeAddress: '0xeBCC5516d44FFf5E9aBa2AcaeB65BbB49bC3EBe1',
        payAt: addMinutes(addHours(minPayAt, 1), 20),
      },
      {
        amount: '11000000',
        feeFixedUSD: '0',
        feePercentage: '0',
        gasTokenAddress: '0x123',
        tokenAddress: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
        chainId,
        payeeAddress: '0xeBCC5516d44FFf5E9aBa2AcaeB65BbB49bC3EBe1',
        payAt: addMonths(minPayAt, 1),
      },
      {
        amount: '20000000',
        feeFixedUSD: '0',
        feePercentage: '0',
        gasTokenAddress: '0x123',
        tokenAddress: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
        chainId,
        payeeAddress: '0xeBCC5516d44FFf5E9aBa2AcaeB65BbB49bC3EBe1',
        payAt: addMonths(minPayAt, 3),
      },
    ]);
  };
}

module('Integration | Component | future-payments-list', function (hooks) {
  setupRenderingTest(hooks);

  hooks.beforeEach(function (this: TestContext) {
    this.owner.register('service:wallet', WalletServiceStub);
    this.owner.register('service:scheduled-payments', ScheduledPaymentsStub);
    this.owner.register(
      'service:hub-authentication',
      HubAuthenticationServiceStub
    );
  });

  hooks.afterEach(function () {
    returnEmptyScheduledPayments = false;
  });

  test('It renders no payments display if no future payments', async function (assert) {
    assert.expect(2);
    returnEmptyScheduledPayments = true;
    this.set('onDepositClick', () => {});
    await render(hbs`
      <FuturePaymentsList @onDepositClick={{this.onDepositClick}} />
    `);

    await percySnapshot(assert);
    assert.dom('[data-test-no-future-payments-list]').isVisible();
    assert.dom('[data-test-future-payments-list]').isNotVisible();
  });

  test('It renders future payments list', async function (assert) {
    assert.expect(5);
    this.set('onDepositClick', () => {});
    await render(hbs`
      <FuturePaymentsList @onDepositClick={{this.onDepositClick}} />
    `);

    await percySnapshot(assert);
    assert.dom('[data-test-no-future-payments-list]').isNotVisible();
    assert.dom('[data-test-future-payments-list]').isVisible();
    assert.strictEqual(
      document.querySelectorAll(
        `[data-test-time-bracket='next hour'] [data-test-scheduled-payment-card]`
      ).length,
      2
    );
    assert.strictEqual(
      document.querySelectorAll(
        `[data-test-time-bracket='next month'] [data-test-scheduled-payment-card]`
      ).length,
      1
    );
    assert.strictEqual(
      document.querySelectorAll(
        `[data-test-time-bracket='next few months'] [data-test-scheduled-payment-card]`
      ).length,
      1
    );
  });

  test('can cancel a payment', async function (assert) {
    const scheduledPaymentsSdkService = this.owner.lookup(
      'service:scheduled-payments-sdk'
    ) as SchedulePaymentSDKService;

    scheduledPaymentsSdkService.cancelScheduledPayment = (): Promise<void> => {
      return Promise.resolve();
    };

    this.set('onDepositClick', () => {});
    await render(hbs`
      <FuturePaymentsList @onDepositClick={{this.onDepositClick}} />
    `);

    await click('[data-test-scheduled-payment-card-options-button]');
    await click('[data-test-boxel-menu-item-text="Cancel Payment"]');
    await click('[data-test-cancel-payment-button]');
    assert
      .dom('[data-test-cancel-scheduled-payment-modal]')
      .includesText(
        "Your scheduled payment was canceled and removed successfully, and it won't be attempted in the future."
      );
    assert.dom('[data-test-cancel-payment-button]').doesNotExist();
    await click('[data-test-close-cancel-payment-modal]');
    assert.dom('[data-test-cancel-scheduled-payment-modal]').doesNotExist();
  });

  test('it shows an error when canceling fails', async function (assert) {
    const scheduledPaymentsSdkService = this.owner.lookup(
      'service:scheduled-payments-sdk'
    ) as SchedulePaymentSDKService;

    scheduledPaymentsSdkService.cancelScheduledPayment = (): Promise<void> => {
      return Promise.reject('error while canceling payment');
    };

    this.set('onDepositClick', () => {});
    await render(hbs`
      <FuturePaymentsList @onDepositClick={{this.onDepositClick}} />
    `);

    await click('[data-test-scheduled-payment-card-options-button]');
    await click('[data-test-boxel-menu-item-text="Cancel Payment"]');
    await click('[data-test-cancel-payment-button]');
    assert
      .dom('[data-test-cancel-scheduled-payment-modal]')
      .includesText(
        'There was an error canceling your scheduled payment. Please try again, or contact support if the problem persists.'
      );
    assert.dom('[data-test-cancel-payment-button]').exists();
  });
});
