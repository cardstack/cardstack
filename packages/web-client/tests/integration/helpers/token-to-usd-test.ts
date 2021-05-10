import { module, test } from 'qunit';
import { setupRenderingTest } from 'ember-qunit';
import { render } from '@ember/test-helpers';
import hbs from 'htmlbars-inline-precompile';
import Layer2TestWeb3Strategy from '@cardstack/web-client/utils/web3-strategies/test-layer2';
import { toBN } from 'web3-utils';

module('Integration | Helper | token-to-usd', function (hooks) {
  setupRenderingTest(hooks);

  test('it reactively converts tokens to 2-decimal floating point numbers using the functions provided by layer 2', async function (assert) {
    const layer2Service = this.owner.lookup('service:layer2-network')
      .strategy as Layer2TestWeb3Strategy;

    layer2Service.usdConverters = {
      // eslint-disable-next-line no-unused-vars
      DAI: (_amountInWei: string) => {
        return parseFloat(_amountInWei);
      },
      // eslint-disable-next-line no-unused-vars
      CARD: (_amountInWei: string) => {
        return 42;
      },
      // eslint-disable-next-line no-unused-vars
      FLOAT_4: (_amountInWei: string) => {
        return 92.3375;
      },
    };

    this.set('inputValue', toBN(123));
    await render(hbs`{{token-to-usd this.tokenSymbol this.inputValue}}`);

    this.set('tokenSymbol', 'DAI');
    assert.equal(this.element.textContent?.trim(), '123.00');

    this.set('tokenSymbol', 'CARD');
    assert.equal(this.element.textContent?.trim(), '42.00');

    this.set('tokenSymbol', 'FLOAT_4');
    assert.equal(this.element.textContent?.trim(), '92.34');
  });

  test('it returns an empty string when it cannot find the converting function', async function (assert) {
    const layer2Service = this.owner.lookup('service:layer2-network')
      .strategy as Layer2TestWeb3Strategy;

    layer2Service.usdConverters = {};

    this.set('inputValue', toBN(12));
    this.set('tokenSymbol', 'CARD');
    await render(hbs`{{token-to-usd this.tokenSymbol this.inputValue}}`);

    assert.equal(this.element.textContent?.trim(), '');
  });
});
