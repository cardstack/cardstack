import { module, test } from 'qunit';
import { setupApplicationTest } from 'ember-qunit';
import { visit, click, fillIn, triggerEvent } from '@ember/test-helpers';
import RSVP from 'rsvp';

function timeout(ms) {
  return new RSVP.Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function findTriggerElementWithLabel(labelRegex) {
  return [...this.element.querySelectorAll('.cs-toolbox-section label')].find(element => labelRegex.test(element.textContent));
}

function findInputWithValue(value) {
  return Array.from(this.element.querySelectorAll('input'))
    .find(element => element.value === value);
}

module('Acceptance | tools', function(hooks) {
  setupApplicationTest(hooks);

  hooks.beforeEach(function() {
    delete localStorage['cardstack-tools'];
  });

  hooks.afterEach(function() {
    delete localStorage['cardstack-tools'];
  });

  test('activate tools', async function(assert) {
    await visit('/1');
    await click('.cardstack-tools-launcher');
    await timeout(10);

    let element = findTriggerElementWithLabel.call(this, /Title/);
    await click(element);
    let matching = findInputWithValue.call(this, 'hello world');
    assert.ok(matching, 'found field editor for title');

    element = findTriggerElementWithLabel.call(this, /Body/);
    await click(element);
    matching = findInputWithValue.call(this, 'Look behind you, a Three-Headed Monkey!');
    assert.ok(matching, 'found field editor for comment body');

    element = findTriggerElementWithLabel.call(this, /Name/);
    await click(element);
    matching = findInputWithValue.call(this, 'Guybrush Threepwood');
    assert.ok(matching, 'found field editor for comment author name');
  });

  test('show validation error', async function(assert) {
    await visit('/1');
    await click('.cardstack-tools-launcher');

    let element = findTriggerElementWithLabel.call(this, /Title/);
    await click(element);

    let titleEditor = findInputWithValue.call(this, 'hello world');
    await fillIn(titleEditor, '');
    await triggerEvent(titleEditor, 'blur');
    await timeout(10);
    assert.dom('.field-editor--error-message').hasText('title must not be empty');

    element = findTriggerElementWithLabel.call(this, /Body/);
    await click(element);

    let commentBodyEditor = findInputWithValue.call(this, 'Look behind you, a Three-Headed Monkey!');
    await fillIn(commentBodyEditor, '');
    await triggerEvent(commentBodyEditor, 'blur');
    await timeout(10);
    assert.dom('.field-editor--error-message').hasText('body must not be empty');
  });
});
