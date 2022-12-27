import { truncateMiddle } from '@cardstack/ember-shared/helpers/truncate-middle';
import HubAuthenticationService from '@cardstack/safe-tools-client/services/hub-authentication';
import SafesService, {
  Safe,
  TokenBalance,
} from '@cardstack/safe-tools-client/services/safes';

import {
  click,
  settled,
  TestContext,
  visit,
  waitFor,
} from '@ember/test-helpers';
import percySnapshot from '@percy/ember';
import { BigNumber } from 'ethers';
import { module, test } from 'qunit';

import {
  TEST_ACCOUNT_1,
  TEST_ACCOUNT_2,
  setupApplicationTest,
} from '../helpers';

module('Acceptance | wallet connection', function (hooks) {
  setupApplicationTest(hooks);

  hooks.beforeEach(function (this: TestContext) {
    const safesService = this.owner.lookup('service:safes') as SafesService;
    const hubAuthenticationService = this.owner.lookup(
      'service:hub-authentication'
    ) as HubAuthenticationService;

    safesService.fetchSafes = (): Promise<Safe[]> => {
      return Promise.resolve([
        {
          address: '0x458Bb61A22A0e91855d6D876C88706cfF7bD486E',
          spModuleAddress: '0xa6B71E26C5e0845f74c812102Ca7114b6a896AB2',
        },
      ]);
    };

    safesService.fetchTokenBalances = (): Promise<TokenBalance[]> => {
      return Promise.resolve([
        {
          symbol: 'ETH',
          balance: BigNumber.from('1000000000000000000'),
          decimals: 18,
          isNativeToken: true,
        } as unknown as TokenBalance,
        {
          symbol: 'USDT',
          balance: BigNumber.from('10000000'),
          decimals: 6,
        } as unknown as TokenBalance,
      ]);
    };

    //@ts-expect-error - don't care about the promise return value since this is a mock
    hubAuthenticationService.getHubAuth = (): Promise<unknown> => {
      return Promise.resolve({
        authenticate: async () => {
          return Promise.resolve('auth-token-1337');
        },
        checkValidAuth: async () => {
          return Promise.resolve(true);
        },
      });
    };
  });

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
        .dom('[data-test-wallet-address]')
        .hasText(truncateMiddle([TEST_ACCOUNT_1]));

      assert.dom('[data-test-safe-address-label]').hasText('0x458B...486E');
      assert.dom('[data-test-token-balance="ETH"]').hasText('1 ETH');
      assert.dom('[data-test-token-balance="USDT"]').hasText('10 USDT');

      await waitFor('[data-test-hub-auth-modal]');
      await percySnapshot(assert);
      await click('[data-test-hub-auth-modal] button');
      assert.dom('[data-test-hub-auth-modal]').doesNotExist();

      const storage = this.owner.lookup('storage:local') as Storage;
      assert.strictEqual(storage.getItem('authToken'), 'auth-token-1337');

      await percySnapshot(assert);

      await this.mockMetaMask.mockAccountsChanged([TEST_ACCOUNT_2]);

      await settled();
      assert
        .dom('[data-test-wallet-address]')
        .hasText(truncateMiddle([TEST_ACCOUNT_2]));
      assert
        .dom('[data-test-wallet-address]')
        .doesNotContainText(truncateMiddle([TEST_ACCOUNT_1]));

      await click('[data-test-disconnect-button]');

      assert.dom('[data-test-wallet-address]').doesNotExist();

      assert.dom('[data-test-connect-button]').exists();
      assert.dom('[data-test-disconnect-button]').doesNotExist();
      assert.dom('[data-test-safe-address-label]').doesNotExist();
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

      await waitFor('[data-test-hub-auth-modal]');
      await click('[data-test-hub-auth-modal] button');
      assert.dom('[data-test-hub-auth-modal]').doesNotExist();

      assert
        .dom('[data-test-wallet-address]')
        .hasText(truncateMiddle([TEST_ACCOUNT_2]));

      assert.dom('[data-test-safe-address-label]').hasText('0x458B...486E');
      assert.dom('[data-test-token-balance="ETH"]').hasText('1 ETH');
      assert.dom('[data-test-token-balance="USDT"]').hasText('10 USDT');
    });
  });

  module('Remembering the selected chain', function () {
    test('Defaults to mainnet', async function (assert) {
      await visit('/schedule');
      assert.dom('[data-test-selected-network]').hasText('Ethereum Mainnet');
    });
    module('with localstorage', function (hooks) {
      hooks.beforeEach(function (this: TestContext) {
        this.mockLocalStorage.setItem('cardstack-cached-network', 'goerli');
      });
      test('Uses localstorage value for other', async function (assert) {
        await visit('/schedule');

        assert.dom('[data-test-selected-network]').hasText('Goerli');
      });
    });
  });
});
