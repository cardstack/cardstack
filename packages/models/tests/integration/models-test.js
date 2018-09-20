import { module, test } from 'qunit';
import { setupTest } from 'ember-qunit';
import '@ember/test-helpers';
import Fixtures from '@cardstack/test-support/fixtures';
import RSVP from 'rsvp';

module('Integration | Models', function(hooks) {
  setupTest(hooks);

  let scenario = new Fixtures({
    create(factory) {
      factory.addResource('content-types', 'posts')
        .withRelated('fields', [
          factory.addResource('fields', 'title').withAttributes({
            fieldType: '@cardstack/core-types::string',
            caption: 'Fancy Title',
            editorComponent: 'fancy-title-editor',
            inlineEditorComponent: 'fancy-title-inline-editor',
            editorOptions: { style: 'extra-fancy' },
            inlineEditorOptions: { style: 'extra-fancy-inline' }
          }),
          factory.addResource('fields', 'author').withAttributes({
            fieldType: '@cardstack/core-types::belongs-to'
          }).withRelated('related-types', [
            factory.addResource('content-types', 'authors').withRelated('fields', [
              factory.addResource('fields', 'name').withAttributes({
                fieldType: '@cardstack/core-types::string'
              })
            ])
          ])
        ]);
      factory.addResource('posts', '1')
        .withAttributes({
          title: 'hello world'
        });
      factory.addResource('posts', '2')
        .withAttributes({
          title: 'second'
        }).withRelated(
          'author',
          factory.addResource('authors').withAttributes({ name: 'Author of Second' })
        );
      factory.addResource('content-types', 'pages')
        .withAttributes({
          routingField: 'permalink'
        })
        .withRelated('fields', [
          factory.addResource('fields', 'permalink').withAttributes({
            fieldType: '@cardstack/core-types::string'
          })
        ]);


      factory.addResource('data-sources', 'mock-auth').
        withAttributes({
          sourceType: '@cardstack/mock-auth',
          mayCreateUser: true,
          params: {
            users: {
              // TODO: we only need `verified` because the mock-auth
              // module is unnecessarily specialized. We should
              // simplify it down to a very barebones user so this can
              // just say `'sample-user': { }`.
              'sample-user': { verified: true }
            }
          }
        })
      factory.addResource('grants')
        .withAttributes({
          mayWriteFields: true,
          mayReadFields: true,
          mayCreateResource: true,
          mayReadResource: true,
          mayUpdateResource: true,
          mayDeleteResource: true,
          mayLogin: true
        })
        .withRelated('who', [{ type: 'mock-users', id: 'sample-user' }]);
    },

    destroy() {
      return [{
        type: 'posts'
      },{
        type: 'pages'
      },{
        type: 'authors'
      }];
    }
  });

  scenario.setupTest(hooks);

  hooks.beforeEach(async function() {
    await this.owner.lookup('service:cardstack-codegen').refreshCode();
    await this.owner.lookup('service:mock-login').get('login').perform('sample-user');
    this.store = this.owner.lookup('service:store');
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

  test('it can delete', async function(assert) {
    let model = await run(() => this.store.findRecord('post', '1'));
    await run(() => model.destroyRecord());

    let notFound = false;
    try {
      await run(() => this.store.queryRecord('post', { filter: { title: 'world' }}));
    } catch (err) {
      notFound = err.errors[0].code === 404;
    }

    assert.ok(notFound, 'the deleted record could not be found');
  });

  test('it can get a belongs-to relationship', async function(assert) {
    let post = await run(() => this.store.findRecord('post', '2', { include: 'author' }));
    let author = await run(() => post.get('author'));
    assert.equal(author.get('name'), 'Author of Second');
  });

  test('it sets no routingField by default', async function(assert) {
    let model = await run(() => this.store.createRecord('post'));
    assert.ok(!model.constructor.routingField);
  });

  test('it sets routingField when configured', async function(assert) {
    let model = await run(() => this.store.createRecord('page'));
    assert.equal(model.constructor.routingField, 'permalink');
  });

  test('it reflects configured field caption', async function(assert) {
    let model = await run(() => this.store.createRecord('post'));
    assert.equal(model.constructor.metaForProperty('title').options.caption, 'Fancy Title');
  });

  test('it reflects default field caption', async function(assert) {
    let model = await run(() => this.store.createRecord('post'));
    assert.equal(model.constructor.metaForProperty('author').options.caption, 'Author');
  });

  test('it reflects configured editor', async function(assert) {
    let model = await run(() => this.store.createRecord('post'));
    assert.equal(model.constructor.metaForProperty('title').options.editorComponent, 'fancy-title-editor');
  });

  test('it reflects configured inline editor', async function(assert) {
    let model = await run(() => this.store.createRecord('post'));
    assert.equal(model.constructor.metaForProperty('title').options.inlineEditorComponent, 'fancy-title-inline-editor');
  });

  test('it reflects configured editor options', async function(assert) {
    let model = await run(() => this.store.createRecord('post'));
    assert.deepEqual(model.constructor.metaForProperty('title').options.editorOptions, { style: 'extra-fancy' });
  });

  test('it reflects configured inline editor options', async function(assert) {
    let model = await run(() => this.store.createRecord('post'));
    assert.deepEqual(model.constructor.metaForProperty('title').options.inlineEditorOptions, { style: 'extra-fancy-inline' });
  });

  // Ember runloop.
  function run(fn) {
    return RSVP.resolve().then(() => fn.apply(this, arguments));
  }
});
