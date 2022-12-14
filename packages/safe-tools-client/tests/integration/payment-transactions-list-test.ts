/* eslint-disable @typescript-eslint/no-empty-function */
import Service from '@ember/service';
import { render, TestContext } from '@ember/test-helpers';
import { setupRenderingTest } from 'ember-qunit';
import hbs from 'htmlbars-inline-precompile';
import { module, test } from 'qunit';

class WalletServiceStub extends Service {
  isConnected = true;
}

class ScheduledPaymentsStub extends Service {
  fetchScheduledPaymentAttempts = () => {
    return Promise.resolve([
      {
        startedAt: new Date('2022-12-12T12:21:25.530'),
        endedAt: new Date('2022-12-12T12:22:25.530'),
        status: 'succeeded',
        failureReason: null,
        transactionHash: '0x1234',
        scheduledPayment: {
          amount: '10000000',
          feeFixedUSD: '0',
          feePercentage: '0',
          gasTokenAddress: '0x123',
          tokenAddress: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
          chainId: 1,
          payeeAddress: '0xeBCC5516d44FFf5E9aBa2AcaeB65BbB49bC3EBe1',
          payAt: new Date('2022-12-12T12:19:25.530'),
        },
      },
      {
        startedAt: new Date('2022-12-12T12:19:25.530'),
        endedAt: new Date('2022-12-12T12:20:25.530'),
        status: 'failed',
        failureReason: 'Funds too low',
        transactionHash: '0x123',
        scheduledPayment: {
          amount: '10000000',
          feeFixedUSD: '0',
          feePercentage: '0',
          gasTokenAddress: '0x123',
          tokenAddress: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
          chainId: 1,
          payeeAddress: '0xeBCC5516d44FFf5E9aBa2AcaeB65BbB49bC3EBe1',
          payAt: new Date('2022-12-12T12:19:25.530'),
        },
      },
    ]);
  };
}

module('Integration | Component | payment-transactions-list', function (hooks) {
  setupRenderingTest(hooks);

  hooks.beforeEach(function (this: TestContext) {
    this.owner.register('service:wallet', WalletServiceStub);
    this.owner.register('service:scheduled-payments', ScheduledPaymentsStub);
  });

  test('It renders transactions', async function (assert) {
    this.set('wallet', { isConnected: true });

    await render(hbs`
      <PaymentTransactionsList />
    `);

    assert.dom('[data-test-scheduled-payment-attempts]').exists();
    assert
      .dom('[data-test-scheduled-payment-attempts-item]')
      .exists({ count: 2 });

    assert
      .dom(
        '[data-test-scheduled-payment-attempts-item="0"] [data-test-scheduled-payment-attempts-item-time]'
      )
      .hasText('12:21:25');

    assert
      .dom(
        '[data-test-scheduled-payment-attempts-item="0"] [data-test-scheduled-payment-attempts-item-date]'
      )
      .hasText('12/12/2022');

    assert
      .dom(
        '[data-test-scheduled-payment-attempts-item="0"] [data-test-scheduled-payment-attempts-item-payee]'
      )
      .hasText('0xeBCC5516d44FFf5E9aBa2AcaeB65BbB49bC3EBe1');

    assert
      .dom(
        '[data-test-scheduled-payment-attempts-item="0"] [data-test-scheduled-payment-attempts-item-amount]'
      )
      .hasText('10 USDC');

    assert
      .dom(
        '[data-test-scheduled-payment-attempts-item="0"] [data-test-scheduled-payment-attempts-item-status]'
      )
      .hasText('succeeded');
  });
});
