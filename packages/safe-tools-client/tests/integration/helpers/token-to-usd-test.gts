/* eslint-disable @typescript-eslint/no-empty-function */
import { ChainAddress } from '@cardstack/cardpay-sdk';
import tokenToUsd from '@cardstack/safe-tools-client/helpers/token-to-usd';
import TokenQuantity from '@cardstack/safe-tools-client/utils/token-quantity';
import TokenToUsdService from '@cardstack/safe-tools-client/services/token-to-usd';
import { render, TestContext, waitUntil } from '@ember/test-helpers';
import { addMilliseconds } from 'date-fns';
import { task } from 'ember-concurrency';
import { setupRenderingTest } from 'ember-qunit';
import { BigNumber, FixedNumber } from 'ethers';
import { module, test } from 'qunit';

let returnUndefinedConversionRate = false;

class TokenToUsdServiceStub extends TokenToUsdService {
  // eslint-disable-next-line require-yield
  @task({ maxConcurrency: 1, enqueue: true }) *updateUsdcRate(
    tokenAddress: ChainAddress
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ): any {
    if (returnUndefinedConversionRate) {
      this.usdcToTokenRates.delete(tokenAddress);
    } else {
      this.usdcToTokenRates.set(tokenAddress, {
        tokenInAddress: '0x0',
        tokenOutAddress: '0x0',
        tokenInDecimals: 6,
        tokenOutDecimals: 18,
        rate: FixedNumber.from("0.001")
      });
    }
  }
}

module('Integration | Helper | token-to-usd', function (hooks) {
  setupRenderingTest(hooks);

  hooks.beforeEach(function (this: TestContext) {
    this.owner.register('service:token-to-usd', TokenToUsdServiceStub);
  });

  hooks.afterEach(function () {
    returnUndefinedConversionRate = false;
  });

  test('It converts token amount to usd', async function (assert) {
    let tokenAmount = BigNumber.from('2000000000000000000');
    await render(<template>
      {{tokenToUsd tokenAddress='0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48' tokenAmount=tokenAmount tokenDecimals=18 }}
    </template>);
    await waitUntil(
      () => {
        return (
          this.element.textContent &&
          this.element.textContent?.trim() !== '' &&
          !this.element.textContent?.trim().includes('Converting')
        );
      },
      { timeout: 5000 }
    );
    assert.strictEqual(this.element.textContent?.trim(), '$ 2000.00');
  });

  test('It returns blank string if usd converter is undefined', async function (assert) {
    returnUndefinedConversionRate = true;
    let tokenAmount = BigNumber.from('2000000000000000000');
    await render(<template>
      {{tokenToUsd tokenAddress='0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48' tokenAmount=tokenAmount tokenDecimals=18 }}
    </template>);
    const now = new Date();
    await waitUntil(
      () => {
        return (
          (this.element.textContent &&
            this.element.textContent?.trim() !== '' &&
            !this.element.textContent?.trim().includes('Converting')) ||
          addMilliseconds(now, 4500) < new Date() // Return true if almost timeout
        );
      },
      { timeout: 5000 }
    );
    assert.strictEqual(
      this.element.textContent?.trim(),
      'Converting to USD...'
    );
  });

  test('It converts TokenQuantity to usd', async function (assert) {
    let tokenAmount = BigNumber.from('2000000000000000000');
    let tokenQuantity = new TokenQuantity({
      address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
      name: 'Hello',
      symbol: 'HELO',
      decimals: 18
    }, tokenAmount);
    await render(<template>
      {{tokenToUsd tokenQuantity=tokenQuantity}}
    </template>);
    await waitUntil(
      () => {
        return (
          this.element.textContent &&
          this.element.textContent?.trim() !== '' &&
          !this.element.textContent?.trim().includes('Converting')
        );
      },
      { timeout: 5000 }
    );
    assert.strictEqual(this.element.textContent?.trim(), '$ 2000.00');
  });

  test('It returns blank string if usd converter is undefined when TokenQuantity passed', async function (assert) {
    returnUndefinedConversionRate = true;
    let tokenAmount = BigNumber.from('2000000000000000000');
    let tokenQuantity = new TokenQuantity({
      address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
      name: 'Hello',
      symbol: 'HELO',
      decimals: 18
    }, tokenAmount);
    await render(<template>
      {{tokenToUsd tokenQuantity=tokenQuantity}}
    </template>);
    const now = new Date();
    await waitUntil(
      () => {
        return (
          (this.element.textContent &&
            this.element.textContent?.trim() !== '' &&
            !this.element.textContent?.trim().includes('Converting')) ||
          addMilliseconds(now, 4500) < new Date() // Return true if almost timeout
        );
      },
      { timeout: 5000 }
    );
    assert.strictEqual(
      this.element.textContent?.trim(),
      'Converting to USD...'
    );
  });
});
