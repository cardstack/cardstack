import { truncateMiddle } from '@cardstack/ember-shared/helpers/truncate-middle';
import { click, visit } from '@ember/test-helpers';
import { setupApplicationTest } from 'ember-qunit';
import { generateTestingUtils } from 'eth-testing';
import {
  MetaMaskProvider,
  WalletConnectProvider,
} from 'eth-testing/lib/providers';
import { TestingUtils } from 'eth-testing/lib/testing-utils';
import { module, test } from 'qunit';

const FAKE_ACCOUNT_1 = '0xf61B443A155b07D2b2cAeA2d99715dC84E839EEf';

declare global {
  interface Window {
    testWalletConnectProvider?: WalletConnectProvider;
  }
}

module('Acceptance | wallet connection', function (hooks) {
  setupApplicationTest(hooks);
  let testingUtils: TestingUtils;
  hooks.afterEach(function () {
    testingUtils.clearAllMocks();
    window.ethereum = undefined;
    window.testWalletConnectProvider = undefined;
  });

  module('With Metamask', function (hooks) {
    hooks.beforeEach(function () {
      testingUtils = generateTestingUtils({ providerType: 'MetaMask' });
      window.ethereum = testingUtils.getProvider() as MetaMaskProvider;

      testingUtils.mockNotConnectedWallet();
      testingUtils.mockAccounts([FAKE_ACCOUNT_1]);
    });

    test('connecting wallet', async function (assert) {
      await visit('/schedule');
      await click('.connect-button__button');
      await click('[data-test-wallet-option="metamask"]');

      assert.dom(
        '.boxel-radio-option__input boxel-radio-option__input--hidden-radio boxel-radio-option__input--checked'
      );
      await click('[data-test-mainnet-connect-button]');
      await click('.network-connect-modal__close-button'); // TODO: I don't think this click should be necessary

      assert
        .dom('.safe-tools__dashboard-schedule-control-panel-wallet-address')
        .hasText(truncateMiddle([FAKE_ACCOUNT_1]));
    });
  });

  module('With Wallet Connect', function (hooks) {
    hooks.beforeEach(function () {
      testingUtils = generateTestingUtils({
        providerType: 'WalletConnect',
      });
      window.testWalletConnectProvider =
        testingUtils.getProvider() as WalletConnectProvider;

      testingUtils.mockNotConnectedWallet();
      testingUtils.mockAccounts([FAKE_ACCOUNT_1]);
    });

    test('connecting wallet', async function (assert) {
      await visit('/schedule');
      await click('.connect-button__button');

      await click('[data-test-wallet-option="wallet-connect"]');

      assert.dom(
        '.boxel-radio-option__input boxel-radio-option__input--hidden-radio boxel-radio-option__input--checked'
      );
      await click('[data-test-mainnet-connect-button]');

      testingUtils.mockAccountsChanged([FAKE_ACCOUNT_1]);

      await click('.network-connect-modal__close-button'); // TODO: I don't think this click should be necessary

      assert
        .dom('.safe-tools__dashboard-schedule-control-panel-wallet-address')
        .hasText(truncateMiddle([FAKE_ACCOUNT_1]));
    });
  });
});
