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
const MERCHANT = '[data-test-merchant]';
const MERCHANT_INFO_ADDRESS_ONLY =
  '[data-test-payment-request-merchant-address]';
const MERCHANT_INFO_MISSING_MESSAGE =
  '[data-test-payment-request-merchant-info-missing]';
const MERCHANT_MISSING_MESSAGE = '[data-test-merchant-missing]';
const MERCHANT_LOGO = '[data-test-merchant-logo]';
const AMOUNT = '[data-test-payment-request-amount]';
const SECONDARY_AMOUNT = '[data-test-payment-request-secondary-amount]';
const QR_CODE = '[data-test-styled-qr-code]';
const DEEP_LINK = '[data-test-payment-request-deep-link]';
const PAYMENT_URL = '[data-test-payment-request-url]';

// fixed data
const mirageConversionRate = 2; // mirage is hardcoded to provide 1:2 conversion from USD to any other currency
const universalLinkDomain = config.universalLinkDomain;
const exampleDid = 'did:cardstack:1moVYMRNGv6E5Ca3t7aXVD2Yb11e4e91103f084a';
const spendSymbol = 'SPD';
const usdSymbol = 'USD';
const jpySymbol = 'JPY';
const invalidCurrencySymbol = 'WUT';
const network = 'sokol';
const merchantName = 'mandello';
const merchantInfoBackground = '#00ffcc';
const merchantInfoTextColor = '#000000';
const nonexistentMerchantId = 'nonexistentmerchant';
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
const usdAmount = spendToUsd(spendAmount);
const minSpendAmount = MIN_PAYMENT_AMOUNT_IN_SPEND;
const minUsdAmount = spendToUsd(MIN_PAYMENT_AMOUNT_IN_SPEND)!;
const lessThanMinSpendAmount = 10;
const lessThanMinUsdAmount = spendToUsd(lessThanMinSpendAmount)!;

module('Acceptance | pay', function (hooks) {
  setupApplicationTest(hooks);
  setupMirage(hooks);

  hooks.beforeEach(async function (this: MirageTestContext) {
    let safeViewer = this.owner.lookup('service:safe-viewer');
    sinon
      .stub(safeViewer, 'view')
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

    this.server.create('merchant-info', {
      id: await getFilenameFromDid(exampleDid),
      name: merchantName,
      slug: 'mandello1',
      did: exampleDid,
      color: merchantInfoBackground,
      'text-color': merchantInfoTextColor,
      'owner-address': '0x182619c6Ea074C053eF3f1e1eF81Ec8De6Eb6E44',
    });
  });

  test('It displays merchant info correctly in a non-iOS environment', async function (assert) {
    await visit(`/pay/${network}/${merchantSafe.address}`);

    await waitFor(MERCHANT);

    assert.dom(MERCHANT).hasAttribute('data-test-merchant', merchantName);
    assert
      .dom(MERCHANT_LOGO)
      .containsText(merchantName.substr(0, 1).toUpperCase())
      .hasAttribute(
        'data-test-merchant-logo-background',
        merchantInfoBackground
      )
      .hasAttribute(
        'data-test-merchant-logo-text-color',
        merchantInfoTextColor
      );

    await percySnapshot(assert);
  });

  test('It displays merchant info correctly on iOS', async function (assert) {
    let isIOSService = this.owner.lookup('service:is-ios');
    sinon.stub(isIOSService, 'isIOS').returns(true);

    await visit(`/pay/${network}/${merchantSafe.address}`);
    await waitFor(MERCHANT);

    assert.dom(MERCHANT).hasAttribute('data-test-merchant', merchantName);
    assert
      .dom(MERCHANT_LOGO)
      .hasAttribute(
        'data-test-merchant-logo-background',
        merchantInfoBackground
      )
      .hasAttribute(
        'data-test-merchant-logo-text-color',
        merchantInfoTextColor
      );

    await percySnapshot(assert);
  });

  test('it renders correctly with SPD as currency', async function (assert) {
    await visit(
      `/pay/${network}/${merchantSafe.address}?amount=${spendAmount}&currency=${spendSymbol}`
    );

    assert
      .dom(AMOUNT)
      .containsText(
        convertAmountToNativeDisplay(spendToUsd(spendAmount)!, 'USD')
      );
    assert.dom(SECONDARY_AMOUNT).doesNotExist();

    let expectedUrl = generateMerchantPaymentUrl({
      domain: universalLinkDomain,
      network,
      merchantSafeID: merchantSafe.address,
      currency: spendSymbol,
      amount: spendAmount,
    });
    assert.dom(QR_CODE).hasAttribute('data-test-styled-qr-code', expectedUrl);
    assert.dom(PAYMENT_URL).containsText(expectedUrl);
  });

  test('it renders appropriate meta tags', async function (assert) {
    const floatingSpendAmount = 279.17;
    const roundedSpendAmount = Math.ceil(floatingSpendAmount);
    await visit(
      `/pay/${network}/${merchantSafe.address}?amount=${floatingSpendAmount}&currency=${spendSymbol}`
    );
    await waitFor(MERCHANT);

    let expectedUrl = generateMerchantPaymentUrl({
      domain: universalLinkDomain,
      network,
      merchantSafeID: merchantSafe.address,
      currency: spendSymbol,
      amount: roundedSpendAmount,
    });

    let expectedPath = expectedUrl.substring(
      expectedUrl.indexOf(universalLinkDomain) + universalLinkDomain.length
    );

    assert
      .dom(
        `meta[property='og:title'][content='Pay Business: ${merchantName}']`,
        document.documentElement
      )
      .exists();

    assert
      .dom(
        `meta[property='og:url'][content$='${expectedPath}']`,
        document.documentElement
      )
      .exists();
  });

  test('it rounds floating point SPEND amounts', async function (assert) {
    const floatingSpendAmount = 279.17;
    const roundedSpendAmount = Math.ceil(floatingSpendAmount);
    await visit(
      `/pay/${network}/${merchantSafe.address}?amount=${floatingSpendAmount}&currency=${spendSymbol}`
    );

    assert
      .dom(AMOUNT)
      .containsText(
        convertAmountToNativeDisplay(spendToUsd(roundedSpendAmount)!, 'USD')
      );
    assert.dom(SECONDARY_AMOUNT).doesNotExist();

    let expectedUrl = generateMerchantPaymentUrl({
      domain: universalLinkDomain,
      network,
      merchantSafeID: merchantSafe.address,
      currency: spendSymbol,
      amount: roundedSpendAmount,
    });
    assert.dom(QR_CODE).hasAttribute('data-test-styled-qr-code', expectedUrl);
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
      currency: spendSymbol,
      amount: minSpendAmount,
    });
    assert.dom(QR_CODE).hasAttribute('data-test-styled-qr-code', expectedUrl);
    assert.dom(PAYMENT_URL).containsText(expectedUrl);
  });

  test('it renders correctly with no currency provided', async function (assert) {
    // this is basically defaulting to SPEND
    await visit(
      `/pay/${network}/${merchantSafe.address}?amount=${spendAmount}`
    );

    assert
      .dom(AMOUNT)
      .containsText(
        convertAmountToNativeDisplay(spendToUsd(spendAmount)!, 'USD')
      );
    assert.dom(SECONDARY_AMOUNT).doesNotExist();

    let expectedUrl = generateMerchantPaymentUrl({
      domain: universalLinkDomain,
      network,
      merchantSafeID: merchantSafe.address,
      currency: spendSymbol,
      amount: spendAmount,
    });
    assert.dom(QR_CODE).hasAttribute('data-test-styled-qr-code', expectedUrl);
    assert.dom(PAYMENT_URL).containsText(expectedUrl);
  });

  test('it renders correctly with USD as currency', async function (assert) {
    await visit(
      `/pay/${network}/${merchantSafe.address}?amount=${usdAmount}&currency=${usdSymbol}`
    );

    assert
      .dom(AMOUNT)
      .containsText(
        convertAmountToNativeDisplay(spendToUsd(spendAmount)!, 'USD')
      );
    assert.dom(SECONDARY_AMOUNT).doesNotExist();

    let expectedUrl = generateMerchantPaymentUrl({
      domain: universalLinkDomain,
      network,
      merchantSafeID: merchantSafe.address,
      currency: usdSymbol,
      amount: usdAmount,
    });
    assert.dom(QR_CODE).hasAttribute('data-test-styled-qr-code', expectedUrl);
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
    assert.dom(QR_CODE).hasAttribute('data-test-styled-qr-code', expectedUrl);
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
    assert.dom(QR_CODE).hasAttribute('data-test-styled-qr-code', expectedUrl);
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
    assert.dom(QR_CODE).hasAttribute('data-test-styled-qr-code', expectedUrl);
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
    assert.dom(QR_CODE).hasAttribute('data-test-styled-qr-code', expectedUrl);
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
    assert.dom(QR_CODE).hasAttribute('data-test-styled-qr-code', expectedUrl);
    assert.dom(PAYMENT_URL).containsText(expectedUrl);
  });

  test('it renders correctly if amount is malformed', async function (assert) {
    await visit(
      `/pay/${network}/${merchantSafe.address}?amount=30a&currency=${spendSymbol}`
    );

    assert.dom(AMOUNT).doesNotExist();
    assert.dom(SECONDARY_AMOUNT).doesNotExist();

    let expectedUrl = generateMerchantPaymentUrl({
      domain: universalLinkDomain,
      network,
      merchantSafeID: merchantSafe.address,
      currency: spendSymbol,
      amount: 0,
    });
    assert.dom(QR_CODE).hasAttribute('data-test-styled-qr-code', expectedUrl);
    assert.dom(PAYMENT_URL).containsText(expectedUrl);
  });

  test('it renders the clickable link by default when in an iOS browser', async function (assert) {
    let isIOSService = this.owner.lookup('service:is-ios');
    sinon.stub(isIOSService, 'isIOS').returns(true);

    await visit(
      `/pay/${network}/${merchantSafe.address}?amount=${spendAmount}&currrency=${spendSymbol}`
    );

    assert
      .dom(AMOUNT)
      .containsText(
        convertAmountToNativeDisplay(spendToUsd(spendAmount)!, 'USD')
      );
    assert.dom(SECONDARY_AMOUNT).doesNotExist();

    // assert that the deep link view is rendered
    assert.dom(QR_CODE).doesNotExist();
    assert
      .dom(DEEP_LINK)
      .containsText('Pay Business')
      .hasAttribute(
        'href',
        generateMerchantPaymentUrl({
          network,
          merchantSafeID: merchantSafe.address,
          currency: spendSymbol,
          amount: spendAmount,
        })
      );
    assert.dom(PAYMENT_URL).containsText(
      generateMerchantPaymentUrl({
        domain: universalLinkDomain,
        network,
        merchantSafeID: merchantSafe.address,
        currency: spendSymbol,
        amount: spendAmount,
      })
    );
  });

  test('it renders appropriate UI when merchant info is not fetched', async function (assert) {
    await visit(
      `/pay/${network}/${merchantSafeWithoutInfo.address}?amount=${spendAmount}&currency=${spendSymbol}`
    );
    await waitFor(MERCHANT_INFO_ADDRESS_ONLY);

    assert.dom(MERCHANT).doesNotExist();
    assert
      .dom(MERCHANT_INFO_ADDRESS_ONLY)
      .containsText(merchantSafeWithoutInfo.address);
    assert
      .dom(MERCHANT_INFO_MISSING_MESSAGE)
      .containsText(
        'Unable to find business details for this address. Use caution when paying.'
      );
    assert
      .dom(AMOUNT)
      .containsText(
        convertAmountToNativeDisplay(spendToUsd(spendAmount)!, 'USD')
      );
    assert.dom(SECONDARY_AMOUNT).doesNotExist();

    let expectedUrl = generateMerchantPaymentUrl({
      domain: universalLinkDomain,
      network,
      merchantSafeID: merchantSafeWithoutInfo.address,
      currency: spendSymbol,
      amount: spendAmount,
    });
    assert.dom(QR_CODE).hasAttribute('data-test-styled-qr-code', expectedUrl);
    assert.dom(PAYMENT_URL).containsText(expectedUrl);
  });

  test('it renders appropriate UI when merchant safe is not fetched', async function (assert) {
    await visit(
      `/pay/${network}/${nonexistentMerchantId}?amount=${spendAmount}&currency=${spendSymbol}`
    );

    await waitFor(MERCHANT_MISSING_MESSAGE);

    assert
      .dom(MERCHANT_MISSING_MESSAGE)
      .containsText(
        'Oops, no business found - please ask the business to confirm the payment link'
      );
  });

  test('it renders appropriate UI when URL is not complete', async function (assert) {
    await visit(`/pay/sok`);

    await waitFor(MERCHANT_MISSING_MESSAGE);

    assert
      .dom(MERCHANT_MISSING_MESSAGE)
      .containsText(
        'Oops, no business found - please ask the business to confirm the payment link'
      );
  });
});
