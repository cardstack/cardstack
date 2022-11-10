import { truncateMiddle } from '@cardstack/ember-shared/helpers/truncate-middle';
import { ChainConnectionManager } from '@cardstack/safe-tools-client/utils/chain-connection-manager';
import { click, visit } from '@ember/test-helpers';
import percySnapshot from '@percy/ember';
import { module, test, todo } from 'qunit';

import {
  FAKE_META_MASK_ACCOUNT,
  FAKE_WALLET_CONNECT_ACCOUNT,
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
        .hasText(truncateMiddle([FAKE_META_MASK_ACCOUNT]));

      await percySnapshot(assert);
    });

    test('reconnecting', async function (assert) {
      const chainConnectionManager = new ChainConnectionManager(
        'mainnet',
        1,
        this.owner
      );
      chainConnectionManager.addProviderToStorage(1, 'metamask');

      await visit('/schedule');

      assert
        .dom('.safe-tools__dashboard-schedule-control-panel-wallet-address')
        .hasText(truncateMiddle([FAKE_META_MASK_ACCOUNT]));
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

      this.mockWalletConnect.mockConnectedWallet([FAKE_WALLET_CONNECT_ACCOUNT]);
      this.mockWalletConnect.mockAccountsChanged([FAKE_WALLET_CONNECT_ACCOUNT]);

      await click('.network-connect-modal__close-button'); // FIXME: I don't think this click should be necessary
      assert
        .dom('.safe-tools__dashboard-schedule-control-panel-wallet-address')
        .hasText(truncateMiddle([FAKE_WALLET_CONNECT_ACCOUNT]));
    });

    todo('reconnecting', async function (assert) {
      const chainConnectionManager = new ChainConnectionManager(
        'mainnet',
        1,
        this.owner
      );
      chainConnectionManager.addProviderToStorage(1, 'wallet-connect');

      await visit('/schedule');

      assert
        .dom('.safe-tools__dashboard-schedule-control-panel-wallet-address')
        .hasText(truncateMiddle([FAKE_WALLET_CONNECT_ACCOUNT]));
    });
  });
});
