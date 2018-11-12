import { module, test } from 'qunit';
import { currentURL, visit, find, click } from '@ember/test-helpers';
import { setupApplicationTest } from 'ember-qunit';
import { insertText } from '../helpers/ember-mobiledoc-editor';

module('Acceptance | mobiledoc markup', function(hooks) {
  setupApplicationTest(hooks);

  test('mobiledoc field without cardstack-tools', async function(assert) {
    await visit('/no-tools');

    assert.equal(currentURL(), '/no-tools');

    let editorEl = find('.mobiledoc-editor__editor');
    assert.dom('.mobiledoc-editor').hasText('I am a dongle.');

    await insertText(editorEl, 'I am a paragraph.');

    assert.dom('.mobiledoc-editor p').hasTextContaining('I am a paragraph.', 'p tag is present');

    await click('.current-block .cs-icon');
    await click('.block-options .editor-h2');
    await insertText(editorEl, 'I am a header.');

    assert.dom('.mobiledoc-editor h2').hasTextContaining('I am a header.', 'h2 tag is present');
  });

  test('mobiledoc field with cardstack-tools', async function(assert) {
    await visit('/tools');

    assert.equal(currentURL(), '/tools');

    let editorEl = find('.mobiledoc-editor__editor');
    assert.dom('.mobiledoc-editor').hasText('I am a dongle.');

    await insertText(editorEl, 'I am a paragraph.');

    assert.dom('.mobiledoc-editor p').hasTextContaining('I am a paragraph.', 'p tag is present');

    await click('.current-block .cs-icon');
    await click('.block-options .editor-h2');
    await insertText(editorEl, 'I am a header.');

    assert.dom('.mobiledoc-editor h2').hasTextContaining('I am a header.', 'h2 tag is present');
  });
});
