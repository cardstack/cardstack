import { module, test } from 'qunit';
import { setupApplicationTest } from 'ember-qunit';
import { visit, click } from '@ember/test-helpers';

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
    let element = [...this.element.querySelectorAll('.cs-toolbox-section label')].find(element => /Title/.test(element.textContent));
    await click(element);

    let matching = findInputWithValue.call(this, 'hello world');
    assert.ok(matching, 'found field editor for title');

    matching = findInputWithValue.call(this, 'Look behind you, a Three-Headed Monkey!');
    assert.ok(matching, 'found field editor for comment body');

    matching = findInputWithValue.call(this, 'Guybrush Threepwood');
    assert.ok(matching, 'found field editor for comment author name');
  });
});
