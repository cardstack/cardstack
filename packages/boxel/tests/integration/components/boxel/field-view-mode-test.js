import { module, test } from 'qunit';
import { setupRenderingTest } from 'ember-qunit';
import { render } from '@ember/test-helpers';
import { hbs } from 'ember-cli-htmlbars';
import a11yAudit from 'ember-a11y-testing/test-support/audit';

module('Integration | Component | Field - View Mode', function (hooks) {
  setupRenderingTest(hooks);

  test('it renders', async function (assert) {
    await render(hbs`<Boxel::Field />`);
    assert.dom('[data-test-boxel-field]').exists();
    assert.dom('[data-test-boxel-field-label]').exists();
  });

  test('it renders with label and block', async function (assert) {
    await render(hbs`<Boxel::Field @label="Name">
        <h3>Jackie</h3>
      </Boxel::Field>`);
    assert.dom('[data-test-boxel-field]').exists();
    assert.dom('[data-test-boxel-field-label]').hasText('Name');
    assert.dom('[data-test-boxel-field] h3').hasText('Jackie');
  });

  test('it renders with id and labelClass', async function (assert) {
    await render(hbs`<Boxel::Field
      @fieldId="breed"
      @label="Breed"
      @labelClass="dog-breed"
    >
      Beagle
    </Boxel::Field>`);
    assert.dom('[data-test-boxel-field-id="breed"]').hasText('Breed Beagle');
    assert.dom('[data-test-boxel-field-label]').hasClass('dog-breed');
    await a11yAudit();
    assert.ok(true, 'no a11y errors found!');
  });
});
