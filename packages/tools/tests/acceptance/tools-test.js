import { module, test } from 'qunit';
import { setupApplicationTest } from 'ember-qunit';
import { visit, click } from '@ember/test-helpers';

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
    let matching = Array.from(this.element.querySelectorAll('input')).find(element => element.value === 'hello world');
    assert.ok(matching, 'found field editor for title');
  });
});
