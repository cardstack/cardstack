
import { csFieldEditorOptionsFor } from 'dummy/helpers/cs-field-editor-options-for';
import { module, test } from 'qunit';

module('Unit | Helper | cs field editor options for', function() {
  class TestModel {}
  TestModel.metaForProperty = function(which) {
    if (which === 'theField') {
      return {
        options: { fieldType: 'test-field-type' }
      };
    } else if (which == 'theFieldWithEditorOptions') {
      return {
        options: { fieldType: 'test-field-type', editorOptions: { foo: 'bar' } }
      };
    } else if (which == 'theFieldWithCustomEditor') {
      return {
        options: { fieldType: 'test-field-type', editorComponent: 'my-custom-editor' }
      };
    } else if (which == 'theFieldWithCustomEditorAndOptions') {
      return {
        options: { fieldType: 'test-field-type', editorComponent: 'my-custom-editor', editorOptions: { foo: 'bar' } }
      };
    } else if (which == 'theFieldWithCustomInlineEditor') {
      return {
        options: { fieldType: 'test-field-type', editorComponent: 'my-custom-editor', editorOptions: { foo: 'bar' }, inlineEditorComponent: 'my-custom-inline-editor' }
      };
    } else if (which == 'theFieldWithCustomInlineEditorAndOptions') {
      return {
        options: { fieldType: 'test-field-type', editorComponent: 'my-custom-editor', editorOptions: { foo: 'bar' }, inlineEditorComponent: 'my-custom-inline-editor', inlineEditorOptions: { baz: 'quux' } }
      };
    } else {
      throw new Error("no such field");
    }
  }

  test('it returns empty object when not specified', function(assert) {
    let result = csFieldEditorOptionsFor([new TestModel(), 'theField'], {});
    assert.deepEqual(result, {});
  });

  test('it returns options when specified', function(assert) {
    let result = csFieldEditorOptionsFor([new TestModel(), 'theFieldWithEditorOptions'], {});
    assert.deepEqual(result, { foo: 'bar' });
  });

  test('it returns empty object for custom editor when not specified', function(assert) {
    let result = csFieldEditorOptionsFor([new TestModel(), 'theFieldWithCustomEditor'], {});
    assert.deepEqual(result, {});
  });

  test('it returns options for custom editor when specified', function(assert) {
    let result = csFieldEditorOptionsFor([new TestModel(), 'theFieldWithCustomEditorAndOptions'], {});
    assert.deepEqual(result, { foo: 'bar' });
  });

  test('it returns empty object for custom inline editor when not specified', function(assert) {
    let result = csFieldEditorOptionsFor([new TestModel(), 'theFieldWithCustomInlineEditor'], { variant: 'inline' });
    assert.deepEqual(result, {});
  });

  test('it returns options for custom inline editor when specified', function(assert) {
    let result = csFieldEditorOptionsFor([new TestModel(), 'theFieldWithCustomInlineEditorAndOptions'], { variant: 'inline' });
    assert.deepEqual(result, { baz: 'quux' });
  });

  test('it returns undefined on bad field', function(assert) {
    let result = csFieldEditorOptionsFor([new TestModel(), 'otherField'], {});
    assert.equal(result, undefined);
  });

  test('it returns undefined on missing model', function(assert) {
    let result = csFieldEditorOptionsFor([null, 'otherField'], {});
    assert.equal(result, undefined);
  });
});
