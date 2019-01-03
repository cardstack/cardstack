import { module, test } from 'qunit';
import { setupRenderingTest } from 'ember-qunit';
import { render } from '@ember/test-helpers';
import hbs from 'htmlbars-inline-precompile';

module('Integration | Helper | cs-error-class', function(hooks) {
  setupRenderingTest(hooks);

  test('it renders an empty string when there are no errors', async function(assert) {
    this.set('errors', undefined);
    this.set('fieldModel', {});
    await render(hbs`{{cs-error-class errors fieldModel}}`);
    assert.dom(this.element).hasText('');
  });

  test('it renders an empty string when there is no error for that field', async function(assert) {
    this.set('errors', { title: [ "That's a bad title" ] });
    this.set('fieldModel', { name: "updateStatus" });
    await render(hbs`{{cs-error-class errors fieldModel}}`);
    assert.dom(this.element).hasText('');
  });

  test('it renders the error class when there is an error for that field', async function(assert) {
    this.set('errors', { title: [ "That's a bad title" ] });
    this.set('fieldModel', { name: "title" });
    await render(hbs`{{cs-error-class errors fieldModel "too-bad"}}`);
    assert.dom(this.element).hasText('too-bad');
  });

  test('it renders the error class when there is an error for any field in a group', async function(assert) {
    this.set('errors', { readingTimeValue: [ "Value must be a number" ] });
    this.set('fieldModel', { grouped: ["readingTimeUnit", "readingTimeValue"] });
    await render(hbs`{{cs-error-class errors fieldModel "invalid"}}`);
    assert.dom(this.element).hasText('invalid');
  });
});
