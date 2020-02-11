import { module, test, skip } from 'qunit';
import Fixtures from '@cardstack/test-support/fixtures';
import { setupRenderingTest } from 'ember-qunit';
import { render, triggerEvent } from '@ember/test-helpers';
import hbs from 'htmlbars-inline-precompile';

const card1Id = 'millenial-puppies';
const eventCardTemplate = 'event-card';
const birthdayCard = '@burcu/birthday-card';
const qualifiedCard1Id = `local-hub::${card1Id}`;
const qualifiedEventCard = `local-hub::${eventCardTemplate}`;
const qualifiedBirthday = `local-hub::${birthdayCard}`;

const scenario = new Fixtures({
  create(factory) {
    factory.addResource('data-sources', 'mock-auth').withAttributes({
      sourceType: '@cardstack/mock-auth',
      mayCreateUser: true,
      params: {
        users: {
          'sample-user': { verified: true },
        },
      },
    });
    factory
      .addResource('grants')
      .withAttributes({
        mayWriteFields: true,
        mayReadFields: true,
        mayCreateResource: true,
        mayReadResource: true,
        mayUpdateResource: true,
        mayDeleteResource: true,
        mayLogin: true,
      })
      .withRelated('who', [{ type: 'mock-users', id: 'sample-user' }]);
  },

  destroy() {
    return [
      { type: 'cards', id: qualifiedBirthday },
      { type: 'cards', id: qualifiedEventCard },
      { type: 'cards', id: qualifiedCard1Id },
    ];
  },
});

module('Integration | Component | card-renderer', function(hooks) {
  setupRenderingTest(hooks);
  scenario.setupTest(hooks);

  hooks.beforeEach(async function() {
    await this.owner
      .lookup('service:mock-login')
      .get('login')
      .perform('sample-user');
  });

  test('it renders embedded card', async function(assert) {
    let service = this.owner.lookup('service:data');
    let card = service.createCard(qualifiedCard1Id);
    card.addField({
      name: 'title',
      type: '@cardstack/core-types::string',
      neededWhenEmbedded: true,
      value: 'test title',
    });
    card.addField({
      name: 'author',
      type: '@cardstack/core-types::string',
      neededWhenEmbedded: true,
      value: 'test author',
    });
    card.addField({
      name: 'body',
      type: '@cardstack/core-types::string',
      neededWhenEmbedded: false,
      value: 'test body',
    });
    this.set('card', card);

    await render(hbs`
      <CardRenderer
        @card={{card}}
        @format="embedded"
        @mode="view"
      />
    `);

    assert.dom(`[data-test-embedded-card="${card1Id}"]`).exists();
    assert.deepEqual(
      [...this.element.querySelectorAll('[data-test-field]')].map(i => i.getAttribute('data-test-field')),
      ['title', 'author']
    );
    assert.dom(`[data-test-card-renderer-embedded]`).hasClass('card-renderer-embedded');
    assert.dom(`[data-test-embedded-card="${card1Id}"]`).hasClass('cardstack_base-card-embedded');
    assert.dom(`[data-test-embedded-card="${card1Id}"]`).hasClass(`${card1Id}-embedded`);
  });

  test('it renders isolated card', async function(assert) {
    let service = this.owner.lookup('service:data');
    let card = service.createCard(qualifiedCard1Id);
    card.addField({
      name: 'title',
      type: '@cardstack/core-types::string',
      neededWhenEmbedded: true,
      value: 'test title',
    });
    card.addField({
      name: 'author',
      type: '@cardstack/core-types::string',
      neededWhenEmbedded: true,
      value: 'test author',
    });
    card.addField({
      name: 'body',
      type: '@cardstack/core-types::string',
      neededWhenEmbedded: false,
      value: 'test body',
    });
    this.set('card', card);

    await render(hbs`
      <CardRenderer
        @card={{card}}
        @format="isolated"
        @mode="view"
      />
    `);

    assert.dom(`[data-test-isolated-card="${card1Id}"]`).exists();
    assert.deepEqual(
      [...this.element.querySelectorAll('[data-test-field]')].map(i => i.getAttribute('data-test-field')),
      ['title', 'author', 'body']
    );
    assert.dom(`[data-test-card-renderer-isolated]`).hasClass('card-renderer-isolated');
    assert.dom(`[data-test-isolated-card="${card1Id}"].isolated-card.cardstack_base-card-isolated`).exists();
    assert.dom(`[data-test-isolated-card="${card1Id}"]`).hasClass(`${card1Id}-isolated`);
  });

  test('it renders an isolated card that adopts from another card', async function(assert) {
    let service = this.owner.lookup('service:data');
    let parent = service.createCard(qualifiedEventCard);
    await parent.save();
    let child = service.createCard(qualifiedBirthday, parent);
    this.set('card', child);

    await render(hbs`
      <CardRenderer
        @card={{card}}
        @format="isolated"
        @mode="view"
      />
    `);

    assert.dom(`[data-test-card-renderer-isolated]`).hasClass('event-card');
    assert.dom(`[data-test-card-renderer-isolated]`).hasClass('burcu-birthday-card');
    assert.dom(`[data-test-isolated-card]`).hasClass(`event-card-isolated`);
    assert.dom(`[data-test-isolated-card]`).hasClass(`burcu-birthday-card-isolated`);
  });

  test('it renders an embedded card that adopts from another card', async function(assert) {
    let service = this.owner.lookup('service:data');
    let parent = service.createCard(qualifiedEventCard);
    await parent.save();
    let child = service.createCard(qualifiedBirthday, parent);
    this.set('card', child);

    await render(hbs`
      <CardRenderer
        @card={{card}}
        @format="embedded"
        @mode="view"
      />
    `);

    assert.dom(`[data-test-card-renderer-embedded]`).hasClass('event-card');
    assert.dom(`[data-test-card-renderer-embedded]`).hasClass('burcu-birthday-card');
    assert.dom(`[data-test-embedded-card]`).hasClass(`event-card-embedded`);
    assert.dom(`[data-test-embedded-card]`).hasClass(`burcu-birthday-card-embedded`);
  });

  test('embedded card is wrapped with a link in view mode', async function(assert) {
    let service = this.owner.lookup('service:data');
    let card = service.createCard(qualifiedCard1Id);
    this.set('card', card);

    await render(hbs`
      <CardRenderer
        @card={{card}}
        @format="embedded"
        @mode="view"
      />
    `);
    assert.dom('[data-test-card-renderer-embedded]').exists();
    assert.dom(`.card-renderer--embedded-card-link`).exists();
    assert.dom(`[data-test-embedded-card=${card1Id}]`).exists();
  });

  test('it can render an embedded card without the ability to isolate it', async function(assert) {
    let service = this.owner.lookup('service:data');
    let card = service.createCard(qualifiedCard1Id);
    this.set('card', card);

    await render(hbs`
      <CardRenderer
        @card={{card}}
        @format="embedded"
        @preventIsolation={{true}}
        @mode="view"
      />
    `);
    assert.dom('[data-test-card-renderer-embedded]').exists();
    assert.dom(`.card-renderer--embedded-card-link`).doesNotExist();
    assert.dom(`[data-test-embedded-card=${card1Id}]`).exists();
  });

  test('embedded card does not have a link to isolated card route in edit mode', async function(assert) {
    let service = this.owner.lookup('service:data');
    let card = service.createCard(qualifiedCard1Id);
    this.set('card', card);

    await render(hbs`
      <CardRenderer
        @card={{card}}
        @format="embedded"
        @mode="edit"
      />
    `);
    assert.dom(`[data-test-card-renderer-embedded]`).exists();
    assert.dom(`.card-renderer--embedded-card-link`).doesNotExist();
    assert.dom(`[data-test-embedded-card=${card1Id}]`).exists();
  });

  test('embedded card does not have a link to isolated card route in schema mode', async function(assert) {
    let service = this.owner.lookup('service:data');
    let card = service.createCard(qualifiedCard1Id);
    this.set('card', card);

    await render(hbs`
      <CardRenderer
        @card={{card}}
        @format="embedded"
        @mode="schema"
      />
    `);
    assert.dom(`.card-renderer--embedded-card-link`).doesNotExist();
    assert.dom(`[data-test-embedded-card=${card1Id}]`).exists();
  });

  test('renders an isolated card in edit mode', async function(assert) {
    let service = this.owner.lookup('service:data');
    let card = service.createCard(qualifiedCard1Id);
    card.addField({
      name: 'title',
      type: '@cardstack/core-types::string',
      neededWhenEmbedded: true,
      value: 'test title',
    });
    card.addField({
      name: 'author',
      type: '@cardstack/core-types::string',
      neededWhenEmbedded: true,
      value: 'test author',
    });
    card.addField({
      name: 'body',
      type: '@cardstack/core-types::string',
      neededWhenEmbedded: false,
      value: 'test body',
    });
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
    assert.deepEqual(
      [...this.element.querySelectorAll('[data-test-field]')].map(i => i.getAttribute('data-test-field')),
      ['title', 'author', 'body']
    );
  });

  test('renders an embedded card in edit mode', async function(assert) {
    let service = this.owner.lookup('service:data');
    let card = service.createCard(qualifiedCard1Id);
    card.addField({
      name: 'title',
      type: '@cardstack/core-types::string',
      neededWhenEmbedded: true,
      value: 'test title',
    });
    card.addField({
      name: 'author',
      type: '@cardstack/core-types::string',
      neededWhenEmbedded: true,
      value: 'test author',
    });
    card.addField({
      name: 'body',
      type: '@cardstack/core-types::string',
      neededWhenEmbedded: false,
      value: 'test body',
    });
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
    assert.deepEqual(
      [...this.element.querySelectorAll('[data-test-field]')].map(i => i.getAttribute('data-test-field')),
      ['title', 'author']
    );
  });

  test('renders an isolated card in schema mode', async function(assert) {
    let service = this.owner.lookup('service:data');
    let card = service.createCard(qualifiedCard1Id);
    card.addField({
      name: 'title',
      type: '@cardstack/core-types::string',
      neededWhenEmbedded: true,
      value: 'test title',
    });
    card.addField({
      name: 'author',
      type: '@cardstack/core-types::string',
      neededWhenEmbedded: true,
      value: 'test author',
    });
    card.addField({
      name: 'body',
      type: '@cardstack/core-types::string',
      neededWhenEmbedded: false,
      value: 'test body',
    });
    this.set('card', card);
    this.set('noop', () => {});

    await render(hbs`
      <CardRenderer
        @card={{card}}
        @format="isolated"
        @dropField={{action noop}}
        @setFieldName={{action noop}}
        @mode="schema"
      />
    `);

    assert.dom(`[data-test-isolated-card-mode="schema"]`).exists();
    assert.dom('[data-test-field-renderer-type]').exists({ count: 3 });
    assert.deepEqual(
      [...this.element.querySelectorAll('[data-test-field]')].map(i => i.getAttribute('data-test-field')),
      ['title', 'author', 'body']
    );
    assert.dom('[data-test-drop-zone="3"]').exists();
  });

  test('renders an isolated card with a drop zone when no fields exist', async function(assert) {
    assert.expect(3);
    let service = this.owner.lookup('service:data');
    let card = service.createCard(qualifiedCard1Id);
    this.set('card', card);
    this.set('noop', () => {});
    this.set('dropField', (position, callback) => {
      assert.equal(position, 0);
      assert.equal(typeof callback, 'function');
    });

    await render(hbs`
      <CardRenderer
        @card={{card}}
        @format="isolated"
        @dropField={{action dropField}}
        @setFieldName={{action noop}}
        @mode="schema"
      />
    `);

    assert.dom('[data-test-drop-zone="0"]').exists();
    await triggerEvent(`[data-test-drop-zone="0"]`, 'drop');
  });

  test('renders an embedded card in schema mode', async function(assert) {
    let service = this.owner.lookup('service:data');
    let card = service.createCard(qualifiedCard1Id);
    card.addField({
      name: 'title',
      type: '@cardstack/core-types::string',
      neededWhenEmbedded: true,
      value: 'test title',
    });
    card.addField({
      name: 'author',
      type: '@cardstack/core-types::string',
      neededWhenEmbedded: true,
      value: 'test author',
    });
    card.addField({
      name: 'body',
      type: '@cardstack/core-types::string',
      neededWhenEmbedded: false,
      value: 'test body',
    });
    this.set('card', card);
    this.set('noop', () => {});

    await render(hbs`
      <CardRenderer
        @card={{card}}
        @format="embedded"
        @mode="schema"
        @dropField={{action noop}}
      />
    `);

    assert.dom(`[data-test-embedded-card-mode="schema"]`).exists();
    assert.dom(`input`).doesNotExist();
    assert.deepEqual(
      [...this.element.querySelectorAll('[data-test-field]')].map(i => i.getAttribute('data-test-field')),
      ['title', 'author']
    );
  });

  test("it can render an embedded card with the card's name", async function(assert) {
    let service = this.owner.lookup('service:data');
    let card = service.createCard(qualifiedCard1Id);
    this.set('card', card);

    await render(hbs`
      <CardRenderer
        @card={{card}}
        @format="embedded"
        @mode="view"
        @showName={{true}}
        />
      `);
    assert.dom('.embedded-card-label').hasText(card1Id);
  });

  test('isolated card can be selected', async function(assert) {
    let service = this.owner.lookup('service:data');
    let card = service.createCard(qualifiedCard1Id);
    card.isSelected = true;
    this.set('card', card);

    await render(hbs`
      <CardRenderer
        @card={{card}}
        @cardSelected={{cardSelected}}
        @format="isolated"
      />
    `);

    assert.dom('[data-test-card-renderer-isolated]').hasClass('selected');
  });

  test('isolated card cannot be selected if not logged in', async function(assert) {
    let service = this.owner.lookup('service:data');
    let session = this.owner.lookup('service:session');
    await session.invalidate();
    let card = service.createCard(qualifiedCard1Id);
    card.isSelected = true;
    this.set('card', card);

    await render(hbs`
      <CardRenderer
        @card={{card}}
        @format="isolated"
      />
    `);

    assert.dom('[data-test-card-renderer-isolated]').hasNoClass('selected');
  });

  test('display message if no @card attribute', async function(assert) {
    await render(hbs`
      <CardRenderer
        @format="isolated"
        @cardSelected={{true}}
      />
    `);
    assert.dom('[data-test-missing-card]').hasTextContaining('must specify a @card attribute');
  });

  skip('TODO it adds isolated css into the page when rendering an isolated card', async function(/*assert*/) {});

  skip('TODO it adds embedded css into the page when rendering an embedded card', async function(/*assert*/) {});

  skip("TODO it removes a card's isolated css when the isolated card is removed from the page", async function(/*assert*/) {});

  skip("TODO it does not remove a card's embedded css when an embedded card is removed from the page, but another instance of the embedded card still remains on teh page", async function(/*assert*/) {});

  skip("TODO it removes an embedded card's css when all instances of the embedded card are removed from the page", async function(/*assert*/) {});
});
