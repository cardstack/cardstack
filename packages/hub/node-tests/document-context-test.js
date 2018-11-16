/*
  Our npm package cannot depend on @cardstack/test-support
  because @cardstack/test-support depends on us. Instead, for our
  tests we have a separate "test-app" that holds our devDependencies.
*/

const {
  createDefaultEnvironment,
  destroyDefaultEnvironment
} = require('../../../tests/pgsearch-test-app/node_modules/@cardstack/test-support/env');
const Factory = require('../../../tests/pgsearch-test-app/node_modules/@cardstack/test-support/jsonapi-factory');

const DocumentContext = require('../indexing/document-context');

describe('DocumentContext', function() {
  let env, factory, writer, searcher, currentSchema, changedModels;

  before(async function() {
    factory = new Factory();

    factory.addResource('content-types', 'puppies')
      .withRelated('fields', [
        factory.addResource('fields', 'name').withAttributes({
          fieldType: '@cardstack/core-types::string',
          searchable: false
        }),
        factory.addResource('fields', 'breed').withAttributes({
          fieldType: '@cardstack/core-types::string'
        }),
      ]);

    changedModels = [];
    factory.addResource('data-sources')
      .withAttributes({
        'source-type': 'fake-indexer',
        params: { changedModels }
      });

    env = await createDefaultEnvironment(`${__dirname}/../../../tests/pgsearch-test-app`, factory.getModels());
    writer = env.lookup('hub:writers');
    searcher = env.lookup('hub:searchers');
    currentSchema = env.lookup('hub:current-schema');
  });

  after(async function() {
    await destroyDefaultEnvironment(env);
  });

  it('searchDoc does not contain unsearchable fields', async function() {
    const branch = 'master';
    const schema = await currentSchema.forBranch(branch);

    let read = async (type, id) => {
      let result;
      try {
        result = await searcher.get(env.session, branch, type, id);
      } catch (err) {
        if (err.status !== 404) { throw err; }
      }

      if (result && result.data) {
        return result.data;
      }
    };

    let { data:ringo } = await writer.create('master', env.session, 'puppies', {
      data: {
        id: 'ringo',
        type: 'puppies',
        attributes: {
          name: 'Ringo',
          breed: 'yorkie'
        }
      }
    });

    let { id, type } = ringo;
    let { data:resource } = await searcher.get(env.session, branch, type, id);

    let searchDoc = await (new DocumentContext({ id, type, branch, schema, read,
      upstreamDoc: { data: resource },
    })).searchDoc();

    expect(searchDoc).to.deep.equal({
      id: 'ringo',
      name: 'Ringo'
    });
  });
});
