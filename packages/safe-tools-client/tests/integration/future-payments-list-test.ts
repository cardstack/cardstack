/* eslint-disable @typescript-eslint/no-empty-function */
import Service from '@ember/service';
import { render, TestContext } from '@ember/test-helpers';
import percySnapshot from '@percy/ember';
import { addDays, addHours, startOfDay, endOfDay, endOfMonth } from 'date-fns';
import {
  setupFakeDateService,
  FakeDateService,
} from 'ember-date-service/test-support';

import hbs from 'htmlbars-inline-precompile';
import { module, test } from 'qunit';

import { setupRenderingTest } from '../helpers';

class WalletServiceStub extends Service {
  isConnected = true;
}
class HubAuthenticationServiceStub extends Service {
  isAuthenticated = true;
}

const NOW = new Date(2023, 0, 1);

let returnEmptyScheduledPayments = false;
let returnScheduledPaymentsUntilTomorrow = false;
let dateService: FakeDateService;

class ScheduledPaymentsStub extends Service {
  fetchScheduledPayments = (chainId: number, minPayAt?: Date) => {
    if (returnEmptyScheduledPayments || !minPayAt) {
      return Promise.resolve([]);
    }

    const startOfToday = startOfDay(minPayAt);
    const endOfToday = endOfDay(minPayAt);
    const startOfTomorrow = startOfDay(addDays(minPayAt, 1));
    const endOfTomorrow = endOfDay(addDays(minPayAt, 1));
    const endOfThisMonth = endOfMonth(minPayAt);

    // 3 SPs are today
    // 2 Sps are tomorrow
    // 1 Sp is this month
    // 1 Sp is later
    const scheduledPayments = [
      {
        amount: '10000000',
        feeFixedUSD: '0',
        feePercentage: '0',
        gasTokenAddress: '0x123',
        tokenAddress: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
        chainId,
        payeeAddress: '0xeBCC5516d44FFf5E9aBa2AcaeB65BbB49bC3EBe1',
        payAt: startOfToday,
      },
      {
        amount: '10000000',
        feeFixedUSD: '0',
        feePercentage: '0',
        gasTokenAddress: '0x123',
        tokenAddress: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
        chainId,
        payeeAddress: '0xeBCC5516d44FFf5E9aBa2AcaeB65BbB49bC3EBe1',
        payAt: addHours(startOfToday, 2),
      },
      {
        amount: '11000000',
        feeFixedUSD: '0',
        feePercentage: '0',
        gasTokenAddress: '0x123',
        tokenAddress: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
        chainId,
        payeeAddress: '0xeBCC5516d44FFf5E9aBa2AcaeB65BbB49bC3EBe1',
        payAt: endOfToday,
      },
      {
        amount: '11000000',
        feeFixedUSD: '0',
        feePercentage: '0',
        gasTokenAddress: '0x123',
        tokenAddress: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
        chainId,
        payeeAddress: '0xeBCC5516d44FFf5E9aBa2AcaeB65BbB49bC3EBe1',
        payAt: startOfTomorrow,
      },
      {
        amount: '11000000',
        feeFixedUSD: '0',
        feePercentage: '0',
        gasTokenAddress: '0x123',
        tokenAddress: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
        chainId,
        payeeAddress: '0xeBCC5516d44FFf5E9aBa2AcaeB65BbB49bC3EBe1',
        payAt: endOfTomorrow,
      },
      {
        amount: '11000000',
        feeFixedUSD: '0',
        feePercentage: '0',
        gasTokenAddress: '0x123',
        tokenAddress: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
        chainId,
        payeeAddress: '0xeBCC5516d44FFf5E9aBa2AcaeB65BbB49bC3EBe1',
        payAt: endOfThisMonth,
      },
      {
        amount: '11000000',
        feeFixedUSD: '0',
        feePercentage: '0',
        gasTokenAddress: '0x123',
        tokenAddress: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
        chainId,
        payeeAddress: '0xeBCC5516d44FFf5E9aBa2AcaeB65BbB49bC3EBe1',
        payAt: addDays(endOfThisMonth, 1),
      },
    ];

    if (returnScheduledPaymentsUntilTomorrow) {
      return Promise.resolve(
        scheduledPayments.filter((sp) => sp.payAt <= endOfTomorrow)
      );
    }

    return Promise.resolve(scheduledPayments);
  };
}

module('Integration | Component | future-payments-list', function (hooks) {
  setupRenderingTest(hooks);
  setupFakeDateService(hooks);

  hooks.beforeEach(async function (this: TestContext) {
    this.owner.register('service:wallet', WalletServiceStub);
    this.owner.register('service:scheduled-payments', ScheduledPaymentsStub);
    this.owner.register(
      'service:hub-authentication',
      HubAuthenticationServiceStub
    );

    dateService = this.owner.lookup('service:date') as FakeDateService;
    await dateService.setNow(NOW.getTime());
  });

  hooks.afterEach(function () {
    returnEmptyScheduledPayments = false;
    returnScheduledPaymentsUntilTomorrow = false;
    dateService.reset();
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
    assert.expect(6);
    this.set('onDepositClick', () => {});
    await render(hbs`
      <FuturePaymentsList @onDepositClick={{this.onDepositClick}} />
    `);

    await percySnapshot(assert);
    assert.dom('[data-test-no-future-payments-list]').isNotVisible();
    assert.dom('[data-test-future-payments-list]').isVisible();
    assert.strictEqual(
      document.querySelectorAll(
        `[data-test-time-bracket='today'] [data-test-scheduled-payment-card]`
      ).length,
      3
    );
    assert.strictEqual(
      document.querySelectorAll(
        `[data-test-time-bracket='tomorrow'] [data-test-scheduled-payment-card]`
      ).length,
      2
    );
    assert.strictEqual(
      document.querySelectorAll(
        `[data-test-time-bracket='this month'] [data-test-scheduled-payment-card]`
      ).length,
      1
    );
    assert.strictEqual(
      document.querySelectorAll(
        `[data-test-time-bracket='later'] [data-test-scheduled-payment-card]`
      ).length,
      1
    );
  });

  test('It renders future payments list, with no this month and later time windows', async function (assert) {
    assert.expect(6);
    returnScheduledPaymentsUntilTomorrow = true;
    this.set('onDepositClick', () => {});
    await render(hbs`
      <FuturePaymentsList @onDepositClick={{this.onDepositClick}} />
    `);

    await percySnapshot(assert);
    assert.dom('[data-test-no-future-payments-list]').isNotVisible();
    assert.dom('[data-test-future-payments-list]').isVisible();
    assert.strictEqual(
      document.querySelectorAll(
        `[data-test-time-bracket='today'] [data-test-scheduled-payment-card]`
      ).length,
      3
    );
    assert.strictEqual(
      document.querySelectorAll(
        `[data-test-time-bracket='tomorrow'] [data-test-scheduled-payment-card]`
      ).length,
      2
    );
    assert.dom(`[data-test-time-bracket='this month']`).isNotVisible();
    assert.dom(`[data-test-time-bracket='later']`).isNotVisible();
  });
});
