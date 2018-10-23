import { module, test } from 'qunit';
import { setupApplicationTest } from 'ember-qunit';
import { visit, currentURL, click, find, findAll, triggerEvent, waitUntil } from '@ember/test-helpers';
import fetch from 'fetch';

module('Acceptance | image attachment', function(hooks) {
  setupApplicationTest(hooks);


  hooks.beforeEach(async function() {
    await this.owner.lookup('service:cardstack-codegen').refreshCode();
    let tools = this.owner.lookup('service:cardstack-tools');
    tools.set('active', true);
    tools.set('editing', true);
  });


  test('attaching an image', async function(assert) {
    await visit('/hub/articles/new');
    assert.equal(currentURL(), '/hub/articles/new');

    let imageOverlay = findContains('.cs-field-overlay', 'Cover Image');
    await click(imageOverlay.querySelector('.target'));
    await click('.cardstack-image-editor button');

    let response = await fetch("/@cardstack/image/cardstack.png");
    let blob = await response.blob();

    await triggerEvent('.cardstack-image-upload-modal input[type=file]', 'change', [blob] );

    await click(findContains('button', 'Update Image'));
    assert.ok(find('img.cs-image[src*="/api/cs-files/"]'));

    // wait until no animation is happening before ending the test to prevent
    // ember errors
    await waitUntil(() => !find('.liquid-animating') )
  });
});

function findContains(selector, string) {
  return findAll(selector).find(o => o.innerHTML.includes(string));
}