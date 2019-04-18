import { module, test } from 'qunit';
import { setupApplicationTest } from 'ember-qunit';
import { visit, click, fillIn, waitFor } from '@ember/test-helpers';
import { login } from '../helpers/login';
import Service from '@ember/service';
import { findInputWithValue, findTriggerElementWithLabel } from '../helpers/query-selectors';


let StubCardstackDataService = Service.extend({
  validate() {
    return Promise.resolve({})
  },
  getCardMeta() {
    return 'Comment #1'
  },
  branches() {
    return []
  },
  fetchPermissionsFor() {
    return Promise.resolve({mayUpdateResource: false, writableFields: ['karmaValue', 'karmaType']})
  }
})

module('Acceptance | tools dirtiness', function(hooks) {
  setupApplicationTest(hooks);

  hooks.beforeEach(function() {
    delete localStorage['cardstack-tools'];
    this.owner.register('service:cardstack-data', StubCardstackDataService);
  });

  hooks.afterEach(function() {
    delete localStorage['cardstack-tools'];
  });

  test('track field dirtiness in owned, related records', async function(assert) {
    await visit('/hub/posts/1');
    await login();
    await click('.cardstack-tools-launcher');
    await waitFor('.cs-active-composition-panel--main');
    await waitFor('.cs-editor-switch')
    await click('.cs-editor-switch');

    assert.dom('[data-test-cs-version-control-button-save="true"]').exists('Save button is disabled');
    assert.dom('[data-test-cs-version-control-button-cancel="true"]').exists('Cancel button is disabled');

    let reviewStatusActionTrigger = findTriggerElementWithLabel.call(this, /Comment #1: Karma/);
    await click(reviewStatusActionTrigger);

    let karmaInput = findInputWithValue.call(this, '10');
    await fillIn(karmaInput, '9');
    assert.dom('[data-test-cs-version-control-button-save="false"]').exists('Save button is enabled');
    assert.dom('[data-test-cs-version-control-button-cancel="false"]').exists('Cancel button is enabled');

    await fillIn(karmaInput, '10');
    assert.dom('[data-test-cs-version-control-button-save="true"]').exists('Save button is disabled');
    assert.dom('[data-test-cs-version-control-button-cancel="true"]').exists('Cancel button is disabled');
  });
});

