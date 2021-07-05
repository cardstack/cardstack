import { module, test } from 'qunit';
import {
  click,
  currentURL,
  settled,
  visit,
  waitFor,
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

module('Acceptance | withdrawal', function (hooks) {
  setupApplicationTest(hooks);

  test('Initiating workflow without wallet connections', async function (assert) {
    await visit('/card-pay/token-suppliers');
    assert.equal(currentURL(), '/card-pay/token-suppliers');
    await click('[data-test-withdrawal-workflow-button]');
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
    assert.dom(post).containsText('Connect your L1 test chain wallet');
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
    assert.dom(`${post} [data-test-balance="DAI"]`).containsText('250.50');
    assert.dom(`${post} [data-test-balance="CARD"]`).containsText('10000.00');
    await settled();
    assert
      .dom(milestoneCompletedSel(0))
      .containsText('Mainnet wallet connected');
    assert
      .dom(postableSel(1, 0))
      .containsText(
        'Now it’s time to connect your xDai chain wallet via your Card Wallet mobile app'
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
    await waitFor(`${postableSel(1, 2)} [data-test-balance-container]`);
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
      .containsText('xDai chain wallet connected');
    assert
      .dom(postableSel(2, 0))
      .containsText(
        'From which balance in your xDai chain wallet do you want to withdraw'
      );
    post = postableSel(2, 1);
    // // choose-balance card
    // await waitFor(`${post} [data-test-balance="DAI CPXD"]`);
    // assert.dom(`${post} [data-test-balance="DAI CPXD"]`).containsText('250.50');
    // assert.dom(`${post} [data-test-usd-balance="DAI CPXD"]`).containsText('50.10');
    // assert.dom(`${post} [data-test-balance="CARD CPXD"]`).containsText('10000.00');
    // assert
    //   .dom(`${post} [data-test-usd-balance="CARD CPXD"]`)
    //   .containsText('2000.00');
    // assert
    //   .dom(
    //     `${post} [data-test-withdrawal-choose-balance-from-depot] [data-test-account-address]`
    //   )
    //   .hasText(layer2AccountAddress); // TODO: should be depot address
    // assert
    //   .dom(
    //     `${post} [data-test-withdrawal-choose-balance-balance] [data-test-token-option]`
    //   )
    //   .hasText('DAI CPXD');
    // assert
    //   .dom('[data-test-withdrawal-choose-balance-is-complete]')
    //   .doesNotExist();
    // assert
    //   .dom(`${post} [data-test-withdrawal-choose-balance-balance-option]`)
    //   .exists({ count: 2 });
    // await click(`${post} [data-test-option="CARD CPXD"]`);
    await waitFor(`${post} [data-test-withdrawal-choose-balance]`);
    await click(
      `${post} [data-test-withdrawal-choose-balance] [data-test-boxel-button]`
    );
    // // choose-balance card (memorialized)
    // assert.dom(`${post} [data-test-option]`).doesNotExist();
    // assert
    //   .dom(`${post} [data-test-withdrawal-choose-balance-balance-option]`)
    //   .doesNotExist();
    // assert
    //   .dom('[data-test-withdrawal-choose-balance] [data-test-boxel-button]')
    //   .isNotDisabled();
    // assert.dom('[data-test-withdrawal-choose-balance-is-complete]').exists();
    // assert
    //   .dom(
    //     `${post} [data-test-withdrawal-choose-balance-from-balance="DAI CPXD"] [data-test-balance-display-amount]`
    //   )
    //   .containsText('250.50');

    // // transaction-amount card
    await waitFor(postableSel(2, 2));
    assert
      .dom(postableSel(2, 2))
      .containsText('How much would you like to withdraw from your balance?');
    post = postableSel(2, 3);
    // assert.dom(`${post} [data-test-source-token="DAI.CPXD"]`).exists();
    // assert
    //   .dom(`${post} [data-test-withdrawal-transaction-amount] [data-test-boxel-button]`)
    //   .isDisabled('Set amount button is disabled until amount has been entered');
    // await fillIn('[data-test-withdrawal-amount-input]', '250');
    // assert
    //   .dom(`${post} [data-test-withdrawal-transaction-amount] [data-test-boxel-button]`)
    //   .isEnabled('Set amount button is enabled once amount has been entered');
    await waitFor(`${post} [data-test-withdrawal-transaction-amount]`);
    await click(
      `${post} [data-test-withdrawal-transaction-amount] [data-test-boxel-button]`
    );
    assert.dom(milestoneCompletedSel(2)).containsText('Withdrawal amount set');

    assert
      .dom(postableSel(3, 0))
      .containsText('we just need your confirmation to make the withdrawal');
    post = postableSel(3, 1);
    // // transaction-approval card
    await waitFor(`${post} [data-test-withdrawal-transaction-approval]`);
    await click(
      `${post} [data-test-withdrawal-transaction-approval] [data-test-boxel-button]`
    );
    // TODO: simulate approval and bridge success
    assert.dom(milestoneCompletedSel(3)).containsText('Transaction confirmed');
    assert
      .dom(epiloguePostableSel(0))
      .containsText('You have successfully withdrawn tokens');
    assert.dom(epiloguePostableSel(1)).containsText('You withdrew');
    assert.dom(epiloguePostableSel(1)).containsText('You received');
    await waitFor(epiloguePostableSel(2));
    assert
      .dom(epiloguePostableSel(2))
      .containsText('This is the remaining balance in your xDai chain wallet');
    layer2Service.test__simulateBalances({
      defaultToken: toBN('2141100000000000000'), // TODO: choose numbers that make sense with the scenario
      card: toBN('10000000000000000000000'), // TODO: choose numbers that make sense with the scenario
    });
    await waitFor(`${epiloguePostableSel(3)} [data-test-balance="DAI.CPXD"]`);
    assert
      .dom(`${epiloguePostableSel(3)} [data-test-balance="DAI.CPXD"]`)
      .containsText('2.1411');
    assert
      .dom(`${epiloguePostableSel(3)} [data-test-balance="CARD.CPXD"]`)
      .containsText('10000.00');
    // let milestoneCtaButtonCount = Array.from(
    //   document.querySelectorAll(
    //     '[data-test-milestone] [data-test-boxel-action-chin] button[data-test-boxel-button]'
    //   )
    // ).length;
    // assert
    //   .dom(
    //     '[data-test-milestone] [data-test-boxel-action-chin] button[data-test-boxel-button]:disabled'
    //   )
    //   .exists(
    //     { count: milestoneCtaButtonCount },
    //     'All cta buttons in milestones should be disabled'
    //   );
    assert
      .dom(
        `${epiloguePostableSel(4)} [data-test-withdrawal-next-step="dashboard"]`
      )
      .exists();
    await click(
      `${epiloguePostableSel(4)} [data-test-withdrawal-next-step="dashboard"]`
    );
    assert.dom('[data-test-workflow-thread]').doesNotExist();
  });

  // Initiating workflow with layer 1 wallet already connected
  // Initiating workflow with layer 2 wallet already connected
  // Disconnecting Layer 1 from within the workflow
  // Disconnecting Layer 1 from outside the current tab (mobile wallet / other tabs)
  // Disconnecting Layer 2 from within the workflow
  // Disconnecting Layer 2 from outside the current tab (mobile wallet / other tabs
});
