
import { csFieldEditorFor } from 'dummy/helpers/cs-field-editor-for';
import { module, test } from 'qunit';

module('Unit | Helper | cs field editor for');

class TestModel {}
TestModel.metaForProperty = function(which) {
  if (which === 'theField') {
    return {
      options: { fieldType: 'test-field-type' }
    };
  } else {
    throw new Error("no such field");
  }
}

test('it maps to a field editor component', function(assert) {
  let result = csFieldEditorFor([new TestModel(), 'theField'], {});
  assert.equal(result, 'field-editors/test-field-type-editor');
});

test('it can do inline variant', function(assert) {
  let result = csFieldEditorFor([new TestModel(), 'theField'], { variant: 'inline' });
  assert.equal(result, 'inline-field-editors/test-field-type-editor');
});

test('it returns undefined on bad field', function(assert) {
  let result = csFieldEditorFor([new TestModel(), 'otherField'], {});
  assert.equal(result, undefined);
});

test('it returns undefined on missing model', function(assert) {
  let result = csFieldEditorFor([null, 'otherField'], {});
  assert.equal(result, undefined);
});
