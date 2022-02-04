import { module, test } from 'qunit';
import { setupRenderingTest } from 'ember-qunit';
import { render } from '@ember/test-helpers';
import { hbs } from 'ember-cli-htmlbars';
import a11yAudit from 'ember-a11y-testing/test-support/audit';

module('Integration | Component | Field', function (hooks) {
  setupRenderingTest(hooks);

  test('it renders', async function (assert) {
    await render(hbs`<Boxel::Field @label="Name">Jackie</Boxel::Field>`);
    assert.dom('[data-test-boxel-field]').hasTagName('div');
    assert.dom('[data-test-boxel-field-label]').hasText('Name');
    assert.dom('[data-test-boxel-field]').containsText('Jackie');
  });

  test('it renders with params', async function (assert) {
    await render(hbs`<Boxel::Field
      @fieldId="name"
      @label="Name"
      @icon="profile"
    >
      <div data-test-field-block>Jackie</div>
    </Boxel::Field>`);
    assert.dom('[data-test-boxel-field] svg').exists();
    assert.dom('[data-test-boxel-field-id="name"]').exists();
    assert.dom('[data-test-field-block]').hasText('Jackie');

    await a11yAudit();
    assert.ok(true, 'no a11y errors found!');
  });

  test('it can render with different tag', async function (assert) {
    await render(hbs`<Boxel::Field
      @tag="label"
      @label="Name"
    >
      <Boxel::Input />
    </Boxel::Field>`);

    assert.dom('[data-test-boxel-field]').hasTagName('label');
    assert.dom('[data-test-boxel-field-label]').hasText('Name');
    assert.dom('[data-test-boxel-field] input').exists();
  });
});
