/* eslint-disable @typescript-eslint/no-empty-function */
import { UsdConverter } from '@cardstack/safe-tools-client/services/scheduled-payments-sdk';
import Service from '@ember/service';
import { render, TestContext } from '@ember/test-helpers';
import percySnapshot from '@percy/ember';
import { addMinutes, addMonths, addHours } from 'date-fns';
import { setupRenderingTest } from 'ember-qunit';
import { BigNumber } from 'ethers';
import hbs from 'htmlbars-inline-precompile';
import { module, test } from 'qunit';

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

class ScheduledPaymentsSdkStub extends Service {
  updateUsdConverters = async (addressesToUpdate: string[]) => {
    const usdConverters: UsdConverter = {};
    for (const tokenAddress of addressesToUpdate) {
      usdConverters[tokenAddress] = (amountInWei: BigNumber) => {
        return amountInWei.mul(1);
      };
    }
    return usdConverters;
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
    this.owner.register(
      'service:scheduled-payments-sdk',
      ScheduledPaymentsSdkStub
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
});
