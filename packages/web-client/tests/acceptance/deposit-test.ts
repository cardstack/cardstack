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

module('Acceptance | deposit', function (hooks) {
  setupApplicationTest(hooks);
  // TODO: Scenario where the user has already connected Layer 1 before starting this workflow
  test('Making a deposit', async function (assert) {
    await visit('/');
    assert.equal(currentURL(), '/');
    await click('[data-test-cardstack-org-link="card-pay"]');
    assert.equal(currentURL(), '/card-pay');

    await click(
      '[data-test-card-pay-layer-2-connect] [data-test-card-pay-connect-button]'
    );
    let layer2Service = this.owner.lookup('service:layer2-network');
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
      .hasText('0x18261…6E44');
    assert.dom('[data-test-wallet-connect-qr-code]').doesNotExist();
    assert.dom('[data-test-layer-two-connect-modal]').doesNotExist();
    await click(
      '[data-test-card-pay-header-tab][href="/card-pay/token-suppliers"]'
    );

    assert.dom('[data-test-deposit-instructions]').exists();
    await click('[data-test-hide-button]');

    let message = '[data-test-milestone="0"][data-test-thread-message="0"]';
    assert.dom(`${message} [data-test-author-name]`).containsText('cardbot');
    assert.dom(message).containsText('Hi there, we’re happy to see you');

    message = '[data-test-milestone="0"][data-test-thread-message="1"]';
    assert.dom(message).containsText('you need to connect two wallets');

    message = '[data-test-milestone="0"][data-test-thread-message="2"]';
    assert
      .dom(message)
      .containsText(
        'The funds you wish to deposit must be available in your Mainnet Wallet'
      );

    message = '[data-test-milestone="0"][data-test-thread-message="3"]';

    await click(`${message} [data-test-wallet-option="metamask"]`);
    await click(
      `${message} [data-test-mainnnet-connection-action-container] [data-test-boxel-button]`
    );

    assert
      .dom(message)
      .containsText(
        'Waiting for you to connect the Cardstack dApp with your mainnet wallet'
      );

    let layer1AccountAddress = '0xaCD5f5534B756b856ae3B2CAcF54B3321dd6654Fb6';
    let layer1Service = this.owner.lookup('service:layer1-network');
    layer1Service.test__simulateAccountsChanged([layer1AccountAddress]);

    await waitFor('[data-test-milestone-completed]');
    assert
      .dom('[data-test-milestone-completed][data-test-milestone="0"]')
      .containsText('Mainnet Wallet connected');
    await this.pauseTest();
    message = '[data-test-milestone="1"][data-test-thread-message="0"]';
    assert.dom(`${message} [data-test-author-name]`).containsText('cardbot');
    assert
      .dom(message)
      .containsText(
        'Please choose the asset you would like to deposit into the CARD Protocol’s Reserve Pool'
      );
    message = '[data-test-milestone="1"][data-test-thread-message="1"]';
    // TODO: assert ETH balance showing
    // TODO: assert DAI balance showing
    await click(`${message} [data-test-layer-1-source-trigger]`);
    await click(`${message} [data-test-dai-option]`);
    await click(`${message} [data-test-layer-2-target-trigger]`);
    await click(`${message} [data-test-new-depot-option]`);
    await click(`${message} [data-test-continue-button]`);

    message = '[data-test-milestone="1"][data-test-thread-message="2"]';
    assert.dom(`${message} [data-test-author-name]`).containsText('cardbot');
    assert
      .dom(message)
      .containsText('How many tokens would you like to deposit?');

    message = '[data-test-milestone="1"][data-test-thread-message="3"]';
    assert.dom(`${message} [data-test-unlock-button]`).isDisabled();
    assert.dom(`${message} [data-test-deposit-button]`).isDisabled();
    await fillIn('[data-test-deposit-amount-input]', '2500');
    assert
      .dom(`${message} [data-test-unlock-button]`)
      .isEnabled('Unlock button is enabled once amount has been entered');
    await click(`${message} [data-test-unlock-button]`);

    // // MetaMask pops up and user approves the transaction. There is a spinner
    // // on the "Unlock" button until the Ethereum transaction is mined.
    // // When the mining is complete, the "Deposit" button becomes clickable.

    // TODO assert spinner on Unlock button

    layer1Service.test__simulateUnlock();
    await settled();

    // TODO assert no spinner on Unlock button

    assert
      .dom(`${message} [data-test-unlock-button]`)
      .isDisabled('Unlock is disabled once unlocked');
    assert
      .dom(`${message} [data-test-deposit-button]`)
      .isEnabled('Deposit is enabled once unlocked');
    await click(`${message} [data-test-deposit-button]`);

    // TODO assert spinner on Deposit button

    layer1Service.test__simulateDeposit();
    await settled();

    assert
      .dom('[data-test-milestone-completed][data-test-milestone="1"]')
      .containsText('Deposited into Reserve Pool');

    message = '[data-test-milestone="2"][data-test-thread-message="0"]';

    assert.dom(`${message} [data-test-author-name]`).containsText('cardbot');
    assert
      .dom(message)
      .containsText('your token will be bridged to the xDai blockchain');

    message = '[data-test-milestone="2"][data-test-thread-message="1"]';
    // assert.dom(`${message} [data-test-step-1="complete"]`);
    // assert.dom(`${message} [data-test-step-2="in-progress"]`);

    // layer1Service.test__simulateTokensBridged();
    // assert.dom(`${message} [data-test-step-2="complete"]`);
    // assert.dom(`${message} [data-test-step-3="in-progress"]`);
    // layer1Service.test__simulateCPXDMinted();

    // assert
    //   .dom('[data-test-milestone-completed]')
    //   .containsText('Tokens received on xDai');

    // message = '[data-test-after-workflow][data-test-thread-message="0"]';

    // assert.dom(`${message} [data-test-author-name]`).containsText('cardbot');
    // assert.dom(`${message}`).containsText('Thank you for your contribution!');
    // assert
    //   .dom(`${message}`)
    //   .containsText(
    //     "You have deposited 2,500 DAI into the CARD Protocol's Reserve Pool."
    //   );

    // message = '[data-test-after-workflow][data-test-thread-message="1"]';
    // assert.dom(`${message} [data-test-author-name]`).containsText('cardbot');
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
});
