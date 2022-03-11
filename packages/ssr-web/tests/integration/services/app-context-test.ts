import { AppContextService } from '@cardstack/ssr-web/services/app-context';
import { module, test } from 'qunit';
import Service from '@ember/service';
import { setupApplicationTest } from 'ember-qunit';
import config from '@cardstack/ssr-web/config/environment';
import window from 'ember-window-mock';
import { setupWindowMock } from 'ember-window-mock/test-support';

module('Integration | Service | app-context', function (hooks) {
  setupApplicationTest(hooks);
  setupWindowMock(hooks);

  let originalValue = config.cardSpaceHostnameSuffix;
  hooks.before(function () {
    config.cardSpaceHostnameSuffix = '.test.time.value';
  });
  hooks.after(function () {
    config.cardSpaceHostnameSuffix = originalValue;
  });

  let fastboot: {
    isFastBoot: boolean;
    request: {
      host: string;
      headers: object;
    };
  };
  let appContext: AppContextService;

  module('fastboot', function (hooks) {
    hooks.beforeEach(function () {
      class MockFastboot extends Service {
        isFastBoot = true;
        request = {
          host: '',
        };
      }
      this.owner.register('service:fastboot', MockFastboot);
      fastboot = this.owner.lookup('service:fastboot');
      appContext = this.owner.lookup('service:app-context');
    });

    test('it can match the card space suffix to determine the app', function (assert) {
      fastboot.request.host = `hello${config.cardSpaceHostnameSuffix}`;
      assert.equal(appContext.currentApp, 'card-space');

      fastboot.request.host = 'hello.localhost:4210';
      assert.equal(appContext.currentApp, 'wallet');
    });

    test('it can match the card space suffix and return a user id', function (assert) {
      fastboot.request.host = `oops${config.cardSpaceHostnameSuffix}`;
      assert.equal(appContext.cardSpaceId, 'oops');

      fastboot.request.host = `oops${config.cardSpaceHostnameSuffix}.should-appear-at-end${config.cardSpaceHostnameSuffix}`;
      assert.equal(
        appContext.cardSpaceId,
        `oops${config.cardSpaceHostnameSuffix}.should-appear-at-end`
      );

      fastboot.request.host = `oops.two${config.cardSpaceHostnameSuffix}`;
      assert.equal(appContext.cardSpaceId, 'oops.two');

      fastboot.request.host = 'oops.wallet';
      assert.equal(appContext.cardSpaceId, '');
    });

    test('it can detect the ELB health checker', function (assert) {
      fastboot.request.headers = {
        'user-agent': 'ELB-HealthChecker/2.0',
      };

      assert.ok(appContext.isELBHealthChecker);
    });
  });

  module('browser', function (hooks) {
    hooks.beforeEach(function () {
      class MockFastboot extends Service {
        isFastBoot = false;
        request = {
          host: '',
        };
      }
      this.owner.register('service:fastboot', MockFastboot);
      appContext = this.owner.lookup('service:app-context');
    });

    test('it can match the card space suffix to determine the app', function (assert) {
      window.location.host = `hello${config.cardSpaceHostnameSuffix}`;
      assert.equal(appContext.currentApp, 'card-space');

      window.location.host = 'hello.localhost:4210';
      assert.equal(appContext.currentApp, 'wallet');
    });

    test('it can match the card space suffix and return a user id', function (assert) {
      window.location.host = `oops${config.cardSpaceHostnameSuffix}`;
      assert.equal(appContext.cardSpaceId, 'oops');

      window.location.host = `oops${config.cardSpaceHostnameSuffix}.should-appear-at-end${config.cardSpaceHostnameSuffix}`;
      assert.equal(
        appContext.cardSpaceId,
        `oops${config.cardSpaceHostnameSuffix}.should-appear-at-end`
      );

      window.location.host = 'oops.wallet';
      assert.equal(appContext.cardSpaceId, '');
    });
  });
});
