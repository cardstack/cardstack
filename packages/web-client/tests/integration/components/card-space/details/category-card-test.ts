import { module, test } from 'qunit';
import { setupRenderingTest } from 'ember-qunit';
import {
  click,
  fillIn,
  find,
  render,
  settled,
  waitUntil,
} from '@ember/test-helpers';
import hbs from 'htmlbars-inline-precompile';
import { WorkflowSession } from '@cardstack/web-client/models/workflow';
import { Response as MirageResponse } from 'ember-cli-mirage';
import { setupMirage } from 'ember-cli-mirage/test-support';
import { MirageTestContext } from 'ember-cli-mirage/test-support';
import { OPTIONS } from '@cardstack/web-client/components/card-space/edit-details/category';

interface Context extends MirageTestContext {}

module(
  'Integration | Component | card-space/edit-details/category',
  function (hooks) {
    setupRenderingTest(hooks);
    setupMirage(hooks);

    hooks.beforeEach(async function (this: Context) {
      this.server.post('/card-spaces/validate-profile-category', function () {
        return new MirageResponse(200, {}, { errors: [] });
      });
    });

    test('it lists the allowed categories and persists the choice to the workflow session', async function (assert) {
      let workflowSession = new WorkflowSession();
      this.set('workflowSession', workflowSession);

      await render(hbs`
        <CardSpace::EditDetails::Category
          @workflowSession={{this.workflowSession}}
        />
      `);

      if (window.location.href.includes('devmode')) {
        await this.pauseTest();
      }

      assert.dom('radio-option__input--checked').doesNotExist();

      OPTIONS.forEach(function (buttonText, index) {
        assert
          .dom(`[data-test-category-option]:nth-child(${index + 1})`)
          .hasText(buttonText);
      });

      await click(`[data-test-category-option]:nth-child(2)`);

      assert.equal(
        workflowSession.getValue<string>('profileCategory'),
        OPTIONS[1]
      );
      assert.dom('[data-test-category-option]:nth-child(2) input').isChecked();
    });

    test('it allows a custom category to be entered', async function (assert) {
      let workflowSession = new WorkflowSession();
      this.set('workflowSession', workflowSession);

      await render(hbs`
        <CardSpace::EditDetails::Category
          @workflowSession={{this.workflowSession}}
        />
      `);

      assert
        .dom(`[data-test-category-option]:nth-child(${OPTIONS.length + 1})`)
        .containsText('Other');

      await click(
        `[data-test-category-option]:nth-child(${OPTIONS.length + 1})`
      );

      assert
        .dom(
          `[data-test-category-option]:nth-child(${
            OPTIONS.length + 1
          }) [data-test-category-option-other]`
        )
        .exists();

      await fillIn('[data-test-category-option-other] input', 'Something');

      await waitUntil(
        () =>
          (find('[data-test-validation-state-input]') as HTMLElement).dataset
            .testValidationStateInput !== 'initial'
      );

      assert
        .dom(
          `[data-test-category-option]:nth-child(${OPTIONS.length + 1}) input`
        )
        .hasClass('radio-option__input--checked');

      assert.equal(
        workflowSession.getValue<string>('profileCategory'),
        'Something'
      );

      await click('[data-test-category-option]:nth-child(2)');
      assert.dom('[data-test-category-option-other] input').doesNotExist();

      assert.notEqual(
        workflowSession.getValue<string>('profileCategory'),
        'Something'
      );

      await click(
        `[data-test-category-option]:nth-child(${OPTIONS.length + 1})`
      );

      assert
        .dom('[data-test-category-option-other] input')
        .hasValue('Something');

      await waitUntil(
        () =>
          (find('[data-test-validation-state-input]') as HTMLElement).dataset
            .testValidationStateInput !== 'loading'
      );

      assert.equal(
        workflowSession.getValue<string>('profileCategory'),
        'Something'
      );
    });

    test('it focuses the other field when the option is clicked', async function (assert) {
      let workflowSession = new WorkflowSession();
      this.set('workflowSession', workflowSession);

      await render(hbs`
        <CardSpace::EditDetails::Category
          @workflowSession={{this.workflowSession}}
        />
      `);

      await click('[data-test-category-option-other-container]');
      assert.dom('[data-test-category-option-other] input').isFocused();
    });

    test('it ignores the validated other value if a preset value has been chosen in the meantime', async function (this: Context, assert) {
      let validationResolver: Function | undefined;
      let validationPromise = new Promise(function (resolve) {
        validationResolver = resolve;
      });

      this.server.post(
        '/card-spaces/validate-profile-category',
        async function () {
          await validationPromise;
          return new MirageResponse(200, {}, { errors: [] });
        }
      );

      let workflowSession = new WorkflowSession();
      this.set('workflowSession', workflowSession);

      await render(hbs`
        <CardSpace::EditDetails::Category
          @workflowSession={{this.workflowSession}}
        />
      `);

      await click('[data-test-category-option-other-container]');
      await fillIn('[data-test-category-option-other] input', 'Something');

      await click(`[data-test-category-option]:nth-child(2)`);

      assert.equal(
        workflowSession.getValue<string>('profileCategory'),
        OPTIONS[1]
      );
      assert.dom('[data-test-category-option]:nth-child(2) input').isChecked();

      if (validationResolver) {
        validationResolver(true);
      }

      // Hideous, but need to wait to ensure validateCategoryTask has completed and not clobbered the static profileCategory
      await settled();
      await validationPromise;
      await settled();

      assert.equal(
        workflowSession.getValue<string>('profileCategory'),
        OPTIONS[1]
      );
      assert.dom('[data-test-category-option]:nth-child(2) input').isChecked();
    });

    test('it shows the error when custom category validation fails', async function (this: Context, assert) {
      this.server.post('/card-spaces/validate-profile-category', function () {
        return new MirageResponse(200, {}, { errors: [{ detail: 'Is bad' }] });
      });

      let workflowSession = new WorkflowSession();
      this.set('workflowSession', workflowSession);

      await render(hbs`
        <CardSpace::EditDetails::Category
          @workflowSession={{this.workflowSession}}
        />
      `);

      await click('[data-test-category-option-other-container]');
      await fillIn('[data-test-category-option-other] input', 'Something');

      await waitUntil(
        () =>
          (find('[data-test-validation-state-input]') as HTMLElement).dataset
            .testValidationStateInput !== 'initial'
      );

      assert
        .dom('[data-test-validation-state-input]')
        .hasAttribute('data-test-validation-state-input', 'invalid');

      assert
        .dom(
          `[data-test-card-space-category-field] [data-test-boxel-input-error-message]`
        )
        .containsText('Is bad');
    });

    test('it shows an error when custom category validation errors', async function (this: Context, assert) {
      this.server.post('/card-spaces/validate-profile-category', function () {
        return new MirageResponse(500, {}, {});
      });

      let workflowSession = new WorkflowSession();
      this.set('workflowSession', workflowSession);

      await render(hbs`
        <CardSpace::EditDetails::Category
          @workflowSession={{this.workflowSession}}
        />
      `);

      await click('[data-test-category-option-other-container]');
      await fillIn('[data-test-category-option-other] input', 'Something');

      await waitUntil(
        () =>
          (find('[data-test-validation-state-input]') as HTMLElement).dataset
            .testValidationStateInput !== 'initial'
      );

      assert
        .dom('[data-test-validation-state-input]')
        .hasAttribute('data-test-validation-state-input', 'invalid');

      assert
        .dom(
          `[data-test-card-space-category-field] [data-test-boxel-input-error-message]`
        )
        .containsText(
          'There was an error validating your Card Space profile category.'
        );
      assert.notOk(workflowSession.getValue<string>('profileCategory'));
    });

    test('it restores input from session', async function (assert) {
      let workflowSession = new WorkflowSession();
      this.set('workflowSession', workflowSession);
      workflowSession.setValue('profileCategory', OPTIONS[1]);

      await render(hbs`
        <CardSpace::EditDetails::Category
          @workflowSession={{this.workflowSession}}
        />
      `);

      assert
        .dom('[data-test-category-option]:nth-child(2) input')
        .hasClass('radio-option__input--checked');
    });

    test('it restores custom input from session', async function (assert) {
      let workflowSession = new WorkflowSession();
      this.set('workflowSession', workflowSession);
      workflowSession.setValue('profileCategory', 'Hello');

      await render(hbs`
        <CardSpace::EditDetails::Category
          @workflowSession={{this.workflowSession}}
        />
      `);

      assert
        .dom(
          `[data-test-category-option]:nth-child(${OPTIONS.length + 1}) input`
        )
        .hasClass('radio-option__input--checked');

      assert.dom('[data-test-category-option-other] input').hasValue('Hello');
    });
  }
);
