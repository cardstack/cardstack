import { click, visit } from '@ember/test-helpers';
import { module, test } from 'qunit';

import { FAKE_WALLET_CONNECT_ACCOUNT, setupApplicationTest } from '../helpers';
import { exampleGasTokens } from '../support/tokens';
import { fillInSchedulePaymentFormWithValidInfo } from '../support/ui-test-helpers';

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
      await fillInSchedulePaymentFormWithValidInfo();

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
