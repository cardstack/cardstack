import { module, test } from 'qunit';
import { setupApplicationTest } from 'ember-qunit';
import { visit, click, fillIn, triggerEvent, waitFor } from '@ember/test-helpers';
import { login } from '../helpers/login';

function findTriggerElementWithLabel(labelRegex) {
  return [...this.element.querySelectorAll('.cs-toolbox-section label')].find(element => labelRegex.test(element.textContent));
}

function findSectionLabels(label) {
  return [...this.element.querySelectorAll('.cs-toolbox-section label')].filter(element => label === element.textContent);
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
    await login();
    await click('.cardstack-tools-launcher');
    await waitFor('.cs-active-composition-panel');

    let element = findTriggerElementWithLabel.call(this, /Title/);
    await click(element);
    let matching = findInputWithValue.call(this, '10 steps to becoming a fearsome pirate');
    assert.ok(matching, 'found field editor for title');

    element = findTriggerElementWithLabel.call(this, /Comment #1: Body/);
    await click(element);
    matching = findInputWithValue.call(this, 'Look behind you, a Three-Headed Monkey!');
    assert.ok(matching, 'found field editor for comment body');

    element = findTriggerElementWithLabel.call(this, /Name/);
    await click(element);
    matching = findInputWithValue.call(this, 'Guybrush Threepwood');
    assert.ok(matching, 'found field editor for comment poster name');
  });

  test('show validation error', async function(assert) {
    await visit('/1');
    await login();
    await click('.cardstack-tools-launcher');

    let element = findTriggerElementWithLabel.call(this, /Title/);
    await click(element);

    let titleEditor = findInputWithValue.call(this, '10 steps to becoming a fearsome pirate');
    await fillIn(titleEditor, '');
    await triggerEvent(titleEditor, 'blur');
    await waitFor('.field-editor--error-message');
    assert.dom('.field-editor--error-message').hasText('title must not be empty');

    element = findTriggerElementWithLabel.call(this, /Body/);
    await click(element);
    let commentBodyEditor = findInputWithValue.call(this, 'Look behind you, a Three-Headed Monkey!');
    await fillIn(commentBodyEditor, '');
    await triggerEvent(commentBodyEditor, 'blur');
    await waitFor('.field-editor--error-message');
    assert.dom('.field-editor--error-message').hasText('body must not be empty');
  });

  test('show all fields, not just those rendered from template', async function(assert) {
    await visit('/1');
    await login();
    await click('.cardstack-tools-launcher');

    let archivedSection = findTriggerElementWithLabel.call(this, /Archived/);
    assert.ok(archivedSection, "Unrendered field appears in editor");

    let titleSections = findSectionLabels.call(this, "Title");
    assert.equal(titleSections.length, 1, "Rendered fields only appear once");
  });

  test('collapsible panel captions are unambiguous', async function(assert) {
    await visit('/1');
    await login();
    await click('.cardstack-tools-launcher');

    assert.ok(findTriggerElementWithLabel.call(this, /Blogger #1: Name/));
    assert.ok(findTriggerElementWithLabel.call(this, /Comment #1: Body/));
    assert.ok(findTriggerElementWithLabel.call(this, /Comment #1: Karma/));
    assert.ok(findTriggerElementWithLabel.call(this, /Comment #2: Body/));
    assert.ok(findTriggerElementWithLabel.call(this, /Comment #2: Karma/));
  });

  test('disable inputs for computed fields', async function(assert) {
    await visit('/1');
    await login();
    await click('.cardstack-tools-launcher');

    let authorNameSectionTrigger = findTriggerElementWithLabel.call(this, /Author Name/);
    await click(authorNameSectionTrigger);

    let nameInput = findInputWithValue.call(this, 'LeChuck');
    assert.dom(nameInput).isDisabled('Computed field is disabled');
  });
});
