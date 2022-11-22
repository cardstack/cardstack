import { click, fillIn, visit } from '@ember/test-helpers';
import { keyDown } from 'ember-keyboard/test-support/test-helpers';
import { selectChoose } from 'ember-power-select/test-support';
import { module, test } from 'qunit';

import { FAKE_WALLET_CONNECT_ACCOUNT, setupApplicationTest } from '../helpers';
import { exampleGasTokens } from '../support/tokens';

const EXAMPLE_RECIPIENT = '0xb794f5ea0ba39494ce839613fffba74279579268';

module('Acceptance | scheduling', function (hooks) {
  setupApplicationTest(hooks);

  module('one-time', function () {
    // test: does not schedule if invalid

    test('schedules if valid', async function (assert) {
      // TODO: setup to already have a safe and wallet connection to a network
      this.mockWalletConnect.mockConnectedWallet([FAKE_WALLET_CONNECT_ACCOUNT]);
      this.mockWalletConnect.mockAccountsChanged([FAKE_WALLET_CONNECT_ACCOUNT]);

      const tokensService = this.owner.lookup('service:tokens');
      tokensService.stubGasTokens(exampleGasTokens);

      await visit('/schedule');
      await click('[data-test-payment-type="one-time"]');

      // choose payment date of tomorrow
      await click('[data-test-boxel-input-date-trigger]');
      await keyDown('ArrowRight');
      await keyDown('Enter');
      await keyDown('Escape');

      // choose payment time of 9AM
      await click('[data-test-boxel-input-time-trigger]');
      await keyDown('9');
      await keyDown(':');
      await keyDown('0');
      await keyDown('A');
      await keyDown('Enter');

      await fillIn('[data-test-recipient-address-input]', EXAMPLE_RECIPIENT);
      await fillIn('[data-test-amount-input] input', '15.0');
      // Choose USDC for the transaction token
      await selectChoose(
        '[data-test-amount-input] [data-test-boxel-input-group-select-accessory-trigger]',
        'USDC'
      );

      // Choose USDC for the gas token
      await selectChoose('[data-test-gas-token-select]', 'USDC');

      await click(
        '[data-test-max-gas-toggle] [data-toggle-group-option="normal"]'
      );

      // click "Schedule Payment" button
      await click(
        '.schedule-payment-form-action-card [data-test-boxel-action-chin] button'
      );
      assert.ok(true, 'temporary');
      // TODO assert in-progress view
      // TODO simulate wallet approval
      // TODO assert hub API call was made (msw?)
      // TODO assert confirmation?
    });
  });

  module('recurring', function () {
    // test: does not schedule if invalid
    // test: schedules if valid
  });
});
