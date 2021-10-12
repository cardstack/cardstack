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
import Layer1TestWeb3Strategy from '@cardstack/web-client/utils/web3-strategies/test-layer1';
import Layer2TestWeb3Strategy from '@cardstack/web-client/utils/web3-strategies/test-layer2';
import a11yAudit from 'ember-a11y-testing/test-support/audit';
import BN from 'bn.js';

import { currentNetworkDisplayInfo as c } from '@cardstack/web-client/utils/web3-strategies/network-display-info';
import { capitalize } from '@ember/string';
import {
  createDepotSafe,
  createSafeToken,
} from '@cardstack/web-client/utils/test-factories';

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

module('Acceptance | deposit', function (hooks) {
  setupApplicationTest(hooks);

  test('Initiating workflow without wallet connections', async function (assert) {
    await visit('/card-pay/token-suppliers');
    assert.equal(currentURL(), '/card-pay/token-suppliers');
    await click('[data-test-workflow-button="deposit"]');

    let post = postableSel(0, 0);
    assert.dom(`${post} img`).exists();
    assert.dom(post).containsText('Hi there, we’re happy to see you');

    assert
      .dom(postableSel(0, 1))
      .containsText('you need to connect two wallets');

    assert
      .dom(postableSel(0, 2))
      .containsText(
        `The funds you wish to deposit must be available in your ${c.layer1.conversationalName} wallet`
      );

    post = postableSel(0, 3);
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
      dai: new BN('250500000000000000000'),
      card: new BN('10000000000000000000000'),
    });

    await waitFor(`${post} [data-test-balance="ETH"]`);
    assert.dom(`${post} [data-test-balance="ETH"]`).containsText('2.1411');
    assert.dom(`${post} [data-test-balance="DAI"]`).containsText('250.50');
    assert.dom(`${post} [data-test-balance="CARD"]`).containsText('10,000.00');

    await settled();

    assert
      .dom(milestoneCompletedSel(0))
      .containsText(
        `${capitalize(c.layer1.conversationalName)} wallet connected`
      );

    assert
      .dom(postableSel(1, 0))
      .containsText(
        `Now it’s time to connect your ${c.layer2.fullName} wallet via your Card Wallet mobile app`
      );

    assert
      .dom(postableSel(1, 1))
      .containsText(
        'Once you have installed the app, open the app and add an existing wallet/account'
      );

    assert
      .dom(`${postableSel(1, 2)} [data-test-wallet-connect-loading-qr-code]`)
      .exists();

    let layer2Service = this.owner.lookup('service:layer2-network')
      .strategy as Layer2TestWeb3Strategy;
    layer2Service.test__simulateWalletConnectUri();
    await waitFor('[data-test-wallet-connect-qr-code]');
    assert.dom('[data-test-wallet-connect-qr-code]').exists();

    // Simulate the user scanning the QR code and connecting their mobile wallet
    let layer2AccountAddress = '0x182619c6Ea074C053eF3f1e1eF81Ec8De6Eb6E44';
    layer2Service.test__simulateRemoteAccountSafes(layer2AccountAddress, [
      createDepotSafe({
        owners: [layer2AccountAddress],
        tokens: [createSafeToken('DAI', '0')],
      }),
    ]);
    layer2Service.test__simulateAccountsChanged([layer2AccountAddress]);

    await waitFor(`${postableSel(1, 2)} [data-test-balance-container]`);
    await waitUntil(() => {
      return (
        document.querySelector('[data-test-balance="DAI.CPXD"]') === null &&
        document.querySelector('[data-test-balance-container-loading]') === null
      );
    });
    assert
      .dom(`${postableSel(1, 2)} [data-test-balance="XDAI"]`)
      .doesNotExist();
    assert
      .dom(`${postableSel(1, 2)} [data-test-balance-container]`)
      .containsText('None');
    assert
      .dom(
        '[data-test-card-pay-layer-2-connect] [data-test-card-pay-connect-button]'
      )
      .hasText('0x1826...6E44');

    await settled();

    assert
      .dom(milestoneCompletedSel(1))
      .containsText(`${c.layer2.fullName} wallet connected`);

    assert
      .dom(postableSel(2, 0))
      .containsText('choose the asset you would like to deposit');

    post = postableSel(2, 1);

    // transaction-setup card
    await waitFor(`${post} [data-test-balance="DAI"]`);
    await click(
      `${post} [data-test-deposit-transaction-setup] [data-test-boxel-button]`
    );
    assert
      .dom(
        `${post} [data-test-deposit-transaction-setup-from-balance="DAI"] [data-test-balance-display-amount]`
      )
      .hasText('250.50 DAI');

    // transaction-amount card
    assert
      .dom(postableSel(2, 2))
      .containsText('How many tokens would you like to deposit?');

    post = postableSel(2, 3);
    assert.dom(`${post} [data-test-source-token="DAI"]`).exists();
    assert.dom(`${post} [data-test-unlock-button]`).isDisabled();
    assert.dom(`${post} [data-test-deposit-button]`).isDisabled();
    await fillIn('[data-test-token-amount-input]', '250');
    assert
      .dom(`${post} [data-test-unlock-button]`)
      .isEnabled('Unlock button is enabled once amount has been entered');

    // make sure that our property to test if balances are refreshed is not true yet
    layer1Service.balancesRefreshed = false;
    await click(`${post} [data-test-unlock-button]`);

    // // MetaMask pops up and user approves the transaction. There is a spinner
    // // on the "Unlock" button until the Ethereum transaction is mined.
    // // When the mining is complete, the "Deposit" button becomes clickable.

    assert
      .dom(`${post} [data-test-unlock-button]`)
      .hasClass('boxel-button--loading');
    assert
      .dom('[data-test-token-amount-input]')
      .doesNotExist('Input field is no longer available when unlocking');

    assert.dom('[data-test-deposit-amount-entered]').containsText('250.00 DAI');

    assert.dom(`${post} [data-test-unlock-etherscan-button]`).doesNotExist();

    layer1Service.test__simulateUnlockTxnHash();
    await settled();

    assert.dom(`${post} [data-test-unlock-etherscan-button]`).exists();

    layer1Service.test__simulateUnlock();
    await settled();

    assert
      .dom(`${post} [data-test-unlock-button]`)
      .doesNotExist('Unlock button is no longer visible after unlocking.');
    assert
      .dom(`${post} [data-test-unlock-success-message]`)
      .exists('There should be a success message after unlocking');
    assert
      .dom('[data-test-token-amount-input]')
      .doesNotExist('Input field is no longer available after unlocking');
    assert
      .dom(`${post} [data-test-deposit-button]`)
      .isEnabled('Deposit is enabled once unlocked');
    await click(`${post} [data-test-deposit-button]`);

    assert
      .dom(`${post} [data-test-deposit-button]`)
      .hasClass('boxel-button--loading');

    assert.dom(`${post} [data-test-deposit-etherscan-button]`).doesNotExist();

    layer1Service.test__simulateDepositTxnHash();
    await settled();

    assert.dom(`${post} [data-test-deposit-etherscan-button]`).exists();

    layer1Service.test__simulateDeposit();
    await settled();

    assert.ok(
      layer1Service.balancesRefreshed,
      'Balances should be refreshed after relaying tokens'
    );

    assert
      .dom(`${post} [data-test-deposit-button]`)
      .doesNotExist('Deposit button is no longer visible after depositing.');

    assert
      .dom(`${post} [data-test-deposit-success-message]`)
      .exists('There should be a success message after depositing');

    assert
      .dom(milestoneCompletedSel(2))
      .containsText('Deposited into reserve pool');

    assert
      .dom(postableSel(3, 0))
      .containsText(
        `your token will be bridged to the ${c.layer2.shortName} blockchain`
      );

    post = postableSel(3, 1);
    // transaction-status card
    // we assert that it exists, and will show a blockscout button after completion of bridging (success state)
    // the rest is handled in an integration test
    assert.dom(`${post} [data-test-deposit-transaction-status-card]`).exists();
    const blockCount = layer1Service.bridgeConfirmationBlockCount;
    layer1Service.test__simulateBlockConfirmation();
    await waitFor(`[data-test-token-bridge-step-block-count="${blockCount}"]`);
    layer1Service.test__simulateBlockConfirmation();
    await waitFor(
      `[data-test-token-bridge-step-block-count="${blockCount + 1}"]`
    );
    layer1Service.test__simulateBlockConfirmation();
    await waitFor(`[data-test-token-bridge-step="1"][data-test-completed]`);
    assert.dom(`${post} [data-test-bridge-explorer-button]`).exists();

    layer2Service.test__simulateBridgedToLayer2(
      '0xabc123abc123abc123e5984131f6b4cc3ac8af14'
    );
    await waitFor(`${post} [data-test-blockscout-button]`);

    assert.ok(
      layer2Service.balancesRefreshed,
      'Balances for layer 2 should be refreshed after bridging'
    );

    assert.dom(`${post} [data-test-blockscout-button]`).exists();

    await settled();

    assert
      .dom(milestoneCompletedSel(3))
      .containsText(`Tokens received on ${c.layer2.shortName}`);

    assert
      .dom(epiloguePostableSel(0))
      .containsText('Thank you for your contribution!');

    assert
      .dom(epiloguePostableSel(1))
      .containsText(`Minted from CARD Protocol on ${c.layer2.fullName}`);
    assert.dom(epiloguePostableSel(1)).containsText('250.00 DAI.CPXD');

    await waitFor(epiloguePostableSel(2));

    assert
      .dom(epiloguePostableSel(2))
      .containsText(
        `This is the remaining balance in your ${c.layer1.fullName} wallet`
      );

    layer1Service.test__simulateBalances({
      defaultToken: new BN('2141100000000000000'),
      dai: new BN('500000000000000000'),
      card: new BN('10000000000000000000000'),
    });

    await waitFor(`${epiloguePostableSel(3)} [data-test-balance="ETH"]`);
    assert
      .dom(`${epiloguePostableSel(3)} [data-test-balance="ETH"]`)
      .containsText('2.1411');
    assert
      .dom(`${epiloguePostableSel(3)} [data-test-balance="DAI"]`)
      .containsText('0.50');
    assert
      .dom(`${epiloguePostableSel(3)} [data-test-balance="CARD"]`)
      .containsText('10,000.00');

    assert
      .dom(
        '[data-test-milestone] [data-test-boxel-action-chin] button[data-test-boxel-button]:not([disabled])'
      )
      .doesNotExist();

    assert
      .dom(
        `${epiloguePostableSel(4)} [data-test-deposit-next-step="dashboard"]`
      )
      .exists();
    await click(
      `${epiloguePostableSel(4)} [data-test-deposit-next-step="dashboard"]`
    );
    assert.dom('[data-test-workflow-thread]').doesNotExist();
  });

  test('Initiating workflow with layer 1 wallet already connected', async function (assert) {
    await visit('/card-pay/token-suppliers');
    await click(
      '[data-test-card-pay-layer-1-connect] [data-test-card-pay-connect-button]'
    );
    assert.dom('[data-test-layer-connect-modal="layer1"]').exists();
    let layer1Service = this.owner.lookup('service:layer1-network')
      .strategy as Layer1TestWeb3Strategy;

    let layer1AccountAddress = '0xaCD5f5534B756b856ae3B2CAcF54B3321dd6654Fb6';
    layer1Service.test__simulateAccountsChanged(
      [layer1AccountAddress],
      'metamask'
    );
    await waitUntil(
      () => !document.querySelector('[data-test-layer-connect-modal="layer1"]')
    );
    assert
      .dom(
        '[data-test-card-pay-layer-1-connect] [data-test-card-pay-connect-button]'
      )
      .hasText('0xaCD5...4Fb6');
    assert.dom('[data-test-layer-connect-modal="layer1"]').doesNotExist();

    await click('[data-test-workflow-button="deposit"]');

    let post = postableSel(0, 0);
    assert.dom(`${post} img`).exists();
    assert.dom(post).containsText('Hi there, we’re happy to see you');

    assert
      .dom(postableSel(0, 1))
      .containsText('you need to connect two wallets');

    assert
      .dom(postableSel(0, 2))
      .containsText(
        `The funds you wish to deposit must be available in your ${c.layer1.conversationalName} wallet`
      );

    assert
      .dom(postableSel(0, 3))
      .containsText(
        `Looks like you’ve already connected your ${c.layer1.fullName} wallet`
      );

    await settled();
    assert
      .dom(milestoneCompletedSel(0))
      .containsText(
        `${capitalize(c.layer1.conversationalName)} wallet connected`
      );

    assert
      .dom(postableSel(1, 0))
      .containsText(
        `Now it’s time to connect your ${c.layer2.fullName} wallet via your Card Wallet mobile app`
      );

    assert
      .dom(postableSel(1, 1))
      .containsText(
        'Once you have installed the app, open the app and add an existing wallet/account'
      );

    assert
      .dom(postableSel(1, 2))
      .containsText('Loading QR Code for Card Wallet connection');

    let layer2Service = this.owner.lookup('service:layer2-network')
      .strategy as Layer2TestWeb3Strategy;
    layer2Service.test__simulateWalletConnectUri();
    await waitFor('[data-test-wallet-connect-qr-code]');
    assert.dom('[data-test-wallet-connect-qr-code]').exists();

    // Simulate the user scanning the QR code and connecting their mobile wallet
    let layer2AccountAddress = '0x182619c6Ea074C053eF3f1e1eF81Ec8De6Eb6E44';
    layer2Service.test__simulateAccountsChanged([layer2AccountAddress]);
    await waitUntil(
      () => !document.querySelector('[data-test-wallet-connect-qr-code]')
    );
    assert
      .dom(
        '[data-test-card-pay-layer-2-connect] [data-test-card-pay-connect-button]'
      )
      .hasText('0x1826...6E44');
    await settled();
    assert
      .dom(milestoneCompletedSel(1))
      .containsText(`${c.layer2.fullName} wallet connected`);

    assert
      .dom(postableSel(2, 0))
      .containsText('choose the asset you would like to deposit');
  });

  test('Initiating workflow with layer 2 wallet already connected', async function (assert) {
    await visit('/card-pay/token-suppliers');
    await click(
      '[data-test-card-pay-layer-2-connect] [data-test-card-pay-connect-button]'
    );
    assert.dom('[data-test-layer-connect-modal="layer2"]').exists();
    let layer2Service = this.owner.lookup('service:layer2-network')
      .strategy as Layer2TestWeb3Strategy;

    layer2Service.test__simulateWalletConnectUri();
    await waitFor('[data-test-wallet-connect-qr-code]');
    assert.dom('[data-test-wallet-connect-qr-code]').exists();

    // Simulate the user scanning the QR code and connecting their mobile wallet
    let layer2AccountAddress = '0x182619c6Ea074C053eF3f1e1eF81Ec8De6Eb6E44';
    layer2Service.test__simulateAccountsChanged([layer2AccountAddress]);
    await waitUntil(
      () => !document.querySelector('[data-test-layer-connect-modal="layer2"]')
    );
    assert
      .dom(
        '[data-test-card-pay-layer-2-connect] [data-test-card-pay-connect-button]'
      )
      .hasText('0x1826...6E44');
    assert.dom('[data-test-layer-connect-modal="layer2"]').doesNotExist();

    await click('[data-test-workflow-button="deposit"]');
    await click(`${postableSel(0, 3)} [data-test-wallet-option="metamask"]`);
    await click(
      `${postableSel(
        0,
        3
      )} [data-test-mainnnet-connection-action-container] [data-test-boxel-button]`
    );

    let layer1AccountAddress = '0xaCD5f5534B756b856ae3B2CAcF54B3321dd6654Fb6';
    let layer1Service = this.owner.lookup('service:layer1-network')
      .strategy as Layer1TestWeb3Strategy;
    layer1Service.test__simulateAccountsChanged(
      [layer1AccountAddress],
      'metamask'
    );

    await settled();
    assert
      .dom(milestoneCompletedSel(0))
      .containsText(
        `${capitalize(c.layer1.conversationalName)} wallet connected`
      );

    assert
      .dom(postableSel(1, 0))
      .containsText(
        `Looks like you’ve already connected your ${c.layer2.fullName} wallet`
      );

    await settled();
    assert
      .dom(milestoneCompletedSel(1))
      .containsText(`${c.layer2.fullName} wallet connected`);

    assert
      .dom(postableSel(2, 0))
      .containsText('choose the asset you would like to deposit');
  });

  test('Disconnecting Layer 1 from within the workflow', async function (assert) {
    let layer1Service = this.owner.lookup('service:layer1-network')
      .strategy as Layer1TestWeb3Strategy;
    let layer1AccountAddress = '0xaCD5f5534B756b856ae3B2CAcF54B3321dd6654Fb6';
    layer1Service.test__simulateAccountsChanged(
      [layer1AccountAddress],
      'metamask'
    );
    layer1Service.test__simulateBalances({
      defaultToken: new BN('2141100000000000000'),
      dai: new BN('250500000000000000000'),
      card: new BN('10000000000000000000000'),
    });
    let layer2Service = this.owner.lookup('service:layer2-network')
      .strategy as Layer2TestWeb3Strategy;
    let layer2AccountAddress = '0xaCD5f5534B756b856ae3B2CAcF54B3321dd6654Fb6';
    layer2Service.test__simulateRemoteAccountSafes(layer2AccountAddress, [
      createDepotSafe({
        owners: [layer2AccountAddress],
        tokens: [createSafeToken('DAI', '142200000000000000')],
      }),
    ]);
    layer2Service.test__simulateAccountsChanged([layer2AccountAddress]);
    await layer2Service.safes.fetch();

    await visit('/card-pay/token-suppliers');
    await click('[data-test-workflow-button="deposit"]');

    let post = postableSel(0, 0);
    assert.dom(post).containsText('Hi there, we’re happy to see you');

    assert
      .dom(postableSel(0, 3))
      .containsText(
        `Looks like you’ve already connected your ${c.layer1.fullName} wallet`
      );

    await settled();

    assert
      .dom(milestoneCompletedSel(0))
      .containsText(
        `${capitalize(c.layer1.conversationalName)} wallet connected`
      );

    assert
      .dom(postableSel(1, 0))
      .containsText(
        `Looks like you’ve already connected your ${c.layer2.fullName} wallet`
      );

    await settled();
    assert
      .dom(milestoneCompletedSel(1))
      .containsText(`${c.layer2.fullName} wallet connected`);

    assert
      .dom(postableSel(2, 0))
      .containsText('choose the asset you would like to deposit');
    assert
      .dom(`${postableSel(0, 4)} [data-test-mainnet-disconnect-button]`)
      .containsText('Disconnect Wallet');
    await click(`${postableSel(0, 4)} [data-test-mainnet-disconnect-button]`);

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
        'It looks like your wallet(s) got disconnected. If you still want to deposit funds, please start again by connecting your wallet(s).'
      );
    assert.dom(cancelationPostableSel(1)).containsText('Workflow canceled');
    assert
      .dom('[data-test-workflow-default-cancelation-restart="deposit"]')
      .exists();
  });

  test('Disconnecting Layer 1 from outside the current tab (mobile wallet / other tabs)', async function (assert) {
    let layer1Service = this.owner.lookup('service:layer1-network')
      .strategy as Layer1TestWeb3Strategy;
    let layer1AccountAddress = '0xaCD5f5534B756b856ae3B2CAcF54B3321dd6654Fb6';
    layer1Service.test__simulateAccountsChanged(
      [layer1AccountAddress],
      'metamask'
    );
    layer1Service.test__simulateBalances({
      defaultToken: new BN('2141100000000000000'),
      dai: new BN('250500000000000000000'),
      card: new BN('10000000000000000000000'),
    });
    let layer2Service = this.owner.lookup('service:layer2-network')
      .strategy as Layer2TestWeb3Strategy;
    let layer2AccountAddress = '0xaCD5f5534B756b856ae3B2CAcF54B3321dd6654Fb6';
    layer2Service.test__simulateRemoteAccountSafes(layer2AccountAddress, [
      createDepotSafe({
        owners: [layer2AccountAddress],
        tokens: [createSafeToken('DAI', '142200000000000000')],
      }),
    ]);
    layer2Service.test__simulateAccountsChanged([layer2AccountAddress]);
    await layer2Service.safes.fetch();

    await visit('/card-pay/token-suppliers');
    await click('[data-test-workflow-button="deposit"]');

    let post = postableSel(0, 0);
    assert.dom(post).containsText('Hi there, we’re happy to see you');

    assert
      .dom(postableSel(0, 3))
      .containsText(
        `Looks like you’ve already connected your ${c.layer1.fullName} wallet`
      );

    assert
      .dom(milestoneCompletedSel(0))
      .containsText(
        `${capitalize(c.layer1.conversationalName)} wallet connected`
      );

    assert
      .dom(postableSel(1, 0))
      .containsText(
        `Looks like you’ve already connected your ${c.layer2.fullName} wallet`
      );

    await settled();
    assert
      .dom(milestoneCompletedSel(1))
      .containsText(`${c.layer2.fullName} wallet connected`);

    assert
      .dom(postableSel(2, 0))
      .containsText('choose the asset you would like to deposit');

    layer1Service.test__simulateDisconnectFromWallet();

    await waitFor('[data-test-workflow-default-cancelation-cta="deposit"]');

    // test that all cta buttons are disabled
    assert
      .dom(
        '[data-test-milestone] [data-test-boxel-action-chin] button[data-test-boxel-button]:not([disabled])'
      )
      .doesNotExist();

    assert
      .dom(cancelationPostableSel(0))
      .containsText(
        'It looks like your wallet(s) got disconnected. If you still want to deposit funds, please start again by connecting your wallet(s).'
      );
    assert.dom(cancelationPostableSel(1)).containsText('Workflow canceled');
    assert
      .dom('[data-test-workflow-default-cancelation-restart="deposit"]')
      .exists();
  });

  test('Disconnecting Layer 2 from within the workflow', async function (assert) {
    let layer1Service = this.owner.lookup('service:layer1-network')
      .strategy as Layer1TestWeb3Strategy;
    let layer1AccountAddress = '0xaCD5f5534B756b856ae3B2CAcF54B3321dd6654Fb6';
    layer1Service.test__simulateAccountsChanged(
      [layer1AccountAddress],
      'metamask'
    );
    layer1Service.test__simulateBalances({
      defaultToken: new BN('2141100000000000000'),
      dai: new BN('250500000000000000000'),
      card: new BN('10000000000000000000000'),
    });
    let layer2Service = this.owner.lookup('service:layer2-network')
      .strategy as Layer2TestWeb3Strategy;
    let layer2AccountAddress = '0xaCD5f5534B756b856ae3B2CAcF54B3321dd6654Fb6';
    layer2Service.test__simulateRemoteAccountSafes(layer2AccountAddress, [
      createDepotSafe({
        owners: [layer2AccountAddress],
        tokens: [createSafeToken('DAI', '142200000000000000')],
      }),
    ]);
    layer2Service.test__simulateAccountsChanged([layer2AccountAddress]);
    await layer2Service.safes.fetch();

    await visit('/card-pay/token-suppliers');
    await click('[data-test-workflow-button="deposit"]');

    let post = postableSel(0, 0);
    assert.dom(post).containsText('Hi there, we’re happy to see you');

    assert
      .dom(postableSel(0, 3))
      .containsText(
        `Looks like you’ve already connected your ${c.layer1.fullName} wallet`
      );

    assert
      .dom(milestoneCompletedSel(0))
      .containsText(
        `${capitalize(c.layer1.conversationalName)} wallet connected`
      );

    assert
      .dom(postableSel(1, 0))
      .containsText(
        `Looks like you’ve already connected your ${c.layer2.fullName} wallet`
      );

    await settled();
    assert
      .dom(milestoneCompletedSel(1))
      .containsText(`${c.layer2.fullName} wallet connected`);

    assert
      .dom(postableSel(2, 0))
      .containsText('choose the asset you would like to deposit');
    assert.dom('[data-test-layer-2-wallet-card]').containsText('0.1422');
    assert
      .dom(
        '[data-test-layer-2-wallet-card] [data-test-layer-2-wallet-disconnect-button]'
      )
      .containsText('Disconnect Wallet');
    await click(
      `[data-test-layer-2-wallet-card] [data-test-layer-2-wallet-disconnect-button]`
    );

    // test that all cta buttons are disabled
    assert
      .dom(
        '[data-test-milestone] [data-test-boxel-action-chin] button[data-test-boxel-button]:not([disabled])'
      )
      .doesNotExist();

    assert
      .dom(cancelationPostableSel(0))
      .containsText(
        'It looks like your wallet(s) got disconnected. If you still want to deposit funds, please start again by connecting your wallet(s).'
      );
    assert.dom(cancelationPostableSel(1)).containsText('Workflow canceled');

    assert
      .dom('[data-test-workflow-default-cancelation-restart="deposit"]')
      .exists();
  });

  test('Disconnecting Layer 2 from outside the current tab (mobile wallet / other tabs)', async function (assert) {
    let layer1Service = this.owner.lookup('service:layer1-network')
      .strategy as Layer1TestWeb3Strategy;
    let layer1AccountAddress = '0xaCD5f5534B756b856ae3B2CAcF54B3321dd6654Fb6';
    layer1Service.test__simulateAccountsChanged(
      [layer1AccountAddress],
      'metamask'
    );
    layer1Service.test__simulateBalances({
      defaultToken: new BN('2141100000000000000'),
      dai: new BN('250500000000000000000'),
      card: new BN('10000000000000000000000'),
    });
    let layer2Service = this.owner.lookup('service:layer2-network')
      .strategy as Layer2TestWeb3Strategy;
    let layer2AccountAddress = '0xaCD5f5534B756b856ae3B2CAcF54B3321dd6654Fb6';
    layer2Service.test__simulateRemoteAccountSafes(layer2AccountAddress, [
      createDepotSafe({
        owners: [layer2AccountAddress],
        tokens: [createSafeToken('DAI', '142200000000000000')],
      }),
    ]);
    layer2Service.test__simulateAccountsChanged([layer2AccountAddress]);

    await visit('/card-pay/token-suppliers');
    await click('[data-test-workflow-button="deposit"]');

    let post = postableSel(0, 0);
    assert.dom(post).containsText('Hi there, we’re happy to see you');

    assert
      .dom(postableSel(0, 3))
      .containsText(
        `Looks like you’ve already connected your ${c.layer1.fullName} wallet`
      );

    assert
      .dom(milestoneCompletedSel(0))
      .containsText(
        `${capitalize(c.layer1.conversationalName)} wallet connected`
      );

    assert
      .dom(postableSel(1, 0))
      .containsText(
        `Looks like you’ve already connected your ${c.layer2.fullName} wallet`
      );

    await settled();
    assert
      .dom(milestoneCompletedSel(1))
      .containsText(`${c.layer2.fullName} wallet connected`);

    assert
      .dom(postableSel(2, 0))
      .containsText('choose the asset you would like to deposit');
    assert.dom('[data-test-layer-2-wallet-card]').containsText('0.1422');
    assert
      .dom(
        '[data-test-layer-2-wallet-card] [data-test-layer-2-wallet-disconnect-button]'
      )
      .containsText('Disconnect Wallet');

    layer2Service.test__simulateDisconnectFromWallet();

    await waitFor('[data-test-workflow-default-cancelation-cta="deposit"]');
    // test that all cta buttons are disabled
    assert
      .dom(
        '[data-test-milestone] [data-test-boxel-action-chin] button[data-test-boxel-button]:not([disabled])'
      )
      .doesNotExist();
    assert
      .dom(cancelationPostableSel(0))
      .containsText(
        'It looks like your wallet(s) got disconnected. If you still want to deposit funds, please start again by connecting your wallet(s).'
      );
    assert.dom(cancelationPostableSel(1)).containsText('Workflow canceled');
    assert
      .dom('[data-test-workflow-default-cancelation-restart="deposit"]')
      .exists();
  });

  test('Changing layer 1 account should cancel the workflow', async function (assert) {
    let layer1Service = this.owner.lookup('service:layer1-network')
      .strategy as Layer1TestWeb3Strategy;
    let layer1AccountAddress = '0xaCD5f5534B756b856ae3B2CAcF54B3321dd6654Fb6';
    let secondLayer1AccountAddress =
      '0x5416C61193C3393B46C2774ac4717C252031c0bE';
    layer1Service.test__simulateAccountsChanged(
      [layer1AccountAddress],
      'metamask'
    );
    layer1Service.test__simulateBalances({
      defaultToken: new BN('2141100000000000000'),
      dai: new BN('250500000000000000000'),
      card: new BN('10000000000000000000000'),
    });
    let layer2Service = this.owner.lookup('service:layer2-network')
      .strategy as Layer2TestWeb3Strategy;
    let layer2AccountAddress = '0xaCD5f5534B756b856ae3B2CAcF54B3321dd6654Fb6';
    layer2Service.test__simulateRemoteAccountSafes(layer2AccountAddress, [
      createDepotSafe({
        owners: [layer2AccountAddress],
        tokens: [createSafeToken('DAI', '142200000000000000')],
      }),
    ]);
    layer2Service.test__simulateAccountsChanged([layer2AccountAddress]);

    await visit('/card-pay/token-suppliers');
    await click('[data-test-workflow-button="deposit"]');

    let post = postableSel(0, 0);
    assert.dom(post).containsText('Hi there, we’re happy to see you');

    assert
      .dom(postableSel(0, 3))
      .containsText(
        `Looks like you’ve already connected your ${c.layer1.fullName} wallet`
      );

    await settled();

    assert
      .dom(milestoneCompletedSel(0))
      .containsText(
        `${capitalize(c.layer1.conversationalName)} wallet connected`
      );

    assert
      .dom(postableSel(1, 0))
      .containsText(
        `Looks like you’ve already connected your ${c.layer2.fullName} wallet`
      );

    await settled();
    assert
      .dom(milestoneCompletedSel(1))
      .containsText(`${c.layer2.fullName} wallet connected`);

    assert
      .dom(postableSel(2, 0))
      .containsText('choose the asset you would like to deposit');
    assert
      .dom(`${postableSel(0, 4)} [data-test-mainnet-disconnect-button]`)
      .containsText('Disconnect Wallet');

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
        'It looks like you changed accounts in the middle of this workflow. If you still want to deposit funds, please restart the workflow.'
      );
    assert.dom(cancelationPostableSel(1)).containsText('Workflow canceled');
    assert
      .dom('[data-test-workflow-default-cancelation-restart="deposit"]')
      .exists();
  });

  test('Changing layer 2 account should cancel the workflow', async function (assert) {
    let layer1Service = this.owner.lookup('service:layer1-network')
      .strategy as Layer1TestWeb3Strategy;
    let layer1AccountAddress = '0xaCD5f5534B756b856ae3B2CAcF54B3321dd6654Fb6';
    layer1Service.test__simulateAccountsChanged(
      [layer1AccountAddress],
      'metamask'
    );
    layer1Service.test__simulateBalances({
      defaultToken: new BN('2141100000000000000'),
      dai: new BN('250500000000000000000'),
      card: new BN('10000000000000000000000'),
    });
    let layer2Service = this.owner.lookup('service:layer2-network')
      .strategy as Layer2TestWeb3Strategy;
    let layer2AccountAddress = '0xaCD5f5534B756b856ae3B2CAcF54B3321dd6654Fb6';
    let secondLayer2AccountAddress =
      '0x0x89205A3A3b2A69De6Dbf7f01ED13B2108B2c43e7';
    layer2Service.test__simulateRemoteAccountSafes(layer2AccountAddress, [
      createDepotSafe({
        owners: [layer2AccountAddress],
        tokens: [createSafeToken('DAI', '142200000000000000')],
      }),
    ]);
    layer2Service.test__simulateAccountsChanged([layer2AccountAddress]);

    await visit('/card-pay/token-suppliers');
    await click('[data-test-workflow-button="deposit"]');

    let post = postableSel(0, 0);
    assert.dom(post).containsText('Hi there, we’re happy to see you');

    assert
      .dom(postableSel(0, 3))
      .containsText(
        `Looks like you’ve already connected your ${c.layer1.fullName} wallet`
      );

    await settled();

    assert
      .dom(milestoneCompletedSel(0))
      .containsText(
        `${capitalize(c.layer1.conversationalName)} wallet connected`
      );

    assert
      .dom(postableSel(1, 0))
      .containsText(
        `Looks like you’ve already connected your ${c.layer2.fullName} wallet`
      );

    await settled();
    assert
      .dom(milestoneCompletedSel(1))
      .containsText(`${c.layer2.fullName} wallet connected`);

    assert
      .dom(postableSel(2, 0))
      .containsText('choose the asset you would like to deposit');
    assert
      .dom(`${postableSel(0, 4)} [data-test-mainnet-disconnect-button]`)
      .containsText('Disconnect Wallet');

    layer2Service.test__simulateAccountsChanged([secondLayer2AccountAddress]);
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
        'It looks like you changed accounts in the middle of this workflow. If you still want to deposit funds, please restart the workflow.'
      );
    assert.dom(cancelationPostableSel(1)).containsText('Workflow canceled');
    assert
      .dom('[data-test-workflow-default-cancelation-restart="deposit"]')
      .exists();
  });
});
