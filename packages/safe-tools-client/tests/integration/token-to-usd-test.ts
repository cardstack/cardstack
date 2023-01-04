/* eslint-disable @typescript-eslint/no-empty-function */
import { UsdConverter } from '@cardstack/safe-tools-client/services/scheduled-payments-sdk';
import Service from '@ember/service';
import { render, TestContext } from '@ember/test-helpers';
import { setupRenderingTest } from 'ember-qunit';
import { BigNumber } from 'ethers';
import hbs from 'htmlbars-inline-precompile';
import { module, test } from 'qunit';

let returnEmptyUsdConverters = false;

class ScheduledPaymentsSdkStub extends Service {
  updateUsdConverters = async (addressesToUpdate: string[]) => {
    if (returnEmptyUsdConverters) return [];

    const usdConverters: UsdConverter = {};
    for (const tokenAddress of addressesToUpdate) {
      usdConverters[tokenAddress] = (amountInWei: BigNumber) => {
        return amountInWei.mul(2);
      };
    }
    return usdConverters;
  };
}

class TokensServiceStub extends Service {
  get transactionTokens() {
    return [{ address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48' }];
  }
}

module('Integration | Helper | token-to-usd', function (hooks) {
  setupRenderingTest(hooks);

  hooks.beforeEach(function (this: TestContext) {
    this.owner.register('service:tokens', TokensServiceStub);
    this.owner.register(
      'service:scheduled-payments-sdk',
      ScheduledPaymentsSdkStub
    );
  });

  hooks.afterEach(function () {
    returnEmptyUsdConverters = false;
  });

  test('It converts token amount to usd', async function (assert) {
    await render(hbs`
      {{token-to-usd '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48' 1000}}
    `);
    assert.strictEqual(this.element.textContent?.trim(), '2000');
  });

  test('It results blank string if usdConverter is undefined', async function (assert) {
    returnEmptyUsdConverters = true;
    await render(hbs`
      {{token-to-usd '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48' 1000}}
    `);
    assert.strictEqual(this.element.textContent?.trim(), '');
  });

  test('It results blank string if token is unknown', async function (assert) {
    await render(hbs`
      {{token-to-usd '0x0' 1000}}
    `);
    assert.strictEqual(this.element.textContent?.trim(), '');
  });
});
