/* eslint-disable @typescript-eslint/no-empty-function */
import { type ScheduledPaymentAttemptStatus } from '@cardstack/safe-tools-client/services/scheduled-payments';
import Service from '@ember/service';
import { click, render, TestContext, waitFor } from '@ember/test-helpers';
import { subDays, addMinutes, format } from 'date-fns';

import hbs from 'htmlbars-inline-precompile';
import { setupWorker, rest, SetupWorkerApi } from 'msw';
import { module, test } from 'qunit';

import { setupRenderingTest } from '../../helpers';

class WalletServiceStub extends Service {
  isConnected = true;
}
class HubAuthenticationServiceStub extends Service {
  isAuthenticated = true;
}

const SENDER_SAFE_ADDRESS = '0xc0ffee254729296a45a3885639AC7E10F9d54979';
class SafesServiceStub extends Service {
  currentSafe = {
    address: SENDER_SAFE_ADDRESS,
  };
}

const TOKEN_ADDRESS = '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48';
const token = {
  address: TOKEN_ADDRESS,
  name: 'USDC',
  symbol: 'USDC',
  decimals: 6,
};

const now = new Date();
let status: ScheduledPaymentAttemptStatus | undefined;
let startedAt = subDays(now, 30);

let returnEmptyScheduledPaymentAttempts = false;
let returnScheduledPaymentAttemptsWithBlankTxHash = false;
let returnScheduledPaymentAttemptsOfCanceledScheduledPayment = false;

function fetchScheduledPaymentAttempts() {
  if (returnEmptyScheduledPaymentAttempts) {
    return [];
  } else if (returnScheduledPaymentAttemptsWithBlankTxHash) {
    return [
      {
        id: '1',
        type: 'scheduled-payment-attempts',
        attributes: {
          'ended-at': addMinutes(subDays(now, 10), 120).toISOString(),
          'failure-reason': '',
          'started-at': subDays(now, 10).toISOString(),
          status: 'failed',
          'transaction-hash': undefined,
        },
        relationships: {
          'scheduled-payment': {
            data: {
              id: '01234',
              type: 'scheduled-payments',
              attributes: {
                'token-address': TOKEN_ADDRESS,
                'fee-fixed-usd': '0',
                'fee-percentage': '0',
                'gas-token-address': TOKEN_ADDRESS,
                'chain-id': 5,
                'sender-safe-address': SENDER_SAFE_ADDRESS,
                'payee-address': '0xeBCC5516d44FFf5E9aBa2AcaeB65BbB49bC3EBe1',
                'pay-at': addMinutes(subDays(now, 10), 120).toISOString(),
                amount: '10000000',
              },
            },
          },
        },
      },
    ];
  } else if (returnScheduledPaymentAttemptsOfCanceledScheduledPayment) {
    // There are two attempts of a canceled scheduled payment
    // but only latest this will be shown
    return [
      {
        id: '1',
        type: 'scheduled-payment-attempts',
        attributes: {
          'ended-at': addMinutes(subDays(now, 10), 120).toISOString(),
          'failure-reason': '',
          'started-at': subDays(now, 10).toISOString(),
          status: 'failed',
          'transaction-hash': undefined,
        },
        relationships: {
          'scheduled-payment': {
            data: {
              id: '01234',
              type: 'scheduled-payments',
              attributes: {
                'token-address': TOKEN_ADDRESS,
                'fee-fixed-usd': '0',
                'fee-percentage': '0',
                'gas-token-address': TOKEN_ADDRESS,
                'chain-id': 5,
                'sender-safe-address': SENDER_SAFE_ADDRESS,
                'payee-address': '0xeBCC5516d44FFf5E9aBa2AcaeB65BbB49bC3EBe1',
                'pay-at': addMinutes(subDays(now, 10), 120).toISOString(),
                amount: '10000000',
                'canceled-at': addMinutes(subDays(now, 10), 180).toISOString(),
              },
            },
          },
        },
      },
      {
        id: '2',
        type: 'scheduled-payment-attempts',
        attributes: {
          'ended-at': addMinutes(subDays(now, 10), 110).toISOString(),
          'failure-reason': '',
          'started-at': subDays(now, 10).toISOString(),
          status: 'failed',
          'transaction-hash': undefined,
        },
        relationships: {
          'scheduled-payment': {
            data: {
              id: '01234',
              type: 'scheduled-payments',
              attributes: {
                'token-address': TOKEN_ADDRESS,
                'fee-fixed-usd': '0',
                'fee-percentage': '0',
                'gas-token-address': TOKEN_ADDRESS,
                'chain-id': 5,
                'sender-safe-address': SENDER_SAFE_ADDRESS,
                'payee-address': '0xeBCC5516d44FFf5E9aBa2AcaeB65BbB49bC3EBe1',
                'pay-at': addMinutes(subDays(now, 10), 120).toISOString(),
                amount: '10000000',
                'canceled-at': addMinutes(subDays(now, 10), 180).toISOString(),
              },
            },
          },
        },
      },
    ];
  } else {
    return [
      {
        id: '1',
        type: 'scheduled-payment-attempts',
        attributes: {
          'ended-at': addMinutes(subDays(now, 10), 120).toISOString(),
          'failure-reason': '',
          'started-at': subDays(now, 10).toISOString(),
          status: 'succeeded',
          'transaction-hash':
            '0x6f7c54719c0901e30ef018206c37df4daa059224549a08d55acb3360f01094e2',
        },
        relationships: {
          'scheduled-payment': {
            data: {
              id: '01234',
              type: 'scheduled-payments',
              attributes: {
                'token-address': TOKEN_ADDRESS,
                'fee-fixed-usd': '0',
                'fee-percentage': '0',
                'gas-token-address': TOKEN_ADDRESS,
                'chain-id': 5,
                'sender-safe-address': SENDER_SAFE_ADDRESS,
                'payee-address': '0xeBCC5516d44FFf5E9aBa2AcaeB65BbB49bC3EBe1',
                'pay-at': addMinutes(subDays(now, 10), 120).toISOString(),
                amount: '10000000',
              },
            },
          },
        },
      },
      {
        id: '2',
        type: 'scheduled-payment-attempts',
        attributes: {
          'ended-at': addMinutes(subDays(now, 20), 120).toISOString(),
          'failure-reason': 'PaymentExecutionFailed',
          'started-at': subDays(now, 20).toISOString(),
          status: 'failed',
          'transaction-hash': undefined,
        },
        relationships: {
          'scheduled-payment': {
            data: {
              id: '34234',
              type: 'scheduled-payments',
              attributes: {
                'token-address': TOKEN_ADDRESS,
                'fee-fixed-usd': '0',
                'fee-percentage': '0',
                'gas-token-address': TOKEN_ADDRESS,
                'chain-id': 5,
                'sender-safe-address': SENDER_SAFE_ADDRESS,
                'payee-address': '0xeBCC5516d44FFf5E9aBa2AcaeB65BbB49bC3EBe1',
                'pay-at': addMinutes(subDays(now, 20), 120).toISOString(),
                amount: '10000000',
              },
            },
          },
        },
      },
      {
        id: '3',
        type: 'scheduled-payment-attempts',
        attributes: {
          'ended-at': addMinutes(subDays(now, 60), 120).toISOString(),
          'failure-reason': '',
          'started-at': subDays(now, 60).toISOString(),
          status: 'succeeded',
          'transaction-hash':
            '0x6f7c54719c0901e30ef018206c37df4daa059224549a08d55acb3360f01094e2',
        },
        relationships: {
          'scheduled-payment': {
            data: {
              id: '34234',
              type: 'scheduled-payments',
              attributes: {
                'token-address': '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
                'fee-fixed-usd': '0',
                'fee-percentage': '0',
                'gas-token-address':
                  '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
                'chain-id': 5,
                'sender-safe-address': '0x0',
                'payee-address': '0xeBCC5516d44FFf5E9aBa2AcaeB65BbB49bC3EBe1',
                'pay-at': addMinutes(subDays(now, 60), 120).toISOString(),
                amount: '15000000',
              },
            },
          },
        },
      },
    ]
      .filter((r) =>
        startedAt ? new Date(r.attributes['started-at']) >= startedAt : true
      )
      .filter((r) => (status ? r.attributes.status === status : true));
  }
}

module('Integration | Component | payment-transactions-list', function (hooks) {
  setupRenderingTest(hooks);

  let mockServiceWorker: SetupWorkerApi;
  hooks.beforeEach(function (this: TestContext) {
    this.owner.register('service:wallet', WalletServiceStub);
    this.owner.register(
      'service:hub-authentication',
      HubAuthenticationServiceStub
    );
    this.owner.register('service:safes', SafesServiceStub);
    const tokenService = this.owner.lookup('service:tokens');
    tokenService.stubTransactionTokens([token]);
    tokenService.stubGasTokens([token]);

    const handlers = [
      rest.get('/hub-test/api/scheduled-payment-attempts', (_req, res, ctx) => {
        return res(
          ctx.status(200),
          ctx.json({
            data: fetchScheduledPaymentAttempts(),
            included: fetchScheduledPaymentAttempts().map(
              (attempts) => attempts.relationships['scheduled-payment'].data
            ),
          })
        );
      }),
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
  });

  hooks.afterEach(function () {
    returnEmptyScheduledPaymentAttempts = false;
    returnScheduledPaymentAttemptsWithBlankTxHash = false;
    returnScheduledPaymentAttemptsOfCanceledScheduledPayment = false;
    status = undefined;
    startedAt = subDays(now, 30);

    mockServiceWorker.stop();
  });

  test('It renders transactions', async function (assert) {
    await render(hbs`
      <PaymentTransactionsList />
    `);

    assert.dom('[data-test-scheduled-payment-attempts]').exists();
    await waitFor('[data-test-scheduled-payment-attempts-item]');

    assert
      .dom('[data-test-scheduled-payment-attempts-item]')
      .exists({ count: 2 });

    assert
      .dom(
        '[data-test-scheduled-payment-attempts-item="0"] [data-test-scheduled-payment-attempts-item-time]'
      )
      .hasText(format(now, 'HH:mm:ss'));

    assert
      .dom(
        '[data-test-scheduled-payment-attempts-item="0"] [data-test-scheduled-payment-attempts-item-date]'
      )
      .hasText(format(subDays(now, 10), 'dd/MM/yyyy'));

    assert
      .dom(
        '[data-test-scheduled-payment-attempts-item="0"] [data-test-scheduled-payment-attempts-item-payee]'
      )
      .hasText('0xeBCC5516d44FFf5E9aBa2AcaeB65BbB49bC3EBe1');

    assert
      .dom(
        '[data-test-scheduled-payment-attempts-item="0"] [data-test-scheduled-payment-attempts-item-amount]'
      )
      .hasText('10.0 USDC');

    assert
      .dom(
        '[data-test-scheduled-payment-attempts-item="0"] [data-test-scheduled-payment-attempts-item-status]'
      )
      .includesText('Confirmed');

    assert
      .dom(
        '[data-test-scheduled-payment-attempts-item="1"] [data-test-scheduled-payment-attempts-item-status]'
      )
      .includesText('Failed (insufficient funds to execute the payment)');

    assert
      .dom(
        '[data-test-scheduled-payment-attempts-item="0"] [data-test-scheduled-payment-attempts-item-explorer-button]'
      )
      .hasText('View on Etherscan')
      .hasAttribute(
        'href',
        'https://etherscan.io/tx/0x6f7c54719c0901e30ef018206c37df4daa059224549a08d55acb3360f01094e2'
      );
  });

  test('it can filter by status', async function (assert) {
    this.set('wallet', { isConnected: true });

    await render(hbs`
      <PaymentTransactionsList />
    `);
    await waitFor('[data-test-scheduled-payment-attempts-item]');
    assert
      .dom('[data-test-scheduled-payment-attempts-item]')
      .exists({ count: 2 });
    assert
      .dom('[data-test-scheduled-payment-status-filter]')
      .containsText('Status: All');

    await click('[data-test-scheduled-payment-status-filter]');
    assert.dom('.boxel-menu').containsText('All Succeeded Failed In Progress');
    status = 'failed';
    await click('[data-test-boxel-menu-item-text="Failed"]');
    await waitFor('[data-test-scheduled-payment-attempts-item]');
    assert
      .dom('[data-test-scheduled-payment-attempts-item]')
      .exists({ count: 1 });
    assert
      .dom(
        '[data-test-scheduled-payment-attempts-item="0"] [data-test-scheduled-payment-attempts-item-status]'
      )
      .includesText('Failed (insufficient funds to execute the payment)');

    await click('[data-test-scheduled-payment-status-filter]');
    status = 'succeeded';
    await click('[data-test-boxel-menu-item-text="Succeeded"]');
    await waitFor('[data-test-scheduled-payment-attempts-item]');
    assert
      .dom('[data-test-scheduled-payment-attempts-item]')
      .exists({ count: 1 });
    assert
      .dom(
        '[data-test-scheduled-payment-attempts-item="0"] [data-test-scheduled-payment-attempts-item-status]'
      )
      .includesText('Confirmed');

    await click('[data-test-scheduled-payment-status-filter]');
    status = undefined;
    await click('[data-test-boxel-menu-item-text="All"]');
    await waitFor('[data-test-scheduled-payment-attempts-item]');
    assert
      .dom('[data-test-scheduled-payment-attempts-item]')
      .exists({ count: 2 });
  });

  test('it can filter by date', async function (assert) {
    this.set('wallet', { isConnected: true });

    await render(hbs`
      <PaymentTransactionsList />
    `);
    await waitFor('[data-test-scheduled-payment-attempts-item]');
    assert
      .dom('[data-test-scheduled-payment-attempts-item]')
      .exists({ count: 2 });
    assert
      .dom('[data-test-scheduled-payment-date-filter]')
      .containsText('Date: Last 30 days');

    await click('[data-test-scheduled-payment-date-filter]');
    assert
      .dom('.boxel-menu')
      .containsText('Last 30 days Last 90 days Last 120 days');
    startedAt = subDays(now, 90);
    await click('[data-test-boxel-menu-item-text="Last 90 days"]');
    await waitFor('[data-test-scheduled-payment-attempts-item]');
    assert
      .dom('[data-test-scheduled-payment-attempts-item]')
      .exists({ count: 3 });

    await click('[data-test-scheduled-payment-date-filter]');
    startedAt = subDays(now, 120);
    await click('[data-test-boxel-menu-item-text="Last 120 days"]');
    await waitFor('[data-test-scheduled-payment-attempts-item]');
    assert
      .dom('[data-test-scheduled-payment-attempts-item]')
      .exists({ count: 3 });
  });

  test('It adds explanation when there are no payment attempts', async function (assert) {
    returnEmptyScheduledPaymentAttempts = true;

    await render(hbs`
      <PaymentTransactionsList />
    `);
    await waitFor('[data-test-scheduled-payment-attempts-empty]');
    assert
      .dom('[data-test-scheduled-payment-attempts-empty]')
      .hasText('No payments found.');
  });

  test('It disables block-explorer-button if tx hash is blank', async function (assert) {
    returnScheduledPaymentAttemptsWithBlankTxHash = true;

    await render(hbs`
      <PaymentTransactionsList />
    `);
    await waitFor('[data-test-scheduled-payment-attempts-item]');
    assert.strictEqual(
      document.querySelectorAll(`.boxel-button--with-tooltip`).length,
      1
    );
  });

  test('It displays the latest attempts of canceled scheduled payment', async function (assert) {
    returnScheduledPaymentAttemptsOfCanceledScheduledPayment = true;

    await render(hbs`
      <PaymentTransactionsList />
    `);
    await waitFor('[data-test-scheduled-payment-attempts-item]');
    assert
      .dom('[data-test-scheduled-payment-attempts-item]')
      .exists({ count: 1 });
  });
});
