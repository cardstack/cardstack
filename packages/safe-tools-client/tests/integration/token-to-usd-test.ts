/* eslint-disable @typescript-eslint/no-empty-function */
import Service from '@ember/service';
import { render, TestContext, waitUntil } from '@ember/test-helpers';
import { setupRenderingTest } from 'ember-qunit';
import { BigNumber } from 'ethers';
import hbs from 'htmlbars-inline-precompile';
import { module, test } from 'qunit';
import { task } from 'ember-concurrency';
import { tracked } from '@glimmer/tracking';

let returnEmptyUsdConverter = false;

class TokenToUsdServiceStub extends Service {
  @tracked usdConverters: Record<string, (amountInWei: BigNumber) => BigNumber> = {};

  @task({maxConcurrency: 1, enqueue: true}) *updateUsdConverter(tokenAddress: string): any {
    this.usdConverters[tokenAddress] = (amountInWei: BigNumber) => {
      return amountInWei.mul(2);
    }
    this.usdConverters = this.usdConverters;
  }

  toUsdFrom(tokenAddress: string, amount: BigNumber): BigNumber | undefined {
    if (returnEmptyUsdConverter) {
      return undefined;
    }
    return this.usdConverters[tokenAddress]?.(amount);
  }
}

module('Integration | Component | token-to-usd', function (hooks) {
  setupRenderingTest(hooks);

  hooks.beforeEach(function (this: TestContext) {
    this.owner.register(
      'service:token-to-usd',
      TokenToUsdServiceStub
    );
  });

  hooks.afterEach(function () {
    returnEmptyUsdConverter = false;
  });

  test('It converts token amount to usd', async function (assert) {
    await render(hbs`
      <TokenToUsd @tokenAddress='0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48' @tokenAmount=1000 />
    `);
    await waitUntil(() => {
      return this.element.textContent && this.element.textContent?.trim() !== '';
    }, { timeout: 5000 });
    assert.strictEqual(this.element.textContent?.trim(), '2000');
  });
});
