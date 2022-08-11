import { module, test } from 'qunit';
import { visit, waitFor } from '@ember/test-helpers';
import { setupApplicationTest } from 'ember-qunit';
import percySnapshot from '@percy/ember';
import { setupMirage } from 'ember-cli-mirage/test-support';
import sinon from 'sinon';

import { MirageTestContext } from 'ember-cli-mirage/test-support';
import {
  convertAmountToNativeDisplay,
  convertToSpend,
  generateMerchantPaymentUrl,
  roundAmountToNativeCurrencyDecimals,
  spendToUsd,
  ViewSafeResult,
} from '@cardstack/cardpay-sdk';
import config from '@cardstack/ssr-web/config/environment';
import { MIN_PAYMENT_AMOUNT_IN_SPEND__PREFER_ON_CHAIN_WHEN_POSSIBLE as MIN_PAYMENT_AMOUNT_IN_SPEND } from '@cardstack/cardpay-sdk';
import {
  createMerchantSafe,
  getFilenameFromDid,
} from '@cardstack/ssr-web/utils/test-factories';
import { Response as MirageResponse } from 'ember-cli-mirage';

// selectors
const PROFILE = '[data-test-profile]';
const PROFILE_INFO_ADDRESS_ONLY = '[data-test-payment-request-profile-address]';
const PROFILE_INFO_MISSING_MESSAGE =
  '[data-test-payment-request-profile-missing]';
const PROFILE_MISSING_MESSAGE = '[data-test-profile-missing]';
const PROFILE_LOGO = '[data-test-profile-logo]';
const AMOUNT = '[data-test-payment-request-amount]';
const SECONDARY_AMOUNT = '[data-test-payment-request-secondary-amount]';
const QR_CODE = '[data-test-boxel-styled-qr-code]';
const DEEP_LINK = '[data-test-payment-link-deep-link]';
const PAYMENT_URL = '[data-test-payment-link-url]';

// fixed data
const mirageConversionRate = 2; // mirage is hardcoded to provide 1:2 conversion from USD to any other currency
const universalLinkDomain = config.universalLinkDomain;
const exampleDid = 'did:cardstack:1moVYMRNGv6E5Ca3t7aXVD2Yb11e4e91103f084a';
const spendSymbol = 'SPD';
const usdSymbol = 'USD';
const jpySymbol = 'JPY';
const invalidCurrencySymbol = 'WUT';
const network = 'sokol';
const profileName = 'mandello';
const profileBackground = '#00ffcc';
const profileTextColor = '#000000';
const nonexistentProfileSlug = 'nonexistentprofile';
const merchantSafe = createMerchantSafe({
  address: '0xE73604fC1724a50CEcBC1096d4229b81aF117c94',
  owners: ['0xAE061aa45950Bf5b0B05458C3b7eE474C25B36a7'],
  infoDID: exampleDid,
});
const merchantSafeWithoutInfo = createMerchantSafe({
  address: '0xE73604fC1724a50CEcBC1096d4229b81aF117c85',
  owners: ['0xAE061aa45950Bf5b0B05458C3b7eE474C25B36a7'],
});
const spendAmount = 300;
const usdAmount = spendToUsd(spendAmount)!;
const minSpendAmount = MIN_PAYMENT_AMOUNT_IN_SPEND;
const minUsdAmount = spendToUsd(MIN_PAYMENT_AMOUNT_IN_SPEND)!;
const lessThanMinSpendAmount = 10;
const lessThanMinUsdAmount = spendToUsd(lessThanMinSpendAmount)!;

module('Acceptance | pay', function (hooks) {
  setupApplicationTest(hooks);
  setupMirage(hooks);

  hooks.beforeEach(async function (this: MirageTestContext) {
    let subgraph = this.owner.lookup('service:subgraph');
    sinon
      .stub(subgraph, 'viewSafe')
      .callsFake(async function (
        _network: string,
        address: string
      ): Promise<ViewSafeResult> {
        if (address === merchantSafe.address)
          return { safe: merchantSafe, blockNumber: 0 };
        else if (address === merchantSafeWithoutInfo.address)
          return { safe: merchantSafeWithoutInfo, blockNumber: 0 };
        else return { safe: undefined, blockNumber: 0 };
      });

    this.server.create('profile', {
      id: await getFilenameFromDid(exampleDid),
      name: profileName,
      slug: 'mandello1',
      did: exampleDid,
      color: profileBackground,
      'text-color': profileTextColor,
      'owner-address': '0x182619c6Ea074C053eF3f1e1eF81Ec8De6Eb6E44',
    });
  });

  // eslint-disable-next-line qunit/require-expect
  test('It displays profile correctly in a non-iOS/non-Android environment', async function (assert) {
    await visit(`/pay/${network}/${merchantSafe.address}`);

    await waitFor(PROFILE);

    assert.dom(PROFILE).hasAttribute('data-test-profile', profileName);
    assert
      .dom(PROFILE_LOGO)
      .containsText(profileName.substr(0, 1).toUpperCase())
      .hasAttribute('data-test-profile-logo-background', profileBackground)
      .hasAttribute('data-test-profile-logo-text-color', profileTextColor);

    await percySnapshot(assert);
  });

  // eslint-disable-next-line qunit/require-expect
  test('It displays profile correctly on iOS', async function (assert) {
    let UAService = this.owner.lookup('service:ua');
    sinon.stub(UAService, 'isIOS').returns(true);

    await visit(`/pay/${network}/${merchantSafe.address}`);
    await waitFor(PROFILE);

    assert.dom(PROFILE).hasAttribute('data-test-profile', profileName);
    assert
      .dom(PROFILE_LOGO)
      .hasAttribute('data-test-profile-logo-background', profileBackground)
      .hasAttribute('data-test-profile-logo-text-color', profileTextColor);

    await percySnapshot(assert);
  });

  // eslint-disable-next-line qunit/require-expect
  test('It displays profile correctly on Android', async function (assert) {
    let UAService = this.owner.lookup('service:ua');
    sinon.stub(UAService, 'isAndroid').returns(true);

    await visit(`/pay/${network}/${merchantSafe.address}`);
    await waitFor(PROFILE);

    assert.dom(PROFILE).hasAttribute('data-test-profile', profileName);
    assert
      .dom(PROFILE_LOGO)
      .hasAttribute('data-test-profile-logo-background', profileBackground)
      .hasAttribute('data-test-profile-logo-text-color', profileTextColor);

    await percySnapshot(assert);
  });

  test('it renders correctly with SPD as currency', async function (assert) {
    await visit(
      `/pay/${network}/${merchantSafe.address}?amount=${spendAmount}&currency=${spendSymbol}`
    );

    assert
      .dom(AMOUNT)
      .containsText(convertAmountToNativeDisplay(usdAmount, 'USD'));
    assert.dom(SECONDARY_AMOUNT).doesNotExist();

    let expectedUrl = generateMerchantPaymentUrl({
      domain: universalLinkDomain,
      network,
      merchantSafeID: merchantSafe.address,
      currency: usdSymbol,
      amount: usdAmount,
    });
    assert
      .dom(QR_CODE)
      .hasAttribute('data-test-boxel-styled-qr-code', expectedUrl);
    assert.dom(PAYMENT_URL).containsText(expectedUrl);
  });

  test('it renders appropriate meta tags', async function (assert) {
    await visit(
      `/pay/${network}/${merchantSafe.address}?amount=${usdAmount}&currency=${usdSymbol}`
    );
    await waitFor(PROFILE);
    let expectedUrl = generateMerchantPaymentUrl({
      domain: universalLinkDomain,
      network,
      merchantSafeID: merchantSafe.address,
      currency: usdSymbol,
      amount: usdAmount,
    });
    let expectedPath = expectedUrl.substring(
      expectedUrl.indexOf(universalLinkDomain) + universalLinkDomain.length
    );

    assert
      .dom(
        `meta[property='og:title'][content='${profileName} requests payment']`,
        document.documentElement
      )
      .exists();

    assert
      .dom(
        `meta[name='twitter:title'][content='${profileName} requests payment']`,
        document.documentElement
      )
      .exists();
    assert
      .dom(
        `meta[property='og:url'][content$='${expectedPath}']`,
        document.documentElement
      )
      .exists();

    assert
      .dom(
        `meta[name='twitter:url'][content$='${expectedPath}']`,
        document.documentElement
      )
      .exists();

    let amountInUSD = convertAmountToNativeDisplay(usdAmount, 'USD');
    let description = `Use Cardstack Wallet to pay ${amountInUSD}`;

    assert
      .dom(
        `meta[property='og:description'][content$='${description}']`,
        document.documentElement
      )
      .exists();

    assert
      .dom(
        `meta[name='twitter:description'][content$='${description}']`,
        document.documentElement
      )
      .exists();
  });

  test('it has a fallback meta description if there is no amount param specified', async function (assert) {
    await visit(`/pay/${network}/${merchantSafe.address}`);
    await waitFor(PROFILE);

    let description = `Use Cardstack Wallet to pay ${profileName}`;
    assert
      .dom(
        `meta[property='og:description'][content="${description}"]`,
        document.documentElement
      )
      .exists();
    assert
      .dom(
        `meta[name='twitter:description'][content="${description}"]`,
        document.documentElement
      )
      .exists();
  });

  test('it rounds floating point SPEND amounts', async function (assert) {
    const floatingSpendAmount = 279.17;
    await visit(
      `/pay/${network}/${merchantSafe.address}?amount=${floatingSpendAmount}&currency=${spendSymbol}`
    );

    assert.dom(AMOUNT).containsText('$2.80 USD');
    assert.dom(SECONDARY_AMOUNT).doesNotExist();

    let expectedUrl = generateMerchantPaymentUrl({
      domain: universalLinkDomain,
      network,
      merchantSafeID: merchantSafe.address,
      currency: usdSymbol,
      amount: 2.8,
    });
    assert
      .dom(QR_CODE)
      .hasAttribute('data-test-boxel-styled-qr-code', expectedUrl);
    assert.dom(PAYMENT_URL).containsText(expectedUrl);
  });

  test('it rounds SPEND up to the min SPEND amount', async function (assert) {
    await visit(
      `/pay/${network}/${merchantSafe.address}?amount=${lessThanMinSpendAmount}&currency=${spendSymbol}`
    );

    assert
      .dom(AMOUNT)
      .containsText(convertAmountToNativeDisplay(minUsdAmount, 'USD'));
    assert.dom(SECONDARY_AMOUNT).doesNotExist();

    let expectedUrl = generateMerchantPaymentUrl({
      domain: universalLinkDomain,
      network,
      merchantSafeID: merchantSafe.address,
      currency: usdSymbol,
      amount: Number(
        roundAmountToNativeCurrencyDecimals(spendToUsd(minSpendAmount)!, 'USD')
      ),
    });
    assert
      .dom(QR_CODE)
      .hasAttribute('data-test-boxel-styled-qr-code', expectedUrl);
    assert.dom(PAYMENT_URL).containsText(expectedUrl);
  });

  test('it renders correctly with no currency provided', async function (assert) {
    // Don't render any amounts, esp in the URL. The wallet wants to respect
    // user preferences for currencies when currency is not specified
    // so we should not allow requests for amounts without currencies
    await visit(`/pay/${network}/${merchantSafe.address}?amount=5000`);

    assert.dom(AMOUNT).doesNotExist();
    assert.dom(SECONDARY_AMOUNT).doesNotExist();

    let expectedUrl = generateMerchantPaymentUrl({
      domain: universalLinkDomain,
      network,
      merchantSafeID: merchantSafe.address,
    });
    assert
      .dom(QR_CODE)
      .hasAttribute('data-test-boxel-styled-qr-code', expectedUrl);
    assert.dom(PAYMENT_URL).containsText(expectedUrl);
  });

  test('it renders correctly with USD as currency', async function (assert) {
    await visit(
      `/pay/${network}/${merchantSafe.address}?amount=${usdAmount}&currency=${usdSymbol}`
    );

    assert
      .dom(AMOUNT)
      .containsText(convertAmountToNativeDisplay(usdAmount, 'USD'));
    assert.dom(SECONDARY_AMOUNT).doesNotExist();

    let expectedUrl = generateMerchantPaymentUrl({
      domain: universalLinkDomain,
      network,
      merchantSafeID: merchantSafe.address,
      currency: usdSymbol,
      amount: usdAmount,
    });
    assert
      .dom(QR_CODE)
      .hasAttribute('data-test-boxel-styled-qr-code', expectedUrl);
    assert.dom(PAYMENT_URL).containsText(expectedUrl);
  });

  test('it rounds USD up to the min USD amount', async function (assert) {
    await visit(
      `/pay/${network}/${merchantSafe.address}?amount=${lessThanMinUsdAmount}&currency=${usdSymbol}`
    );

    assert
      .dom(AMOUNT)
      .containsText(convertAmountToNativeDisplay(minUsdAmount, 'USD'));
    assert.dom(SECONDARY_AMOUNT).doesNotExist();

    let expectedUrl = generateMerchantPaymentUrl({
      domain: universalLinkDomain,
      network,
      merchantSafeID: merchantSafe.address,
      currency: usdSymbol,
      amount: minUsdAmount,
    });
    assert
      .dom(QR_CODE)
      .hasAttribute('data-test-boxel-styled-qr-code', expectedUrl);
    assert.dom(PAYMENT_URL).containsText(expectedUrl);
  });

  test('it renders correctly if currency is non-USD and non-SPEND', async function (assert) {
    const jpyAmount = 300.335;
    const roundedJpyAmount = roundAmountToNativeCurrencyDecimals(
      jpyAmount,
      jpySymbol
    );
    const roundedJpyAmountInUsd =
      Number(roundedJpyAmount) / mirageConversionRate;

    await visit(
      `/pay/${network}/${merchantSafe.address}?amount=${jpyAmount}&currency=${jpySymbol}`
    );

    assert
      .dom(AMOUNT)
      .containsText(convertAmountToNativeDisplay(roundedJpyAmount, jpySymbol));
    assert
      .dom(SECONDARY_AMOUNT)
      .containsText(
        convertAmountToNativeDisplay(
          spendToUsd(convertToSpend(roundedJpyAmountInUsd, 'USD', 1)!)!,
          'USD'
        )
      );

    let expectedUrl = generateMerchantPaymentUrl({
      domain: universalLinkDomain,
      network,
      merchantSafeID: merchantSafe.address,
      currency: jpySymbol,
      amount: Number(roundedJpyAmount),
    });
    assert
      .dom(QR_CODE)
      .hasAttribute('data-test-boxel-styled-qr-code', expectedUrl);
    assert.dom(PAYMENT_URL).containsText(expectedUrl);
  });

  test('it rounds amount up to min spend amount if currency is non-USD and non-SPEND', async function (assert) {
    const minJpyAmount = minUsdAmount * mirageConversionRate;
    const jpyAmount = minJpyAmount - 0.1;
    const convertedMinSpendAmount = convertToSpend(
      minJpyAmount,
      'JPY',
      mirageConversionRate
    );

    await visit(
      `/pay/${network}/${merchantSafe.address}?amount=${jpyAmount}&currency=${jpySymbol}`
    );

    assert
      .dom(AMOUNT)
      .containsText(convertAmountToNativeDisplay(minJpyAmount, jpySymbol));
    assert
      .dom(SECONDARY_AMOUNT)
      .containsText(
        convertAmountToNativeDisplay(
          spendToUsd(convertedMinSpendAmount)!,
          'USD'
        )
      );

    let expectedUrl = generateMerchantPaymentUrl({
      domain: universalLinkDomain,
      network,
      merchantSafeID: merchantSafe.address,
      currency: jpySymbol,
      amount: minJpyAmount,
    });
    assert
      .dom(QR_CODE)
      .hasAttribute('data-test-boxel-styled-qr-code', expectedUrl);
    assert.dom(PAYMENT_URL).containsText(expectedUrl);
  });

  test('it handles errors in fetching exchange rates gracefully', async function (this: MirageTestContext, assert) {
    this.server.get('/exchange-rates', function () {
      return new MirageResponse(502, {}, '');
    });

    const jpyAmount = 300;

    await visit(
      `/pay/${network}/${merchantSafe.address}?amount=${jpyAmount}&currency=${jpySymbol}`
    );

    assert
      .dom(AMOUNT)
      .containsText(convertAmountToNativeDisplay(jpyAmount, jpySymbol));
    assert.dom(SECONDARY_AMOUNT).doesNotExist();

    let expectedUrl = generateMerchantPaymentUrl({
      domain: universalLinkDomain,
      network,
      merchantSafeID: merchantSafe.address,
      currency: jpySymbol,
      amount: jpyAmount,
    });
    assert
      .dom(QR_CODE)
      .hasAttribute('data-test-boxel-styled-qr-code', expectedUrl);
    assert.dom(PAYMENT_URL).containsText(expectedUrl);
  });

  test('it renders correctly if currency is unrecognised', async function (assert) {
    await visit(
      `/pay/${network}/${merchantSafe.address}?amount=300&currency=${invalidCurrencySymbol}`
    );

    assert.dom(AMOUNT).doesNotExist();
    assert.dom(SECONDARY_AMOUNT).doesNotExist();

    // we just pass this currency to the wallet to handle without
    // displaying the amounts if we don't recognize the currency
    // currently this is anything that is not SPD or USD
    let expectedUrl = generateMerchantPaymentUrl({
      domain: universalLinkDomain,
      network,
      merchantSafeID: merchantSafe.address,
      currency: invalidCurrencySymbol,
      amount: 300,
    });
    assert
      .dom(QR_CODE)
      .hasAttribute('data-test-boxel-styled-qr-code', expectedUrl);
    assert.dom(PAYMENT_URL).containsText(expectedUrl);
  });

  test('it renders correctly if amount is malformed', async function (assert) {
    await visit(
      `/pay/${network}/${merchantSafe.address}?amount=30a&currency=${usdSymbol}`
    );

    assert.dom(AMOUNT).doesNotExist();
    assert.dom(SECONDARY_AMOUNT).doesNotExist();

    let expectedUrl = generateMerchantPaymentUrl({
      domain: universalLinkDomain,
      network,
      merchantSafeID: merchantSafe.address,
      currency: usdSymbol,
      amount: 0,
    });
    assert
      .dom(QR_CODE)
      .hasAttribute('data-test-boxel-styled-qr-code', expectedUrl);
    assert.dom(PAYMENT_URL).containsText(expectedUrl);
  });

  test('it renders the clickable link by default when in an iOS browser', async function (assert) {
    let UAService = this.owner.lookup('service:ua');
    sinon.stub(UAService, 'isIOS').returns(true);

    await visit(
      `/pay/${network}/${merchantSafe.address}?amount=${usdAmount}&currency=${usdSymbol}`
    );

    assert
      .dom(AMOUNT)
      .containsText(convertAmountToNativeDisplay(usdAmount, 'USD'));
    assert.dom(SECONDARY_AMOUNT).doesNotExist();

    // assert that the deep link view is rendered
    assert.dom(QR_CODE).doesNotExist();
    assert
      .dom(DEEP_LINK)
      .containsText('Pay with Cardstack Wallet')
      .hasAttribute(
        'href',
        generateMerchantPaymentUrl({
          network,
          merchantSafeID: merchantSafe.address,
          currency: usdSymbol,
          amount: usdAmount,
        })
      );
    assert.dom(PAYMENT_URL).containsText(
      generateMerchantPaymentUrl({
        network,
        merchantSafeID: merchantSafe.address,
        currency: usdSymbol,
        amount: usdAmount,
      })
    );
  });

  test('it renders the clickable link by default when in an Android browser', async function (assert) {
    let UAService = this.owner.lookup('service:ua');
    sinon.stub(UAService, 'isAndroid').returns(true);

    await visit(
      `/pay/${network}/${merchantSafe.address}?amount=${usdAmount}&currency=${usdSymbol}`
    );

    assert
      .dom(AMOUNT)
      .containsText(convertAmountToNativeDisplay(usdAmount, 'USD'));
    assert.dom(SECONDARY_AMOUNT).doesNotExist();

    // assert that the deep link view is rendered
    assert.dom(QR_CODE).doesNotExist();
    assert
      .dom(DEEP_LINK)
      .containsText('Pay with Cardstack Wallet')
      .hasAttribute(
        'href',
        generateMerchantPaymentUrl({
          network,
          merchantSafeID: merchantSafe.address,
          currency: usdSymbol,
          amount: usdAmount,
        })
      );
    assert.dom(PAYMENT_URL).containsText(
      generateMerchantPaymentUrl({
        network,
        merchantSafeID: merchantSafe.address,
        currency: usdSymbol,
        amount: usdAmount,
      })
    );
  });

  test('it renders appropriate UI when profile is not fetched', async function (assert) {
    await visit(
      `/pay/${network}/${merchantSafeWithoutInfo.address}?amount=${usdAmount}&currency=${usdSymbol}`
    );
    await waitFor(PROFILE_INFO_ADDRESS_ONLY);

    assert.dom(PROFILE).doesNotExist();
    assert
      .dom(PROFILE_INFO_ADDRESS_ONLY)
      .containsText(merchantSafeWithoutInfo.address);
    assert
      .dom(PROFILE_INFO_MISSING_MESSAGE)
      .containsText(
        'Unable to find payment profile for this address. Use caution when paying.'
      );
    assert
      .dom(AMOUNT)
      .containsText(convertAmountToNativeDisplay(usdAmount, 'USD'));
    assert.dom(SECONDARY_AMOUNT).doesNotExist();

    let expectedUrl = generateMerchantPaymentUrl({
      domain: universalLinkDomain,
      network,
      merchantSafeID: merchantSafeWithoutInfo.address,
      currency: usdSymbol,
      amount: usdAmount,
    });
    assert
      .dom(QR_CODE)
      .hasAttribute('data-test-boxel-styled-qr-code', expectedUrl);
    assert.dom(PAYMENT_URL).containsText(expectedUrl);
  });

  test('it renders appropriate meta tags when profile is not fetched', async function (assert) {
    await visit(`/pay/${network}/${merchantSafeWithoutInfo.address}`);

    let title = 'Payment Requested';
    let description = `Use Cardstack Wallet to pay Payment Request`;
    assert
      .dom(
        `meta[property='og:title'][content="${title}"]`,
        document.documentElement
      )
      .exists();
    assert
      .dom(
        `meta[name='twitter:title'][content="${title}"]`,
        document.documentElement
      )
      .exists();
    assert
      .dom(
        `meta[property='og:description'][content="${description}"]`,
        document.documentElement
      )
      .exists();
    assert
      .dom(
        `meta[name='twitter:description'][content="${description}"]`,
        document.documentElement
      )
      .exists();
  });

  test('it renders appropriate UI when merchant safe is not fetched', async function (assert) {
    await visit(
      `/pay/${network}/${nonexistentProfileSlug}?amount=${usdAmount}&currency=${usdSymbol}`
    );

    await waitFor(PROFILE_MISSING_MESSAGE);

    assert
      .dom(PROFILE_MISSING_MESSAGE)
      .containsText(
        'Oops, no payment profile found - please ask for confirmation of the payment link'
      );
  });

  test('it renders appropriate UI when URL is not complete', async function (assert) {
    await visit(`/pay/sok`);

    await waitFor(PROFILE_MISSING_MESSAGE);

    assert
      .dom(PROFILE_MISSING_MESSAGE)
      .containsText(
        'Oops, no payment profile found - please ask for confirmation of the payment link'
      );
  });

  test('renders an error for an unknown page', async function (this: MirageTestContext, assert) {
    await visit('/nowhere');

    assert.dom('[data-test-error]').includesText('404: Not Found');
  });

  module('status page incidents', function () {
    // eslint-disable-next-line qunit/require-expect
    test('it renders a degraded service banner on the pay page', async function (this: MirageTestContext, assert) {
      this.server.get(config.urls.statusPageUrl, function () {
        return new MirageResponse(
          200,
          {},
          {
            incidents: [
              {
                name: 'Name',
                impact: 'major',
                incident_updates: [{ body: 'We are experiencing issues' }],
              },
            ],
          }
        );
      });

      await visit(`/pay/${network}/${merchantSafe.address}`);

      assert.dom('[data-test-degraded-service-banner]').isVisible({ count: 1 });

      await percySnapshot(assert);
    });

    test('it renders a degraded service banner on the pay error page', async function (this: MirageTestContext, assert) {
      this.server.get(config.urls.statusPageUrl, function () {
        return new MirageResponse(
          200,
          {},
          {
            incidents: [
              {
                name: 'Name',
                impact: 'major',
                incident_updates: [{ body: 'We are experiencing issues' }],
              },
            ],
          }
        );
      });

      await visit(`/pay/sok`);
      await waitFor(PROFILE_MISSING_MESSAGE);

      assert.dom('[data-test-degraded-service-banner]').isVisible({ count: 1 });
    });
  });
});
