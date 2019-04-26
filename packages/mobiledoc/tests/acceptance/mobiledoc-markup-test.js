import { module, test } from 'qunit';
import { currentURL, fillIn, visit, find, click, waitFor, waitUntil } from '@ember/test-helpers';
import { setupApplicationTest } from 'ember-qunit';
import { insertText } from '../helpers/ember-mobiledoc-editor';

module('Acceptance | mobiledoc markup', function(hooks) {
  setupApplicationTest(hooks);

  test('mobiledoc field', async function(assert) {
    await visit('/test');

    assert.equal(currentURL(), '/test');

    let editorEl = find('.mobiledoc-editor__editor');
    assert.dom('.mobiledoc-editor').hasText('I am a dongle.');

    await insertText(editorEl, 'I am a paragraph.');

    assert.dom('.mobiledoc-editor p').hasTextContaining('I am a paragraph.', 'p tag is present');

    await click('.current-block .cs-icon');
    await click('.block-options .editor-h2');
    await insertText(editorEl, 'I am a header.');

    assert.dom('.mobiledoc-editor h2').hasTextContaining('I am a header.', 'h2 tag is present');
  });

  test('inserting an image into mobiledoc', async function(assert) {
    await visit('/test');

    let editorEl = find('.mobiledoc-editor__editor');
    await insertText(editorEl, 'I am a paragraph.');

    await click('.current-block .cs-icon');
    await click('.block-options .editor-image');

    await waitFor('[data-card-picker-toolbox-header]');
    await waitUntil(() => !find('.cardstack-card-picker--loading'));

    let imgSrc = document.querySelector('[data-card-picker-card="0"] img').getAttribute('src');
    await click('[data-card-picker-card="0"]');
    await waitUntil(() => !find('[data-card-picker-toolbox-header]'));

    assert.equal(find('.mobiledoc-editor .cs-mobiledoc-card img').getAttribute('src'), imgSrc);

    await fillIn('.cs-mobiledoc-card--caption-input', 'Are you ready for me guys?');
    assert.dom('.cs-mobiledoc-card--caption-input').hasValue('Are you ready for me guys?');
  });
});
