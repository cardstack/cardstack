import { module, test } from 'qunit';
import { setupApplicationTest } from 'ember-qunit';
import { MirageTestContext, setupMirage } from 'ember-cli-mirage/test-support';
import { click, visit, currentURL, waitFor } from '@ember/test-helpers';
import WorkflowPersistence from '@cardstack/web-client/services/workflow-persistence';
import Layer2TestWeb3Strategy from '@cardstack/web-client/utils/web3-strategies/test-layer2';
import { buildState } from '@cardstack/web-client/models/workflow/workflow-session';
import { setupHubAuthenticationToken } from '../helpers/setup';

interface Context extends MirageTestContext {}

function milestoneCompletedSel(milestoneIndex: number): string {
  return `[data-test-milestone-completed][data-test-milestone="${milestoneIndex}"]`;
}

module('Acceptance | create card space persistence', function (hooks) {
  setupApplicationTest(hooks);
  setupMirage(hooks);
  setupHubAuthenticationToken(hooks);

  let workflowPersistenceService: WorkflowPersistence;
  let layer2AccountAddress = '0x182619c6Ea074C053eF3f1e1eF81Ec8De6Eb6E44';

  hooks.beforeEach(async function () {
    let layer2Service = this.owner.lookup('service:layer2-network')
      .strategy as Layer2TestWeb3Strategy;
    layer2Service.test__simulateAccountsChanged([layer2AccountAddress]);

    layer2Service.authenticate();
    layer2Service.test__simulateHubAuthentication('abc123--def456--ghi789');

    workflowPersistenceService = this.owner.lookup(
      'service:workflow-persistence'
    );

    workflowPersistenceService.clear();
  });

  test('Generates a flow uuid query parameter used as a persistence identifier', async function (this: Context, assert) {
    await visit('/card-space');
    await click('[data-test-workflow-button="create-space"]');

    assert.equal(
      // @ts-ignore (complains object is possibly null)
      new URL('http://domain.test/' + currentURL()).searchParams.get('flow-id')
        .length,
      22
    );
  });

  module('Restoring from a previously saved state', function () {
    test('it restores an unfinished workflow', async function (this: Context, assert) {
      let state = buildState({
        meta: {
          completedCardNames: ['LAYER2_CONNECT', 'CARD_SPACE_USERNAME'],
        },
      });

      workflowPersistenceService.persistData('abc123', {
        name: 'CARD_SPACE_CREATION',
        state,
      });

      await visit('/card-space?flow=create-space&flow-id=abc123');

      assert.dom(milestoneCompletedSel(0)).exists(); // L2 connect
      assert.dom(milestoneCompletedSel(1)).exists(); // Username
      assert.dom(milestoneCompletedSel(2)).doesNotExist();
      assert.dom('[data-test-milestone="2"][data-test-postable="2"]').exists();
      assert.dom('[data-test-card-space-details-start-button]').isNotDisabled();
    });

    test('it restores a finished workflow', async function (this: Context, assert) {
      let state = buildState({
        meta: {
          completedCardNames: [
            'LAYER2_CONNECT',
            'CARD_SPACE_USERNAME',
            'CARD_SPACE_DETAILS',
            'CARD_SPACE_CONFIRM',
          ],
        },
      });

      workflowPersistenceService.persistData('abc123', {
        name: 'CARD_SPACE_CREATION',
        state,
      });

      await visit('/card-space?flow=create-space&flow-id=abc123');

      assert.dom(milestoneCompletedSel(0)).exists(); // L2 connect
      assert.dom(milestoneCompletedSel(1)).exists(); // Username
      assert.dom(milestoneCompletedSel(2)).exists(); // Details
      assert.dom(milestoneCompletedSel(3)).exists(); // Confirm
      assert
        .dom('[data-test-epilogue][data-test-postable="1"]')
        .includesText(`Congrats, you have created your Card Space!`);
    });

    test('it restores a cancelled workflow', async function (this: Context, assert) {
      const state = buildState({
        meta: {
          completedCardNames: ['LAYER2_CONNECT', 'CARD_SPACE_USERNAME'],
          isCanceled: true,
          cancelationReason: 'L2_DISCONNECTED',
        },
      });

      workflowPersistenceService.persistData('abc123', {
        name: 'CARD_SPACE_CREATION',
        state,
      });

      await visit('/card-space?flow=create-space&flow-id=abc123');

      assert.dom(milestoneCompletedSel(0)).exists(); // L2 connect
      assert.dom(milestoneCompletedSel(1)).exists(); // Username
      assert.dom(milestoneCompletedSel(2)).doesNotExist();
      assert
        .dom('[data-test-cancelation]')
        .includesText(
          'It looks like your L2 test chain wallet got disconnected. If you still want to create a Card Space, please start again by connecting your wallet.'
        );

      await waitFor(
        '[data-test-workflow-default-cancelation-restart="create-space"]'
      );
      assert
        .dom('[data-test-workflow-default-cancelation-restart="create-space"]')
        .exists();
    });

    test('it cancels a persisted flow when trying to restore while unauthenticated', async function (this: Context, assert) {
      const state = buildState({
        meta: {
          completedCardNames: ['LAYER2_CONNECT', 'CARD_SPACE_USERNAME'],
        },
      });

      workflowPersistenceService.persistData('abc123', {
        name: 'CARD_SPACE_CREATION',
        state,
      });

      window.TEST__AUTH_TOKEN = undefined;

      await visit('/card-space?flow=create-space&flow-id=abc123');

      assert.dom(milestoneCompletedSel(0)).doesNotExist(); // L2 connect
      assert.dom(milestoneCompletedSel(1)).doesNotExist(); // Username
      assert
        .dom('[data-test-cancelation]')
        .includesText(
          'You attempted to restore an unfinished workflow, but you are no longer authenticated. Please restart the workflow.'
        );

      await click('[data-test-workflow-default-cancelation-restart]');

      assert.dom(milestoneCompletedSel(0)).exists(); // L2 connect
      assert.dom(milestoneCompletedSel(1)).doesNotExist(); // Username
      assert.dom(`[data-test-authentication-button]`).exists();

      // TODO
      // const workflowPersistenceId = new URL(
      //   'http://domain.test/' + currentURL()
      // ).searchParams.get('flow-id');

      // assert.notEqual(workflowPersistenceId!, 'abc123'); // flow-id param should be regenerated
      // assert.equal(workflowPersistenceId!.length, 22);
    });

    test('it should reset the persisted card names when editing one of the previous steps', async function (this: Context, assert) {
      const state = buildState({
        meta: {
          completedCardNames: ['LAYER2_CONNECT', 'CARD_SPACE_USERNAME'],
        },
      });

      workflowPersistenceService.persistData('abc123', {
        name: 'CARD_SPACE_CREATION',
        state,
      });

      await visit('/card-space?flow=create-space&flow-id=abc123');
      assert.dom(milestoneCompletedSel(0)).exists(); // L2 connect
      assert.dom(milestoneCompletedSel(1)).exists(); // Username

      await waitFor('[data-test-milestone="1"] [data-test-boxel-button]');
      await click('[data-test-milestone="1"] [data-test-boxel-button]');

      await visit('/card-space?flow=create-space&flow-id=abc123');
      assert.dom(milestoneCompletedSel(0)).exists(); // L2 connect
      assert.dom(milestoneCompletedSel(1)).doesNotExist(); // Username
    });

    // TODO
    // test('it cancels a persisted flow when card wallet address is different', async function (this: Context, assert) {});
    // test('it allows interactivity after restoring previously saved state', async function (this: Context, assert) {});
  });
});
