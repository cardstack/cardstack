import { module, test } from 'qunit';
import { setupRenderingTest } from 'ember-qunit';
import { render, fillIn, triggerEvent } from '@ember/test-helpers';
import EmberObject from '@ember/object';
import hbs from 'htmlbars-inline-precompile';

module('Integration | Component | field editors/string editor', function(hooks) {
  setupRenderingTest(hooks);

  test('it renders', async function(assert) {
    this.set('model', EmberObject.create({ title: 'Go, Fabi, go!' }));
    await render(hbs`
      {{field-editors/string-editor
        content=model
        field="title"
      }}`
    );
    assert.dom('input').hasValue('Go, Fabi, go!', 'text input has correct value');
    assert.dom('input').isNotDisabled();

    await fillIn('input', 'Win that gold from Magnus');
    assert.dom('input').hasValue('Win that gold from Magnus', 'input is updated');
    assert.equal(this.get('model.title'), 'Win that gold from Magnus', 'model attribute is updated');
  });

  test('it can be disabled', async function(assert) {
    this.set('model', EmberObject.create({ title: 'Go, Fabi, go!' }));
    await render(hbs`{{field-editors/string-editor content=model field="title" disabled=true}}`);
    await render(hbs`
      {{field-editors/string-editor
        content=model
        field="title"
        disabled=true
      }}`
    );
    assert.dom('input[disabled]').isDisabled();
  });

  test('onchange is called when the field is left', async function(assert) {
    let changed;
    this.set('onchange', () => {
      changed = true;
    });
    this.set('model', EmberObject.create({ rating: 3 }));
    await render(hbs`
      {{field-editors/integer-editor
        content=model
        field="rating"
        onchange=onchange
      }}`);
    await triggerEvent('input', 'blur');
    assert.ok(changed);
  });
});
