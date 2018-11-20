import { module, test } from 'qunit';
import { setupRenderingTest } from 'ember-qunit';
import { render, fillIn, focus, blur } from '@ember/test-helpers';
import EmberObject from '@ember/object';
import hbs from 'htmlbars-inline-precompile';

const INPUT = '.field-editor > input';

module('Integration | Component | field editors/string editor', function(hooks) {
  setupRenderingTest(hooks);

  test('it renders', async function(assert) {
    this.set('model', EmberObject.create({ title: 'Go, Fabi, go!' }));
    this.set('onchange', () => {});
    await render(hbs`
      {{field-editors/string-editor
        content=model
        field="title"
        onchange=onchange
      }}`
    );
    assert.dom(INPUT).hasValue('Go, Fabi, go!', 'text input has correct value');
    assert.dom(INPUT).isNotDisabled();

    await fillIn(INPUT, 'Win that gold from Magnus');
    assert.dom(INPUT).hasValue('Win that gold from Magnus', 'input is updated');
    assert.equal(this.get('model.title'), 'Win that gold from Magnus', 'model attribute is updated');
  });

  test('it can be disabled', async function(assert) {
    this.set('model', EmberObject.create({ title: 'Go, Fabi, go!' }));
    this.set('onchange', () => {});
    await render(hbs`
      {{field-editors/string-editor
        content=model
        field="title"
        onchange=onchange
        disabled=true
      }}`
    );
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
