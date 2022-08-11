import { module, test } from 'qunit';
import { setupRenderingTest } from 'ember-qunit';
import { click, render } from '@ember/test-helpers';
import hbs from 'htmlbars-inline-precompile';
import { ProfileResource } from '@cardstack/ssr-web/resources/profile';

// selectors
const EXPLANATION = '[data-test-payment-request-explanation]';
const PROFILE = '[data-test-profile]';
const PROFILE_ADDRESS_ONLY = '[data-test-payment-request-profile-address]';
const PROFILE_MISSING_MESSAGE = '[data-test-payment-request-profile-missing]';
const PROFILE_LOGO = '[data-test-profile-logo]';
const AMOUNT = '[data-test-payment-request-amount]';
const SECONDARY_AMOUNT = '[data-test-payment-request-secondary-amount]';
const QR_CODE = '[data-test-boxel-styled-qr-code]';
const DEEP_LINK = '[data-test-payment-link-deep-link]';
const LINK_VIEW_TOGGLE = '[data-test-payment-link-link-view-toggle]';
const PAYMENT_URL = '[data-test-payment-link-url]';
const LOADING_INDICATOR = '[data-test-profile-loading-indicator]';

// fixed data
const amount = `§300`;
const secondaryAmount = '$3.00 USD';
const paymentURL =
  'https://pay.cardstack.com/merchat-asdnsadkasd?id=0x1238urfds&amount=73298587423545';
const deepLinkPaymentURL =
  'https://deep-link.cardstack.com/merchat-asdnsadkasd?id=0x1238urfds&amount=73298587423545';
let profile: ProfileResource;
const profileAddress = '0xE73604fC1724a50CEcBC1096d4229b81aF117c94';

module('Integration | Component | payment-request', function (hooks) {
  setupRenderingTest(hooks);

  hooks.beforeEach(function () {
    profile = {
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
      profile,
      profileAddress,
    });
  });

  test('It renders the non-deep-link view correctly with profile display info', async function (assert) {
    await render(hbs`
        <PaymentRequest
          @amount={{this.amount}}
          @secondaryAmount={{this.secondaryAmount}}
          @profile={{this.profile}}
          @paymentURL={{this.paymentURL}}
          @deepLinkPaymentURL={{this.deepLinkPaymentURL}}
          @canDeepLink={{false}}
        />
      `);

    assert.dom(PROFILE).hasAttribute('data-test-profile', profile.name!);
    assert
      .dom(PROFILE_LOGO)
      .hasAttribute(
        'data-test-profile-logo-background',
        profile.backgroundColor!
      );
    assert
      .dom(PROFILE_LOGO)
      .hasAttribute('data-test-profile-logo-text-color', profile.textColor!);
    assert.dom(AMOUNT).containsText(`§300`);
    assert.dom(SECONDARY_AMOUNT).containsText(`$3.00 USD`);
    assert
      .dom(QR_CODE)
      .hasAttribute('data-test-boxel-styled-qr-code', paymentURL);
    assert.dom(PAYMENT_URL).containsText(paymentURL);
  });

  test('It renders the deep-link view correctly and allows toggling', async function (assert) {
    await render(hbs`
        <PaymentRequest
          @amount={{this.amount}}
          @secondaryAmount={{this.secondaryAmount}}
          @profile={{this.profile}}
          @paymentURL={{this.paymentURL}}
          @deepLinkPaymentURL={{this.deepLinkPaymentURL}}
          @canDeepLink={{true}}
        />
      `);

    assert.dom(PROFILE).hasAttribute('data-test-profile', profile.name!);
    assert
      .dom(PROFILE_LOGO)
      .hasAttribute(
        'data-test-profile-logo-background',
        profile.backgroundColor!
      );
    assert
      .dom(PROFILE_LOGO)
      .hasAttribute('data-test-profile-logo-text-color', profile.textColor!);
    assert.dom(AMOUNT).containsText(`§300`);
    assert.dom(SECONDARY_AMOUNT).containsText(`$3.00 USD`);
    assert.dom(QR_CODE).doesNotExist();
    assert
      .dom(EXPLANATION)
      .containsText(
        'Please install the Cardstack Wallet app on your mobile phone, then tap on the link below to complete your payment'
      );
    assert
      .dom(DEEP_LINK)
      .containsText('Pay with Cardstack Wallet')
      .hasAttribute('href', deepLinkPaymentURL);
    assert.dom(PAYMENT_URL).containsText(deepLinkPaymentURL);
    assert.dom(LINK_VIEW_TOGGLE).containsText('Show as QR Code');

    await click(LINK_VIEW_TOGGLE);

    assert.dom(DEEP_LINK).doesNotExist();
    assert
      .dom(QR_CODE)
      .hasAttribute('data-test-boxel-styled-qr-code', paymentURL);
    assert.dom(LINK_VIEW_TOGGLE).containsText('Show Payment Link');
    assert
      .dom(EXPLANATION)
      .containsText(
        'Please install the Cardstack Wallet app on your mobile phone, then scan the QR code below to complete your payment'
      );
  });

  test('It renders correctly with merchant address and failure to fetch profile', async function (assert) {
    profile.errored = new Error('An error');
    await render(hbs`
        <PaymentRequest
          @amount={{this.amount}}
          @secondaryAmount={{this.secondaryAmount}}
          @profile={{this.profile}}
          @profileAddress={{this.profileAddress}}
          @paymentURL={{this.paymentURL}}
          @deepLinkPaymentURL={{this.deepLinkPaymentURL}}
          @canDeepLink={{false}}
        />
      `);

    assert.dom(PROFILE).doesNotExist();
    assert.dom(PROFILE_ADDRESS_ONLY).containsText(profileAddress);
    assert
      .dom(PROFILE_MISSING_MESSAGE)
      .containsText(
        'Unable to find payment profile for this address. Use caution when paying.'
      );
    assert.dom(AMOUNT).containsText(`§300`);
    assert.dom(SECONDARY_AMOUNT).containsText(`$3.00 USD`);
    assert
      .dom(QR_CODE)
      .hasAttribute('data-test-boxel-styled-qr-code', paymentURL);
    assert.dom(PAYMENT_URL).containsText(paymentURL);
  });

  test('It renders a loading state while a profile is loading', async function (assert) {
    profile.loading = true;
    await render(hbs`
        <PaymentRequest
          @amount={{this.amount}}
          @secondaryAmount={{this.secondaryAmount}}
          @profile={{this.profile}}
          @profileAddress={{this.profileAddress}}
          @paymentURL={{this.paymentURL}}
          @deepLinkPaymentURL={{this.deepLinkPaymentURL}}
          @canDeepLink={{false}}
        />
      `);

    assert.dom(PROFILE).doesNotExist();
    assert.dom(LOADING_INDICATOR).exists();
    assert.dom(AMOUNT).containsText(`§300`);
    assert.dom(SECONDARY_AMOUNT).containsText(`$3.00 USD`);
    assert
      .dom(QR_CODE)
      .hasAttribute('data-test-boxel-styled-qr-code', paymentURL);
    assert.dom(PAYMENT_URL).containsText(paymentURL);
  });
});
