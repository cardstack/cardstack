const JSONAPIFactory = require('../../../tests/stub-project/node_modules/@cardstack/test-support/jsonapi-factory');
const {
  createDefaultEnvironment,
  destroyDefaultEnvironment
} = require('../../../tests/stub-project/node_modules/@cardstack/test-support/env');

const everyone = { type: 'groups', id: 'everyone' };

function createSchema(factory) {
  factory.addResource('content-types', 'articles')
    .withRelated('fields', [
      factory.addResource('fields', 'title')
        .withAttributes({ fieldType: '@cardstack/core-types::string' }),
      factory.addResource('fields', 'coolness')
        .withAttributes({
          fieldType: '@cardstack/core-types::integer'
        }).withRelated(
          'defaultAtCreate',
          factory.addResource('default-values').withAttributes({ value: 0 })
        ),
      factory.addResource('fields', 'reviewed')
        .withAttributes({
          fieldType: '@cardstack/core-types::boolean'
        }).withRelated(
          'defaultAtUpdate',
          factory.addResource('default-values').withAttributes({ value: false })
        ),
      factory.addResource('fields', 'misc')
        .withAttributes({
          fieldType: '@cardstack/core-types::object'
        }),
      factory.addResource('fields', 'author').withAttributes({
        fieldType: '@cardstack/core-types::belongs-to'
      }).withRelated('related-types', [
        factory.addResource('content-types', 'authors').withRelated('fields', [
          factory.addResource('fields', 'name').withAttributes({
            fieldType: '@cardstack/core-types::string'
          })
        ])
      ]),
    ]);

    factory.addResource('articles', 'improve-chess').withAttributes({
      title: '5 Ways to Improve Your Laughable Chess Skills'
    });
}

describe('permissions', function() {
  let factory, env, searchers;

  before(async function() {
    factory = new JSONAPIFactory();
    createSchema(factory);
    let projectDir = `${__dirname}/../../../tests/stub-project`;
    env = await createDefaultEnvironment(projectDir, factory.getModels());
    searchers = await env.lookup('hub:searchers');
  }),

  after(async function() {
    if (env) {
      await destroyDefaultEnvironment(env);
    }
  });

  function allReadable() {
    factory.addResource('grants').withAttributes({
      mayReadResource: true,
      mayReadFields: true
    }).withRelated('who', [everyone]);
  }

  it("attempting to fetch permissions for a resource the user doesn't have access to", async function() {
    try {
      await searchers.get(env.session, 'master', 'permissions', `articles/improve-chess`);
    } catch (err) {
      expect(err.message).to.match(/No such resource master\/articles\/improve-chess/);
    }
  });

  it("attempting to fetch permissions for a resource the user has access to", async function() {
    allReadable();
    let response = await searchers.get(env.session, 'master', 'permissions', `articles/improve-chess`);
    expect(response).is.ok;

    let { data } = response;
    let writableFields = data.relationships['writable-fields'].data.map(field => field.id);
    expect(writableFields).to.deep.equal(['title', 'coolness', 'reviewed', 'misc', 'author', 'type', 'id']);
    expect(data.type).to.equal('permissions');
    expect(data.id).to.equal('articles/improve-chess');
  });
});
