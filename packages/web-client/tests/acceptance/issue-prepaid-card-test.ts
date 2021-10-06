import { module, test } from 'qunit';
import {
  click,
  currentURL,
  visit,
  waitFor,
  waitUntil,
  fillIn,
  settled,
} from '@ember/test-helpers';
import { setupApplicationTest } from 'ember-qunit';
import Layer2TestWeb3Strategy from '@cardstack/web-client/utils/web3-strategies/test-layer2';
import { fromWei, toWei } from 'web3-utils';
import BN from 'bn.js';

import { setupMirage } from 'ember-cli-mirage/test-support';
import prepaidCardColorSchemes from '../../mirage/fixture-data/prepaid-card-color-schemes';
import prepaidCardPatterns from '../../mirage/fixture-data/prepaid-card-patterns';
import { timeout } from 'ember-concurrency';
import { currentNetworkDisplayInfo as c } from '@cardstack/web-client/utils/web3-strategies/network-display-info';
import { faceValueOptions } from '@cardstack/web-client/components/card-pay/issue-prepaid-card-workflow/index';

import { MirageTestContext } from 'ember-cli-mirage/test-support';
import WorkflowPersistence from '@cardstack/web-client/services/workflow-persistence';
import { setupHubAuthenticationToken } from '../helpers/setup';
import {
  deserializeState,
  WorkflowMeta,
} from '@cardstack/web-client/models/workflow/workflow-session';
import {
  createDepotSafe,
  createPrepaidCardSafe,
  createSafeToken,
  defaultCreatedPrepaidCardDID,
} from '@cardstack/web-client/utils/test-factories';
import {
  convertAmountToNativeDisplay,
  spendToUsd,
} from '@cardstack/cardpay-sdk';

interface Context extends MirageTestContext {}

// Dai amounts based on available prepaid card options
const MIN_SPEND_AMOUNT = Math.min(...faceValueOptions);
const MIN_AMOUNT_TO_PASS = new BN(
  toWei(`${Math.ceil(MIN_SPEND_AMOUNT / 100)}`)
);
const FAILING_AMOUNT = new BN(
  toWei(`${Math.floor(MIN_SPEND_AMOUNT / 100) - 1}`)
);
const SLIGHTLY_LESS_THAN_MAX_VALUE_IN_ETHER =
  Math.floor(Math.max(...faceValueOptions) / 100) - 1;
const SLIGHTLY_LESS_THAN_MAX_VALUE = new BN(
  toWei(`${SLIGHTLY_LESS_THAN_MAX_VALUE_IN_ETHER}`)
);

function postableSel(milestoneIndex: number, postableIndex: number): string {
  return `[data-test-milestone="${milestoneIndex}"][data-test-postable="${postableIndex}"]`;
}

function epiloguePostableSel(postableIndex: number): string {
  return `[data-test-epilogue][data-test-postable="${postableIndex}"]`;
}

function milestoneCompletedSel(milestoneIndex: number): string {
  return `[data-test-milestone-completed][data-test-milestone="${milestoneIndex}"]`;
}

function cancelationPostableSel(postableIndex: number) {
  return `[data-test-cancelation][data-test-postable="${postableIndex}"]`;
}

module('Acceptance | issue prepaid card', function (hooks) {
  setupApplicationTest(hooks);
  setupMirage(hooks);

  hooks.beforeEach(function (this: Context) {
    this.server.db.loadData({
      prepaidCardColorSchemes,
      prepaidCardPatterns,
    });
  });

  test('Initiating workflow without wallet connections', async function (this: Context, assert) {
    await visit('/card-pay');
    assert.equal(currentURL(), '/card-pay/balances');
    await click('[data-test-workflow-button="issue-prepaid-card"]');

    let post = postableSel(0, 0);
    assert.dom(`${postableSel(0, 0)} img`).exists();
    assert.dom(postableSel(0, 0)).containsText('Hello, it’s nice to see you!');
    assert.dom(postableSel(0, 1)).containsText('Let’s issue a prepaid card.');

    assert
      .dom(postableSel(0, 2))
      .containsText(
        `Before we get started, please connect your ${c.layer2.fullName} wallet via your Card Wallet mobile app.`
      );

    assert
      .dom(postableSel(0, 3))
      .containsText(
        'Once you have installed the app, open the app and add an existing wallet/account'
      );

    assert
      .dom(`${postableSel(0, 4)} [data-test-wallet-connect-loading-qr-code]`)
      .exists();

    let layer2Service = this.owner.lookup('service:layer2-network')
      .strategy as Layer2TestWeb3Strategy;
    layer2Service.test__simulateWalletConnectUri();
    await waitFor('[data-test-wallet-connect-qr-code]');
    assert.dom('[data-test-wallet-connect-qr-code]').exists();

    // Simulate the user scanning the QR code and connecting their mobile wallet
    let layer2AccountAddress = '0x182619c6Ea074C053eF3f1e1eF81Ec8De6Eb6E44';
    layer2Service.test__simulateAccountsChanged([layer2AccountAddress]);
    let depotAddress = '0xB236ca8DbAB0644ffCD32518eBF4924ba8666666';
    layer2Service.test__simulateAccountSafes(layer2AccountAddress, [
      createDepotSafe({
        address: depotAddress,
        owners: [layer2AccountAddress],
        tokens: [
          createSafeToken('DAI', SLIGHTLY_LESS_THAN_MAX_VALUE.toString()),
          createSafeToken('CARD', '250000000000000000000'),
        ],
      }),
      createPrepaidCardSafe({
        address: '0x123400000000000000000000000000000000abcd',
        owners: [layer2AccountAddress],
        spendFaceValue: 2324,
        prepaidCardOwner: layer2AccountAddress,
        issuer: layer2AccountAddress,
      }),
    ]);

    await waitUntil(
      () => !document.querySelector('[data-test-wallet-connect-qr-code]')
    );
    assert
      .dom(
        '[data-test-postable] [data-test-layer-2-wallet-card] [data-test-address-field]'
      )
      .containsText(layer2AccountAddress)
      .isVisible();

    await settled();

    assert.dom('[data-test-prepaid-cards-count]').containsText('1');

    assert
      .dom(milestoneCompletedSel(0))
      .containsText(`${c.layer2.fullName} wallet connected`);

    assert
      .dom(postableSel(1, 0))
      .containsText(
        'To store card customization data in the Cardstack Hub, you need to authenticate using your Card Wallet'
      );
    post = postableSel(1, 1);
    await click(
      `${post} [data-test-boxel-action-chin] [data-test-boxel-button]`
    );
    layer2Service.test__simulateHubAuthentication('abc123--def456--ghi789');

    await waitFor(postableSel(1, 2));
    assert
      .dom(postableSel(1, 2))
      .containsText('First, you can choose the look and feel of your card');

    post = postableSel(1, 3);

    await waitFor('[data-test-layout-customization-form]');
    assert.dom('[data-test-layout-customization-form]').isVisible();
    assert
      .dom(`${post} [data-test-boxel-action-chin] [data-test-boxel-button]`)
      .isDisabled();

    await fillIn('[data-test-layout-customization-name-input]', 'A');

    assert
      .dom(`${post} [data-test-boxel-action-chin] [data-test-boxel-button]`)
      .isEnabled();

    await fillIn('[data-test-layout-customization-name-input]', '');
    assert
      .dom(`${post} [data-test-boxel-input-error-message]`)
      .containsText('required');
    assert
      .dom(`${post} [data-test-boxel-action-chin] [data-test-boxel-button]`)
      .isDisabled();

    await fillIn('[data-test-layout-customization-name-input]', 'JJ');
    assert.dom(`${post} [data-test-boxel-input-error-message]`).doesNotExist();

    assert
      .dom(`${post} [data-test-boxel-action-chin] [data-test-boxel-button]`)
      .isEnabled();

    let backgroundChoice = prepaidCardColorSchemes[1].background;
    let patternChoice = prepaidCardPatterns[3].patternUrl;

    await waitUntil(
      () =>
        document.querySelectorAll(
          '[data-test-customization-background-loading],[data-test-customization-theme-loading]'
        ).length === 0
    );

    assert
      .dom(
        `${post}  [data-test-prepaid-card-background="${backgroundChoice}"][data-test-prepaid-card-pattern="${patternChoice}"]`
      )
      .doesNotExist();

    await click(
      `${post}  [data-test-customization-background-selection-item="${backgroundChoice}"]`
    );
    await click(
      `${post} [data-test-customization-pattern-selection-item="${patternChoice}"]`
    );

    assert
      .dom(
        `${post} [data-test-prepaid-card-background="${backgroundChoice}"][data-test-prepaid-card-pattern="${patternChoice}"]`
      )
      .exists();

    await click(
      `${post} [data-test-boxel-action-chin] [data-test-boxel-button]`
    );

    assert.dom(`${post} [data-test-layout-customization-form]`).isNotVisible();
    assert.dom(`${post} [data-test-layout-customization-display]`).isVisible();

    assert
      .dom(
        `${post} [data-test-prepaid-card-background="${backgroundChoice}"][data-test-prepaid-card-pattern="${patternChoice}"]`
      )
      .exists();
    assert.dom(`${post} [data-test-prepaid-card-attributes]`).doesNotExist();

    assert
      .dom(`${post} [data-test-boxel-action-chin] [data-test-boxel-button]`)
      .containsText('Edit')
      .isEnabled();

    await settled();

    assert.dom(milestoneCompletedSel(1)).containsText('Layout customized');

    assert.dom(postableSel(2, 0)).containsText('Nice choice!');
    assert
      .dom(postableSel(2, 1))
      .containsText('How do you want to fund your prepaid card?');

    post = postableSel(2, 2);
    // // funding-source card
    assert
      .dom('[data-test-account-outer] [data-test-account-address]')
      .hasText('0x1826...6E44');
    assert
      .dom(
        `${post} [data-test-account-depot-outer] [data-test-account-address]`
      )
      .hasText(depotAddress);
    assert
      .dom(`${post} [data-test-balance-chooser-dropdown="DAI.CPXD"]`)
      .containsText(`${SLIGHTLY_LESS_THAN_MAX_VALUE_IN_ETHER.toFixed(2)} DAI`);
    await click(
      `${post} [data-test-boxel-action-chin] [data-test-boxel-button]`
    );
    assert
      .dom(`${post} [data-test-balance-chooser-dropdown="DAI.CPXD"]`)
      .doesNotExist();
    assert
      .dom(`${post} [data-test-account-balance]`)
      .containsText(`${SLIGHTLY_LESS_THAN_MAX_VALUE_IN_ETHER.toFixed(2)} DAI`);

    assert
      .dom(postableSel(2, 3))
      .containsText('choose the face value of your prepaid card');
    // // face-value card
    assert
      .dom('[data-test-balance-view-summary]')
      .containsText(`${SLIGHTLY_LESS_THAN_MAX_VALUE_IN_ETHER.toFixed(2)} DAI`);
    await click('[data-test-balance-view-summary]');
    assert
      .dom('[data-test-balance-view-account-address]')
      .containsText(layer2AccountAddress);
    assert
      .dom('[data-test-balance-view-depot-address]')
      .containsText(depotAddress);
    assert
      .dom('[data-test-balance-view-token-amount]')
      .containsText(`${SLIGHTLY_LESS_THAN_MAX_VALUE_IN_ETHER.toFixed(2)} DAI`);
    assert.dom('[data-test-face-value-display]').doesNotExist();
    assert.dom('[data-test-face-value-option]').exists({ count: 6 });
    assert.dom('[data-test-face-value-option-checked]').doesNotExist();
    assert.dom('[data-test-face-value-option="10000"] input').isNotDisabled();
    assert.dom('[data-test-face-value-option="50000"] input').isDisabled();
    assert
      .dom('[data-test-face-value-option="50000"]')
      .containsText('50,000 SPEND');
    assert
      .dom('[data-test-face-value-option="50000"]')
      .containsText('$500 USD');
    assert
      .dom('[data-test-face-value-option="50000"]')
      .containsText('≈ 500 DAI.CPXD');
    assert.dom('[data-test-face-value-option="10000"] input').isNotDisabled();
    assert.dom('[data-test-face-value-option="5000"] input').isNotDisabled();
    await click('[data-test-face-value-option="5000"]');
    assert.dom('[data-test-face-value-option="5000"] input').isChecked();
    assert.dom('[data-test-face-value-option-checked]').exists({ count: 1 });
    await click(
      `${postableSel(
        2,
        4
      )} [data-test-boxel-action-chin] [data-test-boxel-button]`
    );

    assert.dom('[data-test-face-value-option]').doesNotExist();
    assert.dom('[data-test-face-value-display]').containsText('5,000 SPEND');
    await click(
      `${postableSel(
        2,
        4
      )} [data-test-boxel-action-chin] [data-test-boxel-button]`
    );

    await click('[data-test-face-value-option="10000"]');
    assert.dom('[data-test-face-value-option="10000"] input').isChecked();
    await click(
      `${postableSel(
        2,
        4
      )} [data-test-boxel-action-chin] [data-test-boxel-button]`
    );

    assert.dom('[data-test-face-value-display]').containsText('10,000 SPEND');
    assert.dom('[data-test-face-value-display]').containsText('$100.00 USD');
    assert.dom('[data-test-face-value-display]').containsText('≈ 100 DAI.CPXD');

    await waitFor(milestoneCompletedSel(2));
    assert.dom(milestoneCompletedSel(2)).containsText('Face value chosen');

    assert
      .dom(postableSel(3, 0))
      .containsText('This is what your prepaid card will look like.');

    assert
      .dom(`${postableSel(3, 1)} [data-test-prepaid-card-issuer-name]`)
      .containsText('JJ');
    assert
      .dom(
        `${postableSel(
          3,
          1
        )} [data-test-prepaid-card-issuer-name-labeled-value]`
      )
      .containsText('JJ');
    assert
      .dom(
        `${postableSel(3, 1)} [data-test-prepaid-card-face-value-labeled-value]`
      )
      .containsText('10,000 SPEND')
      .containsText('$100.00 USD');

    assert
      .dom(`${postableSel(3, 1)} [data-test-prepaid-card-balance]`)
      .containsText('10,000');
    assert
      .dom(`${postableSel(3, 1)} [data-test-prepaid-card-usd-balance]`)
      .containsText('100');
    assert.dom(`${post} [data-test-prepaid-card-attributes]`).doesNotExist();

    assert.dom(
      `${postableSel(
        3,
        1
      )} [data-test-prepaid-card-background="${backgroundChoice}"][data-test-prepaid-card-pattern="${patternChoice}"]`
    );

    layer2Service.balancesRefreshed = false;

    // preview card
    post = postableSel(3, 1);
    await click(
      `${post} [data-test-boxel-action-chin] [data-test-boxel-button]`
    );

    assert
      .dom(`${post} [data-test-boxel-action-chin-action-status-area]`)
      .containsText('Preparing to create your custom prepaid card…');

    await timeout(250);

    let prepaidCardAddress = '0xaeFbA62A2B3e90FD131209CC94480E722704E1F8';

    layer2Service.test__simulateIssuePrepaidCardForAmount(
      10000,
      layer2AccountAddress,
      prepaidCardAddress,
      {}
    );

    await waitFor(milestoneCompletedSel(3));
    assert.dom(milestoneCompletedSel(3)).containsText('Transaction confirmed');

    assert
      .dom(`${postableSel(3, 1)} [data-test-boxel-action-chin]`)
      .containsText('Confirmed');

    await settled();

    let customizationStorageRequest = (
      this as any
    ).server.pretender.handledRequests.find((req: { url: string }) =>
      req.url.includes('prepaid-card-customizations')
    );

    assert.equal(
      customizationStorageRequest.requestHeaders['authorization'],
      'Bearer: abc123--def456--ghi789'
    );

    let customizationRequestJson = JSON.parse(
      customizationStorageRequest.requestBody
    );

    assert.equal(customizationRequestJson.data.attributes['issuer-name'], 'JJ');
    assert.equal(
      customizationRequestJson.data.relationships.pattern.data.id,
      '80cb8f99-c5f7-419e-9c95-2e87a9d8db32'
    );
    assert.equal(
      customizationRequestJson.data.relationships['color-scheme'].data.id,
      '4f219852-33ee-4e4c-81f7-76318630a423'
    );

    assert
      .dom(
        `${postableSel(3, 1)} [data-test-prepaid-card-address-labeled-value]`
      )
      .containsText(`0xaeFb...E1F8 on ${c.layer2.fullName}`);

    assert
      .dom(epiloguePostableSel(0))
      .containsText('Congratulations, you have created a prepaid card!');

    await waitFor(epiloguePostableSel(1));

    assert.dom(epiloguePostableSel(1)).containsText('Prepaid card issued');
    assert
      .dom(`${epiloguePostableSel(1)} [data-test-prepaid-card-issuer-name]`)
      .containsText('JJ');
    assert
      .dom(`${epiloguePostableSel(1)} [data-test-prepaid-card-attributes]`)
      .containsText('Non-reloadable Transferrable');
    assert.dom(
      `${epiloguePostableSel(
        1
      )} [data-test-prepaid-card-background="${backgroundChoice}"][data-test-prepaid-card-pattern="${patternChoice}"]`
    );

    await layer2Service.test__simulateBalances({
      defaultToken: new BN('150000000000000000000'),
      card: new BN('500000000000000000000'),
    });

    await waitFor(epiloguePostableSel(2));

    assert
      .dom(epiloguePostableSel(2))
      .containsText(
        `This is the remaining balance in your ${c.layer2.fullName} wallet`
      );

    await waitFor(epiloguePostableSel(3));

    assert
      .dom(`${epiloguePostableSel(3)} [data-test-balance="DAI.CPXD"]`)
      .containsText('150.0');

    assert.ok(layer2Service.balancesRefreshed);

    await waitFor(epiloguePostableSel(4));

    let workflowPersistenceService = this.owner.lookup(
      'service:workflow-persistence'
    ) as WorkflowPersistence;

    const workflowPersistenceId = new URL(
      'http://domain.test/' + currentURL()
    ).searchParams.get('flow-id')!;

    assert
      .dom(
        `${epiloguePostableSel(
          4
        )} [data-test-issue-prepaid-card-next-step="dashboard"]`
      )
      .exists();
    await click(
      `${epiloguePostableSel(
        4
      )} [data-test-issue-prepaid-card-next-step="dashboard"]`
    );
    assert.dom('[data-test-workflow-thread]').doesNotExist();

    assert.dom('[data-test-prepaid-cards-count]').containsText('2');

    const persistedData = workflowPersistenceService.getPersistedData(
      workflowPersistenceId
    );

    assert.equal(persistedData.name, 'PREPAID_CARD_ISSUANCE');
    let persistedState = persistedData.state;
    persistedState.prepaidCardSafe = persistedState.prepaidCardSafe.replace(
      /"createdAt":[\d.]+,/,
      ''
    );

    let prepaidCardSafe = createPrepaidCardSafe({
      address: '0xaeFbA62A2B3e90FD131209CC94480E722704E1F8',
      owners: ['0x182619c6Ea074C053eF3f1e1eF81Ec8De6Eb6E44'],
      spendFaceValue: 10000,
      prepaidCardOwner: '0x182619c6Ea074C053eF3f1e1eF81Ec8De6Eb6E44',
      issuer: '0x182619c6Ea074C053eF3f1e1eF81Ec8De6Eb6E44',
      customizationDID: defaultCreatedPrepaidCardDID,
    });
    // @ts-ignore
    delete prepaidCardSafe.createdAt;

    let deserializedState = deserializeState({
      ...persistedState,
    });
    // We don't have a good way to control the date properties in an acceptance test yet
    // sinon.useFakeTimers will mess up a couple of browser apis + ember concurrency
    if (deserializedState.meta) {
      delete (deserializedState.meta as WorkflowMeta)?.createdAt;
      delete (deserializedState.meta as WorkflowMeta)?.updatedAt;
    }

    assert.propEqual(deserializedState, {
      colorScheme: {
        patternColor: 'white',
        textColor: 'black',
        background: '#37EB77',
        id: '4f219852-33ee-4e4c-81f7-76318630a423',
      },
      daiMinValue: MIN_AMOUNT_TO_PASS.toString(),
      spendMinValue: MIN_SPEND_AMOUNT,
      did: defaultCreatedPrepaidCardDID,
      issuerName: 'JJ',
      layer2WalletAddress: '0x182619c6Ea074C053eF3f1e1eF81Ec8De6Eb6E44',
      pattern: {
        patternUrl:
          '/assets/images/prepaid-card-customizations/pattern-3-89f3b92e275536a92558d500a3dc9e4d.svg',
        id: '80cb8f99-c5f7-419e-9c95-2e87a9d8db32',
      },
      prepaidCardAddress: '0xaeFbA62A2B3e90FD131209CC94480E722704E1F8',
      prepaidCardSafe,
      prepaidFundingToken: 'DAI.CPXD',
      reloadable: false,
      spendFaceValue: 10000,
      transferrable: true,
      txnHash: 'exampleTxnHash',
      meta: {
        completedCardNames: [
          'LAYER2_CONNECT',
          'HUB_AUTH',
          'LAYOUT_CUSTOMIZATION',
          'FUNDING_SOURCE',
          'FACE_VALUE',
          'PREVIEW',
          'CONFIRMATION',
          'EPILOGUE_LAYER_TWO_CONNECT_CARD',
        ],
        completedMilestonesCount: 4,
        milestonesCount: 4,
      },
    });
  });

  module('Tests with the layer 2 wallet already connected', function (hooks) {
    let layer2Service: Layer2TestWeb3Strategy;
    let layer2AccountAddress = '0x182619c6Ea074C053eF3f1e1eF81Ec8De6Eb6E44';
    setupHubAuthenticationToken(hooks);

    hooks.beforeEach(async function () {
      layer2Service = this.owner.lookup('service:layer2-network')
        .strategy as Layer2TestWeb3Strategy;
      layer2Service.test__simulateAccountsChanged([layer2AccountAddress]);
      await layer2Service.test__simulateBalances({
        defaultToken: MIN_AMOUNT_TO_PASS,
        card: new BN('500000000000000000000'),
      });
      let testDepot = createDepotSafe({
        address: '0xB236ca8DbAB0644ffCD32518eBF4924ba8666666',
        tokens: [
          createSafeToken('DAI', '250000000000000000000'),
          createSafeToken('CARD', '500000000000000000000'),
        ],
      });
      await layer2Service.test__simulateDepot(testDepot);
    });

    test('Disconnecting Layer 2 from within the workflow', async function (assert) {
      await visit('/card-pay');
      assert.equal(currentURL(), '/card-pay/balances');
      await click('[data-test-workflow-button="issue-prepaid-card"]');

      assert
        .dom(
          '[data-test-postable] [data-test-layer-2-wallet-card] [data-test-address-field]'
        )
        .containsText(layer2AccountAddress)
        .isVisible();

      await settled();

      assert
        .dom(milestoneCompletedSel(0))
        .containsText(`${c.layer2.fullName} wallet connected`);

      await click(
        `[data-test-layer-2-wallet-card] [data-test-layer-2-wallet-disconnect-button]`
      );

      // test that all cta buttons are disabled
      let milestoneCtaButtonCount = Array.from(
        document.querySelectorAll(
          '[data-test-milestone] [data-test-boxel-action-chin] button[data-test-boxel-button]'
        )
      ).length;
      assert
        .dom(
          '[data-test-milestone] [data-test-boxel-action-chin] button[data-test-boxel-button]:disabled'
        )
        .exists(
          { count: milestoneCtaButtonCount },
          'All cta buttons in milestones should be disabled'
        );

      assert
        .dom(cancelationPostableSel(0))
        .containsText(
          `It looks like your ${c.layer2.fullName} wallet got disconnected. If you still want to create a prepaid card, please start again by connecting your wallet.`
        );
      assert.dom(cancelationPostableSel(1)).containsText('Workflow canceled');

      assert
        .dom(
          '[data-test-workflow-default-cancelation-restart="issue-prepaid-card"]'
        )
        .exists();
    });

    test('Disconnecting Layer 2 from outside the current tab (mobile wallet / other tabs)', async function (assert) {
      await visit('/card-pay');
      assert.equal(currentURL(), '/card-pay/balances');
      await click('[data-test-workflow-button="issue-prepaid-card"]');

      assert
        .dom(
          '[data-test-postable] [data-test-layer-2-wallet-card] [data-test-address-field]'
        )
        .containsText(layer2AccountAddress)
        .isVisible();

      await settled();

      assert
        .dom(milestoneCompletedSel(0))
        .containsText(`${c.layer2.fullName} wallet connected`);

      assert.dom('[data-test-layout-customization-form]').isVisible();

      layer2Service.test__simulateDisconnectFromWallet();

      await waitFor(
        '[data-test-workflow-default-cancelation-cta="issue-prepaid-card"]'
      );
      // test that all cta buttons are disabled
      let milestoneCtaButtonCount = Array.from(
        document.querySelectorAll(
          '[data-test-milestone] [data-test-boxel-action-chin] button[data-test-boxel-button]'
        )
      ).length;
      assert
        .dom(
          '[data-test-milestone] [data-test-boxel-action-chin] button[data-test-boxel-button]:disabled'
        )
        .exists(
          { count: milestoneCtaButtonCount },
          'All cta buttons in milestones should be disabled'
        );
      assert
        .dom(cancelationPostableSel(0))
        .containsText(
          `It looks like your ${c.layer2.fullName} wallet got disconnected. If you still want to create a prepaid card, please start again by connecting your wallet.`
        );
      assert.dom(cancelationPostableSel(1)).containsText('Workflow canceled');
      assert
        .dom(
          '[data-test-workflow-default-cancelation-restart="issue-prepaid-card"]'
        )
        .exists();
    });

    test('Workflow is canceled after showing wallet connection card if balance insufficient to create prepaid card', async function (assert) {
      await visit('/card-pay');
      assert.equal(currentURL(), '/card-pay/balances');

      await layer2Service.test__simulateBalances({
        defaultToken: FAILING_AMOUNT,
      });

      await click('[data-test-workflow-button="issue-prepaid-card"]');

      assert
        .dom(
          '[data-test-postable] [data-test-layer-2-wallet-card] [data-test-address-field]'
        )
        .containsText(layer2AccountAddress)
        .isVisible();

      await settled();

      assert
        .dom(cancelationPostableSel(0))
        .containsText(
          `Looks like there’s not enough balance in your ${
            c.layer2.fullName
          } wallet to fund a prepaid card. Before you can continue, please add funds to your ${
            c.layer2.fullName
          } wallet by bridging some tokens from your ${
            c.layer1.fullName
          } wallet. The minimum balance needed to issue a prepaid card is approximately ${Math.ceil(
            Number(fromWei(MIN_AMOUNT_TO_PASS.toString()))
          )} DAI.CPXD (${convertAmountToNativeDisplay(
            spendToUsd(MIN_SPEND_AMOUNT)!,
            'USD'
          )}).`
        );
      assert.dom(cancelationPostableSel(1)).containsText('Workflow canceled');

      assert
        .dom(
          '[data-test-issue-prepaid-card-workflow-insufficient-funds-deposit]'
        )
        .exists();
    });

    test('Changing Layer 2 account should cancel the workflow', async function (assert) {
      let secondLayer2AccountAddress =
        '0x5416C61193C3393B46C2774ac4717C252031c0bE';
      await visit('/card-pay');
      assert.equal(currentURL(), '/card-pay/balances');
      await click('[data-test-workflow-button="issue-prepaid-card"]');

      assert
        .dom(
          '[data-test-postable] [data-test-layer-2-wallet-card] [data-test-address-field]'
        )
        .containsText(layer2AccountAddress)
        .isVisible();

      await settled();

      assert
        .dom(milestoneCompletedSel(0))
        .containsText(`${c.layer2.fullName} wallet connected`);

      layer2Service.test__simulateAccountsChanged([secondLayer2AccountAddress]);

      await settled();

      // test that all cta buttons are disabled
      let milestoneCtaButtonCount = Array.from(
        document.querySelectorAll(
          '[data-test-milestone] [data-test-boxel-action-chin] button[data-test-boxel-button]'
        )
      ).length;
      assert
        .dom(
          '[data-test-milestone] [data-test-boxel-action-chin] button[data-test-boxel-button]:disabled'
        )
        .exists(
          { count: milestoneCtaButtonCount },
          'All cta buttons in milestones should be disabled'
        );

      assert
        .dom(cancelationPostableSel(0))
        .containsText(
          'It looks like you changed accounts in the middle of this workflow. If you still want to create a prepaid card, please restart the workflow.'
        );
      assert.dom(cancelationPostableSel(1)).containsText('Workflow canceled');

      assert
        .dom(
          '[data-test-workflow-default-cancelation-restart="issue-prepaid-card"]'
        )
        .exists();
    });
  });
});
