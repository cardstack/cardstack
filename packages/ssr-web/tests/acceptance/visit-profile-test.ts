import { module, test } from 'qunit';
import { setupApplicationTest } from 'ember-qunit';
import { currentURL, visit } from '@ember/test-helpers';
import { MirageTestContext, setupMirage } from 'ember-cli-mirage/test-support';
import AppContext from '@cardstack/ssr-web/services/app-context';
import TestLayer2Web3Strategy from '@cardstack/ssr-web/utils/web3-strategies/test-layer2';
import percySnapshot from '@percy/ember';
import type { SubgraphServiceOptionals } from '@cardstack/ssr-web/services/subgraph';
import { generateMerchantPaymentUrl } from '@cardstack/cardpay-sdk';
import config from '@cardstack/ssr-web/config/environment';
import Service from '@ember/service';
import sinon from 'sinon';

let HUB_AUTH_TOKEN = 'HUB_AUTH_TOKEN';
let layer2AccountAddress = '0x182619c6Ea074C053eF3f1e1eF81Ec8De6Eb6E44';
let otherLayer2AccountAddress = '0x1000000000000000000000000000000000000000';
let layer2Service: TestLayer2Web3Strategy;

class MockSubgraph extends Service implements SubgraphServiceOptionals {
  async query(
    _network: any,
    _graphqlQuery: string,
    _variables: any
  ): Promise<{ data: any }> {
    return {
      data: {
        merchantSafes: [
          {
            id: '0x1234',
          },
        ],
      },
    };
  }
}

class MockAppContext extends AppContext {
  get currentApp() {
    return 'profile' as 'profile';
  }

  get profileId() {
    return 'slug';
  }

  // TODO remove when auth button is shown for all
  get searchParams() {
    const searchParams = new URLSearchParams();
    searchParams.set('edit', 'true');
    return searchParams;
  }
}

module('Acceptance | visit profile', function (hooks) {
  setupApplicationTest(hooks);
  setupMirage(hooks);

  hooks.beforeEach(function () {
    this.owner.register('service:subgraph', MockSubgraph);
    this.owner.register('service:app-context', MockAppContext);
  });

  module('render', function (hooks) {
    let link: string;
    hooks.beforeEach(function (this: MirageTestContext) {
      this.server.create('profile', {
        name: 'profile name',
        slug: 'slug',
        color: 'blue',
        textColor: 'hotpink',
        ownerAddress: layer2AccountAddress,
      });

      link = generateMerchantPaymentUrl({
        domain: config.universalLinkDomain,
        merchantSafeID: '0x1234',
        network: config.chains.layer2,
      });
    });

    // eslint-disable-next-line qunit/require-expect
    test('renders a user’s profile', async function (assert) {
      await visit('/');

      assert.dom('[data-test-profile-name]').hasText('profile name');
      assert.dom('[data-test-profile-url]').includesText('slug');
      assert
        .dom('[data-test-boxel-styled-qr-code]')
        .hasAttribute('data-test-boxel-styled-qr-code', link);
      assert.dom('[data-test-payment-link-deep-link]').doesNotExist();

      assert
        .dom(`meta[property='og:title']`, document.documentElement)
        .hasAttribute('content', 'profile name’s Profile');

      assert
        .dom(`meta[name='twitter:title']`, document.documentElement)
        .hasAttribute('content', 'profile name’s Profile');

      assert
        .dom(`meta[property='og:description']`, document.documentElement)
        .hasAttribute('content', 'Visit profile name’s profile on card.xyz');

      assert
        .dom(`meta[name='twitter:description']`, document.documentElement)
        .hasAttribute('content', 'Visit profile name’s profile on card.xyz');

      assert
        .dom(
          `meta[property='og:url'][content$='slug${config.profileHostnameSuffix}']`,
          document.documentElement
        )
        .exists();

      assert
        .dom(
          `meta[name='twitter:url'][content$='slug${config.profileHostnameSuffix}']`,
          document.documentElement
        )
        .exists();

      assert
        .dom('[data-test-connect-button]')
        .exists('expected a connect button when not authenticated');

      await percySnapshot(assert);
    });

    // eslint-disable-next-line qunit/require-expect
    test('renders a user’s profile on iOS', async function (assert) {
      this.owner.register(
        'service:ua',
        class UA extends Service {
          isIOS() {
            return true;
          }
          isAndroid() {
            return false;
          }
        }
      );
      await visit('/');

      assert.dom('[data-test-profile-name]').hasText('profile name');
      assert.dom('[data-test-profile-url]').containsText('slug');

      assert.dom('[data-test-boxel-styled-qr-code]').exists();

      assert
        .dom('[data-test-payment-link-deep-link]')
        .hasAttribute('href', link);

      await percySnapshot(assert);
    });

    // eslint-disable-next-line qunit/require-expect
    test('renders a user’s profile on Android', async function (assert) {
      this.owner.register(
        'service:ua',
        class UA extends Service {
          isIOS() {
            return false;
          }
          isAndroid() {
            return true;
          }
        }
      );
      await visit('/');

      assert.dom('[data-test-profile-name]').hasText('profile name');
      assert.dom('[data-test-profile-url]').containsText('slug');

      assert.dom('[data-test-boxel-styled-qr-code]').exists();

      assert
        .dom('[data-test-payment-link-deep-link]')
        .hasAttribute('href', link);

      await percySnapshot(assert);
    });

    test('it shows an error when subgraph fetch fails', async function (this: MirageTestContext, assert) {
      let subgraphService = this.owner.lookup('service:subgraph');
      sinon
        .stub(subgraphService, 'query')
        .throws(new Error('Subgraph failure'));
      await visit('/');

      assert
        .dom('[data-test-address-fetching-error]')
        .includesText(
          'We ran into an issue while generating the payment request link'
        );
    });

    test('it shows an error when subgraph fetch does not return a merchant safe', async function (this: MirageTestContext, assert) {
      let subgraphService = this.owner.lookup('service:subgraph');
      sinon
        .stub(subgraphService, 'query')
        .returns(Promise.resolve({ data: { merchantSafes: [] } }));

      await visit('/');

      assert
        .dom('[data-test-address-fetching-error]')
        .includesText(
          'We ran into an issue while generating the payment request link'
        );
    });

    module(
      'authed for this profile',
      function (this: MirageTestContext, hooks) {
        hooks.beforeEach(async function (this: MirageTestContext) {
          // this is the condition for initializing with an authenticated state
          // assumption made that layer2Service.checkHubAuthenticationValid returns Promise<true>
          window.TEST__AUTH_TOKEN = HUB_AUTH_TOKEN;
          layer2Service = this.owner.lookup('service:layer2-network').strategy;
          await layer2Service.test__simulateAccountsChanged([
            layer2AccountAddress,
          ]);
        });

        hooks.afterEach(async function () {
          delete window.TEST__AUTH_TOKEN;
        });

        test('it shows when auth is present', async function (assert) {
          await visit('/');

          assert.dom('[data-test-connect-button]').doesNotExist();
          assert.dom('[data-test-auth-for-this-profile]').exists();
        });
      }
    );

    module('authed but not owner', function (this: MirageTestContext, hooks) {
      hooks.beforeEach(async function (this: MirageTestContext) {
        window.TEST__AUTH_TOKEN = HUB_AUTH_TOKEN;
        layer2Service = this.owner.lookup('service:layer2-network').strategy;
        await layer2Service.test__simulateAccountsChanged([
          otherLayer2AccountAddress,
        ]);
      });

      hooks.afterEach(async function () {
        delete window.TEST__AUTH_TOKEN;
      });

      test('it shows when auth is present', async function (assert) {
        await visit('/');

        assert.dom('[data-test-connect-button]').doesNotExist();
        assert.dom('[data-test-auth-not-for-this-profile]').exists();
      });
    });
  });

  test('renders an error for a missing slug', async function (this: MirageTestContext, assert) {
    await visit('/');

    assert
      .dom('[data-test-profile-not-found]')
      .includesText("We couldn't find the profile you're looking for");
  });

  test('redirects from wallet links', async function (this: MirageTestContext, assert) {
    this.server.create('profile', {
      name: 'profile name',
      slug: 'slug',
    });

    await visit('/pay/xdai/0xf9c0E2B59824f33656CC5A94423FcF62892dad60');

    assert.strictEqual(currentURL(), '/');
    assert.dom('[data-test-profile-name]').hasText('profile name');
  });

  test('redirects from other links', async function (this: MirageTestContext, assert) {
    this.server.create('profile', {
      name: 'profile name',
      slug: 'slug',
    });

    await visit('/nothing/nowhere');

    assert.strictEqual(currentURL(), '/');
    assert.dom('[data-test-profile-name]').hasText('profile name');
  });
});
