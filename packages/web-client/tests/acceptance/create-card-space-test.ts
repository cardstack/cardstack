import { module, test } from 'qunit';
import { setupApplicationTest } from 'ember-qunit';
import { click, settled, visit, waitFor } from '@ember/test-helpers';
import BN from 'bn.js';

import Layer2TestWeb3Strategy from '@cardstack/web-client/utils/web3-strategies/test-layer2';
import { currentNetworkDisplayInfo as c } from '@cardstack/web-client/utils/web3-strategies/network-display-info';

function postableSel(milestoneIndex: number, postableIndex: number): string {
  return `[data-test-milestone="${milestoneIndex}"][data-test-postable="${postableIndex}"]`;
}

function milestoneCompletedSel(milestoneIndex: number): string {
  return `[data-test-milestone-completed][data-test-milestone="${milestoneIndex}"]`;
}

function epiloguePostableSel(postableIndex: number): string {
  return `[data-test-epilogue][data-test-postable="${postableIndex}"]`;
}

module('Acceptance | create card space', function (hooks) {
  setupApplicationTest(hooks);

  test('initiating workflow without wallet connections', async function (assert) {
    await visit('/card-space');
    await click('[data-test-workflow-button="create-space"]');

    // // Milestone 1
    assert.dom(`${postableSel(0, 0)} img`).exists();
    assert.dom(postableSel(0, 0)).containsText(`Hello, welcome to Card Space`);

    // // L2 wallet connection
    assert
      .dom(postableSel(0, 1))
      .containsText(`connect your ${c.layer2.fullName} wallet`);
    assert
      .dom(postableSel(0, 2))
      .containsText(`Once you have installed the app`);

    let layer2Service = this.owner.lookup('service:layer2-network')
      .strategy as Layer2TestWeb3Strategy;
    layer2Service.test__simulateWalletConnectUri();

    await waitFor('[data-test-wallet-connect-qr-code]');

    let layer2AccountAddress = '0x182619c6Ea074C053eF3f1e1eF81Ec8De6Eb6E44';
    layer2Service.test__simulateAccountsChanged([layer2AccountAddress]);
    layer2Service.test__simulateBalances({
      defaultToken: new BN(0),
    });

    await settled();
    assert
      .dom('[data-test-layer-2-wallet-summary] [data-test-address-field]')
      .containsText(layer2AccountAddress);

    await waitFor(milestoneCompletedSel(0));
    assert
      .dom(milestoneCompletedSel(0))
      .containsText(`${c.layer2.fullName} wallet connected`);

    // // Milestone 2
    // // Hub auth
    assert.dom(postableSel(1, 0)).containsText(`you need to authenticate`);

    await click(`[data-test-authentication-button]`);
    layer2Service.test__simulateHubAuthentication('abc123--def456--ghi789');

    // // Username step
    await waitFor(postableSel(1, 3));
    assert.dom(postableSel(1, 2)).containsText(`Please pick a username`);
    assert.dom(postableSel(1, 3)).containsText(`Pick a username`);

    await click('[data-test-card-space-username-save-button]');
    assert.dom('[data-test-card-space-username-is-complete]').exists();

    await waitFor(milestoneCompletedSel(1));
    assert.dom(milestoneCompletedSel(1)).containsText(`Username picked`);

    // // Milestone 3
    // // Details step
    await waitFor(postableSel(2, 2));
    assert
      .dom(postableSel(2, 1))
      .containsText(`Now it’s time to set up your space.`);
    assert
      .dom(postableSel(2, 2))
      .containsText(`Fill out the Card Space details`);

    await click('[data-test-card-space-details-start-button]');
    assert.dom('[data-test-card-space-details-is-complete]').exists();

    await waitFor(milestoneCompletedSel(2));
    assert
      .dom(milestoneCompletedSel(2))
      .containsText(`Card Space details saved`);

    // // Milestone 4
    await waitFor(postableSel(3, 1));
    assert
      .dom(postableSel(3, 0))
      .containsText(`We have sent your URL reservation badge`);
    // // Badge
    assert.dom(postableSel(3, 1)).containsText(`URL reservation`);

    // // Confirm step
    await waitFor(postableSel(3, 3));
    assert
      .dom(postableSel(3, 2))
      .containsText(`You need to pay a small protocol fee`);
    assert.dom(postableSel(3, 3)).containsText(`Select a payment method`);

    await click('[data-test-card-space-creation-button]');
    assert.dom('[data-test-card-space-creation-is-complete]').exists();

    await waitFor(milestoneCompletedSel(3));
    assert.dom(postableSel(3, 4)).containsText(`Thank you for your payment`);
    assert.dom(milestoneCompletedSel(3)).containsText(`Card Space created`);

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

    // // Epilogue
    await waitFor(epiloguePostableSel(0));
    assert
      .dom(epiloguePostableSel(0))
      .containsText(`This is the remaining balance on your prepaid card`);

    await waitFor(epiloguePostableSel(1));
    assert
      .dom(epiloguePostableSel(1))
      .containsText(`Congrats, you have created your Card Space!`);

    await waitFor(epiloguePostableSel(2));
    // TODO
    // await click('[data-test-card-space-next-step="visit-space"]');
  });
});
