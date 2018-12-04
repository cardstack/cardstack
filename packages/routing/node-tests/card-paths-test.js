const {
  createDefaultEnvironment,
  destroyDefaultEnvironment
} = require('../../../tests/stub-project/node_modules/@cardstack/test-support/env');
const JSONAPIFactory = require('../../../tests/stub-project/node_modules/@cardstack/test-support/jsonapi-factory');
const { getPath } = require('../cardstack/path');

describe('routing/paths', function () {
  let env, routers, routingCards;

  afterEach(async function () {
    await destroyDefaultEnvironment(env);
  });

  async function getCardPath(card) {
    let { routerMapByDepth } = await routers.getRoutersInfo();
    return await getPath(routingCards, card, routerMapByDepth);
  }

  describe('getPath() with router that has :friendly_id based route and vanity route', function () {
    let applicationCard, card;
    beforeEach(async function () {
      let factory = new JSONAPIFactory();

      factory.addResource('content-types', 'cards')
        .withAttributes({
          router: [{
            path: '/buddy/:friendly_id',
            query: {
              filter: {
                type: { exact: 'puppies' },
                name: { exact: ':friendly_id' }
              }
            }
          },
          {
            path: '/:type/:id',
            query: {
              filter: {
                type: { exact: ':type' },
                id: { exact: ':id' }
              }
            }
          },
          {
            path: '/',
            query: {
              filter: {
                type: { exact: ':card:type' },
                id: { exact: ':card:id' }
              }
            }
          }]
        })
        .withRelated('fields', [
          factory.addResource('fields', 'dog-breed').withAttributes({
            fieldType: '@cardstack/core-types::string'
          }),
        ]);
      applicationCard = factory.addResource('cards', 'app');

      factory.addResource('content-types', 'puppies')
        .withRelated('fields', [
          factory.addResource('fields', 'name').withAttributes({
            fieldType: '@cardstack/core-types::string'
          }),
        ]);
      card = factory.addResource('puppies', 'vanGogh')
        .withAttributes({
          name: 'VanGogh',
        });

      factory.addResource('plugin-configs', '@cardstack/hub')
        .withAttributes({
          'plugin-config': {
            'application-card': { type: applicationCard.data.type, id: applicationCard.data.id }
          }
        })
        .withRelated('default-data-source', { data: { type: 'data-sources', id: 'default' } });

      routingCards = [ applicationCard ];

      env = await createDefaultEnvironment(`${__dirname}/../../../tests/stub-project`, factory.getModels());
      routers = env.lookup('hub:routers');
    });

    it('can get the path for a card that uses a vanity path', async function() {
      // in this test, the "/" is actually a "vanity URL" for the applicationCard
      let path = await getCardPath(applicationCard);
      expect(path).equals('/');
    });

    it('can get the path for a card that uses a :friendly_id segment in the route when a static mapping route exists', async function() {
      let path = await getCardPath(card);
      expect(path).equals('/buddy/VanGogh');
    });
  });

  describe('getPath() with router that has static mapping route', function () {
    let card, applicationCard;
    beforeEach(async function () {
      let factory = new JSONAPIFactory();

      factory.addResource('content-types', 'cards')
        .withAttributes({
          router: [{
            path: '/:type/:id',
            query: {
              filter: {
                type: { exact: ':type' },
                id: { exact: ':id' }
              }
            }
          },
          {
            path: '/',
            query: {
              filter: {
                type: { exact: ':card:type' },
                id: { exact: ':card:id' }
              }
            }
          }]
        })
        .withRelated('fields', [
          factory.addResource('fields', 'dog-breed').withAttributes({
            fieldType: '@cardstack/core-types::string'
          }),
        ]);

      applicationCard = factory.addResource('cards', 'app');

      factory.addResource('content-types', 'puppies')
        .withRelated('fields', [
          factory.addResource('fields', 'name').withAttributes({
            fieldType: '@cardstack/core-types::string'
          }),
        ]);
      card = factory.addResource('puppies', 'vanGogh')
        .withAttributes({
          name: 'VanGogh',
        });

      factory.addResource('plugin-configs', '@cardstack/hub')
        .withAttributes({
          'plugin-config': {
            'application-card': { type: applicationCard.data.type, id: applicationCard.data.id }
          }
        })
        .withRelated('default-data-source', { data: { type: 'data-sources', id: 'default' } });

      routingCards = [ applicationCard ];

      env = await createDefaultEnvironment(`${__dirname}/../../../tests/stub-project`, factory.getModels());
      routers = env.lookup('hub:routers');
    });

    it('can get the path for a card that uses a static mapping route', async function() {
      let path = await getCardPath(card);
      expect(path).equals('/puppies/vanGogh');
    });

    it('can get the path for a card that uses a vanity path', async function() {
      // in this test, the "/" is actually a "vanity URL" for the applicationCard
      let path = await getCardPath(applicationCard);
      expect(path).equals('/');
    });

    it('doesnt get a path for "spaces" content-type', async function() {
      let space = await (await env.lookup('hub:searchers')).getFromControllingBranch(env.session, 'spaces', '/');
      let path = await getCardPath(space);
      expect(path).is.not.ok;
    });
  });

  describe('getPath() with non canonical routing', function () {
    let card, applicationCard;
    beforeEach(async function () {
      let factory = new JSONAPIFactory();

      factory.addResource('content-types', 'cards')
        .withAttributes({
          router: [{
            path: '/contextual-favorite-toy/:toy',
            query: {
              filter: {
                type: { exact: 'puppies' },
                'dog-breed': { exact: ':card:dog-breed' },
                'favorite-toy': ':toy'
              }
            }
          },
          {
            path: '/sorted?sort=:sort',
            query: {
              filter: {
                type: { exact: 'puppies' },
              },
              sort: ':sort'
            }
          }]
        })
        .withRelated('fields', [
          factory.addResource('fields', 'dog-breed').withAttributes({
            fieldType: '@cardstack/core-types::string'
          }),
        ]);

      applicationCard = factory.addResource('cards', 'app')
        .withAttributes({
          'dog-breed': 'dalmatian',
        });

      factory.addResource('content-types', 'puppies')
        .withRelated('fields', [
          factory.addResource('fields', 'name').withAttributes({
            fieldType: '@cardstack/core-types::string'
          }),
        ]);
      card = factory.addResource('puppies', 'vanGogh')
        .withAttributes({
          name: 'VanGogh',
        });

      factory.addResource('plugin-configs', '@cardstack/hub')
        .withAttributes({
          'plugin-config': {
            'application-card': { type: applicationCard.data.type, id: applicationCard.data.id }
          }
        })
        .withRelated('default-data-source', { data: { type: 'data-sources', id: 'default' } });

      routingCards = [ applicationCard ];

      env = await createDefaultEnvironment(`${__dirname}/../../../tests/stub-project`, factory.getModels());
      routers = env.lookup('hub:routers');
    });

    it('does not get a path when there is no route that can get the card using a unique identifier', async function() {
      let path = await getCardPath(card);
      expect(path).is.not.ok;
    });
  });

  describe('routing card is mounted below the application card', function() {
    let card, applicationCard;
    beforeEach(async function () {
      let factory = new JSONAPIFactory();

      factory.addResource('content-types', 'cards')
        .withAttributes({
          router: [{
            path: '/routing/:router-id',
            query: {
              filter: {
                type: { exact: 'routing-cards' },
                id: { exact: ':router-id' }
              }
            }
          }]
        });

      applicationCard = factory.addResource('cards', 'app');

      factory.addResource('content-types', 'routing-cards')
        .withAttributes({
          router: [{
            path: '/:puppy-id',
            query: {
              filter: {
                type: { exact: 'puppies'},
                id: { exact: ':puppy-id'}
              }
            }
          }]
        })
        .withRelated('fields', [
          factory.addResource('fields', 'name').withAttributes({
            fieldType: '@cardstack/core-types::string'
          }),
        ]);
      let routingCard = factory.addResource('routing-cards', 'routeA')
        .withAttributes({ name: 'Route A' });

      factory.addResource('content-types', 'puppies')
        .withRelated('fields', [
          factory.addResource('fields', 'name').withAttributes({
            fieldType: '@cardstack/core-types::string'
          }),
        ]);
      card = factory.addResource('puppies', 'vanGogh')
        .withAttributes({
          name: 'VanGogh',
        });

      factory.addResource('plugin-configs', '@cardstack/hub')
        .withAttributes({
          'plugin-config': {
            'application-card': { type: applicationCard.data.type, id: applicationCard.data.id }
          }
        })
        .withRelated('default-data-source', { data: { type: 'data-sources', id: 'default' } });

      routingCards = [ routingCard, applicationCard ];

      env = await createDefaultEnvironment(`${__dirname}/../../../tests/stub-project`, factory.getModels());
      routers = env.lookup('hub:routers');
    });

    it('can get a path that includes the mount point of the routing card', async function() {
      let path = await getCardPath(card);
      expect(path).equals('/routing/routeA/vanGogh');
    });

  });

  describe('routing card uses queryless route', function() {
    let card, applicationCard;
    beforeEach(async function () {
      let factory = new JSONAPIFactory();

      factory.addResource('content-types', 'cards')
        .withAttributes({
          router: [{
            path: '/routing/:router-id',
            query: {
              filter: {
                type: { exact: 'routing-cards' },
                id: { exact: ':router-id' }
              }
            }
          }]
        });

      applicationCard = factory.addResource('cards', 'app');

      factory.addResource('content-types', 'routing-cards')
        .withAttributes({
          router: [{
            path: '/:puppy-id',
            query: {
              filter: {
                type: { exact: 'puppies'},
                id: { exact: ':puppy-id'}
              }
            }
          }]
        })
        .withRelated('fields', [
          factory.addResource('fields', 'name').withAttributes({
            fieldType: '@cardstack/core-types::string'
          }),
        ]);
      let routingCard = factory.addResource('routing-cards', 'routeA')
        .withAttributes({ name: 'Route A' });

      factory.addResource('content-types', 'puppies')
        .withAttributes({
          router: [{ path: '/' }]
        })
        .withRelated('fields', [
          factory.addResource('fields', 'name').withAttributes({
            fieldType: '@cardstack/core-types::string'
          }),
        ]);
      card = factory.addResource('puppies', 'vanGogh')
        .withAttributes({
          name: 'VanGogh',
        });

      factory.addResource('plugin-configs', '@cardstack/hub')
        .withAttributes({
          'plugin-config': {
            'application-card': { type: applicationCard.data.type, id: applicationCard.data.id }
          }
        })
        .withRelated('default-data-source', { data: { type: 'data-sources', id: 'default' } });

      routingCards = [ card, routingCard, applicationCard ];

      env = await createDefaultEnvironment(`${__dirname}/../../../tests/stub-project`, factory.getModels());
      routers = env.lookup('hub:routers');
    });

    it('can get a path that includes the mount point of the routing card for a queryless routing card', async function() {
      let path = await getCardPath(card);
      expect(path).equals('/routing/routeA/vanGogh');
    });
  });

  describe('routing card is derived from query that uses :card:data', function() {
    let card, applicationCard;
    beforeEach(async function () {
      let factory = new JSONAPIFactory();

      factory.addResource('content-types', 'cards')
        .withAttributes({
          router: [{
            path: '/deep-routing/:router-id',
            query: {
              filter: {
                type: { exact: 'deep-routing-cards' },
                id: { exact: ':router-id' }
              }
            }
          }]
        });

      applicationCard = factory.addResource('cards', 'app');

      factory.addResource('content-types', 'routing-cards')
        .withAttributes({
          router: [{
            path: '/:puppy-id',
            query: {
              filter: {
                type: { exact: ':card:puppy-type' },
                id: { exact: ':puppy-id'}
              }
            }
          }]
        })
        .withRelated('fields', [
          factory.addResource('fields', 'name').withAttributes({
            fieldType: '@cardstack/core-types::string'
          }),
          factory.addResource('fields', 'puppy-type').withAttributes({
            fieldType: '@cardstack/core-types::string'
          }),
        ]);
      let routingCard = factory.addResource('routing-cards', 'routeA')
        .withAttributes({ name: 'Route A', 'puppy-type': 'puppies' });

      factory.addResource('content-types', 'deep-routing-cards')
        .withAttributes({
          router: [{
            path: '/routing/:router-id',
            query: {
              filter: {
                type: { exact: ':card:routing-type' },
                id: { exact: ':router-id' }
              }
            }
          }]
        })
        .withRelated('fields', [
          factory.addResource('fields', 'name').withAttributes({
            fieldType: '@cardstack/core-types::string'
          }),
          factory.addResource('fields', 'routing-type').withAttributes({
            fieldType: '@cardstack/core-types::string'
          }),
        ]);
      let deepRoutingCard = factory.addResource('deep-routing-cards', 'route1')
        .withAttributes({ name: 'Deep Route 1', 'routing-type': 'routing-cards' });

      factory.addResource('content-types', 'puppies')
        .withRelated('fields', [
          factory.addResource('fields', 'name').withAttributes({
            fieldType: '@cardstack/core-types::string'
          }),
        ]);
      card = factory.addResource('puppies', 'vanGogh')
        .withAttributes({
          name: 'VanGogh',
        });

      factory.addResource('plugin-configs', '@cardstack/hub')
        .withAttributes({
          'plugin-config': {
            'application-card': { type: applicationCard.data.type, id: applicationCard.data.id }
          }
        })
        .withRelated('default-data-source', { data: { type: 'data-sources', id: 'default' } });

      routingCards = [ routingCard, deepRoutingCard, applicationCard ];

      env = await createDefaultEnvironment(`${__dirname}/../../../tests/stub-project`, factory.getModels());
      routers = env.lookup('hub:routers');
    });

    it('can get the path when routing card is derived from query that uses :card:data', async function() {
      let path = await getCardPath(card);
      expect(path).equals('/deep-routing/route1/routing/routeA/vanGogh');
    });

  });

});
