/* eslint-disable @typescript-eslint/no-empty-function */
import { type ScheduledPaymentAttemptStatus } from '@cardstack/safe-tools-client/services/scheduled-payments';
import Service from '@ember/service';
import { click, render, TestContext } from '@ember/test-helpers';
import { subDays, addMinutes, format } from 'date-fns';

import hbs from 'htmlbars-inline-precompile';
import { module, test } from 'qunit';

import { setupRenderingTest } from '../helpers';

class WalletServiceStub extends Service {
  isConnected = true;
}
class HubAuthenticationServiceStub extends Service {
  isAuthenticated = true;
}

let returnEmptyScheduledPaymentAttempts = false;
const now = new Date();

class ScheduledPaymentsStub extends Service {
  fetchScheduledPaymentAttempts = (
    chainId: number,
    status?: ScheduledPaymentAttemptStatus,
    startedAt?: Date
  ) => {
    if (returnEmptyScheduledPaymentAttempts) {
      return Promise.resolve([]);
    }
    return Promise.resolve(
      [
        {
          startedAt: subDays(now, 10),
          endedAt: addMinutes(subDays(now, 10), 120),
          status: 'succeeded',
          failureReason: null,
          transactionHash:
            '0x6f7c54719c0901e30ef018206c37df4daa059224549a08d55acb3360f01094e2',
          scheduledPayment: {
            amount: '10000000',
            feeFixedUSD: '0',
            feePercentage: '0',
            gasTokenAddress: '0x123',
            tokenAddress: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
            chainId,
            payeeAddress: '0xeBCC5516d44FFf5E9aBa2AcaeB65BbB49bC3EBe1',
            payAt: addMinutes(subDays(now, 10), 120),
          },
        },
        {
          startedAt: subDays(now, 20),
          endedAt: addMinutes(subDays(now, 20), 120),
          status: 'failed',
          failureReason: 'Funds too low',
          transactionHash: '0x123',
          scheduledPayment: {
            amount: '10000000',
            feeFixedUSD: '0',
            feePercentage: '0',
            gasTokenAddress: '0x123',
            tokenAddress: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
            chainId,
            payeeAddress: '0xeBCC5516d44FFf5E9aBa2AcaeB65BbB49bC3EBe1',
            payAt: addMinutes(subDays(now, 20), 120),
          },
        },
        {
          startedAt: subDays(now, 60),
          endedAt: addMinutes(subDays(now, 60), 120),
          status: 'succeeded',
          failureReason: undefined,
          transactionHash: '0x123',
          scheduledPayment: {
            amount: '15000000',
            feeFixedUSD: '0',
            feePercentage: '0',
            gasTokenAddress: '0x123',
            tokenAddress: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
            chainId,
            payeeAddress: '0xeBCC5516d44FFf5E9aBa2AcaeB65BbB49bC3EBe1',
            payAt: addMinutes(subDays(now, 60), 120),
          },
        },
      ]
        .filter((r) => (startedAt ? r.startedAt > startedAt : true))
        .filter((r) => (status ? r.status === status : true))
    );
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
        '[data-test-scheduled-payment-attempts-item="0"] [data-test-scheduled-payment-attempts-item-time]'
      )
      .hasText(format(now, 'HH:mm:ss'));

    assert
      .dom(
        '[data-test-scheduled-payment-attempts-item="0"] [data-test-scheduled-payment-attempts-item-date]'
      )
      .hasText(format(subDays(now, 10), 'dd/MM/yyyy'));

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
      .includesText('Confirmed');

    assert
      .dom(
        '[data-test-scheduled-payment-attempts-item="1"] [data-test-scheduled-payment-attempts-item-status]'
      )
      .includesText('Failed (Funds too low)');

    assert
      .dom(
        '[data-test-scheduled-payment-attempts-item="0"] [data-test-scheduled-payment-attempts-item-explorer-button]'
      )
      .hasText('View on Etherscan')
      .hasAttribute(
        'href',
        'https://etherscan.io/tx/0x6f7c54719c0901e30ef018206c37df4daa059224549a08d55acb3360f01094e2'
      );
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
      .includesText('Failed (Funds too low)');
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
});
