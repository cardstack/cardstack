const JSONAPIFactory = require('../../../tests/stub-project/node_modules/@cardstack/test-support/jsonapi-factory');
const bootstrapSchema = require('../bootstrap-schema');
const {
  createDefaultEnvironment,
  destroyDefaultEnvironment
} = require('../../../tests/stub-project/node_modules/@cardstack/test-support/env');

/**
 * see https://github.com/cardstack/deck/issues/250
 */
describe('unknown fields validation', function() {
  let env;

  beforeEach(async function() {
    let factory = new JSONAPIFactory();

    factory.importModels(bootstrapSchema);

    factory.addResource('content-types', 'articles')
      .withRelated('fields', [
        factory.addResource('fields', 'title')
          .withAttributes({ fieldType: '@cardstack/core-types::string' }),
      ]);

    factory.addResource('fields', 'header')
      .withAttributes({ fieldType: '@cardstack/core-types::string' });

    env = await createDefaultEnvironment(`${__dirname}/../../../tests/sample-computed-fields`, factory.getModels());
  });

  afterEach(async function() {
    await destroyDefaultEnvironment(env);
  });

  it('backend has new field, request has new field', async function () {
    await changeArticleField();
    let model = await createArticle({ header: 'foo' });

    await updateArticle(model.data.id, { header: 'bar' });

    let article = await readArticle(model.data.id);
    expect(article.data.attributes).to.have.property('header', 'bar');
  });

  it('backend has new field, request has old field', async function () {
    await changeArticleField();
    let model = await createArticle({ header: 'foo' });

    await expect(updateArticle(model.data.id, { title: 'bar' }))
      .to.be.rejectedWith('type "articles" has no field named "title"');
  });

  it('backend has old field, request has new field', async function () {
    let model = await createArticle({ title: 'foo' });
    await changeArticleField();

    await updateArticle(model.data.id, { header: 'bar' });

    let article = await readArticle(model.data.id);
    expect(article.data.attributes).to.have.property('header', 'bar');
  });

  // This is an artificial test case that should never actually happen in the app
  // as the JSONAPI will only return fields that are included in the schema
  it.skip('backend has old field, request has old field', async function () {
    let model = await createArticle({ title: 'foo' });
    await changeArticleField();

    await expect(updateArticle(model.data.id, { title: 'bar' }))
      .to.be.rejectedWith('type "articles" has no field named "title"');
  });

  /**
   * Changes the `articles` content type from having a `title` field to having a `header` field.
   */
  async function changeArticleField() {
    let articleContentType = await env.lookup('hub:searchers').getCard(env.session, 'content-types', 'articles');

    await env.lookup('hub:writers').update('master', env.session, 'content-types', 'articles', {
      data: {
        type: 'content-types',
        meta: {
          version: articleContentType.data.meta.version
        },
        relationships: {
          fields: {data: [{type: 'fields', id: 'header'}]},
        },
      }
    });
  }

  async function createArticle(attributes) {
    return await env.lookup('hub:writers').create('master', env.session, 'articles', {
      data: {
        type: 'articles',
        attributes
      }
    });
  }

  async function readArticle(id) {
    return await env.lookup('hub:searchers').getCard(env.session, 'articles', id);
  }

  async function updateArticle(id, attributes) {
    let article = await readArticle(id);

    await env.lookup('hub:writers').update('master', env.session, 'articles', id, {
      data: {
        type: 'articles',
        meta: {
          version: article.data.meta.version,
        },
        attributes,
      },
    });
  }
});
