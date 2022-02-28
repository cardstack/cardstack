import { module, test } from 'qunit';
import { setupRenderingTest } from 'ember-qunit';
import { click, render } from '@ember/test-helpers';
import hbs from 'htmlbars-inline-precompile';
import { PaymentLinkMode } from '@cardstack/ssr-web/components/common/payment-link';

const URL = '[data-test-payment-link-url]';
const LINK = '[data-test-payment-link-deep-link]';
const QR = '[data-test-styled-qr-code]';
const TOGGLE = '[data-test-payment-link-link-view-toggle]';

// no clear way to assert that this is included in qr
// so you will have to pause tests to see
const imageDataUri =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABQAAAAUCAYAAACNiR0NAAAAH0lEQVR42mNkYPhfz0BFwDhq4KiBowaOGjhq4Eg1EAAROx3tVhgyzAAAAABJRU5ErkJggg==';
const link =
  'https://pay.cardstack.com/merchat-asdnsadkasd?id=0x1238urfds&amount=73298587423545';
const deepLink =
  'https://deep-link-pay.cardstack.com/merchat-asdnsadkasd?id=0x1238urfds&amount=73298587423545';

module('Integration | Component | common/payment-link', function (hooks) {
  setupRenderingTest(hooks);
  hooks.beforeEach(async function () {
    this.setProperties({
      mode: 'qr',
      switchMode: (mode: PaymentLinkMode) => {
        this.set('mode', mode);
      },
      image: imageDataUri,
      paymentURL: link,
      deepLinkPaymentURL: deepLink,
    });

    await render(hbs`
      <Common::PaymentLink
        @mode={{this.mode}}
        @switchMode={{this.switchMode}}
        @image={{this.image}}
        @paymentURL={{this.paymentURL}}
        @deepLinkPaymentURL={{this.deepLinkPaymentURL}}
        @cta={{this.cta}}
      />
    `);
  });

  test('it can render the non-mobile state', async function (assert) {
    this.set('mode', 'qr-non-mobile');
    assert.dom(QR).hasAttribute('data-test-styled-qr-code', link);
    assert.dom(URL).containsText(link);
    assert.dom(TOGGLE).doesNotExist();
    assert.dom(LINK).doesNotExist();
  });
  test('it can render the mobile state', async function (assert) {
    this.set('mode', 'link');
    assert.dom(QR).doesNotExist();
    assert.dom(URL).containsText(deepLink);
    assert.dom(TOGGLE).isEnabled().containsText('Show as QR Code');
    assert
      .dom(LINK)
      .hasAttribute('href', deepLink)
      .containsText('Pay Business');
  });
  test('it allows toggling to qr and back in the mobile state', async function (assert) {
    this.set('mode', 'link');
    await click(TOGGLE);
    // eslint-disable-next-line ember/no-get
    assert.equal(this.get('mode'), 'qr');
    assert.dom(QR).hasAttribute('data-test-styled-qr-code', link);
    assert.dom(URL).containsText(link);
    assert.dom(TOGGLE).isEnabled().containsText('Show Payment Link');
    assert.dom(LINK).doesNotExist();
  });
  test('it allows a custom cta for the payment link', async function (assert) {
    this.set('mode', 'link');
    this.set('cta', 'Please pay 10 dollars');
    assert
      .dom(LINK)
      .hasAttribute('href', deepLink)
      .containsText('Please pay 10 dollars');
  });
});
