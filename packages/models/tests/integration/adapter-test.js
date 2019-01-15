import Adapter from '@cardstack/models/adapter';
import { setupTest } from 'ember-qunit'
import { module, test } from 'qunit';

module('something', function(hooks){ 
  setupTest(hooks);
  hooks.beforeEach(function() {
    this.owner.register('adapter:my-test', Adapter);
  });

  test('branch query param is sent correctly', async function(assert) {
    let adapter = this.owner.lookup('adapter:my-test');
    let snapshot = {
      adapterOptions: {
        branch: 'master'
      }
    };
    let builtUrl = adapter.buildUrl('test', 'id', snapshot, findRecord);

    assert.equal(builtUrl, 'tests/id?branch=master');
  });
});
