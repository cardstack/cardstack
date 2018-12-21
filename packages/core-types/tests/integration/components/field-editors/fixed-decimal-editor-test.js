import { module, test } from 'qunit';
import { setupRenderingTest } from 'ember-qunit';
import { render, fillIn, focus, blur } from '@ember/test-helpers';
import EmberObject from '@ember/object';
import hbs from 'htmlbars-inline-precompile';

const INPUT = '.field-editor > input';

module('Integration | Component | field editors/fixed-decimal editor', function(hooks) {
  setupRenderingTest(hooks);

  test('it renders', async function(assert) {
    this.set('model', EmberObject.create({ eccentricity: 2.74284164 }));
    await render(hbs`
      {{field-editors/fixed-decimal-editor
        content=model
        field="eccentricity"
      }}`);
    assert.dom(INPUT).hasValue('2.74284164', 'number input has correct value');
    assert.dom(INPUT).isNotDisabled();
  });

  test('it updates the value correctly', async function(assert) {
    this.set('model', EmberObject.create({ eccentricity: 5.0 }));
    await render(hbs`
      {{field-editors/fixed-decimal-editor
        content=model
        field="eccentricity"
      }}`);
    await fillIn(INPUT, '3.3463235');
    assert.dom(INPUT).hasValue('3.3463235', 'input is updated');
    assert.dom(INPUT).isNotDisabled();
    assert.strictEqual(this.get('model.eccentricity'), 3.3463235, 'model attribute is updated');
  });

  test('it can be disabled', async function(assert) {
    this.set('model', EmberObject.create({ eccentricity: 3 }));
    await render(hbs`
      {{field-editors/fixed-decimal-editor
        content=model
        field="eccentricity"
        disabled=true
      }}`);
    assert.dom(INPUT).isDisabled();
  });

  test('onchange is called when the field is left', async function(assert) {
    this.set('onchange', () => assert.step('change'))
    this.set('model', EmberObject.create({ eccentricity: 3 }));
    await render(hbs`
      {{field-editors/fixed-decimal-editor
        content=model
        field="eccentricity"
        onchange=onchange
      }}`);
    await focus(INPUT);
    await blur(INPUT);
    assert.verifySteps(['change']);
  });
});
