import { module, test } from 'qunit';
import {
  click,
  currentURL,
  fillIn,
  settled,
  visit,
  waitFor,
  waitUntil,
} from '@ember/test-helpers';
import { setupApplicationTest } from 'ember-qunit';
import Layer2TestWeb3Strategy from '@cardstack/web-client/utils/web3-strategies/test-layer2';
import { currentNetworkDisplayInfo as c } from '@cardstack/web-client/utils/web3-strategies/network-display-info';
import BN from 'bn.js';
import { setupMirage } from 'ember-cli-mirage/test-support';
import { MERCHANT_CREATION_FEE_IN_SPEND } from '@cardstack/web-client/components/card-pay/create-merchant-workflow/workflow-config';
import { formatUsd, PrepaidCardSafe, spendToUsd } from '@cardstack/cardpay-sdk';

function postableSel(milestoneIndex: number, postableIndex: number): string {
  return `[data-test-milestone="${milestoneIndex}"][data-test-postable="${postableIndex}"]`;
}

function epiloguePostableSel(postableIndex: number): string {
  return `[data-test-epilogue][data-test-postable="${postableIndex}"]`;
}

function milestoneCompletedSel(milestoneIndex: number): string {
  return `[data-test-milestone-completed][data-test-milestone="${milestoneIndex}"]`;
}

let layer2AccountAddress = '0x182619c6Ea074C053eF3f1e1eF81Ec8De6Eb6E44';
let prepaidCardAddress = '0x123400000000000000000000000000000000abcd';

let secondLayer2AccountAddress = '0x5416C61193C3393B46C2774ac4717C252031c0bE';
let secondPrepaidCardAddress = '0x123400000000000000000000000000000000defa';

function createMockPrepaidCard(
  eoaAddress: string,
  prepaidCardAddress: string,
  amount: number
) {
  return {
    type: 'prepaid-card',
    createdAt: Date.now() / 1000,

    address: prepaidCardAddress,

    tokens: [],
    owners: [eoaAddress],

    issuingToken: '0xTOKEN',
    spendFaceValue: amount,
    prepaidCardOwner: eoaAddress,
    hasBeenUsed: false,
    issuer: eoaAddress,
    reloadable: false,
    transferrable: false,
  } as PrepaidCardSafe;
}

module('Acceptance | create merchant', function (hooks) {
  setupApplicationTest(hooks);
  setupMirage(hooks);

  test('initiating workflow without wallet connections', async function (assert) {
    await visit('/card-pay');
    await click(
      '[data-test-card-pay-header-tab][href="/card-pay/merchant-services"]'
    );
    assert.equal(currentURL(), '/card-pay/merchant-services');

    await click('[data-test-workflow-button="create-merchant"]');

    let post = postableSel(0, 0);
    assert.dom(`${postableSel(0, 0)} img`).exists();
    assert.dom(postableSel(0, 0)).containsText('Hello, nice to see you!');
    assert.dom(postableSel(0, 1)).containsText('create a merchant account');

    assert
      .dom(postableSel(0, 2))
      .containsText('connect your L2 test chain wallet');

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
    layer2Service.test__simulateAccountsChanged([layer2AccountAddress]);
    layer2Service.test__simulateBalances({
      defaultToken: new BN(0),
    });
    layer2Service.test__simulateAccountSafes(layer2AccountAddress, [
      createMockPrepaidCard(
        layer2AccountAddress,
        prepaidCardAddress,
        MERCHANT_CREATION_FEE_IN_SPEND
      ),
    ]);
    await waitUntil(
      () => !document.querySelector('[data-test-wallet-connect-qr-code]')
    );

    assert
      .dom(
        '[data-test-card-pay-layer-2-connect] [data-test-card-pay-connect-button]'
      )
      .hasText('0x1826...6E44');
    await waitFor(milestoneCompletedSel(0));
    assert
      .dom(milestoneCompletedSel(0))
      .containsText('L2 test chain wallet connected');

    post = postableSel(1, 0);
    await waitFor(post);

    assert
      .dom(post)
      .containsText(
        'To store data in the Cardstack Hub, you need to authenticate using your Card Wallet'
      );
    post = postableSel(1, 1);

    await waitFor(post);

    await click(
      `${post} [data-test-boxel-action-chin] [data-test-boxel-button]`
    );
    layer2Service.test__simulateHubAuthentication('abc123--def456--ghi789');

    await waitFor(postableSel(1, 2));

    assert
      .dom(postableSel(1, 2))
      .containsText('Let’s create a new merchant account.');

    post = postableSel(1, 3);

    await waitFor(post);

    assert.dom(post).containsText('Choose a name and ID for the merchant');

    let merchantAddress = '0x1234000000000000000000000000000000004321';

    // // merchant-customization card
    // TODO verify and interact with merchant customization card default state
    await fillIn(
      `[data-test-merchant-customization-merchant-name-field] input`,
      'HELLO!'
    );
    await fillIn(
      `[data-test-merchant-customization-merchant-id-field] input`,
      'abc123'
    );
    await waitUntil(
      () =>
        (document.querySelector(
          '[data-test-validation-state-input]'
        ) as HTMLElement).dataset.testValidationStateInput === 'valid'
    );
    await click(`[data-test-merchant-customization-save-details]`);

    // prepaid-card-choice card
    post = postableSel(1, 4);
    await waitFor(post);
    assert
      .dom(post)
      .containsText('Choose a prepaid card to fund merchant creation');
    await click(
      `${post} [data-test-boxel-action-chin] [data-test-boxel-button]`
    );

    // need wait for Hub POST /api/merchant-infos
    // eslint-disable-next-line ember/no-settled-after-test-helper
    await settled();

    layer2Service.test__simulateRegisterMerchantForAddress(
      prepaidCardAddress,
      merchantAddress,
      {}
    );

    await waitFor('[data-test-prepaid-card-choice-is-complete]');
    assert
      .dom('[data-test-prepaid-card-choice-merchant-address]')
      .containsText(merchantAddress);

    await waitFor(milestoneCompletedSel(1));
    assert.dom(milestoneCompletedSel(1)).containsText('Merchant created');

    assert
      .dom(epiloguePostableSel(0))
      .containsText('You have created a merchant.');

    await waitFor(epiloguePostableSel(1));

    await click(
      `${epiloguePostableSel(
        1
      )} [data-test-create-merchant-next-step="dashboard"]`
    );
    assert.dom('[data-test-workflow-thread]').doesNotExist();

    await visit('/card-pay/balances');
    assert
      .dom('[data-test-card-balances]')
      .containsText('§0', 'expected card balance to have updated');
  });

  module('Tests with the layer 2 wallet already connected', function (hooks) {
    let layer2Service: Layer2TestWeb3Strategy;

    hooks.beforeEach(function () {
      layer2Service = this.owner.lookup('service:layer2-network')
        .strategy as Layer2TestWeb3Strategy;
      layer2Service.test__simulateAccountsChanged([layer2AccountAddress]);
      layer2Service.test__simulateBalances({
        defaultToken: new BN(0),
      });

      layer2Service.test__simulateAccountSafes(layer2AccountAddress, [
        createMockPrepaidCard(
          layer2AccountAddress,
          prepaidCardAddress,
          MERCHANT_CREATION_FEE_IN_SPEND
        ),
      ]);
    });

    test('initiating workflow with layer 2 wallet already connected', async function (assert) {
      await visit('/card-pay/merchant-services?flow=create-merchant');
      assert.equal(
        currentURL(),
        '/card-pay/merchant-services?flow=create-merchant'
      );
      assert
        .dom(postableSel(0, 2))
        .containsText(
          `Looks like you’ve already connected your ${c.layer2.fullName} wallet`
        );
      assert
        .dom(
          '[data-test-layer-2-wallet-card] [data-test-layer-2-wallet-connected-status]'
        )
        .containsText('Connected');
      assert
        .dom(
          '[data-test-layer-2-wallet-card] [data-test-wallet-connect-qr-code]'
        )
        .doesNotExist();
      assert
        .dom(milestoneCompletedSel(0))
        .containsText(`${c.layer2.fullName} wallet connected`);
    });

    test('disconnecting Layer 2 after proceeding beyond it', async function (assert) {
      await visit('/card-pay/merchant-services?flow=create-merchant');
      assert.equal(
        currentURL(),
        '/card-pay/merchant-services?flow=create-merchant'
      );
      assert
        .dom(
          '[data-test-postable] [data-test-layer-2-wallet-card] [data-test-address-field]'
        )
        .containsText(layer2AccountAddress)
        .isVisible();
      assert
        .dom(milestoneCompletedSel(0))
        .containsText(`${c.layer2.fullName} wallet connected`);

      layer2Service.test__simulateDisconnectFromWallet();
      await settled();

      assert
        .dom('[data-test-postable="0"][data-test-cancelation]')
        .containsText(
          `It looks like your ${c.layer2.fullName} wallet got disconnected. If you still want to create a merchant, please start again by connecting your wallet.`
        );
      assert
        .dom('[data-test-workflow-default-cancelation-cta="create-merchant"]')
        .containsText('Workflow canceled');

      await click(
        '[data-test-workflow-default-cancelation-restart="create-merchant"]'
      );
      assert.equal(
        currentURL(),
        '/card-pay/merchant-services?flow=create-merchant'
      );

      layer2Service.test__simulateWalletConnectUri();
      await waitFor('[data-test-wallet-connect-qr-code]');
      assert
        .dom(
          '[data-test-layer-2-wallet-card] [data-test-wallet-connect-qr-code]'
        )
        .exists();
      assert
        .dom('[data-test-workflow-default-cancelation-cta="create-merchant"]')
        .doesNotExist();
    });

    test('changing Layer 2 account should cancel the workflow', async function (assert) {
      await visit('/card-pay/merchant-services?flow=create-merchant');
      assert.equal(
        currentURL(),
        '/card-pay/merchant-services?flow=create-merchant'
      );
      assert
        .dom(
          '[data-test-postable] [data-test-layer-2-wallet-card] [data-test-address-field]'
        )
        .containsText(layer2AccountAddress)
        .isVisible();
      assert
        .dom(milestoneCompletedSel(0))
        .containsText(`${c.layer2.fullName} wallet connected`);

      layer2Service.test__simulateAccountsChanged([secondLayer2AccountAddress]);

      layer2Service.test__simulateAccountSafes(secondLayer2AccountAddress, [
        createMockPrepaidCard(
          secondLayer2AccountAddress,
          secondPrepaidCardAddress,
          MERCHANT_CREATION_FEE_IN_SPEND
        ),
      ]);
      await settled();

      assert
        .dom('[data-test-postable="0"][data-test-cancelation]')
        .containsText(
          'It looks like you changed accounts in the middle of this workflow. If you still want to create a merchant, please restart the workflow.'
        );
      assert
        .dom('[data-test-workflow-default-cancelation-cta="create-merchant"]')
        .containsText('Workflow canceled');

      await click(
        '[data-test-workflow-default-cancelation-restart="create-merchant"]'
      );
      assert.equal(
        currentURL(),
        '/card-pay/merchant-services?flow=create-merchant'
      );
    });
  });

  test('it cancels the workflow if there are no prepaid cards associated with the EOA', async function (assert) {
    let layer2Service = this.owner.lookup('service:layer2-network')
      .strategy as Layer2TestWeb3Strategy;
    layer2Service.test__simulateAccountsChanged([layer2AccountAddress]);
    layer2Service.test__simulateBalances({
      defaultToken: new BN(0),
    });

    layer2Service.test__simulateAccountSafes(layer2AccountAddress, []);

    await visit('/card-pay/merchant-services?flow=create-merchant');
    assert
      .dom(
        '[data-test-postable] [data-test-layer-2-wallet-card] [data-test-address-field]'
      )
      .containsText(layer2AccountAddress)
      .isVisible();

    await settled();

    assert
      .dom('[data-test-postable="0"][data-test-cancelation]')
      .containsText(
        `It looks like you don’t have a prepaid card in your wallet. You will need one to pay the ${MERCHANT_CREATION_FEE_IN_SPEND} SPEND (${formatUsd(
          spendToUsd(MERCHANT_CREATION_FEE_IN_SPEND)!
        )}) merchant creation fee. Please buy a prepaid card in your Card Wallet mobile app before you continue with this workflow.`
      );
    assert
      .dom('[data-test-workflow-default-cancelation-cta="create-merchant"]')
      .containsText('Workflow canceled');
  });

  test('it cancels the workflow if prepaid cards associated with the EOA do not have enough balance', async function (assert) {
    let layer2Service = this.owner.lookup('service:layer2-network')
      .strategy as Layer2TestWeb3Strategy;
    layer2Service.test__simulateAccountsChanged([layer2AccountAddress]);
    layer2Service.test__simulateBalances({
      defaultToken: new BN(0),
    });

    layer2Service.test__simulateAccountSafes(layer2AccountAddress, [
      createMockPrepaidCard(
        layer2AccountAddress,
        prepaidCardAddress,
        MERCHANT_CREATION_FEE_IN_SPEND - 1
      ),
    ]);

    await visit('/card-pay/merchant-services?flow=create-merchant');
    assert
      .dom(
        '[data-test-postable] [data-test-layer-2-wallet-card] [data-test-address-field]'
      )
      .containsText(layer2AccountAddress)
      .isVisible();

    await settled();

    assert
      .dom('[data-test-postable="0"][data-test-cancelation]')
      .containsText(
        `It looks like you don’t have a prepaid card with enough funds to pay the ${MERCHANT_CREATION_FEE_IN_SPEND} SPEND (${formatUsd(
          spendToUsd(MERCHANT_CREATION_FEE_IN_SPEND)!
        )}) merchant creation fee. Please buy a prepaid card in your Card Wallet mobile app before you continue with this workflow.`
      );
    assert
      .dom('[data-test-workflow-default-cancelation-cta="create-merchant"]')
      .containsText('Workflow canceled');
  });
});
