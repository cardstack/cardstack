const {
  createDefaultEnvironment,
  destroyDefaultEnvironment
} = require('../../../tests/stub-project/node_modules/@cardstack/test-support/env');
const JSONAPIFactory = require('../../../tests/stub-project/node_modules/@cardstack/test-support/jsonapi-factory');
const { getPath } = require('../cardstack/router-utils');

describe('routing/paths', function () {
  let env;

  afterEach(async function () {
    await destroyDefaultEnvironment(env);
  });

  async function getPathForControllingBranch(routingCard, card) {
    let schema = await (await env.lookup('hub:current-schema')).forControllingBranch();
    let plugins = await (await env.lookup('hub:plugins')).active();

    return await getPath(plugins, schema, routingCard, card);
  }

  describe('getPath() with router that has :friendly_id based route and vanity route', function () {
    let routingCard, card;
    beforeEach(async function () {
      let factory = new JSONAPIFactory();

      factory.addResource('content-types', 'cards')
        .withAttributes({ router: 'puppy-routing' })
        .withRelated('fields', [
          factory.addResource('fields', 'dog-breed').withAttributes({
            fieldType: '@cardstack/core-types::string'
          }),
        ]);
      routingCard = factory.addResource('cards', 'app');

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

      env = await createDefaultEnvironment(`${__dirname}/../../../tests/router-test-app`, factory.getModels());
    });

    it('can get the path for a card that uses a vanity path', async function() {
      // in this test, the "/" is actually a "vanity URL" for the routingCard
      let path = await getPathForControllingBranch(routingCard, routingCard);
      expect(path).equals('/');
    });

    it('can get the path for a card that uses a :friendly_id segment in the route when a static mapping route exists', async function() {
      let path = await getPathForControllingBranch(routingCard, card);
      expect(path).equals('/buddy/VanGogh');
    });

    it('does not get a path when the routing card has no router associated with it', async function() {
      let path = await getPathForControllingBranch(card, card);
      expect(path).is.not.ok;
    });
  });

  describe('getPath() with router that has static mapping route', function () {
    let routingCard, card;
    beforeEach(async function () {
      let factory = new JSONAPIFactory();

      factory.addResource('content-types', 'cards')
        .withAttributes({ router: 'static-mapping-routing' })
        .withRelated('fields', [
          factory.addResource('fields', 'dog-breed').withAttributes({
            fieldType: '@cardstack/core-types::string'
          }),
        ]);
      routingCard = factory.addResource('cards', 'app');

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

      env = await createDefaultEnvironment(`${__dirname}/../../../tests/router-test-app`, factory.getModels());
    });

    it('can get the path for a card that uses a static mapping route', async function() {
      let path = await getPathForControllingBranch(routingCard, card);
      expect(path).equals('/puppies/vanGogh');
    });

    it('can get the path for a card that uses a vanity path', async function() {
      // in this test, the "/" is actually a "vanity URL" for the routingCard
      let path = await getPathForControllingBranch(routingCard, routingCard);
      expect(path).equals('/');
    });

    it('doesnt get a path for "spaces" content-type', async function() {
      let space = await (await env.lookup('hub:searchers')).getFromControllingBranch(env.session, 'spaces', '/');
      let path = await getPathForControllingBranch(routingCard, space);
      expect(path).is.not.ok;
    });
  });

  describe('getPath() with non canonical routing', function () {
    let routingCard, card;
    beforeEach(async function () {
      let factory = new JSONAPIFactory();

      factory.addResource('content-types', 'cards')
        .withAttributes({ router: 'non-canonical-routing' })
        .withRelated('fields', [
          factory.addResource('fields', 'dog-breed').withAttributes({
            fieldType: '@cardstack/core-types::string'
          }),
        ]);
      routingCard = factory.addResource('cards', 'app')
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

      env = await createDefaultEnvironment(`${__dirname}/../../../tests/router-test-app`, factory.getModels());
    });

    it('does not get a path when there is no route that can get the card using a unique identifier', async function() {
      let path = await getPathForControllingBranch(routingCard, card);
      expect(path).is.not.ok;
    });
  });

});
