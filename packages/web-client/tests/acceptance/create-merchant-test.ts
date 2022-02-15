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
import percySnapshot from '@percy/ember';
import Layer2TestWeb3Strategy from '@cardstack/web-client/utils/web3-strategies/test-layer2';
import WorkflowPersistence from '@cardstack/web-client/services/workflow-persistence';
import { currentNetworkDisplayInfo as c } from '@cardstack/web-client/utils/web3-strategies/network-display-info';
import { setupMirage } from 'ember-cli-mirage/test-support';
import {
  convertAmountToNativeDisplay,
  spendToUsd,
} from '@cardstack/cardpay-sdk';
import { setupHubAuthenticationToken } from '../helpers/setup';

import { MirageTestContext } from 'ember-cli-mirage/test-support';

import {
  createDepotSafe,
  createPrepaidCardSafe,
  createSafeToken,
} from '@cardstack/web-client/utils/test-factories';

interface Context extends MirageTestContext {}

function postableSel(milestoneIndex: number, postableIndex: number): string {
  return `[data-test-milestone="${milestoneIndex}"][data-test-postable="${postableIndex}"]`;
}

function epiloguePostableSel(postableIndex: number): string {
  return `[data-test-epilogue][data-test-postable="${postableIndex}"]`;
}

function milestoneCompletedSel(milestoneIndex: number): string {
  return `[data-test-milestone-completed][data-test-milestone="${milestoneIndex}"]`;
}

async function selectPrepaidCard(cardAddress: string) {
  await click(`[data-test-card-picker-dropdown] > [role="button"]`);
  await waitFor(`[data-test-card-picker-dropdown-option="${cardAddress}"]`);
  await click(`[data-test-card-picker-dropdown-option="${cardAddress}"]`);
}

let layer2AccountAddress = '0x182619c6Ea074C053eF3f1e1eF81Ec8De6Eb6E44';
let prepaidCardAddress = '0x123400000000000000000000000000000000abcd';

let secondLayer2AccountAddress = '0x5416C61193C3393B46C2774ac4717C252031c0bE';
let secondPrepaidCardAddress = '0x123400000000000000000000000000000000defa';

let merchantAddress = '0x1234000000000000000000000000000000004321';

function createMockPrepaidCard(
  eoaAddress: string,
  prepaidCardAddress: string,
  amount: number
) {
  return createPrepaidCardSafe({
    address: prepaidCardAddress,
    owners: [eoaAddress],
    spendFaceValue: amount,
    prepaidCardOwner: eoaAddress,
    issuer: eoaAddress,
  });
}

module('Acceptance | create merchant', function (hooks) {
  setupApplicationTest(hooks);
  setupMirage(hooks);

  let merchantRegistrationFee: number;

  hooks.beforeEach(async function () {
    merchantRegistrationFee = await this.owner
      .lookup('service:layer2-network')
      .strategy.fetchMerchantRegistrationFee();
  });

  test('initiating workflow without wallet connections', async function (assert) {
    await visit('/card-pay');
    await click('[data-test-card-pay-header-tab][href="/card-pay/payments"]');
    assert.equal(currentURL(), '/card-pay/payments');

    await click('[data-test-workflow-button="create-business"]');

    let post = postableSel(0, 0);
    assert.dom(`${postableSel(0, 0)} img`).exists();
    assert.dom(postableSel(0, 0)).containsText('Hello, nice to see you!');
    assert.dom(postableSel(0, 1)).containsText('create a business account');

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
    layer2Service.test__simulateRemoteAccountSafes(layer2AccountAddress, [
      createDepotSafe({
        owners: [layer2AccountAddress],
        tokens: [createSafeToken('DAI.CPXD', '0')],
      }),
      createMockPrepaidCard(
        layer2AccountAddress,
        prepaidCardAddress,
        merchantRegistrationFee
      ),
    ]);
    await layer2Service.test__simulateAccountsChanged([layer2AccountAddress]);
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
      .containsText('Let’s create a new business account.');

    post = postableSel(1, 3);

    await waitFor(post);

    assert.dom(post).containsText('Choose a name and ID for the business');

    // // merchant-customization card
    // TODO verify and interact with merchant customization card default state
    await fillIn(
      `[data-test-merchant-customization-merchant-name-field] input`,
      'Mandello'
    );
    await fillIn(
      `[data-test-merchant-customization-merchant-id-field] input`,
      'mandello1'
    );
    await waitFor('[data-test-boxel-input-validation-state="valid"]');
    await click(`[data-test-merchant-customization-save-details]`);

    await waitFor(milestoneCompletedSel(1));
    assert.dom(milestoneCompletedSel(1)).containsText('Business details saved');

    // prepaid-card-choice card
    post = postableSel(2, 2);
    await waitFor(post);
    await click(`${post} [data-test-card-picker-dropdown] > [role="button"]`);
    await waitFor(
      `${post} [data-test-card-picker-dropdown-option="${prepaidCardAddress}"]`
    );
    await click(
      `${post} [data-test-card-picker-dropdown-option="${prepaidCardAddress}"]`
    );
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
    assert.dom(`[data-test-card-picker-dropdown]`).doesNotExist();
    assert
      .dom('[data-test-prepaid-card-choice-merchant-address]')
      .containsText(merchantAddress);

    await waitFor(milestoneCompletedSel(2));
    assert
      .dom(milestoneCompletedSel(2))
      .containsText('Business account created');

    assert
      .dom(epiloguePostableSel(0))
      .containsText('You have created a business account.');

    await waitFor(epiloguePostableSel(1));

    await percySnapshot(assert);

    await click(
      `${epiloguePostableSel(
        1
      )} [data-test-create-merchant-next-step="dashboard"]`
    );
    assert.dom('[data-test-workflow-thread]').doesNotExist();

    await visit('/card-pay/wallet');
    assert
      .dom('[data-test-card-balances]')
      .containsText('0 USD', 'expected card balance to have updated');
  });

  module('Tests with the layer 2 wallet already connected', function (hooks) {
    setupHubAuthenticationToken(hooks);

    let layer2Service: Layer2TestWeb3Strategy;

    hooks.beforeEach(async function () {
      layer2Service = this.owner.lookup('service:layer2-network')
        .strategy as Layer2TestWeb3Strategy;
      layer2Service.test__simulateRemoteAccountSafes(layer2AccountAddress, [
        createDepotSafe({
          owners: [layer2AccountAddress],
          tokens: [createSafeToken('DAI.CPXD', '0')],
        }),
        createMockPrepaidCard(
          layer2AccountAddress,
          prepaidCardAddress,
          merchantRegistrationFee
        ),
      ]);
      await layer2Service.test__simulateAccountsChanged([layer2AccountAddress]);
    });

    test('initiating workflow with layer 2 wallet already connected', async function (assert) {
      await visit('/card-pay/payments?flow=create-business');

      const flowId = new URL(
        'http://domain.test/' + currentURL()
      ).searchParams.get('flow-id');
      assert.equal(
        currentURL(),
        `/card-pay/payments?flow=create-business&flow-id=${flowId}`
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

      let workflowPersistenceService = this.owner.lookup(
        'service:workflow-persistence'
      ) as WorkflowPersistence;

      let workflowPersistenceId = new URL(
        'http://domain.test/' + currentURL()
      ).searchParams.get('flow-id')!;

      let persistedData = workflowPersistenceService.getPersistedData(
        workflowPersistenceId
      );

      assert.ok(
        persistedData.state.layer2WalletAddress.includes(layer2AccountAddress),
        'expected the layer 2 address to have been persisted when the wallet was already connected'
      );
    });

    test('changed merchant details after canceling the merchant creation request are persisted', async function (this: Context, assert) {
      await visit('/card-pay/payments?flow=create-business');
      await waitFor('[data-test-merchant-customization-merchant-name-field]');
      await fillIn(
        `[data-test-merchant-customization-merchant-name-field] input`,
        'HELLO!'
      );
      await fillIn(
        `[data-test-merchant-customization-merchant-id-field] input`,
        'abc123'
      );
      await waitFor('[data-test-boxel-input-validation-state="valid"]');
      await click(`[data-test-merchant-customization-save-details]`);

      let prepaidCardChoice = postableSel(2, 2);
      await waitFor(prepaidCardChoice);
      await selectPrepaidCard(prepaidCardAddress);
      await click(
        `${prepaidCardChoice} [data-test-boxel-action-chin] [data-test-boxel-button]`
      );

      // need wait for Hub POST /api/merchant-infos
      // eslint-disable-next-line ember/no-settled-after-test-helper
      await settled();

      layer2Service.test__simulateRegisterMerchantRejectionForAddress(
        prepaidCardAddress
      );

      await click('[data-test-merchant-customization-edit]');
      await fillIn(
        '[data-test-merchant-customization-merchant-name-field] input',
        'changed'
      );
      await click('[data-test-merchant-customization-save-details]');

      await waitFor(prepaidCardChoice);
      await selectPrepaidCard(prepaidCardAddress);
      await click(
        `${prepaidCardChoice} [data-test-boxel-action-chin] [data-test-boxel-button]`
      );

      // wait for another Hub POST /api/merchant-infos
      // eslint-disable-next-line ember/no-settled-after-test-helper
      await settled();

      layer2Service.test__simulateRegisterMerchantForAddress(
        prepaidCardAddress,
        merchantAddress,
        {}
      );

      let secondMerchantInfo = this.server.schema.findBy('merchant-info', {
        name: 'changed',
      });

      assert.ok(
        secondMerchantInfo,
        'expected a second merchant-info to have been persisted'
      );
    });

    test('disconnecting Layer 2 after proceeding beyond it', async function (assert) {
      await visit('/card-pay/payments?flow=create-business');

      let flowId = new URL(
        'http://domain.test/' + currentURL()
      ).searchParams.get('flow-id');
      assert.equal(
        currentURL(),
        `/card-pay/payments?flow=create-business&flow-id=${flowId}`
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
          `It looks like your ${c.layer2.fullName} wallet got disconnected. If you still want to create a business account, please start again by connecting your wallet.`
        );
      assert
        .dom('[data-test-workflow-default-cancelation-cta="create-business"]')
        .containsText('Workflow canceled');

      await click(
        '[data-test-workflow-default-cancelation-restart="create-business"]'
      );

      flowId = new URL('http://domain.test/' + currentURL()).searchParams.get(
        'flow-id'
      );
      assert.equal(
        currentURL(),
        `/card-pay/payments?flow=create-business&flow-id=${flowId}`
      );

      layer2Service.test__simulateWalletConnectUri();
      await waitFor('[data-test-wallet-connect-qr-code]');
      assert
        .dom(
          '[data-test-layer-2-wallet-card] [data-test-wallet-connect-qr-code]'
        )
        .exists();
      assert
        .dom('[data-test-workflow-default-cancelation-cta="create-business"]')
        .doesNotExist();
    });

    test('changing Layer 2 account should cancel the workflow', async function (assert) {
      await visit('/card-pay/payments?flow=create-business');

      let flowId = new URL(
        'http://domain.test/' + currentURL()
      ).searchParams.get('flow-id');
      assert.equal(
        currentURL(),
        `/card-pay/payments?flow=create-business&flow-id=${flowId}`
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

      await layer2Service.test__simulateAccountsChanged([
        secondLayer2AccountAddress,
      ]);

      layer2Service.test__simulateRemoteAccountSafes(
        secondLayer2AccountAddress,
        [
          createMockPrepaidCard(
            secondLayer2AccountAddress,
            secondPrepaidCardAddress,
            merchantRegistrationFee
          ),
        ]
      );
      await settled();

      assert
        .dom('[data-test-postable="0"][data-test-cancelation]')
        .containsText(
          'It looks like you changed accounts in the middle of this workflow. If you still want to create a business account, please restart the workflow.'
        );
      assert
        .dom('[data-test-workflow-default-cancelation-cta="create-business"]')
        .containsText('Workflow canceled');

      await click(
        '[data-test-workflow-default-cancelation-restart="create-business"]'
      );
      flowId = new URL('http://domain.test/' + currentURL()).searchParams.get(
        'flow-id'
      );
      assert.equal(
        currentURL(),
        `/card-pay/payments?flow=create-business&flow-id=${flowId}`
      );
    });
  });

  test('it cancels the workflow if there are no prepaid cards associated with the EOA', async function (assert) {
    let layer2Service = this.owner.lookup('service:layer2-network')
      .strategy as Layer2TestWeb3Strategy;
    layer2Service.test__simulateRemoteAccountSafes(layer2AccountAddress, [
      createDepotSafe({
        owners: [layer2AccountAddress],
        tokens: [createSafeToken('DAI.CPXD', '0')],
      }),
    ]);
    await layer2Service.test__simulateAccountsChanged([layer2AccountAddress]);

    await visit('/card-pay/payments?flow=create-business');
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
        `It looks like you don’t have a prepaid card in your wallet. You will need one to pay the ${convertAmountToNativeDisplay(
          spendToUsd(merchantRegistrationFee)!,
          'USD'
        )} business account creation fee. Please buy a prepaid card in your Card Wallet mobile app before you continue with this workflow.`
      );
    assert
      .dom('[data-test-workflow-default-cancelation-cta="create-business"]')
      .containsText('Workflow canceled');
  });

  test('it cancels the workflow if prepaid cards associated with the EOA do not have enough balance', async function (assert) {
    let layer2Service = this.owner.lookup('service:layer2-network')
      .strategy as Layer2TestWeb3Strategy;

    layer2Service.test__simulateRemoteAccountSafes(layer2AccountAddress, [
      createDepotSafe({
        owners: [layer2AccountAddress],
        tokens: [createSafeToken('DAI.CPXD', '0')],
      }),
      createMockPrepaidCard(
        layer2AccountAddress,
        prepaidCardAddress,
        merchantRegistrationFee - 1
      ),
    ]);
    await layer2Service.test__simulateAccountsChanged([layer2AccountAddress]);

    await visit('/card-pay/payments?flow=create-business');
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
        `It looks like you don’t have a prepaid card with enough funds to pay the ${convertAmountToNativeDisplay(
          spendToUsd(merchantRegistrationFee)!,
          'USD'
        )} business account creation fee. Please buy a prepaid card in your Card Wallet mobile app before you continue with this workflow.`
      );
    assert
      .dom('[data-test-workflow-default-cancelation-cta="create-business"]')
      .containsText('Workflow canceled');
  });
});
