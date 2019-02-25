import { module, test } from 'qunit';
import { setupTest } from 'ember-qunit';
import '@ember/test-helpers';
import Fixtures from '@cardstack/test-support/fixtures';
import testDataSetup from '../helpers/test-data-setup';


module('Integration | getCardMeta', function (hooks) {
  setupTest(hooks);
  let scenario = new Fixtures({
    create(factory) {
      testDataSetup(factory);
    }
  });
  scenario.setupTest(hooks);

  hooks.beforeEach(async function () {
    let codegenService = this.owner.lookup('service:cardstack-codegen');
    await codegenService.refreshCode();
    this.store = this.owner.lookup('service:store');
  });

  test('It returns a human readable identifier for a saved record', async function(assert) {
    let vanGogh = await this.store.findRecord('puppy', 'vanGogh');
    let dataService = this.owner.lookup('service:cardstackData');
    assert.equal(dataService.getCardMeta(vanGogh, 'human-id'), 'Puppy #vanGogh');
  });

  test('It returns a human readable identifier for a new record', async function(assert) {
    let newPuppy = await this.store.createRecord('puppy');
    let dataService = this.owner.lookup('service:cardstackData');
    assert.equal(dataService.getCardMeta(newPuppy, 'human-id'), 'New puppy');
  });

  test('It returns type/id when asked for a unique id', async function(assert) {
    let vanGogh = await this.store.findRecord('puppy', 'vanGogh');
    let dataService = this.owner.lookup('service:cardstackData');
    assert.equal(dataService.getCardMeta(vanGogh, 'uid'), 'puppy/vanGogh');
  });
});
