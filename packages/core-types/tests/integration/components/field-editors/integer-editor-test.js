import { module, test } from 'qunit';
import { setupRenderingTest } from 'ember-qunit';
import { render, triggerEvent, waitFor } from '@ember/test-helpers';
import Object from '@ember/object';
import hbs from 'htmlbars-inline-precompile';

module('Integration | Component | field editors/integer editor', function(hooks) {
  setupRenderingTest(hooks);

  test('it renders', async function(assert) {
    this.setProperties({
      model: Object.create({ rating: 3 }),
      onchange() {}
    });
    await render(hbs`
      {{field-editors/integer-editor
        content=model
        field="rating"
        onchange=onchange
      }}`);
    assert.dom('input[type=number]').hasValue('3', 'number input has correct value');
    assert.dom('input').isNotDisabled('input is not disabled');
  });

  test('it updates the value correctly', async function(assert) {
    this.setProperties({
      model: Object.create({ rating: 3 }),
      onchange() {}
    });
    await render(hbs`
      {{field-editors/integer-editor
        content=model
        field="rating"
        onchange=onchange
      }}`);
    this.set('model.rating', 5);
    await triggerEvent('.field-editor > input', 'input');
    assert.dom('input[type=number]').hasValue('5', 'input is updated');
    assert.dom('input').isNotDisabled('input is not disabled');
    assert.equal(this.get('model.rating'), '5', 'model attribute is updated');
  });

  test('it can be disabled', async function(assert) {
    this.setProperties({
      model: Object.create({ rating: 3 }),
      onchange() {}
    });
    await render(hbs`
      {{field-editors/integer-editor
        content=model
        field="rating"
        onchange=onchange
        disabled=true
      }}`);
    assert.dom('input').isDisabled('integer input is disabled');
  });
});
