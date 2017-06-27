import { moduleForComponent, test, skip } from 'ember-qunit';
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

test('it can findRecord', async function(assert) {
  let model = await run(() => {
    return this.store.findRecord('post', '1');
  });
  assert.equal(model.get('title'), 'hello world');
});

test('it can findAll', async function(assert) {
  let models = await run(
    () => this.store.findAll('post')
  );
  assert.equal(models.get('length'), 2);
});

test('it can query', async function(assert) {
  let models = await run(
    () => this.store.query('post', { filter: { title: 'world' } })
  );
  assert.equal(models.get('length'), 1);
  assert.equal(models.objectAt(0).get('id'), '1')
});

test('it can queryRecord', async function(assert) {
  let model = await run(
    () => this.store.queryRecord('post', { filter: { title: 'world' } })
  );
  assert.equal(model.get('id'), '1')
});

test('it can create', async function(assert) {
  let model;
  await run(() => {
    model = this.store.createRecord('post');
    model.set('title', 'New One');
    return model.save();
  });
  assert.ok(model.get('id'), 'has id');
  let models = await run(async () => {
    return this.store.query('post', { filter: { title: 'New' }});
  });
  assert.equal(models.get('length'), 1, "the newly created model should be immediately visible in search results");
});

test('it can update', async function(assert) {
  let model = await run(() => this.store.findRecord('post', '1'));
  await run(() => {
    model.set('title', 'Updated Title');
    return model.save();
  });

  let models = await run(async () => {
    return this.store.query('post', { filter: { title: 'Updated' }});
  });
  assert.equal(models.get('length'), 1, "the newly updated model should be immediately visible in search results");
});

skip('delete the post model, adapter, and serializer and rely on auto generation instead');


// Ember runloop.
function run(fn) {
  return RSVP.resolve().then(() => fn.apply(this, arguments));
}
