const {
  createDefaultEnvironment,
  destroyDefaultEnvironment,
} = require('../../../tests/stub-project/node_modules/@cardstack/test-support/env');
const JSONAPIFactory = require('../../../tests/stub-project/node_modules/@cardstack/test-support/jsonapi-factory');

describe('hub/routers', function() {
  let env, searchers;

  afterEach(async function() {
    await destroyDefaultEnvironment(env);
  });

  function setupTests(factory) {
    factory.addResource('content-types', 'dads');

    factory
      .addResource('content-types', 'people')
      .withAttributes({
        router: [{ path: '/' }],
      })
      .withRelated('fields', [
        factory.addResource('fields', 'name').withAttributes({
          fieldType: '@cardstack/core-types::string',
        }),
      ]);
    factory.addResource('content-types', 'puppies').withRelated('fields', [
      factory.addResource('fields', 'name').withAttributes({
        fieldType: '@cardstack/core-types::string',
      }),
      factory.addResource('fields', 'dog-breed').withAttributes({
        fieldType: '@cardstack/core-types::string',
      }),
      factory.addResource('fields', 'favorite-toy').withAttributes({
        fieldType: '@cardstack/core-types::string',
      }),
      factory.addResource('fields', 'daddy').withAttributes({
        fieldType: '@cardstack/core-types::belongs-to',
      }),
    ]);
    factory.addResource('content-types', 'puppies-errors');
    factory.addResource('puppies-errors', 'not-found');

    factory
      .addResource('content-types', 'rats')
      .withAttributes({
        router: [
          {
            path: '/national-treasure',
          },
          {
            path: '/:card:name/fish-friend',
            query: {
              filter: {
                type: { exact: 'fishes' },
                id: { exact: ':card:fish-friend' },
              },
            },
          },
        ],
      })
      .withRelated('fields', [
        factory.addResource('fields', 'name').withAttributes({
          fieldType: '@cardstack/core-types::string',
        }),
        factory.addResource('fields', 'fish-friend').withAttributes({
          fieldType: '@cardstack/core-types::string',
        }),
      ]);
    factory
      .addResource('grants', 'rats-errors-grant')
      .withAttributes({
        'may-read-fields': true,
        'may-read-resource': true,
      })
      .withRelated('who', [{ type: 'groups', id: 'everyone' }])
      .withRelated('types', [{ type: 'content-types', id: 'rats-errors' }]);
    factory.addResource('content-types', 'rats-errors');

    factory
      .addResource('content-types', 'fishes')
      .withAttributes({
        router: [
          {
            path: '/',
            additionalParams: {
              name: ':card:name',
            },
          },
          {
            path: '/:card:name/dinner-for',
            query: {
              filter: {
                type: { exact: 'people' },
                id: { exact: ':card:dinner-for' },
              },
            },
          },
        ],
      })
      .withRelated('fields', [
        factory.addResource('fields', 'name').withAttributes({
          fieldType: '@cardstack/core-types::string',
        }),
        factory.addResource('fields', 'dinner-for').withAttributes({
          fieldType: '@cardstack/core-types::string',
        }),
      ]);
    factory.addResource('content-types', 'fishes-errors');
    factory.addResource('fishes-errors', 'not-found');

    factory
      .addResource('content-types', 'kitties')
      .withAttributes({
        router: [
          {
            path: '/?foo=:foo&bee=:bee',
          },
          {
            path: '/:card:name/puppy-friends/:id',
            query: {
              filter: {
                type: { exact: 'puppies' },
                id: { exact: ':id' },
              },
            },
          },
          {
            path: '/:card:name/fish-friend/:id',
            query: {
              filter: {
                type: { exact: 'fishes' },
                id: { exact: ':id' },
              },
            },
          },
        ],
      })
      .withRelated('fields', [
        factory.addResource('fields', 'name').withAttributes({
          fieldType: '@cardstack/core-types::string',
        }),
      ]);
    factory
      .addResource('grants', 'kitties-errors-grant')
      .withAttributes({
        'may-read-fields': true,
        'may-read-resource': true,
      })
      .withRelated('who', [{ type: 'groups', id: 'everyone' }])
      .withRelated('types', [{ type: 'content-types', id: 'kitties-errors' }]);
    factory.addResource('content-types', 'kitties-errors');
    factory.addResource('kitties-errors', 'not-found');

    factory
      .addResource('grants', 'session-tests-user-grants')
      .withAttributes({
        'may-read-fields': true,
        'may-read-resource': true,
      })
      .withRelated('who', [{ type: 'groups', id: 'everyone' }])
      .withRelated('types', [
        { type: 'content-types', id: 'dads' },
        { type: 'content-types', id: 'puppies' },
      ]);

    factory.addResource('content-types', 'kitties-errors');
    factory
      .addResource('puppies', 'vanGogh')
      .withAttributes({
        name: 'Van Gogh',
        'dog-breed': 'dalmatian',
        'favorite-toy': 'squeaky-snake',
      })
      .withRelated('daddy', factory.addResource('dads', 'hassan'));

    factory.addResource('puppies', 'ringo').withAttributes({
      name: 'Ringo',
      'dog-breed': 'dalmatian',
      'favorite-toy': 'tennis ball',
    });

    factory.addResource('puppies', 'lucky').withAttributes({
      name: 'Lucky',
      'dog-breed': 'golden retriever',
      'favorite-toy': 'tennis ball',
    });

    factory.addResource('kitties', 'sally').withAttributes({
      name: 'Sally',
    });

    factory.addResource('rats', 'pizza-rat').withAttributes({
      name: 'Pizza Rat',
      'fish-friend': 'nemo',
    });

    factory.addResource('fishes', 'nemo').withAttributes({
      name: 'Nemo',
      'dinner-for': 'hassan',
    });

    factory.addResource('people', 'hassan').withAttributes({
      name: 'Hassan',
    });
  }

  describe('using default application card', function() {
    beforeEach(async function() {
      let factory = new JSONAPIFactory();

      setupTests(factory);

      env = await createDefaultEnvironment(`${__dirname}/../../../tests/stub-project`, factory.getModels());
      searchers = env.lookup('hub:searchers');
    });

    it('can get the default "getting started" application card when no application card has been specified in the plugin-config', async function() {
      let { included, data: space } = await searchers.getSpace(env.session, '/');

      expect(space).has.property('type', 'spaces');
      expect(space).has.property('id', '/');
      expect(space.attributes.params).to.eql({
        path: '/',
        session: { id: 'the-default-test-user', type: 'test-users' },
      });
      expect(space.attributes['allowed-query-params']).to.have.members([]);
      expect(space.attributes['route-stack']).to.eql(['application-cards/getting-started']);
      expect(space).has.deep.property('relationships.primary-card.data.id', 'getting-started');
      expect(space).has.deep.property('relationships.primary-card.data.type', 'application-cards');

      expect(included.length).equals(1);
      expect(included[0]).has.property('id', 'getting-started');
      expect(included[0]).has.property('type', 'application-cards');
      expect(included[0]).has.deep.property('links.self', '/');
    });

    it('uses statically mapped routing for the application card when no routing has been specified', async function() {
      let { included, data: space } = await searchers.getSpace(env.session, '/puppies/vanGogh');

      expect(space).has.property('type', 'spaces');
      expect(space).has.property('id', '/puppies/vanGogh');
      expect(space.attributes.params).to.eql({
        path: '/puppies/vanGogh',
        type: 'puppies',
        id: 'vanGogh',
        session: { type: 'test-users', id: 'the-default-test-user' },
      });
      expect(space.attributes['allowed-query-params']).to.have.members([]);
      expect(space.attributes['route-stack']).to.eql(['application-cards/getting-started']);
      expect(space).has.deep.property('relationships.primary-card.data.id', 'vanGogh');
      expect(space).has.deep.property('relationships.primary-card.data.type', 'puppies');

      expect(included.length).equals(1);
      expect(included[0]).has.property('id', 'vanGogh');
      expect(included[0]).has.property('type', 'puppies');
      expect(included[0]).has.deep.property('attributes.name', 'Van Gogh');
      expect(included[0]).has.deep.property('attributes.dog-breed', 'dalmatian');
      expect(included[0]).has.deep.property('attributes.favorite-toy', 'squeaky-snake');
      expect(included[0]).has.deep.property('links.self', '/puppies/vanGogh');
    });

    it('doesnt route a non-existant single segment path (e.g. /sadfdfsdfs) to the index route, rather it returns an error card', async function() {
      let { data: space } = await searchers.getSpace(env.session, '/sadfdfsdfs');
      expect(space.relationships['primary-card'].data).to.eql({ type: 'error-cards', id: 'not-found' });
    });
  });

  describe('using configured application card that uses session based routing', function() {
    let session;
    beforeEach(async function() {
      let factory = new JSONAPIFactory();

      setupTests(factory);

      factory
        .addResource('plugin-configs', '@cardstack/hub')
        .withAttributes({
          'plugin-config': {
            'application-card': { type: 'docs', id: 'app' },
          },
        })
        .withRelated('default-data-source', { data: { type: 'data-sources', id: 'default' } });

      factory.addResource('content-types', 'docs').withAttributes({
        router: [
          {
            path: '/',
            query: {
              filter: {
                type: { exact: ':session:type' },
                id: { exact: ':session:id' },
              },
            },
          },
          {
            path: '/puppy',
            query: {
              filter: {
                type: { exact: 'puppies' },
                'daddy.id': { exact: ':session:id' },
                'daddy.type': { exact: ':session:type' },
              },
            },
          },
        ],
      });

      factory.addResource('docs', 'app');

      env = await createDefaultEnvironment(`${__dirname}/../../../tests/stub-project`, factory.getModels());
      searchers = env.lookup('hub:searchers');
      session = env.lookup('hub:sessions').create('dads', 'hassan');
    });

    it('can get the space of a route using a session based query', async function() {
      let result = await searchers.getSpace(session, '/puppy');
      let { included, data: space } = result;

      expect(space).has.property('type', 'spaces');
      expect(space).has.property('id', '/puppy');
      expect(space.attributes.params).to.eql({ path: '/puppy', session: { id: 'hassan', type: 'dads' } });
      expect(space.attributes['allowed-query-params']).to.have.members([]);
      expect(space.attributes['route-stack']).to.eql(['docs/app']);
      expect(space).has.deep.property('relationships.primary-card.data.id', 'vanGogh');
      expect(space).has.deep.property('relationships.primary-card.data.type', 'puppies');

      expect(included.length).equals(1);
      expect(included[0]).has.property('id', 'vanGogh');
      expect(included[0]).has.property('type', 'puppies');
      expect(included[0]).has.deep.property('attributes.name', 'Van Gogh');
      expect(included[0]).has.deep.property('attributes.dog-breed', 'dalmatian');
      expect(included[0]).has.deep.property('attributes.favorite-toy', 'squeaky-snake');
      expect(included[0]).has.deep.property('relationships.daddy.data.id', 'hassan');
      expect(included[0]).has.deep.property('relationships.daddy.data.type', 'dads');
      expect(included[0]).to.not.have.property('links');
    });

    it('can get the space of a route whose primary card is the session object', async function() {
      let { included, data: space } = await searchers.getSpace(session, '/');

      expect(space).has.property('type', 'spaces');
      expect(space).has.property('id', '/');
      expect(space.attributes.params).to.eql({ path: '/', session: { id: 'hassan', type: 'dads' } });
      expect(space.attributes['allowed-query-params']).to.have.members([]);
      expect(space.attributes['route-stack']).to.eql(['docs/app']);
      expect(space).has.deep.property('relationships.primary-card.data.id', 'hassan');
      expect(space).has.deep.property('relationships.primary-card.data.type', 'dads');

      expect(included.length).equals(1);
      expect(included[0]).has.property('id', 'hassan');
      expect(included[0]).has.property('type', 'dads');
      expect(included[0]).to.not.have.property('links');
    });
  });

  describe('using configured application card that has a router', function() {
    beforeEach(async function() {
      let factory = new JSONAPIFactory();

      setupTests(factory);

      factory
        .addResource('plugin-configs', '@cardstack/hub')
        .withAttributes({
          'plugin-config': {
            'application-card': { type: 'docs', id: 'app' },
          },
        })
        .withRelated('default-data-source', { data: { type: 'data-sources', id: 'default' } });

      factory
        .addResource('content-types', 'docs')
        .withAttributes({
          router: [
            {
              path: '/favorite-puppy',
              query: {
                filter: {
                  type: { exact: 'puppies' },
                  id: { exact: 'vanGogh' },
                },
              },
            },
            {
              path: '/buddy/:friendly_id',
              query: {
                filter: {
                  type: { exact: 'puppies' },
                  name: { exact: ':friendly_id' },
                },
              },
              additionalParams: {
                foo: 'bar',
                name: ':friendly_id',
                routingCardData: ':card:dog-breed',
              },
            },
            {
              path: '/kitty-breeds/:card:dog-breed/:id',
              query: {
                filter: {
                  type: { exact: 'kitties' },
                  id: { exact: ':id' },
                },
              },
            },
            {
              path: '/contextual-favorite-toy/:toy',
              query: {
                filter: {
                  type: { exact: 'puppies' },
                  'dog-breed': { exact: ':card:dog-breed' },
                  'favorite-toy': ':toy',
                },
              },
            },
            {
              path: '/sorted?sort=:sort&extra=:extra',
              query: {
                filter: {
                  type: { exact: 'puppies' },
                },
                sort: ':sort',
              },
            },
            {
              path: '/forward/:type/:id',
              query: {
                filter: {
                  type: { exact: ':type' },
                  id: { exact: ':id' },
                },
              },
            },
          ],
        })
        .withRelated('fields', [
          factory.addResource('fields', 'dog-breed').withAttributes({
            fieldType: '@cardstack/core-types::string',
          }),
        ]);

      factory.addResource('docs', 'app').withAttributes({
        'dog-breed': 'dalmatian',
      });

      env = await createDefaultEnvironment(`${__dirname}/../../../tests/stub-project`, factory.getModels());
      searchers = env.lookup('hub:searchers');
    });

    it('can return the routing card as the primary card when no query exists for the route', async function() {
      let { included, data: space } = await searchers.getSpace(env.session, '/forward/rats/pizza-rat');

      expect(space).has.property('type', 'spaces');
      expect(space).has.property('id', '/forward/rats/pizza-rat');
      expect(space.attributes.params).to.eql({
        path: '/forward/rats/pizza-rat',
        id: 'pizza-rat',
        type: 'rats',
        session: { type: 'test-users', id: 'the-default-test-user' },
      });
      expect(space.attributes['allowed-query-params']).to.have.members([]);
      expect(space.attributes['route-stack']).to.eql(['docs/app']);
      expect(space).has.deep.property('relationships.primary-card.data.id', 'pizza-rat');
      expect(space).has.deep.property('relationships.primary-card.data.type', 'rats');

      expect(included.length).equals(1);
      expect(included[0]).has.property('id', 'pizza-rat');
      expect(included[0]).has.property('type', 'rats');
      expect(included[0]).has.deep.property('attributes.name', 'Pizza Rat');
      expect(included[0]).has.deep.property('links.self', '/forward/rats/pizza-rat/national-treasure');
    });

    it('can return the routing card as the primary card when primary card has query param based routes', async function() {
      let { included, data: space } = await searchers.getSpace(
        env.session,
        '/forward/kitties/sally?kitties[foo]=bar&kitties[bee]=bop&ignore-me=true'
      );

      expect(space).has.property('type', 'spaces');
      expect(space).has.property('id', '/forward/kitties/sally?kitties[foo]=bar&kitties[bee]=bop&ignore-me=true');
      expect(space.attributes.params).to.eql({
        path: '/?foo=bar&bee=bop',
        foo: 'bar',
        bee: 'bop',
        session: { type: 'test-users', id: 'the-default-test-user' },
      });
      expect(space.attributes['allowed-query-params']).to.have.members(['foo', 'bee']);
      expect(space.attributes['route-stack']).to.eql(['kitties/sally', 'docs/app']);
      expect(space).has.deep.property('relationships.primary-card.data.id', 'sally');
      expect(space).has.deep.property('relationships.primary-card.data.type', 'kitties');

      expect(included.length).equals(1);
      expect(included[0]).has.property('id', 'sally');
      expect(included[0]).has.property('type', 'kitties');
      expect(included[0]).has.deep.property('attributes.name', 'Sally');
      expect(included[0]).has.deep.property('links.self', '/forward/kitties/sally');
    });

    it('can return the routing card as the primary card when no query exists for the route with query param', async function() {
      let { included, data: space } = await searchers.getSpace(env.session, '/forward/kitties/sally');

      expect(space).has.property('type', 'spaces');
      expect(space).has.property('id', '/forward/kitties/sally');
      expect(space.attributes.params).to.eql({
        path: '/',
        session: { type: 'test-users', id: 'the-default-test-user' },
      });
      expect(space.attributes['allowed-query-params']).to.have.members(['foo', 'bee']);
      expect(space.attributes['route-stack']).to.eql(['kitties/sally', 'docs/app']);
      expect(space).has.deep.property('relationships.primary-card.data.id', 'sally');
      expect(space).has.deep.property('relationships.primary-card.data.type', 'kitties');

      expect(included.length).equals(1);
      expect(included[0]).has.property('id', 'sally');
      expect(included[0]).has.property('type', 'kitties');
      expect(included[0]).has.deep.property('attributes.name', 'Sally');
      expect(included[0]).has.deep.property('links.self', '/forward/kitties/sally');
    });

    it('can return an error card when the path does not match any routes', async function() {
      let { included, data: space } = await searchers.getSpace(env.session, '/route-that-doesnt-exist');

      expect(space).has.property('type', 'spaces');
      expect(space).has.property('id', '/route-that-doesnt-exist');
      expect(space.attributes.params).to.eql({
        path: '/route-that-doesnt-exist',
        session: { type: 'test-users', id: 'the-default-test-user' },
      });
      expect(space.attributes['allowed-query-params']).to.have.members([]);
      expect(space.attributes['route-stack']).to.eql([]);
      expect(space).has.deep.property('relationships.primary-card.data.id', 'not-found');
      expect(space).has.deep.property('relationships.primary-card.data.type', 'error-cards');

      expect(included.length).equals(1);
      expect(included[0]).has.property('id', 'not-found');
      expect(included[0]).has.property('type', 'error-cards');
    });

    it('can return an error card when the path does not correspond to a card that exists', async function() {
      let { included, data: space } = await searchers.getSpace(env.session, '/forward/docs/route-that-doesnt-exist');

      expect(space).has.property('type', 'spaces');
      expect(space).has.property('id', '/forward/docs/route-that-doesnt-exist');
      expect(space.attributes.params).to.eql({
        path: '/forward/docs/route-that-doesnt-exist',
        session: { type: 'test-users', id: 'the-default-test-user' },
      });
      expect(space.attributes['allowed-query-params']).to.have.members([]);
      expect(space).has.deep.property('relationships.primary-card.data.id', 'not-found');
      expect(space).has.deep.property('relationships.primary-card.data.type', 'error-cards');

      expect(included.length).equals(1);
      expect(included[0]).has.property('id', 'not-found');
      expect(included[0]).has.property('type', 'error-cards');
    });

    it('can return error card if the router identifies a primary card and the path part of the URL has not been fully consumed', async function() {
      let { included, data: space } = await searchers.getSpace(env.session, '/favorite-puppy/blah');

      expect(space).has.property('type', 'spaces');
      expect(space).has.property('id', '/favorite-puppy/blah');
      expect(space.attributes.params).to.eql({
        path: '/favorite-puppy/blah',
        session: { type: 'test-users', id: 'the-default-test-user' },
      });
      expect(space.attributes['allowed-query-params']).to.have.members([]);
      expect(space).has.deep.property('relationships.primary-card.data.id', 'not-found');
      expect(space).has.deep.property('relationships.primary-card.data.type', 'error-cards');

      expect(included.length).equals(1);
      expect(included[0]).has.property('id', 'not-found');
      expect(included[0]).has.property('type', 'error-cards');
    });

    it('can override the system error card with an error card specific to the routing card', async function() {
      let { included, data: space } = await searchers.getSpace(env.session, '/forward/kitties/sally/whaaa');

      expect(space).has.property('type', 'spaces');
      expect(space).has.property('id', '/forward/kitties/sally/whaaa');
      expect(space.attributes.params).to.eql({
        path: '/forward/kitties/sally/whaaa',
        session: { type: 'test-users', id: 'the-default-test-user' },
      });
      expect(space.attributes['allowed-query-params']).to.have.members([]);
      expect(space).has.deep.property('relationships.primary-card.data.id', 'not-found');
      expect(space).has.deep.property('relationships.primary-card.data.type', 'kitties-errors');

      expect(included.length).equals(1);
      expect(included[0]).has.property('id', 'not-found');
      expect(included[0]).has.property('type', 'kitties-errors');
    });

    it('uses system error card if the custom error card doesnt have an instance with the id of "not-found"', async function() {
      let { included, data: space } = await searchers.getSpace(env.session, '/forward/rats/pizza-rat/blah');

      expect(space).has.property('type', 'spaces');
      expect(space).has.property('id', '/forward/rats/pizza-rat/blah');
      expect(space.attributes.params).to.eql({
        path: '/forward/rats/pizza-rat/blah',
        session: { type: 'test-users', id: 'the-default-test-user' },
      });
      expect(space.attributes['allowed-query-params']).to.have.members([]);
      expect(space).has.deep.property('relationships.primary-card.data.id', 'not-found');
      expect(space).has.deep.property('relationships.primary-card.data.type', 'error-cards');

      expect(included.length).equals(1);
      expect(included[0]).has.property('id', 'not-found');
      expect(included[0]).has.property('type', 'error-cards');
    });

    it('uses system error card if the custom error card doesnt have an open grant', async function() {
      let { included, data: space } = await searchers.getSpace(env.session, '/forward/fishes/nemo/blah');

      expect(space).has.property('type', 'spaces');
      expect(space).has.property('id', '/forward/fishes/nemo/blah');
      expect(space.attributes.params).to.eql({
        path: '/forward/fishes/nemo/blah',
        session: { type: 'test-users', id: 'the-default-test-user' },
      });
      expect(space.attributes['allowed-query-params']).to.have.members([]);
      expect(space).has.deep.property('relationships.primary-card.data.id', 'not-found');
      expect(space).has.deep.property('relationships.primary-card.data.type', 'error-cards');

      expect(included.length).equals(1);
      expect(included[0]).has.property('id', 'not-found');
      expect(included[0]).has.property('type', 'error-cards');
    });

    it('can return an http-status of 404 for the `not-found` error card', async function() {
      let { data: space } = await searchers.getSpace(env.session, '/non-existant-card');
      expect(space).has.deep.property('attributes.http-status', 404);
    });

    it('can return an http-status of 200 for a card that is not an error card', async function() {
      let { data: space } = await searchers.getSpace(env.session, '/favorite-puppy');
      expect(space).has.deep.property('attributes.http-status', 200);
    });

    it('can get the space using a route that is static', async function() {
      let { included, data: space } = await searchers.getSpace(env.session, '/favorite-puppy');

      expect(space).has.property('type', 'spaces');
      expect(space).has.property('id', '/favorite-puppy');
      expect(space.attributes.params).to.eql({
        path: '/favorite-puppy',
        session: { type: 'test-users', id: 'the-default-test-user' },
      });
      expect(space.attributes['allowed-query-params']).to.have.members([]);
      expect(space.attributes['route-stack']).to.eql(['docs/app']);
      expect(space).has.deep.property('relationships.primary-card.data.id', 'vanGogh');
      expect(space).has.deep.property('relationships.primary-card.data.type', 'puppies');

      expect(included.length).equals(1);
      expect(included[0]).has.property('id', 'vanGogh');
      expect(included[0]).has.property('type', 'puppies');
      expect(included[0]).has.deep.property('attributes.name', 'Van Gogh');
      expect(included[0]).has.deep.property('attributes.dog-breed', 'dalmatian');
      expect(included[0]).has.deep.property('attributes.favorite-toy', 'squeaky-snake');
      expect(included[0]).has.deep.property('links.self', '/favorite-puppy');
    });

    it('can get the space using a route that has dynamic segments and additional-parameters', async function() {
      let { included, data: space } = await searchers.getSpace(env.session, '/buddy/Ringo');

      expect(space).has.property('type', 'spaces');
      expect(space).has.property('id', '/buddy/Ringo');
      expect(space.attributes.params).to.eql({
        path: '/buddy/Ringo',
        friendly_id: 'Ringo',
        foo: 'bar',
        name: 'Ringo',
        routingCardData: 'dalmatian',
        session: { type: 'test-users', id: 'the-default-test-user' },
      });
      expect(space.attributes['allowed-query-params']).to.have.members([]);
      expect(space.attributes['route-stack']).to.eql(['docs/app']);
      expect(space).has.deep.property('relationships.primary-card.data.id', 'ringo');
      expect(space).has.deep.property('relationships.primary-card.data.type', 'puppies');

      expect(included.length).equals(1);
      expect(included[0]).has.property('id', 'ringo');
      expect(included[0]).has.property('type', 'puppies');
      expect(included[0]).has.deep.property('attributes.name', 'Ringo');
      expect(included[0]).has.deep.property('attributes.dog-breed', 'dalmatian');
      expect(included[0]).has.deep.property('attributes.favorite-toy', 'tennis ball');
      expect(included[0]).has.deep.property('links.self', '/buddy/Ringo');
    });

    it('can get the space using a route that uses contextual card data', async function() {
      let { included, data: space } = await searchers.getSpace(env.session, '/contextual-favorite-toy/squeaky-snake');

      expect(space).has.property('type', 'spaces');
      expect(space).has.property('id', '/contextual-favorite-toy/squeaky-snake');
      expect(space.attributes.params).to.eql({
        path: '/contextual-favorite-toy/squeaky-snake',
        toy: 'squeaky-snake',
        session: { type: 'test-users', id: 'the-default-test-user' },
      });
      expect(space.attributes['allowed-query-params']).to.have.members([]);
      expect(space.attributes['route-stack']).to.eql(['docs/app']);
      expect(space).has.deep.property('relationships.primary-card.data.id', 'vanGogh');
      expect(space).has.deep.property('relationships.primary-card.data.type', 'puppies');

      expect(included.length).equals(1);
      expect(included[0]).has.property('id', 'vanGogh');
      expect(included[0]).has.property('type', 'puppies');
      expect(included[0]).has.deep.property('attributes.name', 'Van Gogh');
      expect(included[0]).has.deep.property('attributes.dog-breed', 'dalmatian');
      expect(included[0]).has.deep.property('attributes.favorite-toy', 'squeaky-snake');
      expect(included[0]).has.deep.property('links.self', '/favorite-puppy');
    });

    it('can get the space using a route that uses a query param', async function() {
      let { included, data: space } = await searchers.getSpace(
        env.session,
        '/sorted?docs[sort]=favorite-toy&foo=bar&bee=bop'
      );

      expect(space).has.property('type', 'spaces');
      expect(space).has.property('id', '/sorted?docs[sort]=favorite-toy&foo=bar&bee=bop');
      expect(space.attributes.params).to.eql({
        path: '/sorted?sort=favorite-toy',
        sort: 'favorite-toy',
        session: { type: 'test-users', id: 'the-default-test-user' },
      });
      expect(space.attributes['allowed-query-params']).to.have.members(['sort', 'extra']);
      expect(space.attributes['route-stack']).to.eql(['docs/app']);
      expect(space).has.deep.property('relationships.primary-card.data.id', 'vanGogh');
      expect(space).has.deep.property('relationships.primary-card.data.type', 'puppies');

      expect(included.length).equals(1);
      expect(included[0]).has.property('id', 'vanGogh');
      expect(included[0]).has.property('type', 'puppies');
      expect(included[0]).has.deep.property('attributes.name', 'Van Gogh');
      expect(included[0]).has.deep.property('attributes.dog-breed', 'dalmatian');
      expect(included[0]).has.deep.property('attributes.favorite-toy', 'squeaky-snake');
      expect(included[0]).has.deep.property('links.self', '/favorite-puppy');
    });

    it('does not include query params that were not consumed', async function() {
      let { data: space } = await searchers.getSpace(env.session, '/favorite-puppy?foo=bar');

      expect(space).has.property('type', 'spaces');
      expect(space).has.property('id', '/favorite-puppy?foo=bar');
      expect(space.attributes.params).to.eql({
        path: '/favorite-puppy',
        session: { type: 'test-users', id: 'the-default-test-user' },
      });
      expect(space.attributes['allowed-query-params']).to.have.members([]);
      expect(space.attributes['route-stack']).to.eql(['docs/app']);
      expect(space).has.deep.property('relationships.primary-card.data.id', 'vanGogh');
      expect(space).has.deep.property('relationships.primary-card.data.type', 'puppies');
    });

    it('can route to a path that includes routing card data', async function() {
      let { included, data: space } = await searchers.getSpace(env.session, '/kitty-breeds/dalmatian/sally');

      expect(space).has.property('type', 'spaces');
      expect(space).has.property('id', '/kitty-breeds/dalmatian/sally');
      expect(space.attributes.params).to.eql({
        path: '/',
        session: { type: 'test-users', id: 'the-default-test-user' },
      });
      expect(space.attributes['allowed-query-params']).to.have.members(['foo', 'bee']);
      expect(space.attributes['route-stack']).to.eql(['kitties/sally', 'docs/app']);
      expect(space).has.deep.property('relationships.primary-card.data.id', 'sally');
      expect(space).has.deep.property('relationships.primary-card.data.type', 'kitties');

      expect(included.length).equals(1);
      expect(included[0]).has.property('id', 'sally');
      expect(included[0]).has.property('type', 'kitties');
      expect(included[0]).has.deep.property('attributes.name', 'Sally');
      expect(included[0]).has.deep.property('links.self', '/forward/kitties/sally');
    });

    it('can route to a path that includes routing card data in multiple nested routes', async function() {
      let { included, data: space } = await searchers.getSpace(
        env.session,
        '/kitty-breeds/dalmatian/sally/Sally/puppy-friends/vanGogh'
      );

      expect(space).has.property('type', 'spaces');
      expect(space).has.property('id', '/kitty-breeds/dalmatian/sally/Sally/puppy-friends/vanGogh');
      expect(space.attributes.params).to.eql({
        path: '/Sally/puppy-friends/vanGogh',
        'card:name': 'Sally',
        id: 'vanGogh',
        session: { type: 'test-users', id: 'the-default-test-user' },
      });
      expect(space.attributes['allowed-query-params']).to.have.members([]);
      expect(space.attributes['route-stack']).to.eql(['kitties/sally', 'docs/app']);
      expect(space).has.deep.property('relationships.primary-card.data.id', 'vanGogh');
      expect(space).has.deep.property('relationships.primary-card.data.type', 'puppies');

      expect(included.length).equals(1);
      expect(included[0]).has.property('id', 'vanGogh');
      expect(included[0]).has.property('type', 'puppies');
      expect(included[0]).has.deep.property('attributes.name', 'Van Gogh');
      expect(included[0]).has.deep.property('links.self', '/favorite-puppy');
    });

    it('can route to a path that includes routing card data in multiple nested routes that terminates in query-less route', async function() {
      let { included, data: space } = await searchers.getSpace(
        env.session,
        '/kitty-breeds/dalmatian/sally/Sally/fish-friend/nemo'
      );

      expect(space).has.property('type', 'spaces');
      expect(space).has.property('id', '/kitty-breeds/dalmatian/sally/Sally/fish-friend/nemo');
      expect(space.attributes.params).to.eql({
        path: '/',
        name: 'Nemo',
        session: { type: 'test-users', id: 'the-default-test-user' },
      });
      expect(space.attributes['allowed-query-params']).to.have.members([]);
      expect(space.attributes['route-stack']).to.eql(['fishes/nemo', 'kitties/sally', 'docs/app']);
      expect(space).has.deep.property('relationships.primary-card.data.id', 'nemo');
      expect(space).has.deep.property('relationships.primary-card.data.type', 'fishes');

      expect(included.length).equals(1);
      expect(included[0]).has.property('id', 'nemo');
      expect(included[0]).has.property('type', 'fishes');
      expect(included[0]).has.deep.property('attributes.name', 'Nemo');
      expect(included[0]).has.deep.property('links.self', '/forward/fishes/nemo');
    });

    it('can route to a path that includes routing card data whose routing card`s query uses card data', async function() {
      let { included, data: space } = await searchers.getSpace(
        env.session,
        '/forward/rats/pizza-rat/Pizza%20Rat/fish-friend'
      );

      expect(space).has.property('type', 'spaces');
      expect(space).has.property('id', '/forward/rats/pizza-rat/Pizza%20Rat/fish-friend');
      expect(space.attributes.params).to.eql({
        path: '/',
        name: 'Nemo',
        session: { type: 'test-users', id: 'the-default-test-user' },
      });
      expect(space.attributes['allowed-query-params']).to.have.members([]);
      expect(space.attributes['route-stack']).to.eql(['fishes/nemo', 'rats/pizza-rat', 'docs/app']);
      expect(space).has.deep.property('relationships.primary-card.data.id', 'nemo');
      expect(space).has.deep.property('relationships.primary-card.data.type', 'fishes');

      expect(included.length).equals(1);
      expect(included[0]).has.property('id', 'nemo');
      expect(included[0]).has.property('type', 'fishes');
      expect(included[0]).has.deep.property('attributes.name', 'Nemo');
      expect(included[0]).has.deep.property('links.self', '/forward/fishes/nemo');
    });

    it('can route to a path that includes routing card that is retrieved via upstream routing card data', async function() {
      let { included, data: space } = await searchers.getSpace(
        env.session,
        '/forward/rats/pizza-rat/Pizza%20Rat/fish-friend/Nemo/dinner-for'
      );

      expect(space).has.property('type', 'spaces');
      expect(space).has.property('id', '/forward/rats/pizza-rat/Pizza%20Rat/fish-friend/Nemo/dinner-for');
      expect(space.attributes.params).to.eql({
        path: '/',
        session: { type: 'test-users', id: 'the-default-test-user' },
      });
      expect(space.attributes['allowed-query-params']).to.have.members([]);
      expect(space.attributes['route-stack']).to.eql(['people/hassan', 'fishes/nemo', 'rats/pizza-rat', 'docs/app']);
      expect(space).has.deep.property('relationships.primary-card.data.id', 'hassan');
      expect(space).has.deep.property('relationships.primary-card.data.type', 'people');

      expect(included.length).equals(1);
      expect(included[0]).has.property('id', 'hassan');
      expect(included[0]).has.property('type', 'people');
      expect(included[0]).has.deep.property('attributes.name', 'Hassan');
      expect(included[0]).has.deep.property('links.self', '/forward/people/hassan');
    });
  });

  describe('route is missing path', function() {
    beforeEach(async function() {
      let factory = new JSONAPIFactory();

      factory
        .addResource('plugin-configs', '@cardstack/hub')
        .withAttributes({
          'plugin-config': {
            'application-card': { type: 'docs', id: 'app' },
          },
        })
        .withRelated('default-data-source', { data: { type: 'data-sources', id: 'default' } });

      factory.addResource('content-types', 'docs').withAttributes({
        router: [
          {
            path: '/',
          },
          {
            query: {
              filter: {
                type: { exact: 'docs' },
                id: { exact: 'app' },
              },
            },
          },
        ],
      });

      factory.addResource('docs', 'app');

      env = await createDefaultEnvironment(`${__dirname}/../../../tests/stub-project`, factory.getModels());
      searchers = env.lookup('hub:searchers');
    });

    it('throws an error when it encounters a route that is missing a path', async function() {
      let error;
      try {
        await searchers.getSpace(env.session, '/');
      } catch (err) {
        error = err.message;
      }

      expect(error).to.equal(`The router for content type 'docs' has a route that is missing a path.`);
    });
  });

  describe('route path does not start with "/"', function() {
    beforeEach(async function() {
      let factory = new JSONAPIFactory();

      factory
        .addResource('plugin-configs', '@cardstack/hub')
        .withAttributes({
          'plugin-config': {
            'application-card': { type: 'docs', id: 'app' },
          },
        })
        .withRelated('default-data-source', { data: { type: 'data-sources', id: 'default' } });

      factory.addResource('content-types', 'docs').withAttributes({
        router: [
          {
            path: 'app-card',
            query: {
              filter: {
                type: { exact: 'docs' },
                id: { exact: 'app' },
              },
            },
          },
        ],
      });

      factory.addResource('docs', 'app');

      env = await createDefaultEnvironment(`${__dirname}/../../../tests/stub-project`, factory.getModels());
      searchers = env.lookup('hub:searchers');
    });

    it('throws an error when it encounters a path definied in a route that does not start with "/"', async function() {
      let error;
      try {
        await searchers.getSpace(env.session, '/');
      } catch (err) {
        error = err.message;
      }

      expect(error).to.equal(
        `The path of the route for content type 'docs' at path 'app-card' does not begin with '/'.`
      );
    });
  });

  describe('router with deep stacks', function() {
    beforeEach(async function() {
      let factory = new JSONAPIFactory();

      factory
        .addResource('plugin-configs', '@cardstack/hub')
        .withAttributes({
          'plugin-config': {
            'application-card': { type: 'docs', id: 'app' },
          },
        })
        .withRelated('default-data-source', { data: { type: 'data-sources', id: 'default' } });

      factory.addResource('content-types', 'docs').withAttributes({
        router: [
          {
            path: '/deep',
            query: {
              filter: {
                type: { exact: ':type' },
                id: { exact: ':id' },
              },
            },
          },
        ],
      });
      factory.addResource('docs', 'app');

      const stackSize = 51;

      for (let i = 0; i < stackSize; i++) {
        factory.addResource('content-types', `cards-${i}`).withAttributes({
          router: [
            {
              path: '/deeper',
              query: {
                filter: {
                  type: { exact: ':type' },
                  id: { exact: ':id' },
                },
              },
            },
          ],
        });
      }

      env = await createDefaultEnvironment(`${__dirname}/../../../tests/stub-project`, factory.getModels());
      searchers = env.lookup('hub:searchers');
    });

    it('throws an error maximum route stack size is exceeded while building router map', async function() {
      let error;
      try {
        await searchers.getSpace(env.session, '/deep');
      } catch (err) {
        error = err.message;
      }

      expect(error).to.match(/^Recursed through more than 50 routers when building routing map/);
    });
  });

  describe('interior routing card missing', function() {
    beforeEach(async function() {
      let factory = new JSONAPIFactory();

      factory
        .addResource('plugin-configs', '@cardstack/hub')
        .withAttributes({
          'plugin-config': {
            'application-card': { type: 'docs', id: 'app' },
          },
        })
        .withRelated('default-data-source', { data: { type: 'data-sources', id: 'default' } });

      factory.addResource('content-types', 'docs').withAttributes({
        router: [
          {
            path: '/router',
            query: {
              filter: {
                type: { exact: 'routers' },
                id: { exact: 'route' },
              },
            },
          },
        ],
      });
      factory.addResource('docs', 'app');

      factory.addResource('content-types', 'routers').withAttributes({
        router: [
          {
            path: '/puppy',
            query: {
              filter: {
                type: { exact: 'puppies' },
                id: { exact: 'vanGogh' },
              },
            },
          },
        ],
      });
      // not creating an instance of this content-type

      factory.addResource('content-types', 'puppies').withAttributes({
        router: [
          {
            path: '/',
          },
        ],
      });
      factory.addResource('puppies', 'vanGogh');

      env = await createDefaultEnvironment(`${__dirname}/../../../tests/stub-project`, factory.getModels());
      searchers = env.lookup('hub:searchers');
    });

    it('returns error card when a route has been matched, but its antecedant routing card does not exist', async function() {
      let { included, data: space } = await searchers.getSpace(env.session, '/router/puppy');

      expect(space).has.property('type', 'spaces');
      expect(space).has.property('id', '/router/puppy');
      expect(space.attributes.params).to.eql({
        path: '/router/puppy',
        session: { type: 'test-users', id: 'the-default-test-user' },
      });
      expect(space.attributes['allowed-query-params']).to.have.members([]);
      expect(space.attributes['route-stack']).to.eql([]);
      expect(space).has.deep.property('relationships.primary-card.data.id', 'not-found');
      expect(space).has.deep.property('relationships.primary-card.data.type', 'error-cards');

      expect(included.length).equals(1);
      expect(included[0]).has.property('id', 'not-found');
      expect(included[0]).has.property('type', 'error-cards');
    });
  });
});
