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
import { BigNumber } from '@ethersproject/bignumber';
import a11yAudit from 'ember-a11y-testing/test-support/audit';

function postableSel(milestoneIndex: number, postableIndex: number): string {
  return `[data-test-milestone="${milestoneIndex}"][data-test-postable="${postableIndex}"]`;
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
    assert.equal(currentURL(), '/card-pay');

    await click('[data-test-card-pay-header-tab][href="/card-pay/balances"]');

    await click('[data-test-deposit-button]');

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
    layer1Service.test__simulateAccountsChanged([layer1AccountAddress]);
    layer1Service.test__simulateBalances({
      defaultToken: BigNumber.from('2141100000000000000'),
      dai: BigNumber.from('250500000000000000000'),
      card: BigNumber.from('10000000000000000000000'),
    });
    await waitFor(`${post} [data-test-eth-balance]`);
    assert.dom(`${post} [data-test-eth-balance]`).containsText('2.1411');
    assert.dom(`${post} [data-test-dai-balance]`).containsText('250.5');
    assert.dom(`${post} [data-test-card-balance]`).containsText('10000.0');

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
      defaultToken: BigNumber.from('0'),
    });
    await waitFor(`${postableSel(1, 2)} [data-test-xdai-balance]`);
    assert
      .dom(`${postableSel(1, 2)} [data-test-xdai-balance]`)
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

    await click(`${post} [data-test-layer-1-source-trigger]`);
    await waitFor(`${post} [data-test-eth-balance]`);
    assert.dom(`${post} [data-test-eth-balance]`).containsText('2.1411');
    assert.dom(`${post} [data-test-dai-balance]`).containsText('250.5');
    assert.dom(`${post} [data-test-card-balance]`).containsText('10000.0');
    await click(`${post} [data-test-dai-option]`);
    await click(`${post} [data-test-layer-2-target-trigger]`);
    await click(`${post} [data-test-new-depot-option]`);
    await click(`${post} [data-test-continue-button]`);

    assert
      .dom(postableSel(2, 2))
      .containsText('How many tokens would you like to deposit?');

    post = postableSel(2, 3);
    assert.dom(`${post} [data-test-source-token="dai"]`).exists();
    assert.dom(`${post} [data-test-unlock-button]`).isDisabled();
    assert.dom(`${post} [data-test-deposit-button]`).isDisabled();
    await fillIn('[data-test-deposit-amount-input]', '2500');
    assert
      .dom(`${post} [data-test-unlock-button]`)
      .isEnabled('Unlock button is enabled once amount has been entered');
    await click(`${post} [data-test-unlock-button]`);

    // // MetaMask pops up and user approves the transaction. There is a spinner
    // // on the "Unlock" button until the Ethereum transaction is mined.
    // // When the mining is complete, the "Deposit" button becomes clickable.

    // TODO assert spinner on Unlock button

    layer1Service.test__simulateUnlock();
    await settled();

    // TODO assert no spinner on Unlock button

    assert
      .dom(`${post} [data-test-unlock-button]`)
      .isDisabled('Unlock is disabled once unlocked');
    assert
      .dom(`${post} [data-test-deposit-button]`)
      .isEnabled('Deposit is enabled once unlocked');
    await click(`${post} [data-test-deposit-button]`);

    // TODO assert spinner on Deposit button

    layer1Service.test__simulateDeposit();
    await settled();

    assert
      .dom(milestoneCompletedSel(2))
      .containsText('Deposited into Reserve Pool');

    assert
      .dom(postableSel(3, 0))
      .containsText('your token will be bridged to the xDai blockchain');

    post = postableSel(3, 1);
    // assert.dom(`${message} [data-test-step-1="complete"]`);
    // assert.dom(`${message} [data-test-step-2="in-progress"]`);

    // layer1Service.test__simulateTokensBridged();
    // assert.dom(`${message} [data-test-step-2="complete"]`);
    // assert.dom(`${message} [data-test-step-3="in-progress"]`);
    // layer1Service.test__simulateCPXDMinted();

    // assert
    //   .dom('milestoneCompletedSel(3)')
    //   .containsText('Tokens received on xDai');

    // message = '[data-test-after-workflow][data-test-postable="0"]';

    // assert.dom(`${message}`).containsText('Thank you for your contribution!');
    // assert
    //   .dom(`${message}`)
    //   .containsText(
    //     "You have deposited 2,500 DAI into the CARD Protocol's Reserve Pool."
    //   );

    // message = '[data-test-after-workflow][data-test-postable="1"]';
    // assert
    //   .dom(`${message}`)
    //   .containsText(
    //     'This is the remaining balance in your Ethereum Mainnet wallet'
    //   );

    // await click('[data-test-show-balances-button]');

    // // assert Cards & Balances tab is active
    // // assert balance shows deposit just made
    // // assert only Dai CPXD balance shown
    // // assert no Prepaid Cards yet
  });

  test('Initiating workflow with layer 1 wallet already connected', async function (assert) {
    await visit('/');
    await click('[data-test-cardstack-org-link="card-pay"]');

    await click(
      '[data-test-card-pay-layer-1-connect] [data-test-card-pay-connect-button]'
    );
    assert.dom('[data-test-layer-one-connect-modal]').exists();
    let layer1Service = this.owner.lookup('service:layer1-network')
      .strategy as Layer1TestWeb3Strategy;

    let layer1AccountAddress = '0xaCD5f5534B756b856ae3B2CAcF54B3321dd6654Fb6';
    layer1Service.test__simulateAccountsChanged([layer1AccountAddress]);
    await waitUntil(
      () => !document.querySelector('[data-test-layer-one-connect-modal]')
    );
    assert
      .dom(
        '[data-test-card-pay-layer-1-connect] [data-test-card-pay-connect-button]'
      )
      .hasText('0xaCD5f...4Fb6');
    assert.dom('[data-test-layer-one-connect-modal]').doesNotExist();

    await click('[data-test-card-pay-header-tab][href="/card-pay/balances"]');
    await click('[data-test-deposit-button]');

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
    assert.dom('[data-test-layer-two-connect-modal]').exists();
    let layer2Service = this.owner.lookup('service:layer2-network')
      .strategy as Layer2TestWeb3Strategy;

    layer2Service.test__simulateWalletConnectUri();
    await waitFor('[data-test-wallet-connect-qr-code]');
    assert.dom('[data-test-wallet-connect-qr-code]').exists();

    // Simulate the user scanning the QR code and connecting their mobile wallet
    let layer2AccountAddress = '0x182619c6Ea074C053eF3f1e1eF81Ec8De6Eb6E44';
    layer2Service.test__simulateAccountsChanged([layer2AccountAddress]);
    await waitUntil(
      () => !document.querySelector('[data-test-layer-two-connect-modal]')
    );
    assert
      .dom(
        '[data-test-card-pay-layer-2-connect] [data-test-card-pay-connect-button]'
      )
      .hasText('0x18261...6E44');
    assert.dom('[data-test-layer-two-connect-modal]').doesNotExist();

    await click('[data-test-card-pay-header-tab][href="/card-pay/balances"]');
    await click('[data-test-deposit-button]');
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
    layer1Service.test__simulateAccountsChanged([layer1AccountAddress]);

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
    layer1Service.test__simulateAccountsChanged([layer1AccountAddress]);
    layer1Service.test__simulateBalances({
      defaultToken: BigNumber.from('2141100000000000000'),
      dai: BigNumber.from('250500000000000000000'),
      card: BigNumber.from('10000000000000000000000'),
    });
    let layer2Service = this.owner.lookup('service:layer2-network')
      .strategy as Layer2TestWeb3Strategy;
    let layer2AccountAddress = '0xaCD5f5534B756b856ae3B2CAcF54B3321dd6654Fb6';
    layer2Service.test__simulateAccountsChanged([layer2AccountAddress]);
    layer2Service.test__simulateBalances({
      defaultToken: BigNumber.from('142200000000000000'),
    });

    await visit('/card-pay/balances');
    await click('[data-test-deposit-button]');

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
      .dom(`${postableSel(0, 4)} [data-test-boxel-cta-block-button]`)
      .containsText('Disconnect Wallet');
    await click(`${postableSel(0, 4)} [data-test-boxel-cta-block-button]`);
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
    layer1Service.test__simulateAccountsChanged([layer1AccountAddress]);
    layer1Service.test__simulateBalances({
      defaultToken: BigNumber.from('2141100000000000000'),
      dai: BigNumber.from('250500000000000000000'),
      card: BigNumber.from('10000000000000000000000'),
    });
    let layer2Service = this.owner.lookup('service:layer2-network')
      .strategy as Layer2TestWeb3Strategy;
    let layer2AccountAddress = '0xaCD5f5534B756b856ae3B2CAcF54B3321dd6654Fb6';
    layer2Service.test__simulateAccountsChanged([layer2AccountAddress]);
    layer2Service.test__simulateBalances({
      defaultToken: BigNumber.from('142200000000000000'),
    });

    await visit('/card-pay/balances');
    await click('[data-test-deposit-button]');

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
      .dom('[data-test-layer-2-wallet-card] [data-test-boxel-cta-block-button]')
      .containsText('Disconnect Wallet');
    await click(
      `[data-test-layer-2-wallet-card] [data-test-boxel-cta-block-button]`
    );
    assert
      .dom('[data-test-layer-2-wallet-card]')
      .containsText('Install the Cardstack app on your mobile phone');
    assert.dom(milestoneCompletedSel(1)).doesNotExist();
  });
});
