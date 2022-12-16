import { click, visit } from '@ember/test-helpers';
import { setupWorker, rest } from 'msw';
import { module, test } from 'qunit';

import { setupApplicationTest } from '../helpers';
import { exampleGasTokens } from '../support/tokens';
import { fillInSchedulePaymentFormWithValidInfo } from '../support/ui-test-helpers';

const FAKE_WALLET_CONNECT_ACCOUNT =
  '0x57b8a319bea4438092eeb4e27d9048dbb844e234';

module('Acceptance | scheduling', function (hooks) {
  setupApplicationTest(hooks);

  module('one-time', function () {
    // test: does not schedule if invalid

    test('schedules if valid', async function (assert) {
      const handlers = [
        rest.get('/hub-test/api/session', (_req, res, ctx) => {
          return res(
            ctx.status(200),
            ctx.json({
              data: {
                attributes: { user: FAKE_WALLET_CONNECT_ACCOUNT },
              },
            })
          );
        }),
      ];
      const worker = setupWorker(...handlers);
      worker.start({
        onUnhandledRequest(req, { warning }) {
          if (req.url.href.match(/trust-wallet.com|relay|\.png|\.svg/)) {
            return;
          }
          warning();
        },
      });
      window.TEST__AUTH_TOKEN = 'abc123';

      this.mockWalletConnect.mockConnectedWallet([FAKE_WALLET_CONNECT_ACCOUNT]);
      this.mockWalletConnect.mockAccountsChanged([FAKE_WALLET_CONNECT_ACCOUNT]);

      // TODO: setup to already have a safe

      const tokensService = this.owner.lookup('service:tokens');
      tokensService.stubGasTokens(exampleGasTokens);

      await visit('/schedule');
      // await click('.connect-button__button');
      // await click('[data-test-wallet-option="metamask"]');
      // await click('[data-test-mainnet-connect-button]');

      await fillInSchedulePaymentFormWithValidInfo();

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
