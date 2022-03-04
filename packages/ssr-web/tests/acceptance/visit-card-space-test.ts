import { module, test } from 'qunit';
import { setupApplicationTest } from 'ember-qunit';
import { click, currentURL, visit } from '@ember/test-helpers';
import { MirageTestContext, setupMirage } from 'ember-cli-mirage/test-support';
import AppContext from '@cardstack/ssr-web/services/app-context';
import percySnapshot from '@percy/ember';
import type { SubgraphServiceOptionals } from '@cardstack/ssr-web/services/subgraph';
import { generateMerchantPaymentUrl } from '@cardstack/cardpay-sdk';
import config from '@cardstack/ssr-web/config/environment';
import Service from '@ember/service';

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
    return 'card-space' as 'card-space';
  }

  get cardSpaceId() {
    return 'slug';
  }
}

module('Acceptance | visit card space', function (hooks) {
  setupApplicationTest(hooks);
  setupMirage(hooks);

  hooks.beforeEach(function () {
    this.owner.register('service:subgraph', MockSubgraph);
    this.owner.register('service:app-context', MockAppContext);
  });

  module('render', function (hooks) {
    let link: string;
    let deepLink: string;
    hooks.beforeEach(function (this: MirageTestContext) {
      let cardSpace = this.server.create('card-space', {
        slug: 'slug',
      });

      cardSpace.createMerchantInfo({ name: 'merchant name', slug: 'slug' });

      link = generateMerchantPaymentUrl({
        domain: config.universalLinkDomain,
        merchantSafeID: '0x1234',
        network: config.chains.layer2,
      });
      deepLink = generateMerchantPaymentUrl({
        merchantSafeID: '0x1234',
        network: config.chains.layer2,
      });
    });

    test('renders a user’s card space', async function (assert) {
      await visit('/');

      assert.dom('[data-test-merchant-name]').hasText('merchant name');
      assert.dom('[data-test-merchant-text]').hasText('slug');
      assert
        .dom('[data-test-boxel-styled-qr-code]')
        .hasAttribute('data-test-boxel-styled-qr-code', link);
      assert.dom('[data-test-payment-link-url]').containsText(link);
      await percySnapshot(assert);
    });

    test('renders a user’s card space on iOS', async function (assert) {
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

      assert.dom('[data-test-merchant-name]').hasText('merchant name');
      assert.dom('[data-test-merchant-text]').hasText('slug');

      assert.dom('[data-test-boxel-styled-qr-code]').doesNotExist();
      assert.dom('[data-test-payment-link-url]').containsText(deepLink);
      assert
        .dom('[data-test-payment-link-deep-link]')
        .hasAttribute('href', deepLink);

      await click('[data-test-payment-link-link-view-toggle]');

      assert.dom('[data-test-payment-link-deep-link]').doesNotExist();
      assert
        .dom('[data-test-boxel-styled-qr-code]')
        .hasAttribute('data-test-boxel-styled-qr-code', link);
      assert.dom('[data-test-payment-link-url]').containsText(link);
      await percySnapshot(assert);
    });

    test('renders a user’s card space on Android', async function (assert) {
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

      assert.dom('[data-test-merchant-name]').hasText('merchant name');
      assert.dom('[data-test-merchant-text]').hasText('slug');

      assert.dom('[data-test-boxel-styled-qr-code]').doesNotExist();
      assert.dom('[data-test-payment-link-url]').containsText(deepLink);
      assert
        .dom('[data-test-payment-link-deep-link]')
        .hasAttribute('href', deepLink);

      await click('[data-test-payment-link-link-view-toggle]');

      assert.dom('[data-test-payment-link-deep-link]').doesNotExist();
      assert
        .dom('[data-test-boxel-styled-qr-code]')
        .hasAttribute('data-test-boxel-styled-qr-code', link);
      assert.dom('[data-test-payment-link-url]').containsText(link);
      await percySnapshot(assert);
    });
  });

  test('renders an error for a missing slug', async function (this: MirageTestContext, assert) {
    await visit('/');

    assert
      .dom('[data-test-error]')
      .includesText('404: Card Space not found for slug');
  });

  test('redirects from wallet links', async function (this: MirageTestContext, assert) {
    let cardSpace = this.server.create('card-space', {
      slug: 'slug',
    });

    cardSpace.createMerchantInfo({ name: 'merchant name' });

    await visit('/pay/xdai/0xf9c0E2B59824f33656CC5A94423FcF62892dad60');

    assert.equal(currentURL(), '/');
    assert.dom('[data-test-merchant-name]').hasText('merchant name');
  });

  test('redirects from other links', async function (this: MirageTestContext, assert) {
    let cardSpace = this.server.create('card-space', {
      slug: 'slug',
    });

    cardSpace.createMerchantInfo({ name: 'merchant name' });

    await visit('/nothing/nowhere');

    assert.equal(currentURL(), '/');
    assert.dom('[data-test-merchant-name]').hasText('merchant name');
  });
});
