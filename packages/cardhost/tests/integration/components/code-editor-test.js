import { module, test } from 'qunit';
import { setupRenderingTest } from 'ember-qunit';
import { render, waitUntil, find } from '@ember/test-helpers';
import hbs from 'htmlbars-inline-precompile';

module('Integration | Component | code-editor', function(hooks) {
  setupRenderingTest(hooks);

  test('it renders', async function(assert) {
    this.set('editorIsReady', false);
    let editorIsReady = false;
    this.set('editorReady', () => {
      editorIsReady = true;
    });

    await render(hbs`<CodeEditor @editorReady={{action this.editorReady}} @code="card" />`);
    await waitUntil(
      () => {
        return editorIsReady;
      },
      { timeout: 10000 }
    );
    let lineNumber = '1';
    await waitUntil(
      function() {
        return find('.cardhost-monaco-container').textContent.includes(lineNumber + 'card');
      },
      { timeout: 3000 }
    );
    assert.dom('.cardhost-monaco-container').includesText(lineNumber + 'card'); // should be 1card
  });
});
