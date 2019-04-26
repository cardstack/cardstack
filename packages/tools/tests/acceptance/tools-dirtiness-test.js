import { module, test } from 'qunit';
import { setupApplicationTest } from 'ember-qunit';
import { visit, click, fillIn, waitFor } from '@ember/test-helpers';
import { login } from '../helpers/login';
import Service from '@ember/service';

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
    await click('[data-test-cardstack-tools-launcher]');
    await waitFor('[data-test-cs-editor-panel]');

    assert.dom('[data-test-cs-version-control-button-save="true"]').exists('Save button is disabled');
    assert.dom('[data-test-cs-version-control-button-cancel]').exists('Cancel button exists');
    assert.dom('[data-test-cs-version-control-status]').hasText('saved');

    let karmaInput = '[data-test-cs-collapsible-section=comment-1-karma] input'
    await fillIn(karmaInput, '9');
    assert.dom('[data-test-cs-version-control-button-save="false"]').exists('Save button is enabled');
    assert.dom('[data-test-cs-version-control-status]').hasText('editing');

    await fillIn(karmaInput, '10');
    assert.dom('[data-test-cs-version-control-button-save="true"]').exists('Save button is disabled');
    assert.dom('[data-test-cs-version-control-status]').hasText('saved');
  });
});
