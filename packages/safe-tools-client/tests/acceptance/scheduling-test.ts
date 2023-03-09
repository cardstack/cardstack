import { type ChainAddress } from '@cardstack/cardpay-sdk';
import { Deferred } from '@cardstack/ember-shared';
import SafesService, {
  TokenBalance,
} from '@cardstack/safe-tools-client/services/safes';
import ScheduledPaymentSdk from '@cardstack/safe-tools-client/services/scheduled-payment-sdk';
import { ScheduledPaymentResponseItem } from '@cardstack/safe-tools-client/services/scheduled-payments';
import { MockLocalStorage } from '@cardstack/safe-tools-client/utils/browser-mocks';
import {
  TestContext,
  click,
  find,
  visit,
  waitFor,
  waitUntil,
} from '@ember/test-helpers';
import { addDays } from 'date-fns';
import { TransactionReceipt } from 'eth-testing/lib/json-rpc-methods-types';
import { BigNumber } from 'ethers';
import { setupWorker, rest, SetupWorkerApi } from 'msw';
import { module, test } from 'qunit';

import { setupApplicationTest, USDC_TOKEN_ADDRESS } from '../helpers';
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
const SP_HASH =
  '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef';
const SP_CREATION_BLOCK_NUMBER = 1000;
const SP_CREATION_TX_HASH =
  '0x5432101234567890abcdef1234567890abcdef1234567890abcdef1234567890';
const SUBMIT_BUTTON = '[data-test-schedule-payment-form-submit-button]';
const PAYEE_INPUT = '[data-test-payee-address-input]';
const IN_PROGRESS_MESSAGE = '[data-test-in-progress-message]';
const CHAIN_ID = 5;

interface SpCreationApiPayload {
  data: {
    attributes: Record<string, string | number>;
  };
}
let signedHubAuthentication = 0;
let signedSafeTx = 0;
let scheduledPaymentCreations: SpCreationApiPayload[] = [];
let scheduledPaymentPatchedWithTxHash: string | undefined;
let scheduledPaymentCreationApiDeferred: Deferred<void> | undefined;
let scheduledPaymentCreationApiDelay: Promise<void> | undefined;
let scheduledPaymentCreateSpHashDeferred: Deferred<void> | undefined;
let scheduledPaymentCreateSpHashDelay: Promise<void> | undefined;
let scheduledPaymentGetShouldIncludeBlockNumber = false;
let scheduledPaymentsToReturnFromTheApi: ScheduledPaymentResponseItem[] = [];

module('Acceptance | scheduling', function (hooks) {
  setupApplicationTest(hooks);
  let mockServiceWorker: SetupWorkerApi;
  hooks.beforeEach(function (this: TestContext) {
    this.mockLocalStorage ||= new MockLocalStorage();
    this.owner.register('storage:local', this.mockLocalStorage, {
      instantiate: false,
    });
    signedHubAuthentication = 0;
    signedSafeTx = 0;
    scheduledPaymentCreations = [];
    scheduledPaymentPatchedWithTxHash = undefined;
    scheduledPaymentCreateSpHashDeferred = new Deferred<void>();
    scheduledPaymentCreateSpHashDelay =
      scheduledPaymentCreateSpHashDeferred.promise;
    scheduledPaymentCreationApiDeferred = new Deferred<void>();
    scheduledPaymentCreationApiDelay =
      scheduledPaymentCreationApiDeferred.promise;
    scheduledPaymentGetShouldIncludeBlockNumber = false;
    scheduledPaymentsToReturnFromTheApi = [];

    const handlers = [
      rest.get('/hub-test/api/config', (_req, res, ctx) => {
        return res(
          ctx.status(200),
          ctx.json({
            data: {
              attributes: {
                web3: {
                  schedulerNetworks: ['mainnet', 'polygon'],
                },
              },
            },
          })
        );
      }),
      rest.get('/hub-test/api/session', (req, res, ctx) => {
        if (req.headers.get('Authorization')) {
          return res(
            ctx.status(200),
            ctx.json({
              data: { attributes: { user: FAKE_WALLET_CONNECT_ACCOUNT } },
            })
          );
        } else {
          return res(
            ctx.status(401),
            ctx.json({ errors: [{ meta: { nonce: 5, version: 1 } }] })
          );
        }
      }),
      rest.post('/hub-test/api/session', (_req, res, ctx) => {
        return res(
          ctx.status(200),
          ctx.json({
            data: { attributes: { authToken: 'abc123' } },
          })
        );
      }),
      rest.get('/hub-test/api/scheduled-payment-attempts', (_req, res, ctx) => {
        return res(
          ctx.status(200),
          ctx.json({
            data: [],
          })
        );
      }),
      rest.get('/hub-test/api/scheduled-payments', (_req, res, ctx) => {
        return res(
          ctx.status(200),
          ctx.json({
            data: scheduledPaymentsToReturnFromTheApi,
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
                'chain-id': CHAIN_ID,
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
                'chain-id': CHAIN_ID,
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
      rest.post('/hub-test/api/scheduled-payments', async (req, res, ctx) => {
        if (scheduledPaymentCreationApiDelay) {
          await scheduledPaymentCreationApiDelay;
        }
        scheduledPaymentCreations.push(await req.json());
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
                  'creation-block-number':
                    scheduledPaymentGetShouldIncludeBlockNumber
                      ? SP_CREATION_BLOCK_NUMBER
                      : null,
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
    mockServiceWorker = setupWorker(...handlers);
    mockServiceWorker.start({
      onUnhandledRequest(req, { warning }) {
        if (
          req.url.href.match(/trust-wallet.com|\.png|\.svg|\.ttf|\/assets\//)
        ) {
          return;
        }
        warning();
      },
    });
    this.mockLocalStorage.setItem(
      `authToken-${FAKE_WALLET_CONNECT_ACCOUNT}-${CHAIN_ID}`,
      'abc123'
    );

    this.mockWalletConnect.mockMainnet();
    this.mockWalletConnect.mockConnectedWallet([FAKE_WALLET_CONNECT_ACCOUNT]);
    this.mockWalletConnect.mockSafe(SAFE_ADDRESS, {
      nativeBalance: '1000000000000000000',
      spModuleAddress: SP_MODULE_ADDRESS,
    });

    // one-time
    this.mockWalletConnect.spModuleContract.mockCall(
      'createSpHash(address,uint256,address,((uint256),(uint256)),uint256,uint256,address,string,uint256)',
      async (_ethCall) => {
        if (scheduledPaymentCreateSpHashDelay) {
          await scheduledPaymentCreateSpHashDelay;
        }
        return [SP_HASH];
      }
    );

    // monthly recurring
    this.mockWalletConnect.spModuleContract.mockCall(
      'createSpHash(address,uint256,address,((uint256),(uint256)),uint256,uint256,address,string,uint256,uint256)',
      async () => {
        if (scheduledPaymentCreateSpHashDelay) {
          await scheduledPaymentCreateSpHashDelay;
        }
        return [SP_HASH];
      }
    );

    this.mockWalletConnect.lowLevel.mockRequest(
      'eth_signTypedData_v4',
      async ([_from, data]: [string, string]) => {
        const typedData = JSON.parse(data);
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
        {
          tokenAddress: USDC_TOKEN_ADDRESS,
          symbol: 'USDC',
          balance: BigNumber.from('10000000'),
          decimals: 6,
        } as unknown as TokenBalance,
      ]);
    };

    const scheduledPaymentSdkService = this.owner.lookup(
      'service:scheduled-payment-sdk'
    ) as ScheduledPaymentSdk;
    scheduledPaymentSdkService.estimateSchedulePaymentInGasToken = async (
      _safeAddress: ChainAddress,
      _moduleAddress: ChainAddress,
      _tokenAddress: ChainAddress,
      _amount: BigNumber,
      _payeeAddress: ChainAddress,
      _executionGas: number,
      _maxGasPrice: string,
      _gasTokenAddress: ChainAddress,
      _salt: string,
      _payAt: number | null,
      _recurringDayOfMonth: number | null,
      _recurringUntil: number | null
    ): Promise<BigNumber> => {
      return Promise.resolve(BigNumber.from('60000'));
    };
  });

  hooks.afterEach(function () {
    mockServiceWorker.stop();
  });

  module('one-time', function () {
    // test: does not schedule if invalid

    test('schedule and then reset', async function (assert) {
      await visit('/schedule');
      await click('.connect-button__button');
      await click('[data-test-wallet-option="wallet-connect"]');
      await click('[data-test-connect-wallet-button-modal]');
      await this.mockWalletConnect.mockAccountsChanged([
        FAKE_WALLET_CONNECT_ACCOUNT,
      ]);
      await waitFor(`[data-test-safe-address-label][title="${SAFE_ADDRESS}"]`);

      await waitFor('[data-test-hub-auth-modal]');
      await click('[data-test-hub-auth-modal] button');
      await waitUntil(() => find('[data-test-hub-auth-modal]') === null);

      await fillInSchedulePaymentFormWithValidInfo({ type: 'one-time' });
      scheduledPaymentCreateSpHashDeferred?.fulfill();
      await waitFor(`${SUBMIT_BUTTON}:not(:disabled)`);
      await click(SUBMIT_BUTTON);
      assert.dom(PAYEE_INPUT).isDisabled();

      await waitUntil(() =>
        find(IN_PROGRESS_MESSAGE)?.textContent?.includes(
          'Calculating payment hash'
        )
      );
      assert.dom(IN_PROGRESS_MESSAGE).hasText('Calculating payment hash...');
      assert.dom(PAYEE_INPUT).isDisabled();

      assert.strictEqual(
        signedHubAuthentication,
        1,
        'signed hub authentication'
      );
      scheduledPaymentCreateSpHashDeferred?.fulfill();

      await waitUntil(() =>
        find(IN_PROGRESS_MESSAGE)?.textContent?.includes(
          'Registering payment with hub'
        )
      );
      assert
        .dom(IN_PROGRESS_MESSAGE)
        .hasText('Registering payment with hub...');
      assert.dom(PAYEE_INPUT).isDisabled();

      scheduledPaymentCreationApiDeferred?.fulfill();

      await waitUntil(() => scheduledPaymentCreations.length);

      await waitUntil(() =>
        find(IN_PROGRESS_MESSAGE)?.textContent?.includes('Recording on hub')
      );
      assert.dom(IN_PROGRESS_MESSAGE).hasText('Recording on hub...');

      assert.strictEqual(signedSafeTx, 1, 'signed safe transaction');
      assert.ok(
        scheduledPaymentCreations.length,
        'Scheduled Payment created via POST to API'
      );
      const apiPostDataAttributes =
        scheduledPaymentCreations[0].data.attributes;
      assert.strictEqual(apiPostDataAttributes['amount'], '15000000');
      assert.ok(
        !!apiPostDataAttributes['pay-at'],
        'pay-at is included in POST to hub'
      );
      assert.strictEqual(
        apiPostDataAttributes['payee-address'],
        '0xb794f5ea0ba39494ce839613fffba74279579268'
      );
      assert.strictEqual(apiPostDataAttributes['sp-hash'], SP_HASH);
      assert.strictEqual(
        apiPostDataAttributes['token-address'],
        USDC_TOKEN_ADDRESS
      );

      scheduledPaymentsToReturnFromTheApi = [
        {
          id: '123',
          // @ts-expect-error intentionally omitting attributes because they are not needed for this test
          attributes: {
            'pay-at': addDays(Date.now(), 1).toISOString(),
            amount: String(
              scheduledPaymentCreations[0].data.attributes['amount']
            ),
            'token-address': String(
              scheduledPaymentCreations[0].data.attributes['token-address']
            ),
            'max-gas-price': String(
              scheduledPaymentCreations[0].data.attributes['max-gas-price']
            ),
          },
        },
      ];

      await waitUntil(() => scheduledPaymentPatchedWithTxHash);
      assert.strictEqual(
        scheduledPaymentPatchedWithTxHash,
        SP_CREATION_TX_HASH,
        'Scheduled Payment updated via PATCH to API'
      );
      await waitUntil(() =>
        find(IN_PROGRESS_MESSAGE)?.textContent?.includes(
          'Confirming transaction'
        )
      );
      assert.dom(IN_PROGRESS_MESSAGE).hasText('Confirming transaction...');

      scheduledPaymentGetShouldIncludeBlockNumber = true;

      await waitFor('[data-test-memorialized-status]');
      assert
        .dom('[data-test-memorialized-status]')
        .containsText('Payment was successfully scheduled');
      assert.dom(PAYEE_INPUT).isDisabled();

      // Make sure the newly created payment appears in the list of future scheduled payments
      await waitFor('[data-test-scheduled-payment-card-id="123"]');
      assert.dom('[data-test-scheduled-payment-card-id="123"]').exists();

      await click('[data-test-schedule-payment-form-reset-button]');
      assert.dom(PAYEE_INPUT).isNotDisabled();
      assert.dom(SUBMIT_BUTTON).hasText('Schedule Payment');
    });
  });

  module('recurring', function () {
    // test: does not schedule if invalid
    test('schedule and then reset', async function (assert) {
      await visit('/schedule');
      await click('.connect-button__button');
      await click('[data-test-wallet-option="wallet-connect"]');
      await click('[data-test-connect-wallet-button-modal]');
      await this.mockWalletConnect.mockAccountsChanged([
        FAKE_WALLET_CONNECT_ACCOUNT,
      ]);
      await waitFor(`[data-test-safe-address-label][title="${SAFE_ADDRESS}"]`);

      await fillInSchedulePaymentFormWithValidInfo({ type: 'monthly' });
      scheduledPaymentCreateSpHashDeferred?.fulfill();
      await waitFor(`${SUBMIT_BUTTON}:not(:disabled)`);

      await click(SUBMIT_BUTTON);
      assert.dom(IN_PROGRESS_MESSAGE).hasText('Authenticating...');
      assert.dom(PAYEE_INPUT).isDisabled();

      await waitUntil(() =>
        find(IN_PROGRESS_MESSAGE)?.textContent?.includes(
          'Calculating payment hash'
        )
      );
      assert.dom(IN_PROGRESS_MESSAGE).hasText('Calculating payment hash...');
      assert.dom(PAYEE_INPUT).isDisabled();

      assert.strictEqual(
        signedHubAuthentication,
        1,
        'signed hub authentication'
      );
      scheduledPaymentCreateSpHashDeferred?.fulfill();

      await waitUntil(() =>
        find(IN_PROGRESS_MESSAGE)?.textContent?.includes(
          'Registering payment with hub'
        )
      );
      assert
        .dom(IN_PROGRESS_MESSAGE)
        .hasText('Registering payment with hub...');
      assert.dom(PAYEE_INPUT).isDisabled();

      scheduledPaymentCreationApiDeferred?.fulfill();

      await waitUntil(() => scheduledPaymentCreations.length);

      await waitUntil(() =>
        find(IN_PROGRESS_MESSAGE)?.textContent?.includes('Recording on hub')
      );
      assert.dom(IN_PROGRESS_MESSAGE).hasText('Recording on hub...');

      assert.strictEqual(signedSafeTx, 1, 'signed safe transaction');
      assert.ok(
        scheduledPaymentCreations.length,
        'Scheduled Payment created via POST to API'
      );
      const apiPostDataAttributes =
        scheduledPaymentCreations[0].data.attributes;
      assert.strictEqual(apiPostDataAttributes['amount'], '15000000');
      assert.strictEqual(
        scheduledPaymentCreations[0].data.attributes['recurring-day-of-month'],
        15
      );
      assert.ok(
        !!scheduledPaymentCreations[0].data.attributes['recurring-until']
      );
      assert.strictEqual(
        apiPostDataAttributes['payee-address'],
        '0xb794f5ea0ba39494ce839613fffba74279579268'
      );
      assert.strictEqual(apiPostDataAttributes['sp-hash'], SP_HASH);
      assert.strictEqual(
        apiPostDataAttributes['token-address'],
        USDC_TOKEN_ADDRESS
      );

      await waitUntil(() => scheduledPaymentPatchedWithTxHash);
      assert.strictEqual(
        scheduledPaymentPatchedWithTxHash,
        SP_CREATION_TX_HASH,
        'Scheduled Payment updated via PATCH to API'
      );
      await waitUntil(() =>
        find(IN_PROGRESS_MESSAGE)?.textContent?.includes(
          'Confirming transaction'
        )
      );
      assert.dom(IN_PROGRESS_MESSAGE).hasText('Confirming transaction...');

      scheduledPaymentGetShouldIncludeBlockNumber = true;

      await waitFor('[data-test-memorialized-status]');
      assert
        .dom('[data-test-memorialized-status]')
        .containsText('Payment was successfully scheduled');
      assert.dom(PAYEE_INPUT).isDisabled();

      await click('[data-test-schedule-payment-form-reset-button]');
      assert.dom(PAYEE_INPUT).isNotDisabled();
      assert.dom(SUBMIT_BUTTON).hasText('Schedule Payment');
    });
  });
});
