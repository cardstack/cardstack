import HubAuthenticationService from '@cardstack/safe-tools-client/services/hub-authentication';
import SafesService, {
  Safe,
  TokenBalance,
} from '@cardstack/safe-tools-client/services/safes';
import SchedulePaymentSDKService from '@cardstack/safe-tools-client/services/scheduled-payment-sdk';
import ScheduledPaymentsService from '@cardstack/safe-tools-client/services/scheduled-payments';
import WalletService from '@cardstack/safe-tools-client/services/wallet';
import { click, visit, waitFor, TestContext } from '@ember/test-helpers';
import { BigNumber } from 'ethers';
import { module, test } from 'qunit';

import { setupApplicationTest } from '../helpers';

module('Acceptance | create safe', function (hooks) {
  setupApplicationTest(hooks);

  hooks.beforeEach(function (this: TestContext) {
    const hubAuthenticationService = this.owner.lookup(
      'service:hub-authentication'
    ) as HubAuthenticationService;

    // @ts-expect-error - don't care about the promise return value since this is a mock
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

    const scheduledPaymentsSdkService = this.owner.lookup(
      'service:scheduled-payment-sdk'
    ) as SchedulePaymentSDKService;

    scheduledPaymentsSdkService.getCreateSafeGasEstimation = (): Promise<{
      gasEstimateInNativeToken: BigNumber;
      gasEstimateInUsd: BigNumber;
    }> => {
      return Promise.resolve({
        gasEstimateInNativeToken: BigNumber.from('11870866000000000'),
        gasEstimateInUsd: BigNumber.from('594514232585000000000'),
      });
    };

    scheduledPaymentsSdkService.createSafe = (): Promise<{
      safeAddress: string;
    }> => {
      return Promise.resolve({ safeAddress: '0x123' });
    };

    scheduledPaymentsSdkService.waitForSafeToBeIndexed = (): Promise<void> => {
      return Promise.resolve();
    };

    const safesService = this.owner.lookup('service:safes') as SafesService;

    safesService.fetchSafes = (): Promise<Safe[]> => {
      return Promise.resolve([]);
    };

    safesService.fetchTokenBalances = (): Promise<TokenBalance[]> => {
      return Promise.resolve([
        {
          symbol: 'ETH',
          balance: BigNumber.from('1000000000000000000'),
          decimals: 18,
          isNativeToken: true,
        } as unknown as TokenBalance,
      ]);
    };

    const scheduledPaymentsService = this.owner.lookup(
      'service:scheduled-payments'
    ) as ScheduledPaymentsService;

    scheduledPaymentsService.fetchScheduledPayments = (): Promise<[]> => {
      return Promise.resolve([]);
    };
  });

  module('with enough balance', function (hooks) {
    hooks.beforeEach(function (this: TestContext) {
      const walletService = this.owner.lookup(
        'service:wallet'
      ) as WalletService;

      walletService.fetchNativeTokenBalance = (): Promise<
        Record<'symbol' | 'amount', string>
      > => {
        return Promise.resolve({
          amount: '1000000000000000000', // WEI
          symbol: 'ETH',
        });
      };
    });

    test('can create a safe', async function (assert) {
      await visit('/schedule');
      await click('.connect-button__button');
      await click('[data-test-wallet-option="metamask"]');
      await click('[data-test-mainnet-connect-button]');
      await click('[data-test-authenticate-button]');
      await click('[data-test-create-safe-button]');

      assert
        .dom('[data-test-setup-safe-modal]')
        .includesText('Set up a Payment Safe')
        .includesText('0.012 ETH (~$594.51)')
        .includesText(
          'Your wallet has sufficient funds to cover the estimated gas cost.'
        );

      const safesService = this.owner.lookup('service:safes') as SafesService;

      // Load newly created safe in the sidebar
      safesService.fetchSafes = (): Promise<Safe[]> => {
        return Promise.resolve([
          {
            address: '0x123',
            spModuleAddress: '0x321',
          },
        ]);
      };
      await click('[data-test-provision-safe-button]');
      await waitFor('[data-test-safe-success-info]');

      assert
        .dom('[data-test-safe-success-info]')
        .includesText(
          'Your safe has been created and the module has been enabled. You can now schedule payments.'
        );

      await click('[data-test-create-safe-close-button]');
      assert.dom('[data-test-safe-address-label]').hasText('0x123');
      assert.dom('[data-test-create-safe-button]').doesNotExist();
    });

    module('with error during safe creation', function (hooks) {
      hooks.beforeEach(function (this: TestContext) {
        const scheduledPaymentsSdkService = this.owner.lookup(
          'service:scheduled-payment-sdk'
        ) as SchedulePaymentSDKService;

        scheduledPaymentsSdkService.createSafe = (): Promise<{
          safeAddress: string;
        }> => {
          return Promise.reject('error while creating safe');
        };
      });

      test('shows an error', async function (assert) {
        await visit('/schedule');
        await click('.connect-button__button');
        await click('[data-test-wallet-option="metamask"]');
        await click('[data-test-mainnet-connect-button]');
        await click('[data-test-authenticate-button]');
        await click('[data-test-create-safe-button]');
        await click('[data-test-provision-safe-button]');
        await waitFor('[data-test-safe-error-info]');

        assert
          .dom('[data-test-safe-error-info]')
          .includesText(
            'There was an error provisioning your safe. Please try again, or contact support if the problem persists.'
          );
      });
    });

    module('with error while fetching gas cost', function (hooks) {
      hooks.beforeEach(function (this: TestContext) {
        const scheduledPaymentsSdkService = this.owner.lookup(
          'service:scheduled-payment-sdk'
        ) as SchedulePaymentSDKService;

        scheduledPaymentsSdkService.getCreateSafeGasEstimation = (): Promise<{
          gasEstimateInNativeToken: BigNumber;
          gasEstimateInUsd: BigNumber;
        }> => {
          return Promise.reject('error while fetching gas cost');
        };
      });

      test('shows an error', async function (assert) {
        await visit('/schedule');
        await click('.connect-button__button');
        await click('[data-test-wallet-option="metamask"]');
        await click('[data-test-mainnet-connect-button]');
        await click('[data-test-authenticate-button]');
        await click('[data-test-create-safe-button]');

        assert
          .dom('[data-test-setup-safe-modal]')
          .includesText(
            'There was an error comparing your wallet balance to the estimated gas cost. Please reload the page and try again. If the problem persists, please contact support.'
          );
      });
    });

    module('with error while getting balance', function (hooks) {
      hooks.beforeEach(function (this: TestContext) {
        const walletService = this.owner.lookup(
          'service:wallet'
        ) as WalletService;

        walletService.fetchNativeTokenBalance = (): Promise<
          Record<'symbol' | 'amount', string>
        > => {
          return Promise.reject('error while getting balance');
        };
      });

      test('shows an error', async function (assert) {
        await visit('/schedule');
        await click('.connect-button__button');
        await click('[data-test-wallet-option="metamask"]');
        await click('[data-test-mainnet-connect-button]');
        await click('[data-test-authenticate-button]');
        await click('[data-test-create-safe-button]');

        assert
          .dom('[data-test-setup-safe-modal]')
          .includesText(
            'There was an error comparing your wallet balance to the estimated gas cost. Please reload the page and try again. If the problem persists, please contact support.'
          );
      });
    });

    module('with error during safe indexing', function (hooks) {
      hooks.beforeEach(function (this: TestContext) {
        const scheduledPaymentsSdkService = this.owner.lookup(
          'service:scheduled-payment-sdk'
        ) as SchedulePaymentSDKService;

        scheduledPaymentsSdkService.waitForSafeToBeIndexed =
          (): Promise<void> => {
            return Promise.reject('error while indexing safe');
          };
      });

      test('shows an error', async function (assert) {
        await visit('/schedule');
        await click('.connect-button__button');
        await click('[data-test-wallet-option="metamask"]');
        await click('[data-test-mainnet-connect-button]');
        await click('[data-test-authenticate-button]');
        await click('[data-test-create-safe-button]');
        await click('[data-test-provision-safe-button]');
        await waitFor('[data-test-safe-error-info]');

        assert
          .dom('[data-test-safe-error-info]')
          .includesText(
            "Your safe was created but we couldn't fetch its info. There could be a delay in our indexing backend. Please reload this page in a couple of minutes to see your safe. If it doesn't appear, please contact support."
          );
      });
    });
  });

  module('with insufficient balance', function (hooks) {
    hooks.beforeEach(function (this: TestContext) {
      const walletService = this.owner.lookup(
        'service:wallet'
      ) as WalletService;

      walletService.fetchNativeTokenBalance = (): Promise<
        Record<'symbol' | 'amount', string>
      > => {
        return Promise.resolve({
          amount: '1', // 1 WEI
          symbol: 'ETH',
        });
      };
    });

    test('can not create a safe', async function (assert) {
      await visit('/schedule');
      await click('.connect-button__button');
      await click('[data-test-wallet-option="metamask"]');
      await click('[data-test-mainnet-connect-button]');
      await click('[data-test-authenticate-button]');
      await click('[data-test-create-safe-button]');

      assert
        .dom('[data-test-setup-safe-modal]')
        .includesText('Set up a Payment Safe')
        .includesText('Estimated gas cost: 0.012 ETH (~$594.51)')
        .includesText(
          'Your wallet has insufficient funds to cover the estimated gas cost'
        );

      assert.dom('[data-test-provision-safe-button]').isDisabled();
    });
  });
});
