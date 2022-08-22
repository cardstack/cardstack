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

  let originalValue = config.profileHostnameSuffix;
  hooks.before(function () {
    config.profileHostnameSuffix = '.test.time.value';
  });
  hooks.after(function () {
    config.profileHostnameSuffix = originalValue;
  });

  let fastboot: {
    isFastBoot: boolean;
    request: {
      host: string;
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

    test('it can match the profile suffix to determine the app', function (assert) {
      fastboot.request.host = `hello${config.profileHostnameSuffix}`;
      assert.strictEqual(appContext.currentApp, 'profile');

      fastboot.request.host = 'hello.localhost:4210';
      assert.strictEqual(appContext.currentApp, 'wallet');
    });

    test('it can match the profile suffix and return a user id', function (assert) {
      fastboot.request.host = `oops${config.profileHostnameSuffix}`;
      assert.strictEqual(appContext.profileId, 'oops');

      fastboot.request.host = `oops${config.profileHostnameSuffix}.should-appear-at-end${config.profileHostnameSuffix}`;
      assert.strictEqual(
        appContext.profileId,
        `oops${config.profileHostnameSuffix}.should-appear-at-end`
      );

      fastboot.request.host = `oops.two${config.profileHostnameSuffix}`;
      assert.strictEqual(appContext.profileId, 'oops.two');

      fastboot.request.host = 'oops.wallet';
      assert.strictEqual(appContext.profileId, '');
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

    test('it can match the profile suffix to determine the app', function (assert) {
      window.location.host = `hello${config.profileHostnameSuffix}`;
      assert.strictEqual(appContext.currentApp, 'profile');

      window.location.host = 'hello.localhost:4210';
      assert.strictEqual(appContext.currentApp, 'wallet');
    });

    test('it can match the profile suffix and return a user id', function (assert) {
      window.location.host = `oops${config.profileHostnameSuffix}`;
      assert.strictEqual(appContext.profileId, 'oops');

      window.location.host = `oops${config.profileHostnameSuffix}.should-appear-at-end${config.profileHostnameSuffix}`;
      assert.strictEqual(
        appContext.profileId,
        `oops${config.profileHostnameSuffix}.should-appear-at-end`
      );

      window.location.host = 'oops.wallet';
      assert.strictEqual(appContext.profileId, '');
    });
  });
});
