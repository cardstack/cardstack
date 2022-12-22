import {
  ERC20ABI,
  GnosisSafeABI,
  ScheduledPaymentModuleABI,
} from '@cardstack/cardpay-sdk';
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
  waitFor,
  waitUntil,
} from '@ember/test-helpers';
import IUniswapV2Pair from '@uniswap/v2-core/build/IUniswapV2Pair.json';
import { TransactionReceipt } from 'eth-testing/lib/json-rpc-methods-types';
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
const SAFE_ADDRESS = '0x458Bb61A22A0e91855d6D876C88706cfF7bD486E';
const SP_MODULE_ADDRESS = '0xa6B71E26C5e0845f74c812102Ca7114b6a896AB2';
const EXECUTION_GAS = 127864;

module('Acceptance | scheduling', function (hooks) {
  setupApplicationTest(hooks);
  hooks.beforeEach(function (this: TestContext) {
    this.mockLocalStorage ||= new MockLocalStorage();
    this.owner.register('storage:local', this.mockLocalStorage, {
      instantiate: false,
    });

    const handlers = [
      rest.get('/hub-test/api/session', (_req, res, ctx) => {
        return res(ctx.status(200), ctx.json({}));
      }),
      rest.get('/hub-test/api/scheduled-payment-attempts', (_req, res, ctx) => {
        return res(
          ctx.status(200),
          ctx.json({
            data: [],
          })
        );
      }),
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
                gas: EXECUTION_GAS,
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
      rest.post(
        `https://relay-ethereum.cardstack.com/api/v2/safes/${SAFE_ADDRESS}/transactions/estimate/`,
        (_req, res, ctx) => {
          return res(
            ctx.status(200),
            ctx.json({
              baseGas: 1,
              safeTxGas: 1,
            })
          );
        }
      ),
      rest.post('/hub-test/api/scheduled-payments', (_req, res, ctx) => {
        return res(
          ctx.status(200),
          ctx.json({
            data: {
              type: 'scheduled-payment',
              id: 'acc42eb0-340f-42f3-98b3-a568255a9c37',
            },
          })
        );
      }),
      rest.post(
        `https://relay-ethereum.cardstack.com/api/v1/safes/${SAFE_ADDRESS}/transactions/`,
        (_req, res, ctx) => {
          return res(
            ctx.status(200),
            ctx.json({
              ethereumTx: {
                txHash:
                  '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
              },
            })
          );
        }
      ),
      rest.patch(
        '/hub-test/api/scheduled-payments/acc42eb0-340f-42f3-98b3-a568255a9c37',
        (_req, res, ctx) => {
          return res(
            ctx.status(200),
            ctx.json({
              data: {
                type: 'scheduled-payment',
                id: 'acc42eb0-340f-42f3-98b3-a568255a9c37',
              },
            })
          );
        }
      ),
      rest.get(
        '/hub-test/api/scheduled-payments/acc42eb0-340f-42f3-98b3-a568255a9c37',
        (_req, res, ctx) => {
          return res(
            ctx.status(200),
            ctx.json({
              data: {
                type: 'scheduled-payment',
                id: 'acc42eb0-340f-42f3-98b3-a568255a9c37',
              },
            })
          );
        }
      ),
    ];
    const worker = setupWorker(...handlers);
    worker.start({
      onUnhandledRequest(req, { warning }) {
        if (
          req.url.href.match(
            /trust-wallet.com|relay|\.png|\.svg|\.ttf|\/assets\//
          )
        ) {
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

    const mockSPModuleContract = this.mockWalletConnect.generateContractUtils(
      ScheduledPaymentModuleABI,
      SP_MODULE_ADDRESS
    );
    mockSPModuleContract.mockCall(
      'createSpHash(address,uint256,address,((uint256),(uint256)),uint256,uint256,address,string,uint256)',
      ['0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef']
    );

    const mockGnosisSafeContract = this.mockWalletConnect.generateContractUtils(
      GnosisSafeABI,
      SAFE_ADDRESS
    );
    mockGnosisSafeContract.mockCall('VERSION', ['1.3.0']);

    this.mockWalletConnect.lowLevel.mockRequest('eth_signTypedData_v4', [
      '1b6a2d7aa891e56f1c7a2456e9f9e4444b9bca72bcecb40cbce2b2df89e387415b724a87e93a7b944d9c34e05e87b87c1d7bb00e6b2c4c3f4ccad42e9a9d49dd1b',
    ]);
    this.mockWalletConnect.lowLevel.mockRequest('eth_signTypedData_v4', [
      '1b6a2d7aa891e56f1c7a2456e9f9e4444b9bca72bcecb40cbce2b2df89e387415b724a87e93a7b944d9c34e05e87b87c1d7bb00e6b2c4c3f4ccad42e9a9d49dd1b',
    ]);

    this.mockWalletConnect.lowLevel.mockRequest(
      'eth_getTransactionReceipt',
      {
        status: true,
        blockHash:
          '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
      } as TransactionReceipt,
      { persistent: true }
    );

    const safesService = this.owner.lookup('service:safes') as SafesService;
    safesService.fetchSafes = (): Promise<Safe[]> => {
      return Promise.resolve([
        {
          address: SAFE_ADDRESS,
          spModuleAddress: SP_MODULE_ADDRESS,
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
      await waitFor('[data-test-safe-address-label]');
      await waitUntil(() => {
        return findAll(
          '.schedule-payment-form-action-card--max-gas-fee-description'
        )[0]?.textContent?.trim().length;
      });
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
