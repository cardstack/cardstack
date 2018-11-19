import { module, test } from 'qunit';
import { setupRenderingTest } from 'ember-qunit';
import { render, fillIn } from '@ember/test-helpers';
import EmberObject from '@ember/object';
import hbs from 'htmlbars-inline-precompile';

module('Integration | Component | field editors/integer editor', function(hooks) {
  setupRenderingTest(hooks);

  test('it renders', async function(assert) {
    this.set('model', EmberObject.create({ rating: 3 }));
    await render(hbs`
      {{field-editors/integer-editor
        content=model
        field="rating"
      }}`);
    assert.dom('input[type=number]').hasValue('3', 'number input has correct value');
    assert.dom('input').isNotDisabled();
  });

  test('it updates the value correctly', async function(assert) {
    this.set('model', EmberObject.create({ rating: 3 }));
    await render(hbs`
      {{field-editors/integer-editor
        content=model
        field="rating"
      }}`);
    await fillIn('input', '5');
    assert.dom('input[type=number]').hasValue('5', 'input is updated');
    assert.dom('input').isNotDisabled();
    assert.strictEqual(this.get('model.rating'), 5, 'model attribute is updated');
  });

  test('it can be disabled', async function(assert) {
    this.set('model', EmberObject.create({ rating: 3 }));
    await render(hbs`
      {{field-editors/integer-editor
        content=model
        field="rating"
        disabled=true
      }}`);
    assert.dom('input').isDisabled();
  });
});
