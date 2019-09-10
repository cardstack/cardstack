const JSONAPIFactory = require('../../../tests/stub-project/node_modules/@cardstack/test-support/jsonapi-factory');
const {
  createDefaultEnvironment,
  destroyDefaultEnvironment
} = require('../../../tests/stub-project/node_modules/@cardstack/test-support/env');

const type = 'users';

describe('schema/group', function() {
  let env, hassan, ed, vanGogh, schema, searchers;

  function makeDocumentContext(upstreamDoc) {
    return searchers.createDocumentContext({
      id: upstreamDoc.data.id,
      type,
      schema,
      upstreamDoc,
    });
  }

  beforeEach(async function() {
    let factory = new JSONAPIFactory();

    factory.addResource('content-types', 'users')
      .withRelated('fields', [
        factory.addResource('fields', 'location').withAttributes({
          fieldType: '@cardstack/core-types::string'
        }),
        factory.addResource('fields', 'permissions').withAttributes({
          fieldType: '@cardstack/core-types::string-array'
        }),
        factory.addResource('fields', 'is-admin').withAttributes({
          fieldType: '@cardstack/core-types::boolean'
        }),
        factory.addResource('computed-fields', 'answer-to-life').withAttributes({
          computedFieldType: 'sample-computed-fields::forty-two'
        }),
      ]);

    factory.addResource('groups', 'nyc').withAttributes({
      searchQuery: { filter: { type: { exact: ['users'] }, location: { exact: 'New York' } } }
    });

    factory.addResource('groups', 'editors').withAttributes({
      searchQuery: { filter: { type: { exact: ['users'] }, permissions: { exact: 'write' } } }
    });

    factory.addResource('groups', 'admins').withAttributes({
      searchQuery: { filter: { type: { exact: ['users'] }, 'is-admin': { exact: true } } }
    });

    factory.addResource('groups', 'answer-to-life-knowers').withAttributes({
      searchQuery: { filter: { type: { exact: ['users'] }, 'answer-to-life': { exact: 42 } } }
    });

    // groups need to actually be used in order for users to be associated to them.
    // lets just use arbitrary grants as a way to use the groups
    factory.addResource('grants')
      .withRelated('who', [ { type: 'groups', id: 'answer-to-life-knowers' }])
      .withAttributes({ mayReadResource: true, mayReadFields: true });

    factory.addResource('grants')
      .withRelated('who', [ { type: 'groups', id: 'nyc' }])
      .withAttributes({ mayReadResource: true, mayReadFields: true });

    factory.addResource('grants')
      .withRelated('who', [{ type: 'groups', id: 'editors' } ])
      .withAttributes({ mayReadResource: true, mayReadFields: true });

    factory.addResource('grants')
      .withRelated('who', [{ type: 'groups', id: 'admins' } ])
      .withAttributes({ mayReadResource: true, mayReadFields: true });

    hassan = factory.addResource('users', 'hassan').withAttributes({
      location: 'New York',
      permissions: ['write', 'read']
    });

    ed = factory.addResource('users', 'ed').withAttributes({
      location: 'Boston',
      'is-admin': true,
      permissions: ['publish', 'read']
    });

    vanGogh = factory.addResource('users', 'vanGogh').withAttributes({
      'is-admin': false
    });

    env = await createDefaultEnvironment(`${__dirname}/../../../tests/sample-computed-fields`, factory.getModels());
    schema = await env.lookup('hub:current-schema').getSchema();
    searchers = env.lookup('hub:searchers');
  });

  afterEach(async function() {
    await destroyDefaultEnvironment(env);
  });

  it("creates group associations based on string field filtering", async function() {
    let realms = await schema.userRealms(makeDocumentContext(hassan));
    expect(realms).to.include("groups/nyc");

    realms = await schema.userRealms(makeDocumentContext(ed));
    expect(realms).to.not.include("groups/nyc");

    realms = await schema.userRealms(makeDocumentContext(vanGogh));
    expect(realms).to.not.include("groups/nyc");
  });

  it("creates group associations based on string-array field filtering", async function() {
    let realms = await schema.userRealms(makeDocumentContext(hassan));
    expect(realms).to.include("groups/editors");

    realms = await schema.userRealms(makeDocumentContext(ed));
    expect(realms).to.not.include("groups/editors");

    realms = await schema.userRealms(makeDocumentContext(vanGogh));
    expect(realms).to.not.include("groups/editors");
  });

  it("creates group associations based on boolean field filtering", async function() {
    let realms = await schema.userRealms(makeDocumentContext(hassan));
    expect(realms).to.not.include("groups/admins");

    realms = await schema.userRealms(makeDocumentContext(vanGogh));
    expect(realms).to.not.include("groups/admins");

    realms = await schema.userRealms(makeDocumentContext(ed));
    expect(realms).to.include("groups/admins");
  });

  it("creates group associations based on computed field filtering", async function() {
    let realms = await schema.userRealms(makeDocumentContext(hassan));
    expect(realms).to.include("groups/answer-to-life-knowers");

    realms = await schema.userRealms(makeDocumentContext(vanGogh));
    expect(realms).to.include("groups/answer-to-life-knowers");

    realms = await schema.userRealms(makeDocumentContext(ed));
    expect(realms).to.include("groups/answer-to-life-knowers");
  });
});
