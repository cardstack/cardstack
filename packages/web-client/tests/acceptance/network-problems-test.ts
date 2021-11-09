import { module, test } from 'qunit';
import { settled, visit } from '@ember/test-helpers';
import { setupApplicationTest } from 'ember-qunit';
import Layer2TestWeb3Strategy from '@cardstack/web-client/utils/web3-strategies/test-layer2';
import Layer1TestWeb3Strategy from '@cardstack/web-client/utils/web3-strategies/test-layer1';

import { createDepotSafe } from '@cardstack/web-client/utils/test-factories';

const MODAL = '[data-test-network-problem-modal]';
const MODAL_TITLE = '[data-test-network-problem-modal-title]';
const MODAL_BODY = '[data-test-network-problem-modal-body]';
const MODAL_ACTION = '[data-test-network-problem-modal-action]';

const MODAL_IS_DISMISSABLE_ATTRIBUTE =
  'data-test-network-problem-modal-dismissable';

module('Acceptance | network-problems', function (hooks) {
  setupApplicationTest(hooks);
  let layer2AccountAddress = '0x182619c6Ea074C053eF3f1e1eF81Ec8De6Eb6E44';
  let layer2Service: Layer2TestWeb3Strategy;
  let layer1Service: Layer1TestWeb3Strategy;

  hooks.beforeEach(async function () {
    layer2Service = this.owner.lookup('service:layer2-network')
      .strategy as Layer2TestWeb3Strategy;
    layer2Service.test__simulateRemoteAccountSafes(layer2AccountAddress, [
      createDepotSafe({}),
    ]);
    await layer2Service.test__simulateAccountsChanged([layer2AccountAddress]);

    let layer1AccountAddress = '0xaCD5f5534B756b856ae3B2CAcF54B3321dd6654Fb6';
    layer1Service = this.owner.lookup('service:layer1-network')
      .strategy as Layer1TestWeb3Strategy;
    layer1Service.test__simulateAccountsChanged(
      [layer1AccountAddress],
      'metamask'
    );

    await visit('/card-pay/balances');
  });

  test('Layer 2 incorrect chain event triggers the showing of a modal', async function (assert) {
    layer2Service.simpleEmitter.emit('incorrect-chain');

    await settled();

    assert.dom(MODAL_TITLE).containsText('Please connect to L2 test chain');
    assert
      .dom(MODAL_BODY)
      .containsText(
        'Card Pay uses L2 test chain as its Layer 2 network. To ensure the safety of your assets and transactions, we’ve disconnected your wallet. You can restart any incomplete workflows after reconnecting with L2 test chain.'
      );
    assert.dom(MODAL_ACTION).containsText('Dismiss');
    assert.dom(MODAL).hasAttribute(MODAL_IS_DISMISSABLE_ATTRIBUTE);
  });

  test('Layer 1 incorrect chain event triggers the showing of a non-dismissable modal', async function (assert) {
    layer1Service.simpleEmitter.emit('incorrect-chain');

    await settled();

    assert.dom(MODAL_TITLE).containsText('Please connect to L1 test chain');
    assert
      .dom(MODAL_BODY)
      .containsText(
        'Card Pay uses L1 test chain as its Layer 1 network. To ensure the safety of your assets and transactions, this page will reload as soon as you change your wallet’s network to L1 test chain or disconnect your wallet.'
      );
    assert.dom(MODAL_ACTION).containsText('Disconnect and Reload');
    assert.dom(MODAL).doesNotHaveAttribute(MODAL_IS_DISMISSABLE_ATTRIBUTE);
  });

  test('Layer 2 websocket disconnected event triggers the showing of a modal', async function (assert) {
    layer2Service.simpleEmitter.emit('websocket-disconnected');

    await settled();

    assert.dom(MODAL_TITLE).containsText('Disconnected from L2 test chain');
    assert
      .dom(MODAL_BODY)
      .containsText(
        'Sorry! Card Pay is disconnected from L2 test chain. You can restore the connection by refreshing the page.'
      );
    assert.dom(MODAL_ACTION).containsText('Contact Cardstack Support');
    assert.dom(MODAL).hasAttribute(MODAL_IS_DISMISSABLE_ATTRIBUTE);
  });

  test('Layer 1 websocket disconnected event triggers the showing of a modal', async function (assert) {
    layer1Service.simpleEmitter.emit('websocket-disconnected');

    await settled();

    assert.dom(MODAL_TITLE).containsText('Disconnected from L1 test chain');
    assert
      .dom(MODAL_BODY)
      .containsText(
        'Sorry! Card Pay is disconnected from L1 test chain. You can restore the connection by refreshing the page.'
      );
    assert.dom(MODAL_ACTION).containsText('Contact Cardstack Support');
    assert.dom(MODAL).hasAttribute(MODAL_IS_DISMISSABLE_ATTRIBUTE);
  });
});
