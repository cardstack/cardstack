import { module, test } from 'qunit';
import { setupRenderingTest } from 'ember-qunit';
import { click, render } from '@ember/test-helpers';
import hbs from 'htmlbars-inline-precompile';
import { MerchantInfoResource } from '@cardstack/web-client/resources/merchant-info';

// selectors
const EXPLANATION = '[data-test-payment-request-explanation]';
const MERCHANT = '[data-test-merchant]';
const MERCHANT_INFO_ADDRESS_ONLY =
  '[data-test-payment-request-merchant-address]';
const MERCHANT_INFO_MISSING_MESSAGE =
  '[data-test-payment-request-merchant-info-missing]';
const MERCHANT_LOGO = '[data-test-merchant-logo]';
const AMOUNT = '[data-test-payment-request-amount]';
const SECONDARY_AMOUNT = '[data-test-payment-request-secondary-amount]';
const QR_CODE = '[data-test-styled-qr-code]';
const DEEP_LINK = '[data-test-payment-request-deep-link]';
const LINK_VIEW_TOGGLE = '[data-test-payment-request-link-view-toggle]';
const PAYMENT_URL = '[data-test-payment-request-url]';
const LOADING_INDICATOR = '[data-test-merchant-loading-indicator]';

// fixed data
const amount = `§300`;
const secondaryAmount = '$3.00 USD';
const paymentURL =
  'https://pay.cardstack.com/merchat-asdnsadkasd?id=0x1238urfds&amount=73298587423545';
const deepLinkPaymentURL =
  'https://deep-link.cardstack.com/merchat-asdnsadkasd?id=0x1238urfds&amount=73298587423545';
let merchant: MerchantInfoResource;
const merchantAddress = '0xE73604fC1724a50CEcBC1096d4229b81aF117c94';

module(
  'Integration | Component | card-pay/merchant-payment-request-card',
  function (hooks) {
    setupRenderingTest(hooks);

    hooks.beforeEach(function () {
      merchant = {
        id: 'happii',
        name: 'Happii Creations',
        backgroundColor: 'cornflowerblue',
        textColor: 'black',
        errored: undefined,
        loading: false,
      };
      this.setProperties({
        amount,
        secondaryAmount,
        paymentURL,
        deepLinkPaymentURL,
        merchant,
        merchantAddress,
      });
    });

    test('It renders the non-deep-link view correctly with merchant display info', async function (assert) {
      await render(hbs`
        <CardPay::MerchantPaymentRequestCard
          @amount={{this.amount}}
          @secondaryAmount={{this.secondaryAmount}}
          @merchant={{this.merchant}}
          @paymentURL={{this.paymentURL}}
          @deepLinkPaymentURL={{this.deepLinkPaymentURL}}
          @canDeepLink={{false}}
        />
      `);

      assert.dom(MERCHANT).hasAttribute('data-test-merchant', merchant.name!);
      assert
        .dom(MERCHANT_LOGO)
        .hasAttribute(
          'data-test-merchant-logo-background',
          merchant.backgroundColor!
        );
      assert
        .dom(MERCHANT_LOGO)
        .hasAttribute(
          'data-test-merchant-logo-text-color',
          merchant.textColor!
        );
      assert.dom(AMOUNT).containsText(`§300`);
      assert.dom(SECONDARY_AMOUNT).containsText(`$3.00 USD`);
      assert.dom(QR_CODE).hasAttribute('data-test-styled-qr-code', paymentURL);
      assert.dom(PAYMENT_URL).containsText(paymentURL);
    });

    test('It renders the deep-link view correctly and allows toggling', async function (assert) {
      await render(hbs`
        <CardPay::MerchantPaymentRequestCard
          @amount={{this.amount}}
          @secondaryAmount={{this.secondaryAmount}}
          @merchant={{this.merchant}}
          @paymentURL={{this.paymentURL}}
          @deepLinkPaymentURL={{this.deepLinkPaymentURL}}
          @canDeepLink={{true}}
        />
      `);

      assert.dom(MERCHANT).hasAttribute('data-test-merchant', merchant.name!);
      assert
        .dom(MERCHANT_LOGO)
        .hasAttribute(
          'data-test-merchant-logo-background',
          merchant.backgroundColor!
        );
      assert
        .dom(MERCHANT_LOGO)
        .hasAttribute(
          'data-test-merchant-logo-text-color',
          merchant.textColor!
        );
      assert.dom(AMOUNT).containsText(`§300`);
      assert.dom(SECONDARY_AMOUNT).containsText(`$3.00 USD`);
      assert.dom(QR_CODE).doesNotExist();
      assert
        .dom(EXPLANATION)
        .containsText(
          'Please install the Card Wallet app on your mobile phone, then tap on the link below to complete your payment'
        );
      assert
        .dom(DEEP_LINK)
        .containsText('Pay Business')
        .hasAttribute('href', deepLinkPaymentURL);
      assert.dom(PAYMENT_URL).containsText(paymentURL);
      assert.dom(LINK_VIEW_TOGGLE).containsText('Show as QR Code');

      await click(LINK_VIEW_TOGGLE);

      assert.dom(DEEP_LINK).doesNotExist();
      assert.dom(QR_CODE).hasAttribute('data-test-styled-qr-code', paymentURL);
      assert.dom(LINK_VIEW_TOGGLE).containsText('Show Payment Link');
      assert
        .dom(EXPLANATION)
        .containsText(
          'Please install the Card Wallet app on your mobile phone, then scan the QR code below to complete your payment'
        );
    });

    test('It renders correctly with merchant address and failure to fetch merchant info', async function (assert) {
      merchant.errored = new Error('An error');
      await render(hbs`
        <CardPay::MerchantPaymentRequestCard
          @amount={{this.amount}}
          @secondaryAmount={{this.secondaryAmount}}
          @merchant={{this.merchant}}
          @merchantAddress={{this.merchantAddress}}
          @paymentURL={{this.paymentURL}}
          @deepLinkPaymentURL={{this.deepLinkPaymentURL}}
          @canDeepLink={{false}}
        />
      `);

      assert.dom(MERCHANT).doesNotExist();
      assert.dom(MERCHANT_INFO_ADDRESS_ONLY).containsText(merchantAddress);
      assert
        .dom(MERCHANT_INFO_MISSING_MESSAGE)
        .containsText(
          'Unable to find business details for this address. Use caution when paying.'
        );
      assert.dom(AMOUNT).containsText(`§300`);
      assert.dom(SECONDARY_AMOUNT).containsText(`$3.00 USD`);
      assert.dom(QR_CODE).hasAttribute('data-test-styled-qr-code', paymentURL);
      assert.dom(PAYMENT_URL).containsText(paymentURL);
    });

    test('It renders a loading state while a merchant is loading', async function (assert) {
      merchant.loading = true;
      await render(hbs`
        <CardPay::MerchantPaymentRequestCard
          @amount={{this.amount}}
          @secondaryAmount={{this.secondaryAmount}}
          @merchant={{this.merchant}}
          @merchantAddress={{this.merchantAddress}}
          @paymentURL={{this.paymentURL}}
          @deepLinkPaymentURL={{this.deepLinkPaymentURL}}
          @canDeepLink={{false}}
        />
      `);

      assert.dom(MERCHANT).doesNotExist();
      assert.dom(LOADING_INDICATOR).exists();
      assert.dom(AMOUNT).containsText(`§300`);
      assert.dom(SECONDARY_AMOUNT).containsText(`$3.00 USD`);
      assert.dom(QR_CODE).hasAttribute('data-test-styled-qr-code', paymentURL);
      assert.dom(PAYMENT_URL).containsText(paymentURL);
    });
  }
);
