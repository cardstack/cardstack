import { module, test } from 'qunit';
import { setupApplicationTest } from 'ember-qunit';
import {
  click,
  currentURL,
  fillIn,
  settled,
  visit,
  waitFor,
} from '@ember/test-helpers';
import percySnapshot from '@percy/ember';
import Layer2TestWeb3Strategy from '@cardstack/ssr-web/utils/web3-strategies/test-layer2';
import { currentNetworkDisplayInfo as c } from '@cardstack/ssr-web/utils/web3-strategies/network-display-info';
import { setupHubAuthenticationToken } from '../helpers/setup';
import WorkflowPersistence from '@cardstack/ssr-web/services/workflow-persistence';
import {
  createDepotSafe,
  createMerchantSafe,
  createSafeToken,
  getFilenameFromDid,
} from '@cardstack/ssr-web/utils/test-factories';
import { MirageTestContext, setupMirage } from 'ember-cli-mirage/test-support';

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
  setupMirage(hooks);

  let layer2Service: Layer2TestWeb3Strategy;
  let layer2AccountAddress = '0x182619c6Ea074C053eF3f1e1eF81Ec8De6Eb6E44';
  let testDID = 'did:cardstack:1moVYMRNGv6E5Ca3t7aXVD2Yb11e4e91103f084a';

  module('tests without layer 2 connection', function (hooks) {
    hooks.beforeEach(async function (this: MirageTestContext) {
      this.server.create('merchant-info', {
        did: testDID,
        id: await getFilenameFromDid(testDID),
        slug: 'vandelay',
      });
    });
    test('initiating the workflow', async function (assert) {
      await visit('/card-space');
      await click('[data-test-workflow-button="create-space"]');

      assert
        .dom('[data-test-boxel-thread-header]')
        .containsText('Card Space Creation');

      assert
        .dom(
          '[data-test-sidebar-preview-body] [data-test-profile-card-placeholder-cover-photo]'
        )
        .exists();
      assert
        .dom(
          '[data-test-sidebar-preview-body] [data-test-profile-card-placeholder-profile-photo]'
        )
        .exists();

      // test that the preview shows a blank state
      assert
        .dom('[data-test-sidebar-preview-body] [data-test-profile-card-name]')
        .containsText('Name');
      assert
        .dom('[data-test-sidebar-preview-body] [data-test-profile-card-host]')
        .containsText('blank.card.space.test');
      assert
        .dom(
          '[data-test-sidebar-preview-body] [data-test-profile-card-category]'
        )
        .containsText('Category');
      assert
        .dom(
          '[data-test-sidebar-preview-body] [data-test-profile-card-description]'
        )
        .containsText('Description');
      assert
        .dom(
          '[data-test-sidebar-preview-body] [data-test-profile-card-button-text]'
        )
        .containsText('Button Text');

      // Milestone 1
      assert.dom(`${postableSel(0, 0)} img`).exists();
      assert
        .dom(postableSel(0, 0))
        .containsText(`Hello, welcome to Card Space`);

      // L2 wallet connection
      assert
        .dom(postableSel(0, 1))
        .containsText(`connect your ${c.layer2.fullName} wallet`);
      assert
        .dom(postableSel(0, 2))
        .containsText(`Once you have installed the app`);

      layer2Service = this.owner.lookup('service:layer2-network')
        .strategy as Layer2TestWeb3Strategy;

      let merchantAddress = '0xmerchantbAB0644ffCD32518eBF4924ba8666666';

      layer2Service.test__simulateRemoteAccountSafes(layer2AccountAddress, [
        createMerchantSafe({
          address: merchantAddress,
          merchant: '0xprepaidDbAB0644ffCD32518eBF4924ba8666666',
          accumulatedSpendValue: 100,
          tokens: [
            createSafeToken('DAI.CPXD', '125000000000000000000'),
            createSafeToken('CARD.CPXD', '450000000000000000000'),
          ],
          infoDID: testDID,
        }),
      ]);

      layer2Service.test__simulateWalletConnectUri();

      await waitFor('[data-test-wallet-connect-qr-code]');

      layer2Service.test__simulateRemoteAccountSafes(layer2AccountAddress, [
        createDepotSafe({
          owners: [layer2AccountAddress],
          tokens: [createSafeToken('DAI.CPXD', '0')],
        }),
      ]);

      await layer2Service.test__simulateAccountsChanged([layer2AccountAddress]);

      await settled();
      assert
        .dom('[data-test-layer-2-wallet-summary] [data-test-address-field]')
        .containsText(layer2AccountAddress);

      await waitFor(milestoneCompletedSel(0));
      assert
        .dom(milestoneCompletedSel(0))
        .containsText(`${c.layer2.fullName} wallet connected`);

      // Hub auth
      assert.dom(postableSel(1, 0)).containsText(`you need to authenticate`);

      await click(`[data-test-authentication-button]`);
      layer2Service.test__simulateHubAuthentication('abc123--def456--ghi789');

      // Select a business account
      await waitFor(postableSel(1, 3)); // First merchant will be automatically selected
      await click('[data-test-card-space-select-business-account-save-button]');
      assert
        .dom('[data-test-card-space-select-business-account-is-complete]')
        .exists();
      assert
        .dom('[data-test-profile-card-host]')
        .hasText('vandelay.card.space.test');

      // Display name
      await waitFor(postableSel(2, 1));
      assert.dom(postableSel(2, 1)).containsText(`Pick a display name`);

      await fillIn(
        '[data-test-card-space-display-name-input] input',
        'Hello there'
      );

      await waitFor(
        '[data-test-card-space-display-name-save-button]:not(:disabled)'
      );

      await click('[data-test-card-space-display-name-save-button]');
      assert.dom('[data-test-card-space-display-name-is-complete]').exists();

      await waitFor(milestoneCompletedSel(2));
      assert.dom(milestoneCompletedSel(2)).containsText(`Display name picked`);

      // Details

      await waitFor(postableSel(3, 2));
      assert
        .dom(postableSel(3, 1))
        .containsText(`Now it’s time to set up your space.`);
      assert
        .dom(postableSel(3, 2))
        .containsText(`Fill out the Card Space details`);

      // fill in required details
      await fillIn(
        '[data-test-card-space-description-field]',
        'Description here'
      );
      await click(
        '[data-test-card-space-category-field] [data-test-category-option="Music"]'
      );
      await click('[data-test-button-text-option="Visit this Creator"]');

      await click('[data-test-card-space-details-save-button]');

      assert.dom('[data-test-card-space-details-is-complete]').exists();

      await waitFor(milestoneCompletedSel(3));
      assert
        .dom(milestoneCompletedSel(3))
        .containsText(`Card Space details saved`);

      // Confirm
      await waitFor(postableSel(4, 0));

      await click('[data-test-card-space-creation-button]');
      assert.dom('[data-test-card-space-creation-is-complete]').exists();

      await waitFor(milestoneCompletedSel(4));
      assert.dom(milestoneCompletedSel(4)).containsText(`Card Space created`);

      assert
        .dom(
          '[data-test-milestone] [data-test-boxel-action-chin] button[data-test-boxel-button]:not([disabled])'
        )
        .doesNotExist();

      // Epilogue
      await waitFor(epiloguePostableSel(0));

      assert
        .dom(epiloguePostableSel(0))
        .containsText(`Congrats, you have created your Card Space!`);

      // test that the preview is filled in
      assert
        .dom('[data-test-sidebar-preview-body] [data-test-profile-card-name]')
        .containsText('Hello there');
      assert
        .dom(
          '[data-test-sidebar-preview-body] [data-test-profile-card-category]'
        )
        .containsText('Music');
      assert
        .dom(
          '[data-test-sidebar-preview-body] [data-test-profile-card-description]'
        )
        .containsText('Description here');
      assert
        .dom(
          '[data-test-sidebar-preview-body] [data-test-profile-card-button-text]'
        )
        .containsText('Visit this Creator');

      await percySnapshot(assert);

      // TODO: fix this assertion after we have fixed the subdomain/business ID
      // things
      // let spaceHostname = `displayNametodo.${config.cardSpaceHostnameSuffix}`;
      // assert
      //   .dom('[data-test-card-space-next-step="visit-space"]')
      //   .hasAttribute('href', new RegExp(spaceHostname.replace(/\./g, '\\.')));
    });

    module('tests with layer 2 already connected', function (hooks) {
      setupHubAuthenticationToken(hooks);

      hooks.beforeEach(async function () {
        layer2Service = this.owner.lookup('service:layer2-network')
          .strategy as Layer2TestWeb3Strategy;
        layer2Service.test__simulateRemoteAccountSafes(layer2AccountAddress, [
          createDepotSafe({
            owners: [layer2AccountAddress],
            tokens: [createSafeToken('DAI.CPXD', '0')],
          }),
        ]);
        layer2Service.test__simulateRemoteAccountSafes(layer2AccountAddress, [
          createMerchantSafe({
            address: '0xmerchantbAB0644ffCD32518eBF4924ba8666666',
            merchant: '0xprepaidDbAB0644ffCD32518eBF4924ba8666666',
            accumulatedSpendValue: 100,
            tokens: [
              createSafeToken('DAI.CPXD', '125000000000000000000'),
              createSafeToken('CARD.CPXD', '450000000000000000000'),
            ],
            infoDID: 'MerchantSafeDID',
          }),
        ]);
        await layer2Service.test__simulateAccountsChanged([
          layer2AccountAddress,
        ]);
      });

      test('initiating workflow with L2 wallet already connected', async function (assert) {
        await visit('/card-space?flow=create-space');

        const flowId = new URL(
          'http://domain.test/' + currentURL()
        ).searchParams.get('flow-id');
        assert.equal(
          currentURL(),
          `/card-space?flow=create-space&flow-id=${flowId}`
        );

        assert
          .dom(postableSel(0, 1))
          .containsText(
            `Looks like you’ve already connected your ${c.layer2.fullName} wallet`
          );
        assert
          .dom(
            '[data-test-layer-2-wallet-card] [data-test-layer-2-wallet-connected-status]'
          )
          .containsText('Connected');
        assert
          .dom(
            '[data-test-layer-2-wallet-card] [data-test-wallet-connect-qr-code]'
          )
          .doesNotExist();

        assert
          .dom(milestoneCompletedSel(0))
          .containsText(`${c.layer2.fullName} wallet connected`);

        await waitFor(postableSel(1, 2));
        assert
          .dom(postableSel(1, 2))
          .containsText(`Please select a business account`);

        let workflowPersistenceService = this.owner.lookup(
          'service:workflow-persistence'
        ) as WorkflowPersistence;

        let workflowPersistenceId = new URL(
          'http://domain.test/' + currentURL()
        ).searchParams.get('flow-id')!;

        let persistedData = workflowPersistenceService.getPersistedData(
          workflowPersistenceId
        );

        assert.ok(
          persistedData.state.layer2WalletAddress.includes(
            layer2AccountAddress
          ),
          'expected the layer 2 address to have been persisted when the wallet was already connected'
        );
      });

      test('disconnecting L2 should cancel the workflow', async function (assert) {
        await visit('/card-space');
        await click('[data-test-workflow-button="create-space"]');

        assert
          .dom('[data-test-layer-2-wallet-card] [data-test-address-field]')
          .containsText(layer2AccountAddress)
          .isVisible();
        assert
          .dom(milestoneCompletedSel(0))
          .containsText(`${c.layer2.fullName} wallet connected`);

        layer2Service.test__simulateDisconnectFromWallet();
        await settled();

        assert
          .dom('[data-test-postable="0"][data-test-cancelation]')
          .containsText(
            `It looks like your ${c.layer2.fullName} wallet got disconnected. If you still want to create a Card Space, please start again by connecting your wallet.`
          );
        assert
          .dom('[data-test-workflow-default-cancelation-cta="create-space"]')
          .containsText('Workflow canceled');
        assert.dom('[data-test-sidebar-preview-body]').doesNotExist();

        // restart workflow
        await click(
          '[data-test-workflow-default-cancelation-restart="create-space"]'
        );

        assert.dom('[data-test-sidebar-preview-body]').exists();
        layer2Service.test__simulateWalletConnectUri();
        await waitFor('[data-test-wallet-connect-qr-code]');

        assert
          .dom(
            '[data-test-layer-2-wallet-card] [data-test-wallet-connect-qr-code]'
          )
          .exists();
        assert
          .dom('[data-test-workflow-default-cancelation-cta="create-space"]')
          .doesNotExist();
      });

      test('changing L2 account should cancel the workflow', async function (assert) {
        let differentL2Address = '0x5416C61193C3393B46C2774ac4717C252031c0bE';

        await visit('/card-space');
        await click('[data-test-workflow-button="create-space"]');

        assert
          .dom('[data-test-layer-2-wallet-card] [data-test-address-field]')
          .containsText(layer2AccountAddress)
          .isVisible();

        assert
          .dom(milestoneCompletedSel(0))
          .containsText(`${c.layer2.fullName} wallet connected`);

        await layer2Service.test__simulateAccountsChanged([differentL2Address]);
        await settled();

        assert
          .dom('[data-test-postable="0"][data-test-cancelation]')
          .containsText(
            'It looks like you changed accounts in the middle of this workflow. If you still want to create a Card Space, please restart the workflow.'
          );
        assert
          .dom('[data-test-workflow-default-cancelation-cta="create-space"]')
          .containsText('Workflow canceled');
        assert.dom('[data-test-sidebar-preview-body]').doesNotExist();

        // restart workflow
        await click(
          '[data-test-workflow-default-cancelation-restart="create-space"]'
        );

        assert
          .dom(postableSel(0, 1))
          .containsText(
            `Looks like you’ve already connected your ${c.layer2.fullName} wallet`
          );
        assert
          .dom('[data-test-layer-2-wallet-card] [data-test-address-field]')
          .containsText(differentL2Address)
          .isVisible();
        assert
          .dom('[data-test-workflow-default-cancelation-cta="create-space"]')
          .doesNotExist();
      });

      module('tests without any available business accounts', function (hooks) {
        hooks.beforeEach(async function (this: MirageTestContext) {
          // @ts-ignore
          this.server.db.merchantInfos.remove(this.server.db.merchantInfos[0]);
        });

        test('cancels the workflow when all business acounts have already been used for card space', async function (assert) {
          layer2Service = this.owner.lookup('service:layer2-network')
            .strategy as Layer2TestWeb3Strategy;

          await visit('/card-space');
          await click('[data-test-workflow-button="create-space"]');

          await waitFor('[data-test-cancelation]');
          assert
            .dom('[data-test-cancelation]')
            .containsText(
              'It looks like you all your business accounts have already been used to create a Card Space'
            );
          await waitFor(
            '[data-test-create-card-space-workflow-create-business-account-cta]'
          );
          await click(
            '[data-test-create-card-space-workflow-create-business-account-cta] button'
          );

          assert
            .dom('[data-test-boxel-thread-header]')
            .containsText('Business Account Creation');
        });
      });
    });

    module('tests with no merchant safes', function (hooks) {
      setupHubAuthenticationToken(hooks);

      test('cancels the workflow when there are no merchant safes (business accounts)', async function (assert) {
        layer2Service = this.owner.lookup('service:layer2-network')
          .strategy as Layer2TestWeb3Strategy;
        layer2Service.test__simulateRemoteAccountSafes(layer2AccountAddress, [
          createDepotSafe({
            owners: [layer2AccountAddress],
            tokens: [createSafeToken('DAI.CPXD', '0')],
          }),
        ]);
        await layer2Service.test__simulateAccountsChanged([
          layer2AccountAddress,
        ]);

        await visit('/card-space');
        await click('[data-test-workflow-button="create-space"]');

        assert
          .dom('[data-test-cancelation]')
          .containsText(
            'It looks like you haven’t created a business account yet'
          );

        await click(
          '[data-test-create-card-space-workflow-create-business-account-cta] button'
        );

        assert
          .dom('[data-test-boxel-thread-header]')
          .containsText('Business Account Creation');
      });
    });
  });
});
