import { module, test } from 'qunit';
import { setupRenderingTest } from 'ember-qunit';
import { click, render, settled } from '@ember/test-helpers';
import hbs from 'htmlbars-inline-precompile';
import Layer2TestWeb3Strategy from '@cardstack/web-client/utils/web3-strategies/test-layer2';
import Layer1TestWeb3Strategy from '@cardstack/web-client/utils/web3-strategies/test-layer1';
import BN from 'bn.js';
import sinon from 'sinon';

import { WorkflowSession } from '@cardstack/web-client/models/workflow';
import {
  createDepotSafe,
  createSafeToken,
} from '@cardstack/web-client/utils/test-factories';
import { defer } from 'rsvp';
import { BridgeValidationResult } from '@cardstack/cardpay-sdk';
import { TransactionReceipt } from 'web3-core';
import { ClaimBridgedTokensOptions } from '@cardstack/web-client/utils/web3-strategies/types';

module(
  'Integration | Component | card-pay/withdrawal-workflow/token-claim',
  function (hooks) {
    setupRenderingTest(hooks);

    test('It clears the token if claim transaction is reverted', async function (assert) {
      let session = new WorkflowSession();
      this.set('session', session);

      let layer1AccountAddress = '0xaCD5f5534B756b856ae3B2CAcF54B3321dd6654Fb6';
      let layer1Service = this.owner.lookup('service:layer1-network')
        .strategy as Layer1TestWeb3Strategy;
      layer1Service.test__simulateAccountsChanged(
        [layer1AccountAddress],
        'metamask'
      );
      layer1Service.test__simulateBalances({
        dai: new BN('150500000000000000000'),
      });

      let layer2Service = this.owner.lookup('service:layer2-network')
        .strategy as Layer2TestWeb3Strategy;
      let layer2AccountAddress = '0x182619c6Ea074C053eF3f1e1eF81Ec8De6Eb6E44';
      let depotAddress = '0xB236ca8DbAB0644ffCD32518eBF4924ba8666666';
      let testDepot = createDepotSafe({
        address: depotAddress,
        tokens: [createSafeToken('DAI.CPXD', '250000000000000000000')],
      });
      await layer2Service.test__simulateRemoteAccountSafes(
        layer2AccountAddress,
        [testDepot]
      );
      await layer2Service.test__simulateAccountsChanged([layer2AccountAddress]);
      session.setValue('bridgeValidationResult', {} as BridgeValidationResult);
      session.setValue('withdrawalSafe', depotAddress);
      session.setValue('withdrawalToken', 'DAI.CPXD');
      session.setValue('withdrawnAmount', new BN('123456000000000000000'));

      await render(hbs`
        <CardPay::WithdrawalWorkflow::TokenClaim
          @workflowSession={{this.session}}
          @onComplete={{this.onComplete}}
          @onIncomplete={{this.onIncomplete}}
          @isComplete={{this.isComplete}}
        />
      `);

      let receipt = defer<TransactionReceipt>();
      sinon
        .stub(layer1Service, 'claimBridgedTokens')
        .callsFake(function (
          _bridgeValidationResult: BridgeValidationResult,
          { onTxnHash }: ClaimBridgedTokensOptions
        ) {
          onTxnHash?.('test hash');
          return receipt.promise;
        });

      await click('[data-test-claim-button]');

      assert.equal(session.getValue('claimTokensTxnHash'), 'test hash');

      receipt.reject(new Error('Test reverted transaction'));
      await settled();

      assert.notOk(session.getValue('claimTokensTxnHash'));
    });
  }
);
