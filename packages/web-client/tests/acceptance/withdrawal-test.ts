import { module, test } from 'qunit';
import {
  click,
  currentURL,
  fillIn,
  settled,
  visit,
  waitFor,
} from '@ember/test-helpers';
import { setupApplicationTest } from 'ember-qunit';
import Layer1TestWeb3Strategy from '@cardstack/web-client/utils/web3-strategies/test-layer1';
import Layer2TestWeb3Strategy from '@cardstack/web-client/utils/web3-strategies/test-layer2';
import a11yAudit from 'ember-a11y-testing/test-support/audit';
import { toBN } from 'web3-utils';
import { capitalize } from '@ember/string';
import { currentNetworkDisplayInfo as c } from '@cardstack/web-client/utils/web3-strategies/network-display-info';

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
      defaultToken: toBN('2141100000000000000'),
      dai: toBN('150500000000000000000'),
      card: toBN('10000000000000000000000'),
    });
    await waitFor(`${post} [data-test-balance="ETH"]`);
    assert.dom(`${post} [data-test-balance="ETH"]`).containsText('2.1411');
    assert.dom(`${post} [data-test-balance="DAI"]`).containsText('150.50');
    assert.dom(`${post} [data-test-balance="CARD"]`).containsText('10000.00');
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
    layer2Service.test__simulateAccountsChanged([layer2AccountAddress]);
    layer2Service.test__simulateBalances({
      defaultToken: toBN('250000000000000000000'),
      card: toBN('500000000000000000000'),
    });
    let depotAddress = '0xB236ca8DbAB0644ffCD32518eBF4924ba8666666';
    let testDepot = {
      address: depotAddress,
      tokens: [
        {
          balance: '250000000000000000000',
          token: {
            symbol: 'DAI',
          },
        },
        {
          balance: '500000000000000000000',
          token: {
            symbol: 'CARD',
          },
        },
      ],
    };
    layer2Service.test__simulateDepot(testDepot as DepotSafe);
    layer2Service.test__simulateAccountsChanged([layer2AccountAddress]);
    await waitFor(`${postableSel(1, 2)} [data-test-balance-container]`);
    assert
      .dom(`${postableSel(1, 2)} [data-test-balance="DAI.CPXD"]`)
      .containsText('250.00 DAI.CPXD');
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
      .containsText(
        `From which balance in your ${c.layer2.fullName} wallet do you want to withdraw`
      );
    post = postableSel(2, 1);
    // // choose-balance card
    await waitFor(`${post} [data-test-balance-chooser-dropdown="DAI.CPXD"]`);
    assert
      .dom(`${post} [data-test-balance-chooser-dropdown="DAI.CPXD"]`)
      .containsText('250.00 DAI.CPXD');
    assert
      .dom(
        `${post} [data-test-withdrawal-choose-balance] [data-test-depot-address]`
      )
      .hasText(`DEPOT: ${depotAddress}`);
    await click(
      '[data-test-balance-chooser-dropdown] .ember-power-select-trigger'
    );
    assert
      .dom(`${post} li:nth-child(1) [data-test-balance-display-name]`)
      .containsText('DAI.CPXD');
    assert
      .dom(`${post} li:nth-child(2) [data-test-balance-display-name]`)
      .containsText('CARD.CPXD');
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
      .dom(
        `${post} [data-test-account-balance] [data-test-balance-display-amount]`
      )
      .containsText('250.00 DAI.CPXD');

    // // transaction-amount card
    await waitFor(postableSel(2, 2));
    assert
      .dom(postableSel(2, 2))
      .containsText('How much would you like to withdraw from your balance?');
    post = postableSel(2, 3);

    assert
      .dom(
        `${post} [data-test-action-card-title="withdrawal-transaction-amount"]`
      )
      .containsText('Choose a withdrawal amount');

    assert
      .dom(`${post} [data-test-balance-display-amount]`)
      .containsText('250.00 DAI.CPXD');

    assert
      .dom(
        `${post} [data-test-withdrawal-transaction-amount] [data-test-boxel-button]`
      )
      .isDisabled(
        'Set amount button is disabled until amount has been entered'
      );
    await fillIn('[data-test-amount-input]', '250');
    assert
      .dom(
        `${post} [data-test-withdrawal-transaction-amount] [data-test-boxel-button]`
      )
      .isEnabled('Set amount button is enabled once amount has been entered');
    await waitFor(`${post} [data-test-withdrawal-transaction-amount]`);
    await click(
      `${post} [data-test-withdrawal-transaction-amount] [data-test-boxel-button]`
    );
    assert.dom(milestoneCompletedSel(2)).containsText('Withdrawal amount set');
    assert
      .dom(
        `${post} [data-test-withdrawal-transaction-amount] [data-test-boxel-button]`
      )
      .hasText('Edit');

    await waitFor(`${post} [data-test-balance-display-usd-amount]`);

    assert
      .dom(`${post} [data-test-amount-entered]`)
      .containsText('250.00 DAI.CPXD')
      .containsText('$50.00 USD*');

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
      .containsText(
        `This is the remaining balance in your ${c.layer2.fullName} wallet`
      );
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
