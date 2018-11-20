
const {
  createDefaultEnvironment,
  destroyDefaultEnvironment
} = require('../../../tests/stub-project/node_modules/@cardstack/test-support/env');
const JSONAPIFactory = require('../../../tests/stub-project/node_modules/@cardstack/test-support/jsonapi-factory');

describe('hub/routers', function () {
  let env, searchers;

  afterEach(async function () {
    await destroyDefaultEnvironment(env);
  });

  function setupTests(factory) {
    factory.addResource('content-types', 'infinity-cards')
      .withAttributes({ router: 'infinite-recursing' })
      .withRelated('fields', [
        factory.addResource('fields', 'name').withAttributes({
          fieldType: '@cardstack/core-types::string'
        })
      ]);

    factory.addResource('content-types', 'cards')
      .withAttributes({ router: 'sample-router' })
      .withRelated('fields', [
        factory.addResource('fields', 'dog-breed').withAttributes({
          fieldType: '@cardstack/core-types::string'
        }),
      ]);

    factory.addResource('content-types', 'puppies')
      .withRelated('fields', [
        factory.addResource('fields', 'name').withAttributes({
          fieldType: '@cardstack/core-types::string'
        }),
        factory.addResource('fields', 'dog-breed').withAttributes({
          fieldType: '@cardstack/core-types::string'
        }),
        factory.addResource('fields', 'favorite-toy').withAttributes({
          fieldType: '@cardstack/core-types::string'
        })
      ]);

    factory.addResource('content-types', 'rodents')
      .withAttributes({ router: 'sample-router' })
      .withRelated('fields', [
        factory.addResource('fields', 'name').withAttributes({
          fieldType: '@cardstack/core-types::string'
        }),
      ]);

    factory.addResource('content-types', 'rodents-errors');
    factory.addResource('grants', 'rodents-errors-grant')
      .withAttributes({
        'may-read-fields': true,
        'may-read-resource': true
      })
      .withRelated('who', [{ type: 'groups', id: 'everyone' }])
      .withRelated('types', [{ type: 'content-types', id: 'rodents-errors' }]);
    factory.addResource('rodents-errors', 'not-found');

    factory.addResource('content-types', 'rats')
      .withAttributes({ router: 'sample-router' })
      .withRelated('fields', [
        factory.addResource('fields', 'name').withAttributes({
          fieldType: '@cardstack/core-types::string'
        }),
      ]);
    factory.addResource('grants', 'rats-errors-grant')
      .withAttributes({
        'may-read-fields': true,
        'may-read-resource': true
      })
      .withRelated('who', [{ type: 'groups', id: 'everyone' }])
      .withRelated('types', [{ type: 'content-types', id: 'rats-errors' }]);
    factory.addResource('content-types', 'rats-errors');

    factory.addResource('content-types', 'hamsters')
      .withAttributes({ router: 'sample-router' })
      .withRelated('fields', [
        factory.addResource('fields', 'name').withAttributes({
          fieldType: '@cardstack/core-types::string'
        }),
      ]);

    factory.addResource('content-types', 'hamsters-errors');
    factory.addResource('grants', 'hamsters-errors-grant')
      .withAttributes({
        'may-read-fields': true,
        'may-read-resource': true
      })
      .withRelated('who', [{ type: 'groups', id: 'everyone' }])
      .withRelated('types', [{ type: 'content-types', id: 'hamsters-errors' }]);
    factory.addResource('hamsters-errors', 'not-found');

    factory.addResource('content-types', 'fishes')
      .withAttributes({ router: 'sample-router' })
      .withRelated('fields', [
        factory.addResource('fields', 'name').withAttributes({
          fieldType: '@cardstack/core-types::string'
        }),
      ]);

    factory.addResource('content-types', 'fishes-errors');
    factory.addResource('rodents-errors', 'not-found');

    factory.addResource('content-types', 'ponies')
      .withAttributes({ router: 'bad-router-missing-path' })
      .withRelated('fields', [
        factory.addResource('fields', 'name').withAttributes({
          fieldType: '@cardstack/core-types::string'
        }),
      ]);

    factory.addResource('content-types', 'kitties')
      .withAttributes({ router: 'bad-router-missing-query' })
      .withRelated('fields', [
        factory.addResource('fields', 'name').withAttributes({
          fieldType: '@cardstack/core-types::string'
        }),
      ]);

    factory.addResource('cards', 'app')
      .withAttributes({
        'dog-breed': 'dalmatian',
      });

    factory.addResource('puppies', 'vanGogh')
      .withAttributes({
        name: 'Van Gogh',
        'dog-breed': 'dalmatian',
        'favorite-toy': 'squeaky-snake'
      });

    factory.addResource('puppies', 'ringo')
      .withAttributes({
        name: 'Ringo',
        'dog-breed': 'dalmatian',
        'favorite-toy': 'tennis ball'
      });

    factory.addResource('puppies', 'lucky')
      .withAttributes({
        name: 'Lucky',
        'dog-breed': 'golden retriever',
        'favorite-toy': 'tennis ball'
      });

    factory.addResource('ponies', 'lawrence')
      .withAttributes({
        name: 'Lawrence',
      });

    factory.addResource('kitties', 'sally')
      .withAttributes({
        name: 'Sally',
      });

    factory.addResource('infinity-cards', 'infinite')
      .withAttributes({
        name: 'Infinite',
      });

    factory.addResource('rodents', 'rocky')
      .withAttributes({
        name: 'Rocky the Flying Squirrel',
      });

    factory.addResource('hamsters', 'yehudaster')
      .withAttributes({
        name: 'Yehudaster',
      });

    factory.addResource('rats', 'pizza-rat')
      .withAttributes({
        name: 'Pizza Rat',
      });

    factory.addResource('fishes', 'nemo')
      .withAttributes({
        name: 'Nemo',
      });
  }

  describe('using default application card', function () {
    beforeEach(async function () {
      let factory = new JSONAPIFactory();

      setupTests(factory);

      env = await createDefaultEnvironment(`${__dirname}/../../../tests/router-test-app`, factory.getModels());
      searchers = env.lookup('hub:searchers');
    });

    it('can get the default "getting started" application card when no application card has been specified in the plugin-config', async function () {
      let { included, data: space } = await searchers.get(env.session, 'master', 'spaces', '/');

      expect(space).has.property('type', 'spaces');
      expect(space).has.property('id', '/');
      expect(space).has.deep.property('attributes.query-params', '');
      expect(space).has.deep.property('relationships.primary-card.data.id', 'getting-started');
      expect(space).has.deep.property('relationships.primary-card.data.type', 'application-cards');

      expect(included.length).equals(1);
      expect(included[0]).has.property('id', 'getting-started');
      expect(included[0]).has.property('type', 'application-cards');
      expect(included[0]).has.deep.property('links.self', '/');
    });

    it('uses statically mapped routing for the application card when no routing has been specified', async function() {
      let { included, data: space } = await searchers.get(env.session, 'master', 'spaces', '/puppies/vanGogh');

      expect(space).has.property('type', 'spaces');
      expect(space).has.property('id', '/puppies/vanGogh');
      expect(space).has.deep.property('attributes.query-params', '');
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

    it('uses the path of the final router that routed the primary card in links.self', async function () {
      let { included, data: space } = await searchers.get(env.session, 'master', 'spaces', '/rodents/rocky/forward/rats/pizza-rat');

      expect(space).has.property('type', 'spaces');
      expect(space).has.property('id', '/rodents/rocky/forward/rats/pizza-rat');
      expect(space).has.deep.property('attributes.query-params', '');
      expect(space).has.deep.property('relationships.primary-card.data.id', 'pizza-rat');
      expect(space).has.deep.property('relationships.primary-card.data.type', 'rats');

      expect(included.length).equals(1);
      expect(included[0]).has.property('id', 'pizza-rat');
      expect(included[0]).has.property('type', 'rats');
      expect(included[0]).has.deep.property('attributes.name', 'Pizza Rat');
      expect(included[0]).has.deep.property('links.self', '/forward/rats/pizza-rat');
    });
  });

  describe('using default application card whose enclosing cardstack app has a routing feature', function() {
    beforeEach(async function () {
      let factory = new JSONAPIFactory();

      setupTests(factory);

      env = await createDefaultEnvironment(`${__dirname}/../../../tests/app-with-routing-feature`, factory.getModels());
      searchers = env.lookup('hub:searchers');
    });

    it('can get the space using a route from the cardstack application`s routing feature', async function () {
      let { included, data: space } = await searchers.get(env.session, 'master', 'spaces', '/cards/puppies/vanGogh');

      expect(space).has.property('type', 'spaces');
      expect(space).has.property('id', '/cards/puppies/vanGogh');
      expect(space).has.deep.property('attributes.query-params', '');
      expect(space).has.deep.property('relationships.primary-card.data.id', 'vanGogh');
      expect(space).has.deep.property('relationships.primary-card.data.type', 'puppies');

      expect(included.length).equals(1);
      expect(included[0]).has.property('id', 'vanGogh');
      expect(included[0]).has.property('type', 'puppies');
      expect(included[0]).has.deep.property('attributes.name', 'Van Gogh');
      expect(included[0]).has.deep.property('attributes.dog-breed', 'dalmatian');
      expect(included[0]).has.deep.property('attributes.favorite-toy', 'squeaky-snake');
      expect(included[0]).has.deep.property('links.self', '/cards/puppies/vanGogh');
    });
  });

  describe('using configured application card that has a routing feature', function () {
    beforeEach(async function () {
      let factory = new JSONAPIFactory();

      setupTests(factory);

      factory.addResource('plugin-configs', '@cardstack/hub')
        .withAttributes({
          'plugin-config': {
            'application-card': { type: 'cards', id: 'app' }
          }
        })
        .withRelated('default-data-source', { data: { type: 'data-sources', id: 'default' } });

      env = await createDefaultEnvironment(`${__dirname}/../../../tests/router-test-app`, factory.getModels());
      searchers = env.lookup('hub:searchers');
    });

    it('can throw error if route is missing path definition', async function () {
      let error;
      try {
        await searchers.get(env.session, 'master', 'spaces', '/forward/ponies/lawrence/blah');
      } catch (e) {
        error = e;
      }
      expect(error.message).equals(`The router for content type 'ponies' has a route that is missing a path.`);
    });

    it('can throw error if route is missing query definition', async function () {
      let error;
      try {
        await searchers.get(env.session, 'master', 'spaces', '/forward/kitties/sally/favorite');
      } catch (e) {
        error = e;
      }
      expect(error.message).equals(`The route '/favorite' for the router of content-type 'kitties' is missing a query.`);
    });

    it('can throw error if the router has recursed through more than the maximum number of router recursions', async function () {
      let error;
      try {
        await searchers.get(env.session, 'master', 'spaces', `/forward/infinity-cards/infinite
/omg/omg/omg/omg/omg/omg/omg/omg/omg/omg
/omg/omg/omg/omg/omg/omg/omg/omg/omg/omg
/omg/omg/omg/omg/omg/omg/omg/omg/omg/omg
/omg/omg/omg/omg/omg/omg/omg/omg/omg/omg
/omg/omg/omg/omg/omg/omg/omg/omg/omg/omg/omg`.replace(/\n/g, ''));
      } catch (e) {
        error = e;
      }
      expect(error.message).equals(`The space for path '/forward/infinity-cards/infinite
/omg/omg/omg/omg/omg/omg/omg/omg/omg/omg
/omg/omg/omg/omg/omg/omg/omg/omg/omg/omg
/omg/omg/omg/omg/omg/omg/omg/omg/omg/omg
/omg/omg/omg/omg/omg/omg/omg/omg/omg/omg
/omg/omg/omg/omg/omg/omg/omg/omg/omg/omg/omg' could not be resolved after 50 routing attempts.`.replace(/\n/g, ''));
    });

    it('can return an error card when the path does not match any routes', async function () {
      let { included, data: space } = await searchers.get(env.session, 'master', 'spaces', '/route-that-doesnt-exist');

      expect(space).has.property('type', 'spaces');
      expect(space).has.property('id', '/route-that-doesnt-exist');
      expect(space).has.deep.property('attributes.query-params', '');
      expect(space).has.deep.property('relationships.primary-card.data.id', 'not-found');
      expect(space).has.deep.property('relationships.primary-card.data.type', 'error-cards');

      expect(included.length).equals(1);
      expect(included[0]).has.property('id', 'not-found');
      expect(included[0]).has.property('type', 'error-cards');
    });

    it('can return an error card when the path does not correspond to a card that exists', async function () {
      let { included, data: space } = await searchers.get(env.session, 'master', 'spaces', '/forward/cards/route-that-doesnt-exist');

      expect(space).has.property('type', 'spaces');
      expect(space).has.property('id', '/forward/cards/route-that-doesnt-exist');
      expect(space).has.deep.property('attributes.query-params', '');
      expect(space).has.deep.property('relationships.primary-card.data.id', 'not-found');
      expect(space).has.deep.property('relationships.primary-card.data.type', 'error-cards');

      expect(included.length).equals(1);
      expect(included[0]).has.property('id', 'not-found');
      expect(included[0]).has.property('type', 'error-cards');
    });


    it('can return error card if the router identifies a primary card and the path part of the URL has not been fully consumed', async function () {
      let { included, data: space } = await searchers.get(env.session, 'master', 'spaces', '/favorite-puppy/blah');

      expect(space).has.property('type', 'spaces');
      expect(space).has.property('id', '/favorite-puppy/blah');
      expect(space).has.deep.property('attributes.query-params', '');
      expect(space).has.deep.property('relationships.primary-card.data.id', 'not-found');
      expect(space).has.deep.property('relationships.primary-card.data.type', 'error-cards');

      expect(included.length).equals(1);
      expect(included[0]).has.property('id', 'not-found');
      expect(included[0]).has.property('type', 'error-cards');
    });

    it('can override the system error card with an error card specific to the routing card', async function () {
      let { included, data: space } = await searchers.get(env.session, 'master', 'spaces', '/forward/rodents/rocky/forward/hamsters/yehudaster/whaaa');

      expect(space).has.property('type', 'spaces');
      expect(space).has.property('id', '/forward/rodents/rocky/forward/hamsters/yehudaster/whaaa');
      expect(space).has.deep.property('attributes.query-params', '');
      expect(space).has.deep.property('relationships.primary-card.data.id', 'not-found');
      expect(space).has.deep.property('relationships.primary-card.data.type', 'hamsters-errors');

      expect(included.length).equals(1);
      expect(included[0]).has.property('id', 'not-found');
      expect(included[0]).has.property('type', 'hamsters-errors');
    });

    it('uses system error card if the custom error card doesnt have an instance with the id of "not-found"', async function() {
      let { included, data: space } = await searchers.get(env.session, 'master', 'spaces', '/forward/rats/pizza-rat/blah');

      expect(space).has.property('type', 'spaces');
      expect(space).has.property('id', '/forward/rats/pizza-rat/blah');
      expect(space).has.deep.property('attributes.query-params', '');
      expect(space).has.deep.property('relationships.primary-card.data.id', 'not-found');
      expect(space).has.deep.property('relationships.primary-card.data.type', 'error-cards');

      expect(included.length).equals(1);
      expect(included[0]).has.property('id', 'not-found');
      expect(included[0]).has.property('type', 'error-cards');
    });

    it('uses system error card if the custom error card doesnt have an open grant', async function() {
      let { included, data: space } = await searchers.get(env.session, 'master', 'spaces', '/forward/fishes/nemo/blah');

      expect(space).has.property('type', 'spaces');
      expect(space).has.property('id', '/forward/fishes/nemo/blah');
      expect(space).has.deep.property('attributes.query-params', '');
      expect(space).has.deep.property('relationships.primary-card.data.id', 'not-found');
      expect(space).has.deep.property('relationships.primary-card.data.type', 'error-cards');

      expect(included.length).equals(1);
      expect(included[0]).has.property('id', 'not-found');
      expect(included[0]).has.property('type', 'error-cards');
    });

    it('can return an http-status of 404 for the `not-found` error card', async function() {
      let { data: space } = await searchers.get(env.session, 'master', 'spaces', '/non-existant-card');
      expect(space).has.deep.property('attributes.http-status', 404);
    });

    it('can return an http-status of 200 for a card that is not an error card', async function() {
      let { data: space } = await searchers.get(env.session, 'master', 'spaces', '/favorite-puppy');
      expect(space).has.deep.property('attributes.http-status', 200);
    });

    it('can get the space using a route that is static', async function () {
      let { included, data: space } = await searchers.get(env.session, 'master', 'spaces', '/favorite-puppy');

      expect(space).has.property('type', 'spaces');
      expect(space).has.property('id', '/favorite-puppy');
      expect(space).has.deep.property('attributes.query-params', '');
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

    it('can get the space using a route that has dynamic segments', async function () {
      let { included, data: space } = await searchers.get(env.session, 'master', 'spaces', '/buddy/Ringo');

      expect(space).has.property('type', 'spaces');
      expect(space).has.property('id', '/buddy/Ringo');
      expect(space).has.deep.property('attributes.query-params', '');
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

    it('can get the space using a route that uses contextual card data', async function () {
      let {included,  data: space } = await searchers.get(env.session, 'master', 'spaces', '/contextual-favorite-toy/squeaky-snake');

      expect(space).has.property('type', 'spaces');
      expect(space).has.property('id', '/contextual-favorite-toy/squeaky-snake');
      expect(space).has.deep.property('attributes.query-params', '');
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

    it('can get the space using a route that uses a query param', async function () {
      let { included, data: space } = await searchers.get(env.session, 'master', 'spaces', '/sorted?cards[sort]=favorite-toy&foo=bar&bee=bop');

      expect(space).has.property('type', 'spaces');
      expect(space).has.property('id', '/sorted?cards[sort]=favorite-toy&foo=bar&bee=bop');
      expect(space).has.deep.property('attributes.query-params', '?foo=bar&bee=bop');
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

    it('can include query params that were not consumed', async function () {
      let { data: space } = await searchers.get(env.session, 'master', 'spaces', '/favorite-puppy?foo=bar');

      expect(space).has.property('type', 'spaces');
      expect(space).has.property('id', '/favorite-puppy?foo=bar');
      expect(space).has.deep.property('attributes.query-params', '?foo=bar');
      expect(space).has.deep.property('relationships.primary-card.data.id', 'vanGogh');
      expect(space).has.deep.property('relationships.primary-card.data.type', 'puppies');
    });

  });

});
