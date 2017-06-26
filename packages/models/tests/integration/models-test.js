import { moduleForComponent, test } from 'ember-qunit';
import Fixtures from '@cardstack/test-support/fixtures';
import RSVP from 'rsvp';

moduleForComponent('models', 'Integration | Models', {
  integration: true,
  beforeEach: async function() {
    this.inject.service('store');
    await scenario.setup();
  }
});

let scenario = new Fixtures(factory => {
  factory.addResource('content-types', 'posts')
    .withRelated('fields', [
      factory.addResource('fields', 'title').withAttributes({
        fieldType: '@cardstack/core-types::string'
      })
    ]);
  factory.addResource('posts', '1')
    .withAttributes({
      title: 'hello world'
    });
  factory.addResource('posts', '2')
    .withAttributes({
      title: 'second'
    });
});

test('it can findRecord', runloop(async function(assert) {
  let model = await this.store.findRecord('post', '1');
  assert.equal(model.get('title'), 'hello world');
}));

test('it can findAll', runloop(async function(assert) {
  let models = await this.store.findAll('post');
  assert.equal(models.get('length'), 2);
}));

// TODO: this weird extra layer is needed to keep our async method
// inside Ember runloops. Make it go away.
function runloop(fn) {
  return function (){
    return RSVP.resolve().then(() => fn.apply(this, arguments));
  }
}
