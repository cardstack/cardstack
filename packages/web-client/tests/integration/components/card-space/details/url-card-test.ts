import { module, test } from 'qunit';
import { setupRenderingTest } from 'ember-qunit';
import { fillIn, render, waitFor } from '@ember/test-helpers';
import hbs from 'htmlbars-inline-precompile';
import { WorkflowSession } from '@cardstack/web-client/models/workflow';
import { Response as MirageResponse } from 'ember-cli-mirage';
import { setupMirage } from 'ember-cli-mirage/test-support';
import { MirageTestContext } from 'ember-cli-mirage/test-support';

interface Context extends MirageTestContext {}

module(
  'Integration | Component | card-space/edit-details/url',
  function (hooks) {
    setupRenderingTest(hooks);
    setupMirage(hooks);

    test('it validates good input', async function (this: Context, assert) {
      this.server.post('/card-spaces/validate-url', function () {
        return new MirageResponse(200, {}, { errors: [] });
      });

      this.set('workflowSession', new WorkflowSession());

      await render(hbs`
      <CardSpace::EditDetails::Url
        @workflowSession={{this.workflowSession}}
      />
    `);

      await fillIn('[data-test-card-space-url-field] input', 'satoshi');

      await waitFor('[data-test-boxel-validation-state-input="initial"]');

      assert
        .dom('[data-test-boxel-validation-state-input]')
        .hasAttribute('data-test-boxel-validation-state-input', 'valid');
    });

    test('it validates bad input', async function (this: Context, assert) {
      this.server.post('/card-spaces/validate-url', function () {
        return new MirageResponse(
          200,
          {},
          { errors: [{ detail: 'Already exists' }] }
        );
      });

      this.set('workflowSession', new WorkflowSession());

      await render(hbs`
        <CardSpace::EditDetails::Url
          @workflowSession={{this.workflowSession}}
        />
      `);

      await fillIn('[data-test-card-space-url-field] input', 'satoshi');

      await waitFor('[data-test-boxel-validation-state-input="initial"]');

      assert
        .dom('[data-test-boxel-validation-state-input]')
        .hasAttribute('data-test-boxel-validation-state-input', 'invalid');

      assert
        .dom(
          `[data-test-card-space-url-field] [data-test-boxel-input-error-message]`
        )
        .containsText('Already exists');
    });

    test('it restores input from session', async function (this: Context, assert) {
      let workflowSession = new WorkflowSession();
      this.set('workflowSession', workflowSession);
      workflowSession.setValue('url', 'satoshi');
      await render(hbs`
        <CardSpace::EditDetails::Url
          @workflowSession={{this.workflowSession}}
        />
      `);
      assert.dom('[data-test-card-space-url-field] input').hasValue('satoshi');
    });
  }
);
