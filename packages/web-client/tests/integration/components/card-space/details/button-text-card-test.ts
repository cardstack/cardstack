import { module, test } from 'qunit';
import { setupRenderingTest } from 'ember-qunit';
import { click, render } from '@ember/test-helpers';
import hbs from 'htmlbars-inline-precompile';
import { WorkflowSession } from '@cardstack/web-client/models/workflow';
import { Response as MirageResponse } from 'ember-cli-mirage';
import { setupMirage } from 'ember-cli-mirage/test-support';
import { MirageTestContext } from 'ember-cli-mirage/test-support';
import { OPTIONS } from '@cardstack/web-client/components/card-space/edit-details/button-text';

interface Context extends MirageTestContext {}

module(
  'Integration | Component | card-space/edit-details/button-text',
  function (hooks) {
    setupRenderingTest(hooks);
    setupMirage(hooks);

    test('it lists the allowed button texts and persists the choice to the workflow session', async function (this: Context, assert) {
      this.server.post('/card-spaces/validate-url', function () {
        return new MirageResponse(200, {}, { errors: [] });
      });

      let workflowSession = new WorkflowSession();
      this.set('workflowSession', workflowSession);

      await render(hbs`
        <CardSpace::EditDetails::ButtonText
          @workflowSession={{this.workflowSession}}
        />
      `);

      OPTIONS.forEach(function (buttonText, index) {
        assert
          .dom(`[data-test-button-text-option]:nth-child(${index + 1})`)
          .hasText(buttonText);
      });

      await click(`[data-test-button-text-option]:nth-child(2)`);

      assert.equal(workflowSession.getValue<string>('buttonText'), OPTIONS[1]);
      assert
        .dom('[data-test-button-text-option]:nth-child(2) input')
        .isChecked();
    });

    test('it restores input from session', async function (this: Context, assert) {
      let workflowSession = new WorkflowSession();
      this.set('workflowSession', workflowSession);
      workflowSession.setValue('buttonText', OPTIONS[1]);

      await render(hbs`
        <CardSpace::EditDetails::ButtonText
          @workflowSession={{this.workflowSession}}
        />
      `);

      assert
        .dom('[data-test-button-text-option]:nth-child(2) input')
        .hasClass('boxel-radio-option__input--checked');
    });
  }
);
