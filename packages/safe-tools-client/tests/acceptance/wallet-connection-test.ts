import { truncateMiddle } from '@cardstack/ember-shared/helpers/truncate-middle';
import { click, settled, visit } from '@ember/test-helpers';
import percySnapshot from '@percy/ember';
import { module, test } from 'qunit';

import {
  TEST_ACCOUNT_1,
  TEST_ACCOUNT_2,
  setupApplicationTest,
} from '../helpers';

module('Acceptance | wallet connection', function (hooks) {
  setupApplicationTest(hooks);

  module('With Metamask', function () {
    // eslint-disable-next-line qunit/require-expect
    test('connecting wallet', async function (assert) {
      await visit('/schedule');
      await click('.connect-button__button');
      await click('[data-test-wallet-option="metamask"]');

      assert.dom(
        '.boxel-radio-option__input boxel-radio-option__input--hidden-radio boxel-radio-option__input--checked'
      );
      await click('[data-test-mainnet-connect-button]');

      assert
        .dom('.safe-tools__dashboard-schedule-control-panel-wallet-address')
        .hasText(truncateMiddle([TEST_ACCOUNT_1]));

      await percySnapshot(assert);

      await this.mockMetaMask.mockAccountsChanged([TEST_ACCOUNT_2]);

      await settled();
      assert
        .dom('.safe-tools__dashboard-schedule-control-panel-wallet-address')
        .hasText(truncateMiddle([TEST_ACCOUNT_2]));
      assert
        .dom('.safe-tools__dashboard-schedule-control-panel-wallet-address')
        .doesNotContainText(truncateMiddle([TEST_ACCOUNT_1]));

      await click('[data-test-disconnect-button]');

      assert
        .dom('.safe-tools__dashboard-schedule-control-panel-wallet-address')
        .doesNotExist();

      assert.dom('[data-test-connect-button]').exists();
      assert.dom('[data-test-disconnect-button]').doesNotExist();
    });
  });

  module('With Wallet Connect', function () {
    test('connecting wallet', async function (assert) {
      await visit('/schedule');
      await click('.connect-button__button');

      await click('[data-test-wallet-option="wallet-connect"]');

      assert.dom(
        '.boxel-radio-option__input boxel-radio-option__input--hidden-radio boxel-radio-option__input--checked'
      );

      await click('[data-test-mainnet-connect-button]');

      this.mockWalletConnect.mockConnectedWallet([TEST_ACCOUNT_2]);
      this.mockWalletConnect.mockAccountsChanged([TEST_ACCOUNT_2]);

      await click('.network-connect-modal__close-button'); // FIXME: I don't think this click should be necessary
      assert
        .dom('.safe-tools__dashboard-schedule-control-panel-wallet-address')
        .hasText(truncateMiddle([TEST_ACCOUNT_2]));
    });
  });
});
