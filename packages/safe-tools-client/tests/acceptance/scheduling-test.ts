import { Deferred } from '@cardstack/ember-shared';
import SafesService, {
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
const SP_CREATION_TX_HASH =
  '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef';
const SP_CREATION_BLOCK_NUMBER = 1000;

let signedHubAuthentication = 0;
let signedSafeTx = 0;
let scheduledPaymentCreated = 0;
let scheduledPaymentPatchedWithTxHash: string | undefined;
let scheduledPaymentCreationApiDelay: Promise<void> | undefined;

module('Acceptance | scheduling', function (hooks) {
  setupApplicationTest(hooks);
  hooks.beforeEach(function (this: TestContext) {
    this.mockLocalStorage ||= new MockLocalStorage();
    this.owner.register('storage:local', this.mockLocalStorage, {
      instantiate: false,
    });
    signedHubAuthentication = 0;
    signedSafeTx = 0;
    scheduledPaymentCreated = 0;

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
      rest.get(
        `https://relay-ethereum.cardstack.com/api/v1/tokens`,
        (_req, res, ctx) => {
          return res(ctx.status(200), ctx.json({ results: exampleGasTokens }));
        }
      ),
      rest.post(
        `https://relay-ethereum.cardstack.com/api/v2/safes/${SAFE_ADDRESS}/transactions/estimate/`,
        async (_req, res, ctx) => {
          return res(
            ctx.status(200),
            ctx.json({
              baseGas: 1,
              safeTxGas: 1,
            })
          );
        }
      ),
      rest.post('/hub-test/api/scheduled-payments', async (_req, res, ctx) => {
        if (scheduledPaymentCreationApiDelay) {
          await scheduledPaymentCreationApiDelay;
        }
        scheduledPaymentCreated++;
        return res(
          ctx.status(200),
          ctx.json({
            data: {
              type: 'scheduled-payment',
              id: 'acc42eb0-340f-42f3-98b3-a568255a9c37',
              attributes: {},
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
                txHash: SP_CREATION_TX_HASH,
              },
            })
          );
        }
      ),
      rest.patch(
        '/hub-test/api/scheduled-payments/:scheduledPaymentId',
        (req, res, ctx) => {
          const requestBody = req.body as {
            data: { attributes: Record<string, string> };
          };
          scheduledPaymentPatchedWithTxHash =
            requestBody.data.attributes['creation-transaction-hash'];
          return res(
            ctx.status(200),
            ctx.json({
              data: {
                type: 'scheduled-payment',
                id: req.params.scheduledPaymentId,
                attributes: {},
              },
            })
          );
        }
      ),
      rest.get(
        '/hub-test/api/scheduled-payments/:scheduledPaymentId',
        (req, res, ctx) => {
          return res(
            ctx.status(200),
            ctx.json({
              data: {
                type: 'scheduled-payment',
                id: req.params.scheduledPaymentId,
                attributes: {
                  'creation-transaction-hash':
                    scheduledPaymentPatchedWithTxHash,
                  'creation-block-number': SP_CREATION_BLOCK_NUMBER,
                },
              },
            })
          );
        }
      ),
      rest.post(
        'https://api.thegraph.com/subgraphs/name/cardstack/safe-tools-mainnet',
        (_req, res, ctx) => {
          return res(
            ctx.status(200),
            ctx.json({
              data: {
                account: {
                  safes: [
                    {
                      safe: {
                        id: SAFE_ADDRESS,
                        spModule: SP_MODULE_ADDRESS,
                      },
                    },
                  ],
                },
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
          req.url.href.match(/trust-wallet.com|\.png|\.svg|\.ttf|\/assets\//)
        ) {
          return;
        }
        warning();
      },
    });
    this.mockLocalStorage.setItem('authToken', 'abc123');

    this.mockWalletConnect.mockMainnet();
    this.mockWalletConnect.mockConnectedWallet([FAKE_WALLET_CONNECT_ACCOUNT]);
    this.mockWalletConnect.mockSafe(SAFE_ADDRESS, {
      nativeBalance: '1000000000000000000',
      spModuleAddress: SP_MODULE_ADDRESS,
    });

    this.mockWalletConnect.spModuleContract.mockCall(
      'createSpHash(address,uint256,address,((uint256),(uint256)),uint256,uint256,address,string,uint256)',
      [SP_CREATION_TX_HASH]
    );

    this.mockWalletConnect.lowLevel.mockRequest(
      'eth_signTypedData_v4',
      async ([from, data]: [string, string]) => {
        const typedData = JSON.parse(data);
        console.log('eth_signTypedData_v4');
        console.log({ from, typedData });
        if (typedData['primaryType'] === 'HubAuthentication') {
          signedHubAuthentication++;
          return '1b6a2d7aa891e56f1c7a2456e9f9e4444b9bca72bcecb40cbce2b2df89e387415b724a87e93a7b944d9c34e05e87b87c1d7bb00e6b2c4c3f4ccad42e9a9d49dd1b';
        } else if (typedData['primaryType'] === 'SafeTx') {
          signedSafeTx++;
          return '1b6a2d7aa891e56f1c7a2456e9f9e4444b9bca72bcecb40cbce2b2df89e387415b724a87e93a7b944d9c34e05e87b87c1d7bb00e6b2c4c3f4ccad42e9a9d49dd1b';
        } else {
          throw new Error(`Unknown typed data: ${typedData['primaryType']}`);
        }
      },
      {
        persistent: true,
      }
    );

    this.mockWalletConnect.lowLevel.mockRequest(
      'eth_getTransactionReceipt',
      {
        status: '0x1',
        blockHash: '0x6fd9e2a26ab',
        blockNumber: '4961488',
        gasUsed: '21000',
        transactionHash: SP_CREATION_TX_HASH,
        from: '',
      } as TransactionReceipt,
      { persistent: true }
    );

    // mocking this at the provider level is complex because of the total number of calls
    const safesService = this.owner.lookup('service:safes') as SafesService;
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

    test('schedule and then reset', async function (assert) {
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
      const scheduledPaymentCreationApiDeferred = new Deferred<void>();
      scheduledPaymentCreationApiDelay =
        scheduledPaymentCreationApiDeferred.promise;
      await click('[data-test-schedule-payment-form-submit-button]');
      assert
        .dom('[data-test-schedule-payment-form-submit-button]')
        .hasText('Scheduling...');
      assert.dom('[data-test-payee-address-input]').isDisabled();

      scheduledPaymentCreationApiDeferred.fulfill();
      await waitUntil(() => scheduledPaymentCreated);
      assert.strictEqual(
        signedHubAuthentication,
        1,
        'signed hub authentication'
      );
      assert.strictEqual(signedSafeTx, 1, 'signed safe transaction');
      assert.ok(
        scheduledPaymentCreated,
        'Scheduled Payment created via POST to API'
      );
      await waitUntil(() => scheduledPaymentPatchedWithTxHash);
      assert.strictEqual(
        scheduledPaymentPatchedWithTxHash,
        SP_CREATION_TX_HASH,
        'Scheduled Payment updated via PATCH to API'
      );
      await waitFor('[data-test-boxel-action-chin-action-status-area]');
      assert
        .dom('[data-test-boxel-action-chin-action-status-area]')
        .containsText('Payment was successfully scheduled');
      assert.dom('[data-test-payee-address-input]').isDisabled();

      await click('[data-test-schedule-payment-form-reset-button]');
      assert.dom('[data-test-payee-address-input]').isNotDisabled();
      assert
        .dom('[data-test-schedule-payment-form-submit-button]')
        .hasText('Schedule Payment');
    });
  });

  module('recurring', function () {
    // test: does not schedule if invalid
    // test: schedules if valid
  });
});
