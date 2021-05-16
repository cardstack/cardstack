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
import { toBN } from 'web3-utils';

function postableSel(milestoneIndex: number, postableIndex: number): string {
  return `[data-test-milestone="${milestoneIndex}"][data-test-postable="${postableIndex}"]`;
}

function epiloguePostableSel(postableIndex: number): string {
  return `[data-test-epilogue][data-test-postable="${postableIndex}"]`;
}

function milestoneCompletedSel(milestoneIndex: number): string {
  return `[data-test-milestone-completed][data-test-milestone="${milestoneIndex}"]`;
}

module('Acceptance | deposit', function (hooks) {
  setupApplicationTest(hooks);

  test('Initiating workflow without wallet connections', async function (assert) {
    await visit('/');
    assert.equal(currentURL(), '/');
    await click('[data-test-cardstack-org-link="card-pay"]');
    assert.equal(currentURL(), '/card-pay/balances');

    await click('[data-test-card-pay-header-tab][href="/card-pay/balances"]');

    await click('[data-test-deposit-workflow-button]');

    let post = postableSel(0, 0);
    assert.dom(`${post} img`).exists();
    assert.dom(post).containsText('Hi there, we’re happy to see you');

    assert
      .dom(postableSel(0, 1))
      .containsText('you need to connect two wallets');

    assert
      .dom(postableSel(0, 2))
      .containsText(
        'The funds you wish to deposit must be available in your Mainnet Wallet'
      );

    post = postableSel(0, 3);
    await click(`${post} [data-test-wallet-option="metamask"]`);
    await click(
      `${post} [data-test-mainnnet-connection-action-container] [data-test-boxel-button]`
    );

    assert.dom(post).containsText('Connect your Ethereum mainnet wallet');

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
      defaultToken: toBN('2141100000000000000'),
      dai: toBN('250500000000000000000'),
      card: toBN('10000000000000000000000'),
    });

    await waitFor(`${post} [data-test-balance="ETH"]`);
    assert.dom(`${post} [data-test-balance="ETH"]`).containsText('2.1411');
    assert.dom(`${post} [data-test-balance="DAI"]`).containsText('250.5');
    assert.dom(`${post} [data-test-balance="CARD"]`).containsText('10000.0');

    await waitFor(milestoneCompletedSel(0));
    assert
      .dom(milestoneCompletedSel(0))
      .containsText('Mainnet Wallet connected');

    assert
      .dom(postableSel(1, 0))
      .containsText(
        'Now it’s time to connect your xDai chain wallet via your Cardstack mobile app'
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
    layer2Service.test__simulateAccountsChanged([layer2AccountAddress]);
    layer2Service.test__simulateBalances({
      defaultToken: toBN(0),
    });
    await waitFor(`${postableSel(1, 2)} [data-test-balance="XDAI"]`);
    assert
      .dom(`${postableSel(1, 2)} [data-test-balance="XDAI"]`)
      .containsText('0.0');
    await waitUntil(
      () => !document.querySelector('[data-test-wallet-connect-qr-code]')
    );
    assert
      .dom(
        '[data-test-card-pay-layer-2-connect] [data-test-card-pay-connect-button]'
      )
      .hasText('0x18261...6E44');
    await waitFor(milestoneCompletedSel(1));
    assert
      .dom(milestoneCompletedSel(1))
      .containsText('xDai Chain wallet connected');

    assert
      .dom(postableSel(2, 0))
      .containsText('choose the asset you would like to deposit');

    post = postableSel(2, 1);

    // transaction-setup card
    await waitFor(`${post} [data-test-balance="DAI"]`);
    assert.dom(`${post} [data-test-balance="DAI"]`).containsText('250.5');
    assert.dom(`${post} [data-test-usd-balance="DAI"]`).containsText('50.10');
    assert.dom(`${post} [data-test-balance="CARD"]`).containsText('10000.0');
    assert
      .dom(`${post} [data-test-usd-balance="CARD"]`)
      .containsText('2000.00');
    assert
      .dom(`${post} [data-test-deposit-transaction-setup-from-address]`)
      .hasText(layer1AccountAddress);
    assert
      .dom(`${post} [data-test-deposit-transaction-setup-to-address]`)
      .hasText('0x18261...6E44');
    assert
      .dom(`${post} [data-test-deposit-transaction-setup-depot-address]`)
      .hasText('New Depot');
    assert
      .dom('[data-test-deposit-transaction-setup-is-complete]')
      .doesNotExist();
    assert.dom(`${post} [data-test-option-view-only]`).doesNotExist();
    assert
      .dom('[data-test-deposit-transaction-setup] [data-test-boxel-button]')
      .isDisabled();
    await click(`${post} [data-test-option="DAI"]`);
    await click(
      `${post} [data-test-deposit-transaction-setup] [data-test-boxel-button]`
    );
    // transaction-setup card (memorialized)
    assert.dom(`${post} [data-test-option]`).doesNotExist();
    assert.dom(`${post} [data-test-option-view-only]`).exists({ count: 1 });
    assert
      .dom('[data-test-deposit-transaction-setup] [data-test-boxel-button]')
      .isNotDisabled();
    assert.dom('[data-test-deposit-transaction-setup-is-complete]').exists();
    assert
      .dom(`${post} [data-test-balance-view-only="DAI"]`)
      .containsText('250.5');
    // transaction-amount card
    assert
      .dom(postableSel(2, 2))
      .containsText('How many tokens would you like to deposit?');

    post = postableSel(2, 3);
    assert.dom(`${post} [data-test-source-token="DAI"]`).exists();
    assert.dom(`${post} [data-test-unlock-button]`).isDisabled();
    assert.dom(`${post} [data-test-deposit-button]`).isDisabled();
    await fillIn('[data-test-deposit-amount-input]', '250');
    assert
      .dom(`${post} [data-test-unlock-button]`)
      .isEnabled('Unlock button is enabled once amount has been entered');
    await click(`${post} [data-test-unlock-button]`);

    // // MetaMask pops up and user approves the transaction. There is a spinner
    // // on the "Unlock" button until the Ethereum transaction is mined.
    // // When the mining is complete, the "Deposit" button becomes clickable.

    assert
      .dom(`${post} [data-test-unlock-button]`)
      .hasClass('boxel-button--loading');

    layer1Service.test__simulateUnlock();
    await settled();

    assert
      .dom(`${post} [data-test-unlock-button]`)
      .doesNotExist('Unlock button is no longer visible after unlocking.');
    assert
      .dom(`${post} [data-test-unlock-success-message]`)
      .exists('There should be a success message after unlocking');

    assert
      .dom(`${post} [data-test-deposit-button]`)
      .isEnabled('Deposit is enabled once unlocked');
    await click(`${post} [data-test-deposit-button]`);

    assert
      .dom(`${post} [data-test-deposit-button]`)
      .hasClass('boxel-button--loading');

    layer1Service.test__simulateDeposit();
    await settled();

    assert
      .dom(`${post} [data-test-deposit-button]`)
      .doesNotExist('Deposit button is no longer visible after depositing.');

    assert
      .dom(`${post} [data-test-deposit-success-message]`)
      .exists('There should be a success message after depositing');

    assert
      .dom(milestoneCompletedSel(2))
      .containsText('Deposited into Reserve Pool');

    assert
      .dom(postableSel(3, 0))
      .containsText('your token will be bridged to the xDai blockchain');

    post = postableSel(3, 1);
    // transaction-status card
    assert
      .dom(`${post} [data-test-token-bridge-step="0"][data-test-completed]`)
      .exists();
    assert.dom(`${post} [data-test-etherscan-button]`).exists();
    assert
      .dom(
        `${post} [data-test-token-bridge-step="1"]:not([data-test-completed])`
      )
      .exists();
    assert.dom(`${post} [data-test-bridge-explorer-button]`).exists();
    assert
      .dom(
        `${post} [data-test-token-bridge-step="2"]:not([data-test-completed])`
      )
      .exists();
    assert.dom(`${post} [data-test-blockscout-button]`).doesNotExist();

    layer2Service.test__simulateBridged(
      '0xabc123abc123abc123e5984131f6b4cc3ac8af14'
    );

    assert.dom(`${post} [data-test-step-2="complete"]`);
    assert.dom(`${post} [data-test-step-3="complete"]`);
    await waitFor(`${post} [data-test-blockscout-button]`);
    assert.dom(`${post} [data-test-blockscout-button]`).exists();

    assert
      .dom(milestoneCompletedSel(3))
      .containsText('Tokens received on xDai');

    assert
      .dom(epiloguePostableSel(0))
      .containsText('Thank you for your contribution!');

    assert
      .dom(epiloguePostableSel(1))
      .containsText('Minted from CARD Protocol on L2 Test Chain');
    assert.dom(epiloguePostableSel(1)).containsText('250.0 DAI CPXD');

    await waitFor(epiloguePostableSel(2));

    assert
      .dom(epiloguePostableSel(2))
      .containsText(
        'This is the remaining balance in your Ethereum mainnet wallet'
      );

    layer1Service.test__simulateBalances({
      defaultToken: toBN('2141100000000000000'),
      dai: toBN('500000000000000000'),
      card: toBN('10000000000000000000000'),
    });

    await waitFor(`${epiloguePostableSel(3)} [data-test-balance="ETH"]`);
    assert
      .dom(`${epiloguePostableSel(3)} [data-test-balance="ETH"]`)
      .containsText('2.1411');
    assert
      .dom(`${epiloguePostableSel(3)} [data-test-balance="DAI"]`)
      .containsText('0.5');
    assert
      .dom(`${epiloguePostableSel(3)} [data-test-balance="CARD"]`)
      .containsText('10000.0');

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
    await visit('/');
    await click('[data-test-cardstack-org-link="card-pay"]');

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
      .hasText('0xaCD5f...4Fb6');
    assert.dom('[data-test-layer-connect-modal="layer1"]').doesNotExist();

    await click('[data-test-card-pay-header-tab][href="/card-pay/balances"]');
    await click('[data-test-deposit-workflow-button]');

    let post = postableSel(0, 0);
    assert.dom(`${post} img`).exists();
    assert.dom(post).containsText('Hi there, we’re happy to see you');

    assert
      .dom(postableSel(0, 1))
      .containsText('you need to connect two wallets');

    assert
      .dom(postableSel(0, 2))
      .containsText(
        'The funds you wish to deposit must be available in your Mainnet Wallet'
      );

    assert
      .dom(postableSel(0, 3))
      .containsText(
        'Looks like you’ve already connected your Ethereum mainnet wallet'
      );

    await waitFor(milestoneCompletedSel(0));
    assert
      .dom(milestoneCompletedSel(0))
      .containsText('Mainnet Wallet connected');

    assert
      .dom(postableSel(1, 0))
      .containsText(
        'Now it’s time to connect your xDai chain wallet via your Cardstack mobile app'
      );

    assert
      .dom(postableSel(1, 1))
      .containsText(
        'Once you have installed the app, open the app and add an existing wallet/account'
      );

    assert
      .dom(postableSel(1, 2))
      .containsText('Loading QR Code for Cardstack Mobile wallet connection');

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
      .hasText('0x18261...6E44');
    await waitFor(milestoneCompletedSel(1));
    assert
      .dom(milestoneCompletedSel(1))
      .containsText('xDai Chain wallet connected');

    assert
      .dom(postableSel(2, 0))
      .containsText('choose the asset you would like to deposit');
  });

  test('Initiating workflow with layer 2 wallet already connected', async function (assert) {
    await visit('/');
    await click('[data-test-cardstack-org-link="card-pay"]');

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
      .hasText('0x18261...6E44');
    assert.dom('[data-test-layer-connect-modal="layer2"]').doesNotExist();

    await click('[data-test-card-pay-header-tab][href="/card-pay/balances"]');
    await click('[data-test-deposit-workflow-button]');
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

    await waitFor(milestoneCompletedSel(0));
    assert
      .dom(milestoneCompletedSel(0))
      .containsText('Mainnet Wallet connected');

    assert
      .dom(postableSel(1, 0))
      .containsText(
        'Looks like you’ve already connected your xDai chain wallet'
      );

    await waitFor(milestoneCompletedSel(1));
    assert
      .dom(milestoneCompletedSel(1))
      .containsText('xDai Chain wallet connected');

    assert
      .dom(postableSel(2, 0))
      .containsText('choose the asset you would like to deposit');
  });

  test('Disconnecting Layer 1 after proceeding beyond it', async function (assert) {
    let layer1Service = this.owner.lookup('service:layer1-network')
      .strategy as Layer1TestWeb3Strategy;
    let layer1AccountAddress = '0xaCD5f5534B756b856ae3B2CAcF54B3321dd6654Fb6';
    layer1Service.test__simulateAccountsChanged(
      [layer1AccountAddress],
      'metamask'
    );
    layer1Service.test__simulateBalances({
      defaultToken: toBN('2141100000000000000'),
      dai: toBN('250500000000000000000'),
      card: toBN('10000000000000000000000'),
    });
    let layer2Service = this.owner.lookup('service:layer2-network')
      .strategy as Layer2TestWeb3Strategy;
    let layer2AccountAddress = '0xaCD5f5534B756b856ae3B2CAcF54B3321dd6654Fb6';
    layer2Service.test__simulateAccountsChanged([layer2AccountAddress]);
    layer2Service.test__simulateBalances({
      defaultToken: toBN('142200000000000000'),
    });

    await visit('/card-pay/balances');
    await click('[data-test-deposit-workflow-button]');

    let post = postableSel(0, 0);
    assert.dom(post).containsText('Hi there, we’re happy to see you');

    assert
      .dom(postableSel(0, 3))
      .containsText(
        'Looks like you’ve already connected your Ethereum mainnet wallet'
      );

    assert
      .dom(milestoneCompletedSel(0))
      .containsText('Mainnet Wallet connected');

    assert
      .dom(postableSel(1, 0))
      .containsText(
        'Looks like you’ve already connected your xDai chain wallet'
      );

    await waitFor(milestoneCompletedSel(1));
    assert
      .dom(milestoneCompletedSel(1))
      .containsText('xDai Chain wallet connected');

    assert
      .dom(postableSel(2, 0))
      .containsText('choose the asset you would like to deposit');
    assert
      .dom(`${postableSel(0, 4)} [data-test-mainnet-disconnect-button]`)
      .containsText('Disconnect Wallet');
    await click(`${postableSel(0, 4)} [data-test-mainnet-disconnect-button]`);
    assert
      .dom(postableSel(0, 4))
      .containsText('Connect your Ethereum mainnet wallet');
    assert.dom(milestoneCompletedSel(1)).doesNotExist();
    assert.dom(milestoneCompletedSel(0)).doesNotExist();
  });

  test('Disconnecting Layer 2 after proceeding beyond it', async function (assert) {
    let layer1Service = this.owner.lookup('service:layer1-network')
      .strategy as Layer1TestWeb3Strategy;
    let layer1AccountAddress = '0xaCD5f5534B756b856ae3B2CAcF54B3321dd6654Fb6';
    layer1Service.test__simulateAccountsChanged(
      [layer1AccountAddress],
      'metamask'
    );
    layer1Service.test__simulateBalances({
      defaultToken: toBN('2141100000000000000'),
      dai: toBN('250500000000000000000'),
      card: toBN('10000000000000000000000'),
    });
    let layer2Service = this.owner.lookup('service:layer2-network')
      .strategy as Layer2TestWeb3Strategy;
    let layer2AccountAddress = '0xaCD5f5534B756b856ae3B2CAcF54B3321dd6654Fb6';
    layer2Service.test__simulateAccountsChanged([layer2AccountAddress]);
    layer2Service.test__simulateBalances({
      defaultToken: toBN('142200000000000000'),
    });

    await visit('/card-pay/balances');
    await click('[data-test-deposit-workflow-button]');

    let post = postableSel(0, 0);
    assert.dom(post).containsText('Hi there, we’re happy to see you');

    assert
      .dom(postableSel(0, 3))
      .containsText(
        'Looks like you’ve already connected your Ethereum mainnet wallet'
      );

    assert
      .dom(milestoneCompletedSel(0))
      .containsText('Mainnet Wallet connected');

    assert
      .dom(postableSel(1, 0))
      .containsText(
        'Looks like you’ve already connected your xDai chain wallet'
      );

    await waitFor(milestoneCompletedSel(1));
    assert
      .dom(milestoneCompletedSel(1))
      .containsText('xDai Chain wallet connected');

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
    assert
      .dom('[data-test-layer-2-wallet-card]')
      .containsText('Install the Cardstack app on your mobile phone');
    assert.dom(milestoneCompletedSel(1)).doesNotExist();
  });
});
