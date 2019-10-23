import { module, test } from 'qunit';
import Fixtures from '@cardstack/test-support/fixtures'
import { setupRenderingTest } from 'ember-qunit';
import { render } from '@ember/test-helpers';
import hbs from 'htmlbars-inline-precompile';

const card1Id = 'local-hub::article-card::millenial-puppies';

const scenario = new Fixtures({
  create(factory) {
    factory.addResource('data-sources', 'mock-auth').
      withAttributes({
        sourceType: '@cardstack/mock-auth',
        mayCreateUser: true,
        params: {
          users: {
            'sample-user': { verified: true }
          }
        }
      });
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
    return [
      { type: 'cards', id: card1Id },
    ];
  }
});

module('Integration | Component | card-renderer', function(hooks) {
  setupRenderingTest(hooks);
  scenario.setupTest(hooks);

  hooks.beforeEach(async function () {
    await this.owner.lookup('service:mock-login').get('login').perform('sample-user');
  });

  test('it renders embedded card', async function(assert) {
    let service = this.owner.lookup('service:data');
    let card = service.createCard(card1Id);
    card.addField({ name: 'title', type: '@cardstack/core-types::string', neededWhenEmbedded: true, value: 'test title' });
    card.addField({ name: 'author', type: '@cardstack/core-types::string', neededWhenEmbedded: true, value: 'test author' });
    card.addField({ name: 'body', type: '@cardstack/core-types::string', neededWhenEmbedded: false, value: 'test body' });
    this.set('card', card);

    await render(hbs`
      <CardRenderer
        @card={{card}}
        @format="embedded"
        @mode="view"
      />
    `);

    assert.dom(`[data-test-embedded-card="${card1Id}"]`).exists();
    assert.deepEqual([...this.element.querySelectorAll('[data-test-field]')].map(i => i.getAttribute('data-test-field')),
      ['title', 'author']);
  });

  test('it renders isolated card', async function(assert) {
    let service = this.owner.lookup('service:data');
    let card = service.createCard(card1Id);
    card.addField({ name: 'title', type: '@cardstack/core-types::string', neededWhenEmbedded: true, value: 'test title' });
    card.addField({ name: 'author', type: '@cardstack/core-types::string', neededWhenEmbedded: true, value: 'test author' });
    card.addField({ name: 'body', type: '@cardstack/core-types::string', neededWhenEmbedded: false, value: 'test body' });
    this.set('card', card);

    await render(hbs`
      <CardRenderer
        @card={{card}}
        @format="isolated"
        @mode="view"
      />
    `);

    assert.dom(`[data-test-isolated-card="${card1Id}"]`).exists();
    assert.deepEqual([...this.element.querySelectorAll('[data-test-field]')].map(i => i.getAttribute('data-test-field')),
      ['title', 'author', 'body']);
  });

  test('embedded card is wrapped with a link in view mode', async function(assert) {
    let service = this.owner.lookup('service:data');
    let card = service.createCard(card1Id);
    this.set('card', card);

    await render(hbs`
      <CardRenderer
        @card={{card}}
        @format="embedded"
        @mode="view"
      />
    `);
    assert.dom(`.card-renderer--embedded-card-link`).exists();
  });

  test('embedded card does not have a link to isolated card route in edit mode', async function(assert) {
    let service = this.owner.lookup('service:data');
    let card = service.createCard(card1Id);
    this.set('card', card);

    await render(hbs`
      <CardRenderer
        @card={{card}}
        @format="embedded"
        @mode="edit"
      />
    `);
    assert.dom(`.card-renderer--embedded-card-link`).doesNotExist();
  });

  test('embedded card does not have a link to isolated card route in schema mode', async function(assert) {
    let service = this.owner.lookup('service:data');
    let card = service.createCard(card1Id);
    this.set('card', card);

    await render(hbs`
      <CardRenderer
        @card={{card}}
        @format="embedded"
        @mode="schema"
      />
    `);
    assert.dom(`.card-renderer--embedded-card-link`).doesNotExist();
  });

  test('renders an isolated card in edit mode', async function(assert) {
    let service = this.owner.lookup('service:data');
    let card = service.createCard(card1Id);
    card.addField({ name: 'title', type: '@cardstack/core-types::string', neededWhenEmbedded: true, value: 'test title' });
    card.addField({ name: 'author', type: '@cardstack/core-types::string', neededWhenEmbedded: true, value: 'test author' });
    card.addField({ name: 'body', type: '@cardstack/core-types::string', neededWhenEmbedded: false, value: 'test body' });
    this.set('card', card);

    await render(hbs`
      <CardRenderer
        @card={{card}}
        @format="isolated"
        @mode="edit"
      />
    `);

    assert.dom(`[data-test-isolated-card-mode="edit"]`).exists();
    assert.dom(`input`).exists({ count: 3 });
    assert.deepEqual([...this.element.querySelectorAll('[data-test-field]')].map(i => i.getAttribute('data-test-field')),
      ['title', 'author', 'body']);
  });

  test('renders an embedded card in edit mode', async function(assert) {
    let service = this.owner.lookup('service:data');
    let card = service.createCard(card1Id);
    card.addField({ name: 'title', type: '@cardstack/core-types::string', neededWhenEmbedded: true, value: 'test title' });
    card.addField({ name: 'author', type: '@cardstack/core-types::string', neededWhenEmbedded: true, value: 'test author' });
    card.addField({ name: 'body', type: '@cardstack/core-types::string', neededWhenEmbedded: false, value: 'test body' });
    this.set('card', card);

    await render(hbs`
      <CardRenderer
        @card={{card}}
        @format="embedded"
        @mode="edit"
      />
    `);

    assert.dom(`[data-test-embedded-card-mode="edit"]`).exists();
    assert.dom(`input`).exists({ count: 2 });
    assert.deepEqual([...this.element.querySelectorAll('[data-test-field]')].map(i => i.getAttribute('data-test-field')),
      ['title', 'author' ]);
  });

  test('renders an isolated card in schema mode', async function(assert) {
    let service = this.owner.lookup('service:data');
    let card = service.createCard(card1Id);
    card.addField({ name: 'title', type: '@cardstack/core-types::string', neededWhenEmbedded: true, value: 'test title' });
    card.addField({ name: 'author', type: '@cardstack/core-types::string', neededWhenEmbedded: true, value: 'test author' });
    card.addField({ name: 'body', type: '@cardstack/core-types::string', neededWhenEmbedded: false, value: 'test body' });
    this.set('card', card);
    this.set('noop', () => {});

    await render(hbs`
      <CardRenderer
        @card={{card}}
        @format="isolated"
        @setFieldName={{action noop}}
        @mode="schema"
      />
    `);

    assert.dom(`[data-test-isolated-card-mode="schema"]`).exists();
    assert.dom(`input[type="text"]`).exists({ count: 3 });
    assert.deepEqual([...this.element.querySelectorAll('[data-test-field]')].map(i => i.getAttribute('data-test-field')),
      ['title', 'author', 'body']);
  });

  test('renders an embedded card in schema mode', async function(assert) {
    let service = this.owner.lookup('service:data');
    let card = service.createCard(card1Id);
    card.addField({ name: 'title', type: '@cardstack/core-types::string', neededWhenEmbedded: true, value: 'test title' });
    card.addField({ name: 'author', type: '@cardstack/core-types::string', neededWhenEmbedded: true, value: 'test author' });
    card.addField({ name: 'body', type: '@cardstack/core-types::string', neededWhenEmbedded: false, value: 'test body' });
    this.set('card', card);

    await render(hbs`
      <CardRenderer
        @card={{card}}
        @format="embedded"
        @mode="schema"
      />
    `);

    assert.dom(`[data-test-embedded-card-mode="schema"]`).exists();
    assert.dom(`input`).doesNotExist();
    assert.deepEqual([...this.element.querySelectorAll('[data-test-field]')].map(i => i.getAttribute('data-test-field')),
      ['title', 'author' ]);
  });
});
