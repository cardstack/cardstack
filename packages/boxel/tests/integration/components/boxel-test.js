import { module, test } from 'qunit';
import { setupRenderingTest } from 'ember-qunit';
import { render } from '@ember/test-helpers';
import hbs from 'htmlbars-inline-precompile';

module('Integration | Component | boxel', function (hooks) {
  setupRenderingTest(hooks);

  test('it renders', async function (assert) {
    await render(hbs`
      <Boxel>
        hello boxel
      </Boxel>
    `);
    assert.dom('[data-test-boxel]').hasText('hello boxel');
  });

  test('it can render with given html tag and css class', async function (assert) {
    await render(hbs`
      <Boxel @class="custom-class" @tag="header">
        hello boxel
      </Boxel>
    `);
    assert.dom('[data-test-boxel]').hasText('hello boxel');
    assert.dom('[data-test-boxel]').hasTagName('header');
    assert.dom('[data-test-boxel].boxel.custom-class').exists();
  });
});
