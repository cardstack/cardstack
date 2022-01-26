import { module, test } from 'qunit';
import { setupRenderingTest } from 'ember-qunit';
import { click, render, settled, waitFor } from '@ember/test-helpers';
import hbs from 'htmlbars-inline-precompile';
import sinon from 'sinon';
import HubAuthentication from '@cardstack/web-client/services/hub-authentication';
import Layer2TestWeb3Strategy from '@cardstack/web-client/utils/web3-strategies/test-layer2';
import { setupMirage } from 'ember-cli-mirage/test-support';
import { MirageTestContext } from 'ember-cli-mirage/test-support';
import RSVP from 'rsvp';
import Service from '@ember/service';

const FAILURE_MESSAGE = 'Authentication failed or was canceled.';

interface Context extends MirageTestContext {
  isComplete: boolean;
}

class AuthServiceStub extends Service {
  isAuthenticated = true;
}

module(
  'Integration | Component | card-pay/hub-authentication',
  function (hooks) {
    let hubAuthentication: HubAuthentication;
    let layer2Service: Layer2TestWeb3Strategy;

    setupRenderingTest(hooks);
    setupMirage(hooks);

    module('Initialized unauthenticated', function (hooks) {
      hooks.beforeEach(async function (this: Context) {
        hubAuthentication = this.owner.lookup('service:hub-authentication');
        layer2Service = this.owner.lookup('service:layer2-network').strategy;

        this.setProperties({
          onComplete: () => {
            this.set('isComplete', true);
          },
          onIncomplete: () => {},
          isComplete: false,
          frozen: false,
        });

        await render(hbs`
      <CardPay::HubAuthentication
        @onComplete={{this.onComplete}}
        @isComplete={{this.isComplete}}
        @onIncomplete={{this.onIncomplete}}
        @frozen={{this.frozen}}
      />
    `);
      });

      test('it disables the chin button when card is frozen', async function (assert) {
        assert.dom('[data-test-authentication-button]').isNotDisabled();
        this.set('frozen', true);
        assert.dom('[data-test-authentication-button]').isDisabled();
      });

      module('Test the sdk hub authentication calls', function () {
        test('It shows the failure message if the signing request fails or is rejected', async function (assert) {
          let deferred = RSVP.defer<void>();
          sinon
            .stub(hubAuthentication, 'ensureAuthenticated')
            .returns(deferred.promise);

          await click('[data-test-authentication-button]');
          assert
            .dom('[data-test-boxel-action-chin]')
            .containsText(
              'You will receive a confirmation request from the Card Wallet app in a few moments'
            );

          deferred.reject(new Error('User rejected request'));

          await waitFor('[data-test-failed]');

          assert.dom('[data-test-failed]').containsText(FAILURE_MESSAGE);
        });

        test('It attempts to re-authenticate when Try Again button is pressed', async function (assert) {
          let deferred = RSVP.defer<void>();
          let stub = sinon
            .stub(hubAuthentication, 'ensureAuthenticated')
            .returns(deferred.promise);

          await click('[data-test-authentication-button]');

          deferred.reject(new Error('User rejected request'));

          await waitFor('[data-test-failed]');

          stub.restore();

          await click('[data-test-authentication-retry-button]');

          assert
            .dom('[data-test-boxel-action-chin]')
            .containsText(
              'You will receive a confirmation request from the Card Wallet app in a few moments'
            );

          layer2Service.test__simulateHubAuthentication('some-auth-token');
          await settled();

          assert
            .dom('[data-test-boxel-action-chin]')
            .containsText('Authenticated with Hub');
        });

        test('It shows the successful state if authentication succeeds', async function (assert) {
          let deferred = RSVP.defer<void>();
          sinon
            .stub(hubAuthentication, 'ensureAuthenticated')
            .returns(deferred.promise);

          await click('[data-test-authentication-button]');
          assert
            .dom('[data-test-boxel-action-chin]')
            .containsText(
              'You will receive a confirmation request from the Card Wallet app in a few moments'
            );
          hubAuthentication.authToken = 'some-auth-token';
          hubAuthentication.isAuthenticated = true;
          deferred.resolve();
          await settled();
          assert
            .dom('[data-test-boxel-action-chin]')
            .containsText('Authenticated with Hub');
        });
      });

      test('It shows a message on timeout', async function (assert) {
        let deferred = RSVP.defer<void>();
        sinon
          .stub(hubAuthentication, 'ensureAuthenticated')
          .returns(deferred.promise);

        await click('[data-test-authentication-button]');

        await waitFor('[data-test-failed]');

        assert
          .dom('[data-test-failed]')
          .containsText(
            "Authentication with Card Wallet timed out. If you didn't receive a confirmation request on your device, try again, or contact Cardstack support"
          );
      });
    });

    module('Initialized authenticated', function () {
      test('It shows authenticated state', async function (assert) {
        this.owner.register('service:hub-authentication', AuthServiceStub);
        this.setProperties({
          onComplete: () => {
            this.set('isComplete', true);
          },
          onIncomplete: () => {},
          isComplete: false,
          frozen: false,
        });

        await render(hbs`
          <CardPay::HubAuthentication
            @onComplete={{this.onComplete}}
            @isComplete={{this.isComplete}}
            @onIncomplete={{this.onIncomplete}}
            @frozen={{this.frozen}}
          />
        `);
        assert
          .dom('[data-test-memorialized]')
          .containsText('Authenticated with Hub');
      });
    });
  }
);
