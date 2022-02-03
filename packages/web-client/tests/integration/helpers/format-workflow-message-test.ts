import { module, test } from 'qunit';
import { setupRenderingTest } from 'ember-qunit';
import { render } from '@ember/test-helpers';
import hbs from 'htmlbars-inline-precompile';

module('Integration | Helper | format-workflow-message', function (hooks) {
  setupRenderingTest(hooks);

  test('it renders lists', async function (assert) {
    this.set(
      'inputValue',
      `In order to make a deposit, you need to connect two wallets:

* Ethereum mainnet wallet: linked to the Ethereum blockchain on mainnet
* Gnosis Chain wallet: linked to the Gnosis blockchain for low-cost transactions
`
    );

    await render(hbs`{{format-workflow-message this.inputValue}}`);

    assert.equal(
      this.element.innerHTML,
      `<p>In order to make a deposit, you need to connect two wallets:</p>
<ul>
<li>Ethereum mainnet wallet: linked to the Ethereum blockchain on mainnet</li>
<li>Gnosis Chain wallet: linked to the Gnosis blockchain for low-cost transactions</li>
</ul>
`
    );
  });
});
