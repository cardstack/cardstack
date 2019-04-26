
const JSONAPIFactory = require('../../../tests/stub-searcher/node_modules/@cardstack/test-support/jsonapi-factory');
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
        let factory = new JSONAPIFactory();

        // TODO should we still require that you specifically set a card package as a data source type in order to activate it?
        factory.addResource('data-sources').withAttributes({ 'source-type': 'person-card' });
        factory.addResource('data-sources').withAttributes({ 'source-type': 'article-card' });

        env = await createDefaultEnvironment(`${__dirname}/../../../tests/stub-cards/valid-cards`, factory.getModels());
        searchers = env.lookup('hub:searchers');

        let schema = await searchers.get(env.session, 'local-hub', 'card-definitions', 'local-hub::person-card');
        expect(schema.data.relationships.model.data).to.eql({ type: 'content-types', id: 'local-hub::person-card::people' });

        schema = await searchers.get(env.session, 'local-hub', 'content-types', 'local-hub::person-card::people');
        expect(schema.data.attributes).to.eql({ 'name': 'people' });
        expect(schema.data.relationships.fields.data).to.eql([
          { type: 'fields', id: 'local-hub::person-card::name' },
          { type: 'fields', id: 'local-hub::person-card::password' },
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
        expect(schema.data.attributes).to.eql({ 'name': 'articles' });
        expect(schema.data.relationships.fields.data).to.eql([
          { type: 'fields', id: 'local-hub::article-card::title' },
          { type: 'fields', id: 'local-hub::article-card::body' },
          { type: 'fields', id: 'local-hub::article-card::categories' },
          { type: 'fields', id: 'local-hub::article-card::author' },
        ]);

        schema = await searchers.get(env.session, 'local-hub', 'content-types', 'local-hub::article-card::categories');
        expect(schema.data.attributes).to.eql({ 'name': 'categories' });
        expect(schema.data.relationships).to.be.notOk;

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
        let factory = new JSONAPIFactory();
        factory.addResource('data-sources').withAttributes({ 'source-type': 'person-card' });
        factory.addResource('data-sources').withAttributes({ 'source-type': 'article-card' });

        env = await createDefaultEnvironment(`${__dirname}/../../../tests/stub-cards/valid-cards`, factory.getModels());
        searchers = env.lookup('hub:searchers');

        let schema = await searchers.get(env.session, 'local-hub', 'fields', 'local-hub::article-card::author');
        expect(schema.data.relationships['related-types'].data).to.eql([
          { type: 'content-types', id: 'cards' }
        ]);
      });

      it(`allows for a content-type's field to specify a related-types that refer to a content-type within the card schema`, async function () {
        let factory = new JSONAPIFactory();
        factory.addResource('data-sources').withAttributes({ 'source-type': 'person-card' });
        factory.addResource('data-sources').withAttributes({ 'source-type': 'article-card' });

        env = await createDefaultEnvironment(`${__dirname}/../../../tests/stub-cards/valid-cards`, factory.getModels());
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

      it('throws when card schema create non-schema models', async function () {
        let factory = new JSONAPIFactory();
        factory.addResource('data-sources').withAttributes({ 'source-type': 'person-card' });

        let error;
        try {
          await createDefaultEnvironment(`${__dirname}/../../../tests/stub-cards/non-schema-models-in-schema-file`, factory.getModels());
        } catch (e) {
          error = e;
        }

        expect(error.message).to.match(/Non-schema models are not allowed in schemas/);
      });

      it('throws when card schema models are not scoped to the source and package that they originate from (which can happen when JSONAPIFactory is not given source and package context)', async function () {
        let factory = new JSONAPIFactory();
        factory.addResource('data-sources').withAttributes({ 'source-type': 'person-card' });

        let error;
        try {
          await createDefaultEnvironment(`${__dirname}/../../../tests/stub-cards/jsonapi-factory-missing-card-context`, factory.getModels());
        } catch (e) {
          error = e;
        }

        expect(error.message).to.match(/has schema models that are not scoped to this data source and package/);
      });

      it('throws when card-defintions id does not match source::package of the schema file name', async function () {
        let factory = new JSONAPIFactory();
        factory.addResource('data-sources').withAttributes({ 'source-type': 'person-card' });

        let error;
        try {
          await createDefaultEnvironment(`${__dirname}/../../../tests/stub-cards/card-definition-id-does-not-match-package-name`, factory.getModels());
        } catch (e) {
          error = e;
        }

        expect(error.message).to.match(/that is not scoped for this source::package/);
      });

      it('throws when there are mulitple card definitions in schema file', async function () {
        let factory = new JSONAPIFactory();
        factory.addResource('data-sources').withAttributes({ 'source-type': 'person-card' });

        let error;
        try {
          await createDefaultEnvironment(`${__dirname}/../../../tests/stub-cards/multiple-card-definitions-in-same-schema-file`, factory.getModels());
        } catch (e) {
          error = e;
        }

        expect(error.message).to.match(/has more than one card-definitions model/);
      });

      it('throws when there are no card definitions in schema file', async function () {
        let factory = new JSONAPIFactory();
        factory.addResource('data-sources').withAttributes({ 'source-type': 'person-card' });

        let error;
        try {
          await createDefaultEnvironment(`${__dirname}/../../../tests/stub-cards/no-card-definitions-in-schema-file`, factory.getModels());
        } catch (e) {
          error = e;
        }

        expect(error.message).to.match(/has no card-definitions model/);
      });

      it('throws when content type defined in the card schema uses a field not contained within the card schema', async function () {
        let factory = new JSONAPIFactory();
        factory.addResource('data-sources').withAttributes({ 'source-type': 'person-card' });
        factory.addResource('data-sources').withAttributes({ 'source-type': 'article-card' });

        let error;
        try {
          await createDefaultEnvironment(`${__dirname}/../../../tests/stub-cards/content-type-uses-foreign-field`, factory.getModels());
        } catch (e) {
          error = e;
        }

        expect(error.message).to.match(/refers to field defined in foreign schema/);
      });

      it(`throws when a content-type's field's related-types refers to a content-type that comes from a different card schema`, async function () {
        let factory = new JSONAPIFactory();
        factory.addResource('data-sources').withAttributes({ 'source-type': 'person-card' });
        factory.addResource('data-sources').withAttributes({ 'source-type': 'article-card' });

        let error;
        try {
          await createDefaultEnvironment(`${__dirname}/../../../tests/stub-cards/field-uses-related-types-with-foreign-content-type`, factory.getModels());
        } catch (e) {
          error = e;
        }

        expect(error.message).to.match(/has a related type that refers to a content type defined in a foreign schema/);
      });
    });
  });
});