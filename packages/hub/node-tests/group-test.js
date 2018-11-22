const JSONAPIFactory = require('@cardstack/test-support/jsonapi-factory');
const {
  createDefaultEnvironment,
  destroyDefaultEnvironment
} = require('@cardstack/test-support/env');

describe('schema/group', function() {
  let env, hassan, ed, vanGogh, schema;

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

    // groups need to actually be used in order for users to be associated to them.
    // lets just use arbitrary grants as a way to use the groups
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

    env = await createDefaultEnvironment(`${__dirname}/../../../tests/stub-project`, factory.getModels());
    schema = await env.lookup('hub:current-schema').forBranch('master');
  });

  afterEach(async function() {
    await destroyDefaultEnvironment(env);
  });

  it("creates group associations based on string field filtering", async function() {
    let realms = schema.userRealms(hassan.data);
    expect(realms).to.include("groups/nyc");

    realms = schema.userRealms(ed.data);
    expect(realms).to.not.include("groups/nyc");

    realms = schema.userRealms(vanGogh.data);
    expect(realms).to.not.include("groups/nyc");
  });

  it("creates group associations based on string-array field filtering", async function() {
    let realms = schema.userRealms(hassan.data);
    expect(realms).to.include("groups/editors");

    realms = schema.userRealms(ed.data);
    expect(realms).to.not.include("groups/editors");

    realms = schema.userRealms(vanGogh.data);
    expect(realms).to.not.include("groups/editors");
  });

  it("creates group associations based on boolean field filtering", async function() {
    let realms = schema.userRealms(hassan.data);
    expect(realms).to.not.include("groups/admins");

    realms = schema.userRealms(vanGogh.data);
    expect(realms).to.not.include("groups/admins");

    realms = schema.userRealms(ed.data);
    expect(realms).to.include("groups/admins");
  });
});
