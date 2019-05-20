
import { module, test } from 'qunit';
import { setupRenderingTest } from 'ember-qunit';
import { render, find } from '@ember/test-helpers';
import hbs from 'htmlbars-inline-precompile';

module('helper:workflow-group-id', function(hooks) {
  setupRenderingTest(hooks);

  // Replace this with your real tests.
  test('it renders', async function(assert) {
    this.set('priority', 'Elevated');
    this.set('tag', 'Home');

    await render(hbs`{{workflow-group-id priority tag}}`);

    assert.equal(find('*').textContent.trim(), 'Elevated::Home');
  });
});

