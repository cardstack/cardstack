import { module, test } from 'qunit';
import { setupRenderingTest } from 'ember-qunit';
import { click, render } from '@ember/test-helpers';
import hbs from 'htmlbars-inline-precompile';
import config from '@cardstack/web-client/config/environment';

// selectors
const BETA_ACCESS_LINK = '[data-test-payment-request-beta-access-link]';
const MERCHANT = '[data-test-merchant]';
const MERCHANT_LOGO = '[data-test-merchant-logo]';
const AMOUNT = '[data-test-payment-request-amount]';
const USD_AMOUNT = '[data-test-payment-request-usd-amount]';
const QR_CODE = '[data-test-styled-qr-code]';
const DEEP_LINK = '[data-test-payment-request-deep-link]';
const LINK_VIEW_TOGGLE = '[data-test-payment-request-link-view-toggle]';
const PAYMENT_URL = '[data-test-payment-request-url]';

// fixed data
const amount = '300';
const usdAmount = '3';
const paymentURL =
  'https://pay.cardstack.com/merchat-asdnsadkasd?id=0x1238urfds&amount=73298587423545';
const merchant = {
  name: 'Happii Creations',
  logoBackground: 'cornflowerblue',
  logoTextColor: 'black',
};

module(
  'Integration | Component | card-pay/merchant-payment-request-card',
  function (hooks) {
    setupRenderingTest(hooks);

    hooks.beforeEach(function () {
      this.setProperties({
        amount,
        usdAmount,
        paymentURL,
        merchant,
      });
    });

    test('It renders the non-deep-link view correctly', async function (assert) {
      await render(hbs`
        <CardPay::MerchantPaymentRequestCard
          @amount={{this.amount}}
          @usdAmount={{this.usdAmount}}
          @merchant={{this.merchant}}
          @paymentURL={{this.paymentURL}}
          @canDeepLink={{false}}
        />
      `);

      assert
        .dom(BETA_ACCESS_LINK)
        .hasAttribute('href', config.urls.testFlightLink);
      assert.dom(MERCHANT).hasAttribute('data-test-merchant', merchant.name);
      assert
        .dom(MERCHANT_LOGO)
        .hasAttribute(
          'data-test-merchant-logo-background',
          merchant.logoBackground
        );
      assert
        .dom(MERCHANT_LOGO)
        .hasAttribute(
          'data-test-merchant-logo-text-color',
          merchant.logoTextColor
        );
      assert.dom(AMOUNT).containsText(`§300`);
      assert.dom(USD_AMOUNT).containsText(`$3.00 USD`);
      assert.dom(QR_CODE).hasAttribute('data-test-styled-qr-code', paymentURL);
      assert.dom(PAYMENT_URL).containsText(paymentURL);
    });

    test('It renders the deep-link view correctly and allows toggling', async function (assert) {
      await render(hbs`
        <CardPay::MerchantPaymentRequestCard
          @amount={{this.amount}}
          @usdAmount={{this.usdAmount}}
          @merchant={{this.merchant}}
          @paymentURL={{this.paymentURL}}
          @canDeepLink={{true}}
        />
      `);

      assert
        .dom(BETA_ACCESS_LINK)
        .hasAttribute('href', config.urls.testFlightLink);
      assert.dom(MERCHANT).hasAttribute('data-test-merchant', merchant.name);
      assert
        .dom(MERCHANT_LOGO)
        .hasAttribute(
          'data-test-merchant-logo-background',
          merchant.logoBackground
        );
      assert
        .dom(MERCHANT_LOGO)
        .hasAttribute(
          'data-test-merchant-logo-text-color',
          merchant.logoTextColor
        );
      assert.dom(AMOUNT).containsText(`§300`);
      assert.dom(USD_AMOUNT).containsText(`$3.00 USD`);
      assert.dom(QR_CODE).doesNotExist();
      assert
        .dom(DEEP_LINK)
        .containsText('Pay Merchant')
        .hasAttribute('href', paymentURL);
      assert.dom(PAYMENT_URL).containsText(paymentURL);
      assert.dom(LINK_VIEW_TOGGLE).containsText('Show as QR Code');

      await click(LINK_VIEW_TOGGLE);

      assert.dom(DEEP_LINK).doesNotExist();
      assert.dom(QR_CODE).hasAttribute('data-test-styled-qr-code', paymentURL);
      assert.dom(LINK_VIEW_TOGGLE).containsText('Show Payment Link');
    });
  }
);
