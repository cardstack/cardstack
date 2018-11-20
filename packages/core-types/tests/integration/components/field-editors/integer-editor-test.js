import { module, test } from 'qunit';
import { setupRenderingTest } from 'ember-qunit';
import { render, fillIn, focus, blur } from '@ember/test-helpers';
import EmberObject from '@ember/object';
import hbs from 'htmlbars-inline-precompile';

const INPUT = '.field-editor > input';

module('Integration | Component | field editors/integer editor', function(hooks) {
  setupRenderingTest(hooks);

  test('it renders', async function(assert) {
    this.set('model', EmberObject.create({ rating: 3 }));
    await render(hbs`
      {{field-editors/integer-editor
        content=model
        field="rating"
      }}`);
    assert.dom(INPUT).hasValue('3', 'number input has correct value');
    assert.dom(INPUT).isNotDisabled();
  });

  test('it updates the value correctly', async function(assert) {
    this.set('model', EmberObject.create({ rating: 3 }));
    await render(hbs`
      {{field-editors/integer-editor
        content=model
        field="rating"
      }}`);
    await fillIn(INPUT, '5');
    assert.dom(INPUT).hasValue('5', 'input is updated');
    assert.dom(INPUT).isNotDisabled();
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
    assert.dom(INPUT).isDisabled();
  });

  test('onchange is called when the field is left', async function(assert) {
    this.set('onchange', () => assert.step('change'))
    this.set('model', EmberObject.create({ rating: 3 }));
    await render(hbs`
      {{field-editors/integer-editor
        content=model
        field="rating"
        onchange=onchange
      }}`);
    await focus(INPUT);
    await blur(INPUT);
    assert.verifySteps(['change']);
  });
});
