import { ERC20ABI } from '@cardstack/cardpay-sdk';
import SafesService, {
  Safe,
  TokenBalance,
} from '@cardstack/safe-tools-client/services/safes';
import { MockLocalStorage } from '@cardstack/safe-tools-client/utils/browser-mocks';
import {
  TestContext,
  click,
  findAll,
  visit,
  waitUntil,
} from '@ember/test-helpers';
import IUniswapV2Pair from '@uniswap/v2-core/build/IUniswapV2Pair.json';
import { BigNumber } from 'ethers';
import { setupWorker, rest } from 'msw';
import { module, test } from 'qunit';

import { setupApplicationTest } from '../helpers';
import { exampleGasTokens } from '../support/tokens';
import { fillInSchedulePaymentFormWithValidInfo } from '../support/ui-test-helpers';

declare global {
  interface Window {
    TEST__AUTH_TOKEN?: string;
  }
}
const FAKE_WALLET_CONNECT_ACCOUNT =
  '0x57b8a319bea4438092eeb4e27d9048dbb844e234';

module('Acceptance | scheduling', function (hooks) {
  setupApplicationTest(hooks);
  hooks.beforeEach(function (this: TestContext) {
    this.mockLocalStorage ||= new MockLocalStorage();
    this.owner.register('storage:local', this.mockLocalStorage, {
      instantiate: false,
    });

    const handlers = [
      rest.post('/hub-test/api/gas-estimation', (_req, res, ctx) => {
        return res(
          ctx.status(200),
          ctx.json({
            data: {
              id: 'f27a519d-dfab-481c-b559-e4b16358f6d9',
              type: 'gas-estimation-results',
              attributes: {
                scenario: 'execute_one_time_payment',
                'chain-id': 5,
                'token-address': '0xB4FBF271143F4FBf7B91A5ded31805e42b2208d6',
                'gas-token-address':
                  '0xB4FBF271143F4FBf7B91A5ded31805e42b2208d6',
                gas: 127864,
              },
            },
          })
        );
      }),
      rest.get('/hub-test/api/gas-station/1', (_req, res, ctx) => {
        return res(
          ctx.status(200),
          ctx.json({
            data: {
              id: '92cda036-c9d9-49a4-bf5d-ecbada790194',
              type: 'gas-prices',
              attributes: {
                'chain-id': 5,
                slow: '130',
                standard: '140',
                fast: '160',
              },
            },
          })
        );
      }),
    ];
    const worker = setupWorker(...handlers);
    worker.start({
      onUnhandledRequest(req, { warning }) {
        if (req.url.href.match(/trust-wallet.com|relay|\.png|\.svg|\.ttf/)) {
          return;
        }
        warning();
      },
    });
    this.mockLocalStorage.setItem('authToken', 'abc123');

    this.mockWalletConnect.mockConnectedWallet([FAKE_WALLET_CONNECT_ACCOUNT]);
    this.mockWalletConnect.mockChainId(1);

    const USDC_TOKEN_ADDRESS = '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48';
    const mockUsdcContract = this.mockWalletConnect.generateContractUtils(
      ERC20ABI,
      USDC_TOKEN_ADDRESS
    );
    mockUsdcContract.mockCall('decimals', ['6']);
    mockUsdcContract.mockCall('decimals', ['6']);

    const WETH_TOKEN_ADDRESS = '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2';
    const mockWethContract = this.mockWalletConnect.generateContractUtils(
      ERC20ABI,
      WETH_TOKEN_ADDRESS
    );
    mockWethContract.mockCall('decimals', ['18']);
    mockWethContract.mockCall('decimals', ['18']);

    const UNISWAP_V2_ADDRESS = '0xb4e16d0168e52d35cacd2c6185b44281ec28c9dc';
    const mockUniswapContract = this.mockWalletConnect.generateContractUtils(
      IUniswapV2Pair.abi,
      UNISWAP_V2_ADDRESS
    );
    mockUniswapContract.mockCall('getReserves', ['1', '1', '10000']);
    mockUniswapContract.mockCall('getReserves', ['1', '1', '10000']);

    const tokensService = this.owner.lookup('service:tokens');
    tokensService.stubGasTokens(exampleGasTokens);

    const safesService = this.owner.lookup('service:safes') as SafesService;

    safesService.fetchSafes = (): Promise<Safe[]> => {
      return Promise.resolve([
        {
          address: '0x458Bb61A22A0e91855d6D876C88706cfF7bD486E',
          spModuleAddress: '0xa6b71e26c5e0845f74c812102ca7114b6a896ab2',
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
  });

  module('one-time', function () {
    // test: does not schedule if invalid

    test('schedules if valid', async function (assert) {
      await visit('/schedule');
      await click('.connect-button__button');
      await click('[data-test-wallet-option="wallet-connect"]');
      await click('[data-test-mainnet-connect-button]');
      await this.mockWalletConnect.mockAccountsChanged([
        FAKE_WALLET_CONNECT_ACCOUNT,
      ]);
      await fillInSchedulePaymentFormWithValidInfo();
      await waitUntil(
        () =>
          findAll(
            '.schedule-payment-form-action-card--max-gas-fee-description'
          )[0]?.textContent?.length
      );
      // click "Schedule Payment" button
      await click(
        '.schedule-payment-form-action-card [data-test-boxel-action-chin] button'
      );
      await this.pauseTest();
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
