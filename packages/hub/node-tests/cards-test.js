
const {
  createDefaultEnvironment,
  destroyDefaultEnvironment
} = require('../../../tests/stub-searcher/node_modules/@cardstack/test-support/env');

describe('hub/cards', function () {
  let env;

  async function teardown() {
    if (env) {
      await destroyDefaultEnvironment(env);
    }
  }

  describe('card schema', function () {
    let searchers;

    describe('valid schema scenarios', function () {
      afterEach(teardown);

      it('can define a card schema', async function () {
        env = await createDefaultEnvironment(`${__dirname}/../../../tests/stub-cards/valid-cards`);
        searchers = env.lookup('hub:searchers');

        let schema = await searchers.get(env.session, 'local-hub', 'card-definitions', 'local-hub::person-card');
        expect(schema.data.relationships.model.data).to.eql({ type: 'content-types', id: 'local-hub::person-card::people' });

        schema = await searchers.get(env.session, 'local-hub', 'content-types', 'local-hub::person-card::people');
        expect(schema.data.attributes).to.eql({
          'default-includes': ['card-context'],
          'name': 'people'
        });
        expect(schema.data.relationships.fields.data).to.eql([
          { type: 'fields', id: 'local-hub::person-card::name' },
          { type: 'fields', id: 'local-hub::person-card::password' },
          { type: 'computed-fields', id: 'card-context' },
        ]);

        schema = await searchers.get(env.session, 'local-hub', 'fields', 'local-hub::person-card::name');
        expect(schema.data.attributes).to.eql({
          'name': 'name',
          'is-metadata': true,
          'needed-when-embedded': true,
          'field-type': '@cardstack/core-types::string'
        });

        schema = await searchers.get(env.session, 'local-hub', 'fields', 'local-hub::person-card::password');
        expect(schema.data.attributes).to.eql({
          'name': 'password',
          'field-type': '@cardstack/core-types::string'
        });

        schema = await searchers.get(env.session, 'local-hub', 'card-definitions', 'local-hub::article-card');
        expect(schema.data.relationships.model.data).to.eql({ type: 'content-types', id: 'local-hub::article-card::articles' });

        schema = await searchers.get(env.session, 'local-hub', 'content-types', 'local-hub::article-card::articles');
        expect(schema.data.attributes).to.eql({
          'default-includes': ['card-context'],
          'name': 'articles'
        });
        expect(schema.data.relationships.fields.data).to.eql([
          { type: 'fields', id: 'local-hub::article-card::title' },
          { type: 'fields', id: 'local-hub::article-card::body' },
          { type: 'fields', id: 'local-hub::article-card::categories' },
          { type: 'fields', id: 'local-hub::article-card::author' },
          { type: 'computed-fields', id: 'card-context' },
        ]);

        schema = await searchers.get(env.session, 'local-hub', 'content-types', 'local-hub::article-card::categories');
        expect(schema.data.attributes).to.eql({
          'default-includes': ['card-context'],
          'name': 'categories'
        });
        expect(schema.data.relationships.fields.data).to.eql([
          { type: 'computed-fields', id: 'card-context' },
        ]);

        schema = await searchers.get(env.session, 'local-hub', 'fields', 'local-hub::article-card::title');
        expect(schema.data.attributes).to.eql({
          'name': 'title',
          'is-metadata': true,
          'needed-when-embedded': true,
          'placeholder': 'Placeholder Title',
          'instructions': 'Choose a title that evokes feelings of harmony',
          'field-type': '@cardstack/core-types::string'
        });
        expect(schema.data.relationships.constraints.data).to.be.ok;
        let constraintId = schema.data.relationships.constraints.data[0].id;
        expect(constraintId).to.match(/^local-hub::article-card::/);

        schema = await searchers.get(env.session, 'local-hub', 'constraints', constraintId);
        expect(schema.data.attributes['error-message']).to.equal('The title must not be empty.');

        schema = await searchers.get(env.session, 'local-hub', 'fields', 'local-hub::article-card::body');
        expect(schema.data.attributes).to.eql({
          'name': 'body',
          'is-metadata': true,
          'field-type': '@cardstack/core-types::string'
        });

        schema = await searchers.get(env.session, 'local-hub', 'fields', 'local-hub::article-card::categories');
        expect(schema.data.attributes).to.eql({
          'name': 'categories',
          'is-metadata': true,
          'needed-when-embedded': true,
          'field-type': '@cardstack/core-types::has-many'
        });

        schema = await searchers.get(env.session, 'local-hub', 'fields', 'local-hub::article-card::author');
        expect(schema.data.attributes).to.eql({
          'name': 'author',
          'is-metadata': true,
          'needed-when-embedded': true,
          'field-type': '@cardstack/core-types::belongs-to'
        });
      });

      it(`allows for a content-type's field to specify a related-types that refer to another card`, async function () {
        env = await createDefaultEnvironment(`${__dirname}/../../../tests/stub-cards/valid-cards`);
        searchers = env.lookup('hub:searchers');

        let schema = await searchers.get(env.session, 'local-hub', 'fields', 'local-hub::article-card::author');
        expect(schema.data.relationships['related-types'].data).to.eql([
          { type: 'content-types', id: 'cards' }
        ]);
      });

      it(`allows for a content-type's field to specify a related-types that refer to a content-type within the card schema`, async function () {
        env = await createDefaultEnvironment(`${__dirname}/../../../tests/stub-cards/valid-cards`);
        searchers = env.lookup('hub:searchers');

        let schema = await searchers.get(env.session, 'local-hub', 'fields', 'local-hub::article-card::categories');
        expect(schema.data.relationships['related-types'].data).to.eql([
          { type: 'content-types', id: 'local-hub::article-card::categories'
         }
        ]);
      });
    });

    describe('invalid schema scenarios', function () {
      // no need to teardown() since env is never created in these scenarios

      it('throws when card schema does not return a card-definitions document', async function() {
        let error;
        try {
          await createDefaultEnvironment(`${__dirname}/../../../tests/stub-cards/schema-returns-non-card-definitions-document`);
        } catch (e) {
          error = e;
        }

        expect(error.message).to.match(/defines a schema document that is not of type 'card-definitions'/);
      });

      it('throws when content type defined in the card schema uses a field not contained within the card schema', async function () {
        let error;
        try {
          await createDefaultEnvironment(`${__dirname}/../../../tests/stub-cards/content-type-uses-foreign-field`);
        } catch (e) {
          error = e;
        }

        expect(error.message).to.match(/refers to field defined in foreign schema/);
      });

      it(`throws when a content-type's field's related-types refers to a content-type that comes from a different card schema`, async function () {
        let error;
        try {
          await createDefaultEnvironment(`${__dirname}/../../../tests/stub-cards/field-uses-related-types-with-foreign-content-type`);
        } catch (e) {
          error = e;
        }

        expect(error.message).to.match(/has a related type that refers to a content type defined in a foreign schema/);
      });
    });
  });

  describe('card read', function() {
    it.skip('get of card internal model includes card', async function() {
      // TODO (this test lives in the pgsearch indexer right now, it should be moved out...)
    });

    it.skip('honors default-metadata-includes set on card-definitions when retreiving a card (probably need to split think into a bunch of tests)', async function() {
    });

    describe ('card metadata', function() {
    });
  });

  describe('card write', function() {
    it.skip('does not allow card models to reference foreign models', async function() {
      // TODO
    });
    it.skip('does not allow card to expose internal model as a has-many relationship in metadata', async function() {
      // TODO
    });
    it.skip('does not allow card to expose internal model as a belongs-to relationship in metadata', async function() {
      // TODO
    });
    it.skip('TODO cannot create an internal card model that is not the primary card model before the card instance exists', async function () {
    });
  });
});