/*
  Our npm package cannot depend on @cardstack/test-support
  because @cardstack/test-support depends on us. Instead, for our
  tests we have a separate "test-app" that holds our devDependencies.
*/

const Factory = require('../../../tests/pgsearch-test-app/node_modules/@cardstack/test-support/jsonapi-factory');

const {
  createDefaultEnvironment,
  destroyDefaultEnvironment
} = require('../../../tests/pgsearch-test-app/node_modules/@cardstack/test-support/env');


describe.only('DocumentContext', function() {
  let env, writer, searcher;

  async function createFromFactory(factory) {
    for(const model of factory.getModels()) {
      await writer.create('master', env.session, model.type, {
        data: model
      });
    }
  }

  beforeEach(async function() {
    let factory = new Factory();

    factory.addResource('data-sources')
      .withAttributes({
        'source-type': 'fake-indexer',
        params: {
          changedModels: []
        }
      });

    env = await createDefaultEnvironment(`${__dirname}/../../../tests/pgsearch-test-app`, factory.getModels());
    writer = env.lookup('hub:writers');
    searcher = env.lookup('hub:searchers');
  });

  afterEach(async function() {
    await destroyDefaultEnvironment(env);
  });

  it('should exclude unsearchable fields from fullTextDoc but not from the searchDoc or pristineDoc', async function() {
    let factory = new Factory();

    factory.addResource('content-types', 'puppies')
      .withRelated('fields', [
        factory.addResource('fields', 'name').withAttributes({
          fieldType: '@cardstack/core-types::string',
        }),
        factory.addResource('fields', 'breed').withAttributes({
          fieldType: '@cardstack/core-types::string',
          includeInDocumentSearch: false,
        }),
      ]);

    factory.addResource('puppies', 'ringo')
      .withAttributes({
        name: 'Ringo',
        breed: 'yorkie',
      });

    await createFromFactory(factory);

    let docContext = await searcher.getContext(env.session, 'master', 'puppies', 'ringo');

    let searchDoc = await docContext.searchDoc();
    let fullTextDoc = await docContext.fullTextDoc();
    let pristineDoc = await docContext.pristineDoc();

    expect(searchDoc).to.deep.equal({
      id: 'ringo',
      name: 'Ringo',
      breed: 'yorkie'
    });

    expect(fullTextDoc).to.deep.equal({
      name: 'Ringo'
    });

    expect(pristineDoc.data).to.deep.include({
      id: 'ringo',
      type: 'puppies',
      attributes: {
        name: 'Ringo',
        breed: 'yorkie',
      },
    });
  });

  it('should include relationships but exclude unsearchable fields from from fullTextDoc but not from the searchDoc or pristineDoc', async function() {
    let factory = new Factory();

    let nameField = factory.addResource('fields', 'name').withAttributes({
      fieldType: '@cardstack/core-types::string',
    });

    factory.addResource('content-types', 'owners')
      .withRelated('fields', [
        nameField,
        factory.addResource('fields', 'address').withAttributes({
          fieldType: '@cardstack/core-types::string',
        })
      ]);

    factory.addResource('content-types', 'puppies')
      .withRelated('fields', [
        nameField,
        factory.addResource('fields', 'breed').withAttributes({
          fieldType: '@cardstack/core-types::string',
          includeInDocumentSearch: false,
        }),
        factory.addResource('fields', 'owner')
          .withAttributes({
            fieldType: '@cardstack/core-types::belongs-to'
          })
          .withRelated('relatedTypes', [
            {type: 'content-types', id: 'owners'}
          ]),
      ]);

    factory.addResource('owners', 'bob')
      .withAttributes({
        name: 'Robert',
        address: 'Germany',
      });

    factory.addResource('puppies', 'ringo')
      .withAttributes({
        name: 'Ringo',
        breed: 'yorkie',
      })
      .withRelated('owner', { type: 'owners', id: 'bob' });

    await createFromFactory(factory);

    let docContext = await searcher.getContext(env.session, 'master', 'puppies', 'ringo', [
      'owner',
    ]);

    let searchDoc = await docContext.searchDoc();
    let fullTextDoc = await docContext.fullTextDoc();
    let pristineDoc = await docContext.pristineDoc();

    expect(searchDoc).to.deep.equal({
      id: 'ringo',
      name: 'Ringo',
      breed: 'yorkie',
      owner: {
        address: 'Germany',
        id: 'bob',
        name: 'Robert',
        type: 'owners'
      }
    });

    expect(fullTextDoc).to.deep.equal({
      name: 'Ringo',
      owner: {
        address: 'Germany',
        name: 'Robert'
      }
    });

    expect(pristineDoc.data).to.deep.include({
      id: 'ringo',
      type: 'puppies',
      attributes: {
        name: 'Ringo',
        breed: 'yorkie',
      },
      relationships: {
        owner: {
          data: {
            id: "bob",
            type: "owners",
          }
        }
      },
    });

    expect(pristineDoc.included[0]).to.deep.include({
      id: 'bob',
      type: 'owners',
      attributes: {
        name: 'Robert',
        address: 'Germany'
      }
    });
  });

  it('should exclude unsearchable relationships from fullTextDoc but not from the searchDoc or pristineDoc', async function() {
    let factory = new Factory();

    let nameField = factory.addResource('fields', 'name').withAttributes({
      fieldType: '@cardstack/core-types::string',
    });

    factory.addResource('content-types', 'owners')
      .withRelated('fields', [
        nameField,
        factory.addResource('fields', 'address').withAttributes({
          fieldType: '@cardstack/core-types::string',
        })
      ]);

    factory.addResource('content-types', 'puppies')
      .withRelated('fields', [
        nameField,
        factory.addResource('fields', 'breed').withAttributes({
          fieldType: '@cardstack/core-types::string',
          includeInDocumentSearch: false,
        }),
        factory.addResource('fields', 'owner')
          .withAttributes({
            fieldType: '@cardstack/core-types::belongs-to'
          })
          .withRelated('relatedTypes', [
            {type: 'content-types', id: 'owners'}
          ]),
        factory.addResource('fields', 'previous-owner')
          .withAttributes({
            fieldType: '@cardstack/core-types::belongs-to',
            includeInDocumentSearch: false,
          })
          .withRelated('relatedTypes', [
            { type: 'content-types', id: 'owners' }
          ]),
      ]);



    factory.addResource('puppies', 'ringo')
      .withAttributes({
        name: 'Ringo',
        breed: 'yorkie',
      })
      .withRelated(
        'owner',
        factory
          .addResource('owners', 'bob')
          .withAttributes({
            name: 'Robert',
            address: 'Germany',
          })
      )
      .withRelated(
        'previous-owner',
        factory
          .addResource('owners', 'jimmy')
          .withAttributes({
            name: 'James',
            address: 'Ireland',
          })
      );

    await createFromFactory(factory);

    let docContext = await searcher.getContext(env.session, 'master', 'puppies', 'ringo', [
      'owner',
      'previous-owner'
    ]);

    let searchDoc = await docContext.searchDoc();
    let fullTextDoc = await docContext.fullTextDoc();
    let pristineDoc = await docContext.pristineDoc();

    expect(searchDoc).to.deep.equal({
      id: 'ringo',
      name: 'Ringo',
      breed: 'yorkie',
      owner: {
        address: 'Germany',
        id: 'bob',
        name: 'Robert',
        type: 'owners'
      },
      'previous-owner': {
        id: 'jimmy',
        name: 'James',
        type: 'owners',
        address: 'Ireland'
      }
    });

    expect(fullTextDoc).to.deep.equal({
      name: 'Ringo',
      owner: {
        address: 'Germany',
        name: 'Robert'
      }
    });

    expect(pristineDoc.data).to.deep.include({
      id: 'ringo',
      type: 'puppies',
      attributes: {
        name: 'Ringo',
        breed: 'yorkie',
      },
      relationships: {
        owner: {
          data: {
            id: "bob",
            type: "owners",
          }
        },
        'previous-owner': {
          data: {
            id: "jimmy",
            type: "owners",
          }
        }
      },
    });

    expect(pristineDoc.included[0]).to.deep.include({
      id: 'bob',
      type: 'owners',
      attributes: {
        name: 'Robert',
        address: 'Germany'
      }
    });

    expect(pristineDoc.included[1]).to.deep.include({
      id: 'jimmy',
      type: 'owners',
      attributes: {
        name: 'James',
        address: 'Ireland'
      }
    });
  });
  it('should exclude unsearchable fields on a related card from the fullTextDoc but not from the searchDoc or pristineDoc');
});
