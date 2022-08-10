import { module, test } from 'qunit';
import { setupApplicationTest } from 'ember-qunit';
import { currentURL, visit } from '@ember/test-helpers';
import AppContext from '@cardstack/ssr-web/services/app-context';
import percySnapshot from '@percy/ember';
import { MirageTestContext, setupMirage } from 'ember-cli-mirage/test-support';

module('Acceptance | wc', function (hooks) {
  setupApplicationTest(hooks);
  setupMirage(hooks);

  // eslint-disable-next-line qunit/require-expect
  test('it can render a wc page', async function (assert) {
    class WalletAppContext extends AppContext {
      get currentApp(): 'wallet' {
        return 'wallet';
      }
    }
    this.owner.register('service:app-context', WalletAppContext);

    await visit('/wc');

    assert
      .dom('[data-test-wc-message]')
      .containsText(
        "Looks like you're trying to connect with WalletConnect, but we couldn't find Cardstack Wallet on this device. Install the app using the links above, or switch to a device with Cardstack Wallet, then retry connecting."
      );

    await percySnapshot(assert);
  });

  test('it can redirect to the root if the wc route is accessed on a Card Space', async function (this: MirageTestContext, assert) {
    let profile = this.server.create('profile', {
      slug: 'slug',
    });
    profile.createMerchantInfo({ name: 'merchant name' });
    class CardSpaceContext extends AppContext {
      get currentApp(): 'profile' {
        return 'profile';
      }

      get profileId(): string {
        return 'slug';
      }
    }
    this.owner.register('service:app-context', CardSpaceContext);

    await visit('/wc');

    assert.dom('[data-test-wc-message]').doesNotExist();

    assert.strictEqual(currentURL(), '/');
  });
});
