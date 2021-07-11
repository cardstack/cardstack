import { module, test } from 'qunit';
import { setupRenderingTest } from 'ember-qunit';
import { render } from '@ember/test-helpers';
import { hbs } from 'ember-cli-htmlbars';
import a11yAudit from 'ember-a11y-testing/test-support/audit';

module('Integration | Component | Field - Edit Mode', function (hooks) {
  setupRenderingTest(hooks);

  test('it renders', async function (assert) {
    await render(hbs`<Boxel::Field @fieldMode="edit" />`);
    assert.dom('[data-test-boxel-edit-field]').exists();
    assert.dom('[data-test-boxel-edit-field]').hasTagName('label');
    assert.dom('[data-test-boxel-edit-field-label]').exists();
  });

  test('it renders with label and block', async function (assert) {
    await render(hbs`<Boxel::Field @fieldMode="edit" @label="Breed">
      <Boxel::Input />
    </Boxel::Field>`);
    assert.dom('[data-test-boxel-edit-field]').exists();
    assert.dom('[data-test-boxel-edit-field-label]').hasText('Breed');
    assert.dom('[data-test-boxel-edit-field] input').exists();
  });

  test('it renders with id and labelClass', async function (assert) {
    await render(hbs`<Boxel::Field
      @fieldMode="edit"
      @fieldId="breed"
      @label="Breed"
      @labelClass="dog-breed"
    >
      <Boxel::Input @value="Beagle" />
    </Boxel::Field>`);
    assert.dom('[data-test-boxel-edit-field-id="breed"]').hasText('Breed');
    assert.dom('[data-test-boxel-edit-field-label]').hasClass('dog-breed');
    assert.dom('[data-test-boxel-edit-field] input').hasValue('Beagle');

    await a11yAudit();
    assert.ok(true, 'no a11y errors found!');
  });
});
