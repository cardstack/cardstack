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
import Layer1TestWeb3Strategy from '@cardstack/web-client/utils/web3-strategies/test-layer1';
import Layer2TestWeb3Strategy from '@cardstack/web-client/utils/web3-strategies/test-layer2';
import a11yAudit from 'ember-a11y-testing/test-support/audit';
import BN from 'bn.js';

import { capitalize } from '@ember/string';
import { currentNetworkDisplayInfo as c } from '@cardstack/web-client/utils/web3-strategies/network-display-info';
import { toWei } from 'web3-utils';
import {
  createDepotSafe,
  createMerchantSafe,
  createSafeToken,
} from '@cardstack/web-client/utils/test-factories';
import { setupMirage } from 'ember-cli-mirage/test-support';

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

module('Acceptance | withdrawal', function (hooks) {
  setupApplicationTest(hooks);
  setupMirage(hooks);
  test('Initiating workflow without wallet connections', async function (assert) {
    await visit('/card-pay/deposit-withdrawal');
    assert.equal(currentURL(), '/card-pay/deposit-withdrawal');
    await click('[data-test-workflow-button="withdrawal"]');
    let post = postableSel(0, 0);
    assert.dom(`${post} img`).exists();
    assert.dom(post).containsText('Hi there, it’s good to see you');
    assert
      .dom(postableSel(0, 1))
      .containsText(
        'In order to make a withdrawal, you need to connect two wallets'
      );
    post = postableSel(0, 2);
    await click(`${post} [data-test-wallet-option="metamask"]`);
    await click(
      `${post} [data-test-mainnnet-connection-action-container] [data-test-boxel-button]`
    );
    assert.dom(post).containsText(`Connect your ${c.layer1.fullName} wallet`);
    await a11yAudit();
    assert.ok(true, 'no a11y errors found - layer 1 connect card');
    let layer1AccountAddress = '0xaCD5f5534B756b856ae3B2CAcF54B3321dd6654Fb6';
    let layer1Service = this.owner.lookup('service:layer1-network')
      .strategy as Layer1TestWeb3Strategy;
    layer1Service.test__simulateAccountsChanged(
      [layer1AccountAddress],
      'metamask'
    );
    layer1Service.test__simulateBalances({
      defaultToken: new BN('2141100000000000000'),
      dai: new BN('150500000000000000000'),
      card: new BN('10000000000000000000000'),
    });
    await waitFor(`${post} [data-test-balance="ETH"]`);
    assert.dom(`${post} [data-test-balance="ETH"]`).containsText('2.14');
    assert.dom(`${post} [data-test-balance="DAI"]`).containsText('150.50');
    assert.dom(`${post} [data-test-balance="CARD"]`).containsText('10,000.00');
    await settled();
    assert
      .dom(milestoneCompletedSel(0))
      .containsText(
        `${capitalize(c.layer1.conversationalName)} wallet connected`
      );

    await waitUntil(() =>
      document
        .querySelector(postableSel(1, 0))
        ?.textContent?.includes('It looks like you have enough ETH')
    );
    assert
      .dom(postableSel(1, 0))
      .containsText('It looks like you have enough ETH');
    await waitFor(postableSel(1, 1));
    assert
      .dom(postableSel(1, 1))
      .containsText(`Sufficient funds for claiming withdrawn tokens`);

    await waitFor(milestoneCompletedSel(1));
    assert.dom(milestoneCompletedSel(1)).containsText(`ETH balance checked`);

    await waitFor(postableSel(2, 0));
    assert
      .dom(postableSel(2, 0))
      .containsText(
        `Now it’s time to connect your ${c.layer2.fullName} wallet via your Card Wallet mobile app`
      );
    await waitFor(postableSel(2, 1));
    assert
      .dom(postableSel(2, 1))
      .containsText(
        'Once you have installed the app, open the app and add an existing wallet/account'
      );
    await waitFor(postableSel(2, 2));
    assert
      .dom(`${postableSel(2, 2)} [data-test-wallet-connect-loading-qr-code]`)
      .exists();
    let layer2Service = this.owner.lookup('service:layer2-network')
      .strategy as Layer2TestWeb3Strategy;
    layer2Service.test__simulateWalletConnectUri();
    await waitFor('[data-test-wallet-connect-qr-code]');
    assert.dom('[data-test-wallet-connect-qr-code]').exists();
    // Simulate the user scanning the QR code and connecting their mobile wallet
    let layer2AccountAddress = '0x182619c6Ea074C053eF3f1e1eF81Ec8De6Eb6E44';
    let merchantAddress = '0xmerchantbAB0644ffCD32518eBF4924ba8666666';
    let depotAddress = '0xB236ca8DbAB0644ffCD32518eBF4924ba8666666';
    layer2Service.test__simulateRemoteAccountSafes(layer2AccountAddress, [
      createDepotSafe({
        address: depotAddress,
        owners: [layer2AccountAddress],
        tokens: [
          createSafeToken('DAI.CPXD', '250000000000000000000'),
          createSafeToken('CARD.CPXD', '500000000000000000000'),
        ],
      }),
      createMerchantSafe({
        address: merchantAddress,
        merchant: '0xprepaidDbAB0644ffCD32518eBF4924ba8666666',
        accumulatedSpendValue: 100,
        tokens: [
          createSafeToken('DAI.CPXD', '125000000000000000000'),
          createSafeToken('CARD.CPXD', '450000000000000000000'),
        ],
      }),
    ]);
    await layer2Service.test__simulateAccountsChanged([layer2AccountAddress]);

    await waitFor(`${postableSel(2, 2)} [data-test-balance="DAI.CPXD"]`);
    assert
      .dom(`${postableSel(2, 2)} [data-test-balance="DAI.CPXD"]`)
      .containsText('250.00 DAI.CPXD');
    assert
      .dom(
        '[data-test-card-pay-layer-2-connect] [data-test-card-pay-connect-button]'
      )
      .hasText('0x1826...6E44');
    await settled();
    assert
      .dom(milestoneCompletedSel(2))
      .containsText(`${c.layer2.fullName} wallet connected`);
    assert
      .dom(postableSel(3, 0))
      .containsText(`Please choose the asset you would like to withdraw`);
    post = postableSel(3, 1);
    // // choose-balance card
    await waitFor(`${post} [data-test-balance-chooser-dropdown="DAI.CPXD"]`);
    assert
      .dom(`${post} [data-test-balance-chooser-dropdown="DAI.CPXD"]`)
      .containsText('250.00 DAI.CPXD');
    assert
      .dom(`${post} [data-test-choose-balance-from-safe]`)
      .hasText(`DEPOT ${depotAddress}`);

    await click(
      '[data-test-safe-chooser-dropdown] .ember-power-select-trigger'
    );
    assert
      .dom('[data-test-safe-chooser-dropdown] li:nth-child(1)')
      .containsText(depotAddress);
    assert
      .dom('[data-test-safe-chooser-dropdown] li:nth-child(2)')
      .containsText(merchantAddress);

    await click('[data-test-safe-chooser-dropdown] li:nth-child(2)');

    await click(
      '[data-test-balance-chooser-dropdown] .ember-power-select-trigger'
    );
    assert
      .dom(`${post} li:nth-child(1) [data-test-balance-display-name]`)
      .containsText('DAI.CPXD');
    assert
      .dom(`${post} li:nth-child(2) [data-test-balance-display-name]`)
      .containsText('CARD.CPXD');

    await click('[data-test-balance-chooser-dropdown] li:nth-child(2)');

    await click(
      `${post} [data-test-withdrawal-choose-balance] [data-test-boxel-button]`
    );
    // // choose-balance card (memorialized)
    assert.dom(`${post} [data-test-balance-chooser-dropdown]`).doesNotExist();
    assert
      .dom('[data-test-withdrawal-choose-balance] [data-test-boxel-button]')
      .hasText('Edit');
    assert.dom('[data-test-withdrawal-choose-balance-is-complete]').exists();
    assert
      .dom(`${post} [data-test-choose-balance-from-display]`)
      .containsText('450.00 CARD.CPXD');
    assert.dom('[data-test-choose-balance-footnote]').containsText('gas fee');

    // // transaction-amount card
    await waitFor(postableSel(3, 2));
    assert
      .dom(postableSel(3, 2))
      .containsText('How much would you like to withdraw from your balance?');
    post = postableSel(3, 3);

    assert
      .dom(
        `${post} [data-test-action-card-title="withdrawal-transaction-amount"]`
      )
      .containsText('Choose an amount to withdraw');

    assert
      .dom(`${post} [data-test-balance-display-amount]`)
      .containsText('450.00 CARD.CPXD');

    assert
      .dom(
        `${post} [data-test-withdrawal-transaction-amount] [data-test-boxel-button]`
      )
      .isDisabled(
        'Set amount button is disabled until amount has been entered'
      );
    await fillIn('[data-test-boxel-input-token-amount]', '200');
    assert
      .dom(
        `${post} [data-test-withdrawal-transaction-amount] [data-test-boxel-button]`
      )
      .isEnabled('Set amount button is enabled once amount has been entered');
    await waitFor(`${post} [data-test-withdrawal-transaction-amount]`);
    await click(
      `${post} [data-test-withdrawal-transaction-amount] [data-test-boxel-button]`
    );

    assert
      .dom('[data-test-withdrawal-transaction-amount]')
      .containsText('Confirmed');
    assert
      .dom(milestoneCompletedSel(3))
      .containsText(`Withdrawn from ${c.layer2.fullName}`);

    // // transaction-status step card
    assert
      .dom(postableSel(4, 0))
      .containsText(
        `withdrawn funds from the ${c.layer2.fullName}, your tokens will be bridged to ${c.layer1.fullName}`
      );
    await waitFor(postableSel(4, 1));

    await layer2Service.test__simulateBridgedToLayer1(
      merchantAddress,
      layer1AccountAddress,
      'CARD.CPXD',
      toWei('200')
    );
    await settled();
    assert
      .dom(milestoneCompletedSel(4))
      .containsText(`Tokens bridged to ${c.layer1.fullName}`);

    // // token claim step card
    assert
      .dom(postableSel(5, 0))
      .containsText(
        `You will have to pay ${c.layer1.conversationalName} gas fee`
      );

    await waitFor(postableSel(5, 1));
    post = postableSel(5, 1);
    await click(`${post} [data-test-boxel-button]`);
    assert
      .dom(`${post} [data-test-boxel-action-chin]`)
      .containsText('Waiting for you to confirm on MetaMask');

    layer1Service.test__simulateBridgedTokensClaimed('example-message-id');
    await waitFor('[data-test-withdrawal-token-claim-is-complete]');
    assert
      .dom(milestoneCompletedSel(5))
      .containsText(`Tokens claimed on ${c.layer1.conversationalName}`);

    // // transaction-summary card
    await waitFor(epiloguePostableSel(0));
    assert
      .dom(epiloguePostableSel(0))
      .containsText('Congrats! Your withdrawal is complete.');
    assert
      .dom(
        '[data-test-withdrawal-transaction-confirmed-from] [data-test-bridge-item-amount]'
      )
      .containsText('200.00 CARD.CPXD');
    assert
      .dom(
        '[data-test-withdrawal-transaction-confirmed-to] [data-test-bridge-item-amount]'
      )
      .containsText('200.00 CARD');

    await waitFor(epiloguePostableSel(2));
    assert
      .dom(epiloguePostableSel(2))
      .containsText(
        `This is the remaining balance in your ${c.layer2.fullName} wallet`
      );

    await waitFor(`${epiloguePostableSel(3)} [data-test-balance="DAI.CPXD"]`);

    assert
      .dom(`${epiloguePostableSel(3)} [data-test-safe-address]`)
      .containsText(merchantAddress);
    assert
      .dom(`${epiloguePostableSel(3)} [data-test-balance="DAI.CPXD"]`)
      .containsText('125.00');
    assert
      .dom(`${epiloguePostableSel(3)} [data-test-balance="CARD.CPXD"]`)
      .containsText('250.00');
    assert
      .dom(
        '[data-test-milestone] [data-test-boxel-action-chin] button[data-test-boxel-button]:not([disabled])'
      )
      .doesNotExist();
    await waitFor(epiloguePostableSel(4));
    assert
      .dom(
        `${epiloguePostableSel(4)} [data-test-withdrawal-next-step="dashboard"]`
      )
      .exists();

    await percySnapshot(assert);

    await click(
      `${epiloguePostableSel(4)} [data-test-withdrawal-next-step="dashboard"]`
    );
    assert.dom('[data-test-workflow-thread]').doesNotExist();
  });

  test('Initiating workflow without enough ETH to claim', async function (assert) {
    await visit('/card-pay/deposit-withdrawal');
    assert.equal(currentURL(), '/card-pay/deposit-withdrawal');
    await click('[data-test-workflow-button="withdrawal"]');
    let post = postableSel(0, 2);
    await click(`${post} [data-test-wallet-option="metamask"]`);
    await click(
      `${post} [data-test-mainnnet-connection-action-container] [data-test-boxel-button]`
    );
    assert.dom(post).containsText(`Connect your ${c.layer1.fullName} wallet`);
    let layer1AccountAddress = '0xaCD5f5534B756b856ae3B2CAcF54B3321dd6654Fb6';
    let layer1Service = this.owner.lookup('service:layer1-network')
      .strategy as Layer1TestWeb3Strategy;
    layer1Service.test__simulateAccountsChanged(
      [layer1AccountAddress],
      'metamask'
    );
    layer1Service.test__simulateBalances({
      defaultToken: new BN(toWei('0.011')),
      dai: new BN('150500000000000000000'),
      card: new BN('10000000000000000000000'),
    });
    await waitFor(`${post} [data-test-balance="ETH"]`);
    await waitFor(milestoneCompletedSel(0));

    await waitUntil(() => {
      return document
        .querySelector(postableSel(1, 0))
        ?.textContent?.includes('You will need to deposit more');
    });
    assert
      .dom(postableSel(1, 0))
      .containsText('You will need to deposit more ETH to your account');
    post = postableSel(1, 1);
    await waitFor(post);
    assert
      .dom(post)
      .containsText(`Insufficient funds for claiming withdrawn tokens`);
    assert
      .dom(
        `${post} [data-test-balance-amount] [data-test-balance-display-usd-amount]`
      )
      .containsText('$33.00');
    assert
      .dom(
        `${post} [data-test-funds-needed] [data-test-balance-display-usd-amount]`
      )
      .containsText('$41.76');
    assert.dom(milestoneCompletedSel(1)).doesNotExist();

    layer1Service.test__simulateBalances({
      defaultToken: new BN(toWei('0.211')),
    });
    await waitFor(milestoneCompletedSel(1));
    assert
      .dom(post)
      .containsText(`Sufficient funds for claiming withdrawn tokens`);
    assert.dom(milestoneCompletedSel(1)).containsText(`ETH balance checked`);
  });

  module('Tests with the layer 1 wallet already connected', function (hooks) {
    let layer1Service: Layer1TestWeb3Strategy;
    let layer1AccountAddress = '0xaCD5f5534B756b856ae3B2CAcF54B3321dd6654Fb6';

    hooks.beforeEach(function () {
      layer1Service = this.owner.lookup('service:layer1-network')
        .strategy as Layer1TestWeb3Strategy;
      layer1Service.test__simulateAccountsChanged(
        [layer1AccountAddress],
        'metamask'
      );
      layer1Service.test__simulateBalances({
        defaultToken: new BN('2141100000000000000'),
        dai: new BN('150500000000000000000'),
        card: new BN('10000000000000000000000'),
      });
    });

    test('Initiating workflow with layer 1 wallet already connected', async function (assert) {
      await visit('/card-pay/deposit-withdrawal?flow=withdrawal');

      assert
        .dom(postableSel(0, 2))
        .containsText(
          `Looks like you’ve already connected your ${c.layer1.fullName} wallet`
        );
      assert
        .dom('[data-test-layer-1-wallet-summary]')
        .containsText(layer1AccountAddress);
      await waitFor(milestoneCompletedSel(0));
      assert
        .dom(milestoneCompletedSel(0))
        .containsText(`${c.layer1.fullName} wallet connected`);
      await waitUntil(() =>
        document
          .querySelector(postableSel(1, 0))
          ?.textContent?.includes('It looks like you have enough ETH')
      );
      assert
        .dom(postableSel(1, 0))
        .containsText('It looks like you have enough ETH');
      await waitFor(postableSel(1, 1));
      assert
        .dom(postableSel(1, 1))
        .containsText(`Sufficient funds for claiming withdrawn tokens`);

      await waitFor(milestoneCompletedSel(1));
      assert.dom(milestoneCompletedSel(1)).containsText(`ETH balance checked`);

      await waitFor(postableSel(2, 0));
      assert
        .dom(postableSel(2, 0))
        .containsText(
          `You have connected your ${c.layer1.fullName} wallet. Now it’s time to connect your ${c.layer2.fullName} wallet`
        );
      await waitFor('[data-test-layer-2-wallet-card]');
      assert.dom('[data-test-layer-2-wallet-card]').exists();
    });

    test('Disconnecting Layer 1 after proceeding beyond it', async function (assert) {
      await visit('/card-pay/deposit-withdrawal?flow=withdrawal');

      assert
        .dom(postableSel(0, 2))
        .containsText(
          `Looks like you’ve already connected your ${c.layer1.fullName} wallet`
        );
      assert
        .dom('[data-test-layer-1-wallet-summary]')
        .containsText(layer1AccountAddress);
      assert
        .dom(milestoneCompletedSel(0))
        .containsText(`${c.layer1.fullName} wallet connected`);

      layer1Service.test__simulateDisconnectFromWallet();
      await settled();

      assert
        .dom('[data-test-postable="0"][data-test-cancelation]')
        .containsText(`It looks like your wallet(s) got disconnected.`);
      assert
        .dom('[data-test-workflow-default-cancelation-cta="withdrawal"]')
        .containsText('Workflow canceled');

      await click(
        '[data-test-workflow-default-cancelation-restart="withdrawal"]'
      );

      assert
        .dom(
          '[data-test-mainnnet-connection-action-container] [data-test-mainnet-connect-button]'
        )
        .exists();
      assert
        .dom('[data-test-workflow-default-cancelation-cta="withdrawal"]')
        .doesNotExist();
    });
  });

  module('Tests with the layer 2 wallet already connected', function (hooks) {
    let layer1Service: Layer1TestWeb3Strategy;
    let layer2Service: Layer2TestWeb3Strategy;
    let layer1AccountAddress = '0xaCD5f5534B756b856ae3B2CAcF54B3321dd6654Fb6';
    let secondLayer1AccountAddress =
      '0x5416C61193C3393B46C2774ac4717C252031c0bE';
    let layer2AccountAddress = '0x182619c6Ea074C053eF3f1e1eF81Ec8De6Eb6E44';
    let secondLayer2AccountAddress =
      '0x0x89205A3A3b2A69De6Dbf7f01ED13B2108B2c43e7';

    hooks.beforeEach(async function () {
      layer1Service = this.owner.lookup('service:layer1-network')
        .strategy as Layer1TestWeb3Strategy;
      layer1Service.test__simulateAccountsChanged(
        [layer1AccountAddress],
        'metamask'
      );
      layer1Service.test__simulateBalances({
        defaultToken: new BN('2141100000000000000'),
        dai: new BN('150500000000000000000'),
        card: new BN('10000000000000000000000'),
      });
      layer2Service = this.owner.lookup('service:layer2-network')
        .strategy as Layer2TestWeb3Strategy;
      layer2Service.test__simulateRemoteAccountSafes(layer2AccountAddress, [
        createDepotSafe({
          tokens: [createSafeToken('DAI.CPXD', '0')],
        }),
      ]);
      await layer2Service.test__simulateAccountsChanged([layer2AccountAddress]);
    });

    test('Initiating workflow with layer 2 wallet already connected', async function (assert) {
      await visit('/card-pay/deposit-withdrawal?flow=withdrawal');

      assert
        .dom(milestoneCompletedSel(0))
        .containsText(`${c.layer1.fullName} wallet connected`);
      assert
        .dom(postableSel(2, 0))
        .containsText(
          `Looks like you’ve already connected your ${c.layer2.fullName} wallet`
        );
      assert
        .dom(milestoneCompletedSel(2))
        .containsText(`${c.layer2.fullName} wallet connected`);
      assert.dom('[data-test-postable="0"][data-test-milestone="2"]').exists();
    });

    test('Disconnecting Layer 2 after proceeding beyond it', async function (assert) {
      await visit('/card-pay/deposit-withdrawal?flow=withdrawal');

      assert
        .dom(milestoneCompletedSel(0))
        .containsText(`${c.layer1.fullName} wallet connected`);
      assert
        .dom(milestoneCompletedSel(2))
        .containsText(`${c.layer2.fullName} wallet connected`);

      layer2Service.test__simulateDisconnectFromWallet();
      await settled();

      assert
        .dom('[data-test-postable="0"][data-test-cancelation]')
        .containsText(`It looks like your wallet(s) got disconnected.`);
      assert
        .dom('[data-test-workflow-default-cancelation-cta="withdrawal"]')
        .containsText('Workflow canceled');

      await click(
        '[data-test-workflow-default-cancelation-restart="withdrawal"]'
      );

      layer2Service.test__simulateWalletConnectUri();
      await waitFor('[data-test-wallet-connect-qr-code]');
      assert
        .dom(
          '[data-test-layer-2-wallet-card] [data-test-wallet-connect-qr-code]'
        )
        .exists();
      assert
        .dom('[data-test-workflow-default-cancelation-cta="withdrawal"]')
        .doesNotExist();
    });

    test('Changing layer 1 account should cancel the workflow', async function (assert) {
      await visit('/card-pay/deposit-withdrawal?flow=withdrawal');

      assert
        .dom(milestoneCompletedSel(0))
        .containsText(`${c.layer1.fullName} wallet connected`);
      assert
        .dom(milestoneCompletedSel(2))
        .containsText(`${c.layer2.fullName} wallet connected`);

      layer1Service.test__simulateAccountsChanged(
        [secondLayer1AccountAddress],
        'metamask'
      );
      await settled();

      // test that all cta buttons are disabled
      assert
        .dom(
          '[data-test-milestone] [data-test-boxel-action-chin] button[data-test-boxel-button]:not([disabled])'
        )
        .doesNotExist();

      await waitFor('[data-test-cancelation][data-test-postable]');

      assert
        .dom(cancelationPostableSel(0))
        .containsText(
          'It looks like you changed accounts in the middle of this workflow. If you still want to withdraw funds, please restart the workflow.'
        );
      assert.dom(cancelationPostableSel(1)).containsText('Workflow canceled');
      assert
        .dom('[data-test-workflow-default-cancelation-restart="withdrawal"]')
        .exists();
    });

    test('Changing layer 2 account should cancel the workflow', async function (assert) {
      await visit('/card-pay/deposit-withdrawal?flow=withdrawal');

      assert
        .dom(milestoneCompletedSel(0))
        .containsText(`${c.layer1.fullName} wallet connected`);
      assert
        .dom(milestoneCompletedSel(2))
        .containsText(`${c.layer2.fullName} wallet connected`);

      await layer2Service.test__simulateAccountsChanged([
        secondLayer2AccountAddress,
      ]);
      await settled();

      // test that all cta buttons are disabled
      assert
        .dom(
          '[data-test-milestone] [data-test-boxel-action-chin] button[data-test-boxel-button]:not([disabled])'
        )
        .doesNotExist();

      await waitFor('[data-test-cancelation][data-test-postable]');

      assert
        .dom(cancelationPostableSel(0))
        .containsText(
          'It looks like you changed accounts in the middle of this workflow. If you still want to withdraw funds, please restart the workflow.'
        );
      assert.dom(cancelationPostableSel(1)).containsText('Workflow canceled');
      assert
        .dom('[data-test-workflow-default-cancelation-restart="withdrawal"]')
        .exists();
    });
  });
});
