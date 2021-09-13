import { module, test } from 'qunit';
import { visit } from '@ember/test-helpers';
import { setupApplicationTest } from 'ember-qunit';
import { setupMirage } from 'ember-cli-mirage/test-support';
import sinon from 'sinon';

import { MirageTestContext } from 'ember-cli-mirage/test-support';
import {
  formatUsd,
  generateMerchantPaymentUrl,
  MerchantSafe,
  spendToUsd,
} from '@cardstack/cardpay-sdk';
import { getResolver } from '@cardstack/did-resolver';
import { Resolver } from 'did-resolver';

// selectors
const MERCHANT = '[data-test-merchant]';
const MERCHANT_LOGO = '[data-test-merchant-logo]';
const AMOUNT = '[data-test-payment-request-amount]';
const USD_AMOUNT = '[data-test-payment-request-usd-amount]';
const QR_CODE = '[data-test-styled-qr-code]';
const DEEP_LINK = '[data-test-payment-request-deep-link]';
const PAYMENT_URL = '[data-test-payment-request-url]';

// fixed data
const exampleDid = 'did:cardstack:1moVYMRNGv6E5Ca3t7aXVD2Yb11e4e91103f084a';
const merchantSafeId = '0xE73604fC1724a50CEcBC1096d4229b81aF117c94';
const spendSymbol = 'SPD'; // TODO: fix this if single source of truth for symbols between web and mobile is established
const usdSymbol = 'USD';
const invalidCurrencySymbol = 'WUT';
const network = 'sokol';
const merchantName = 'Mandello';
const merchantInfoBackground = '#00ffcc';
const merchantInfoTextColor = '#000000';
const merchantSafe: MerchantSafe = {
  type: 'merchant',
  createdAt: Date.now() / 1000,
  address: merchantSafeId,
  owners: ['0xAE061aa45950Bf5b0B05458C3b7eE474C25B36a7'],
  infoDID: exampleDid,
} as MerchantSafe;
const spendAmount = 300;
const usdAmount = spendToUsd(spendAmount);

module('Acceptance | pay', function (hooks) {
  setupApplicationTest(hooks);
  setupMirage(hooks);

  hooks.beforeEach(async function (this: MirageTestContext) {
    let safeViewer = this.owner.lookup('service:safe-viewer');
    sinon.stub(safeViewer, 'view').returns(Promise.resolve(merchantSafe));

    let resolver = new Resolver({ ...getResolver() });
    let resolvedDID = await resolver.resolve(exampleDid);
    let didAlsoKnownAs = resolvedDID?.didDocument?.alsoKnownAs![0]!;
    let customizationJsonFilename = didAlsoKnownAs.split('/')[4].split('.')[0];

    this.server.create('merchant-info', {
      id: customizationJsonFilename, // TODO: replace this with a plain string
      name: merchantName,
      slug: 'mandello1',
      did: exampleDid,
      color: merchantInfoBackground,
      'text-color': merchantInfoTextColor,
      'owner-address': '0x182619c6Ea074C053eF3f1e1eF81Ec8De6Eb6E44',
    });
  });

  test('it renders correctly with SPD as currency', async function (assert) {
    await visit(
      `/pay/${network}/${merchantSafeId}?amount=${spendAmount}&currency=${spendSymbol}`
    );
    assert.dom(MERCHANT).hasAttribute('data-test-merchant', merchantName);
    assert
      .dom(MERCHANT_LOGO)
      .hasAttribute(
        'data-test-merchant-logo-background',
        merchantInfoBackground
      );
    assert
      .dom(MERCHANT_LOGO)
      .hasAttribute(
        'data-test-merchant-logo-text-color',
        merchantInfoTextColor
      );
    assert.dom(AMOUNT).containsText(`§${spendAmount}`);
    assert
      .dom(USD_AMOUNT)
      .containsText(`${formatUsd(spendToUsd(spendAmount)!)}`);

    let expectedUrl = generateMerchantPaymentUrl({
      network: network,
      merchantSafeID: merchantSafeId,
      currency: spendSymbol,
      amount: spendAmount,
    });
    assert.dom(QR_CODE).hasAttribute('data-test-styled-qr-code', expectedUrl);
    assert.dom(PAYMENT_URL).containsText(expectedUrl);
  });

  test('it renders correctly with no currency provided', async function (assert) {
    // this is basically defaulting to SPEND
    await visit(`/pay/${network}/${merchantSafeId}?amount=${spendAmount}`);
    assert.dom(MERCHANT).hasAttribute('data-test-merchant', merchantName);
    assert
      .dom(MERCHANT_LOGO)
      .hasAttribute(
        'data-test-merchant-logo-background',
        merchantInfoBackground
      );
    assert
      .dom(MERCHANT_LOGO)
      .hasAttribute(
        'data-test-merchant-logo-text-color',
        merchantInfoTextColor
      );
    assert.dom(AMOUNT).containsText(`§${spendAmount}`);
    assert
      .dom(USD_AMOUNT)
      .containsText(`${formatUsd(spendToUsd(spendAmount)!)}`);
    let expectedUrl = generateMerchantPaymentUrl({
      network: network,
      merchantSafeID: merchantSafeId,
      currency: spendSymbol,
      amount: spendAmount,
    });
    assert.dom(QR_CODE).hasAttribute('data-test-styled-qr-code', expectedUrl);
    assert.dom(PAYMENT_URL).containsText(expectedUrl);
  });

  test('it renders correctly with USD as currency', async function (assert) {
    await visit(
      `/pay/${network}/${merchantSafeId}?amount=${usdAmount}&currency=${usdSymbol}`
    );
    assert.dom(MERCHANT).hasAttribute('data-test-merchant', merchantName);
    assert
      .dom(MERCHANT_LOGO)
      .hasAttribute(
        'data-test-merchant-logo-background',
        merchantInfoBackground
      );
    assert
      .dom(MERCHANT_LOGO)
      .hasAttribute(
        'data-test-merchant-logo-text-color',
        merchantInfoTextColor
      );
    assert.dom(AMOUNT).containsText(`§${spendAmount}`);
    assert
      .dom(USD_AMOUNT)
      .containsText(`${formatUsd(spendToUsd(spendAmount)!)}`);
    let expectedUrl = generateMerchantPaymentUrl({
      network: network,
      merchantSafeID: merchantSafeId,
      currency: usdSymbol,
      amount: usdAmount,
    });
    assert.dom(QR_CODE).hasAttribute('data-test-styled-qr-code', expectedUrl);
    assert.dom(PAYMENT_URL).containsText(expectedUrl);
  });

  test('it renders correctly if currency is unrecognised', async function (assert) {
    await visit(
      `/pay/${network}/${merchantSafeId}?amount=300&currency=${invalidCurrencySymbol}`
    );
    assert.dom(MERCHANT).hasAttribute('data-test-merchant', merchantName);
    assert
      .dom(MERCHANT_LOGO)
      .hasAttribute(
        'data-test-merchant-logo-background',
        merchantInfoBackground
      );
    assert
      .dom(MERCHANT_LOGO)
      .hasAttribute(
        'data-test-merchant-logo-text-color',
        merchantInfoTextColor
      );

    assert.dom(AMOUNT).doesNotExist();
    assert.dom(USD_AMOUNT).doesNotExist();

    // we just pass this currency to the wallet to handle without
    // displaying the amounts if we don't recognize the currency
    // currently this is anything that is not SPD or USD
    let expectedUrl = generateMerchantPaymentUrl({
      network: network,
      merchantSafeID: merchantSafeId,
      currency: invalidCurrencySymbol,
      amount: 300,
    });
    assert.dom(QR_CODE).hasAttribute('data-test-styled-qr-code', expectedUrl);
    assert.dom(PAYMENT_URL).containsText(expectedUrl);
  });

  test('it renders correctly if amount is malformed', async function (assert) {
    await visit(
      `/pay/${network}/${merchantSafeId}?amount=30a&currency=${spendSymbol}`
    );

    assert.dom(MERCHANT).hasAttribute('data-test-merchant', merchantName);
    assert
      .dom(MERCHANT_LOGO)
      .hasAttribute(
        'data-test-merchant-logo-background',
        merchantInfoBackground
      );
    assert
      .dom(MERCHANT_LOGO)
      .hasAttribute(
        'data-test-merchant-logo-text-color',
        merchantInfoTextColor
      );

    assert.dom(AMOUNT).doesNotExist();
    assert.dom(USD_AMOUNT).doesNotExist();

    let expectedUrl = generateMerchantPaymentUrl({
      network: network,
      merchantSafeID: merchantSafeId,
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
      `/pay/${network}/${merchantSafeId}?amount=${spendAmount}&currrency=${spendSymbol}`
    );

    assert.dom(MERCHANT).hasAttribute('data-test-merchant', merchantName);
    assert
      .dom(MERCHANT_LOGO)
      .hasAttribute(
        'data-test-merchant-logo-background',
        merchantInfoBackground
      );
    assert
      .dom(MERCHANT_LOGO)
      .hasAttribute(
        'data-test-merchant-logo-text-color',
        merchantInfoTextColor
      );

    assert.dom(AMOUNT).containsText(`§${spendAmount}`);
    assert
      .dom(USD_AMOUNT)
      .containsText(`${formatUsd(spendToUsd(spendAmount)!)}`);

    // assert that the deep link view is rendered
    assert.dom(QR_CODE).doesNotExist();
    let expectedUrl = generateMerchantPaymentUrl({
      network: network,
      merchantSafeID: merchantSafeId,
      currency: spendSymbol,
      amount: spendAmount,
    });
    assert
      .dom(DEEP_LINK)
      .containsText('Pay Merchant')
      .hasAttribute('href', expectedUrl);
    assert.dom(PAYMENT_URL).containsText(expectedUrl);
  });

  // This will be handled in a follow-up PR
  // todo(
  //   'it shows an appropriate error message if merchant details cannot be fetched',
  //   async function (assert) {
  //     await visit(
  //       `/pay/${network}/idontexist?amount=${spendAmount}&currrency=${spendSymbol}`
  //     );
  //   }
  // );
  // todo(
  //   'it renders only the provided currency and not a USD conversion or SPEND amount if the provided currency is not USD or SPEND',
  //   async function (assert) {
  //     await visit(
  //       `/pay/${network}/${merchantSafeId}?amount=${0}&currrency=${malaysianRinggitSymbol}`
  //     );
  //     assert.ok(false);
  //     // assert that merchant details are rendered
  //     // assert that amount is rendered
  //     // assert that the deep link url generated is correct
  //   }
  // );
});
