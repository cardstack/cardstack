const JSONAPIFactory = require('../../../tests/stub-searcher/node_modules/@cardstack/test-support/jsonapi-factory');
const {
  createDefaultEnvironment,
  destroyDefaultEnvironment
} = require('../../../tests/stub-searcher/node_modules/@cardstack/test-support/env');
const qs = require('qs');

describe('hub/searchers/basics', function() {
  let env, chocolate, source, searchers;

  async function setup(stubParams) {
    let factory = new JSONAPIFactory();

    source = factory.addResource('data-sources').
      withAttributes({
        sourceType: 'stub-searcher',
        params: stubParams
      });

    factory.addResource('content-types', 'puppies')
      .withRelated('fields', [
      factory.addResource('fields', 'example').withAttributes({
        fieldType: '@cardstack/core-types::belongs-to'
      }).withRelated('relatedTypes', [
        factory.addResource('content-types', 'examples').withRelated('fields', [
          factory.addResource('fields', 'example-flavor').withAttributes({
            fieldType: '@cardstack/core-types::string'
          }),
          factory.addResource('fields', 'example-size').withAttributes({
            fieldType: '@cardstack/core-types::string'
          }),
          factory.addResource('fields', 'topping').withAttributes({
            fieldType: '@cardstack/core-types::case-insensitive'
          }),
          factory.addResource('fields', 'example-counter').withAttributes({
            fieldType: '@cardstack/core-types::integer'
          })
        ])
      ])
    ]);

    chocolate = factory.addResource('examples').withAttributes({
      exampleFlavor: 'chocolate',
      exampleSize: 'large',
      topping: 'sprinkles'
    });

    env = await createDefaultEnvironment(`${__dirname}/../../../tests/stub-searcher`, factory.getModels());
    searchers = env.lookup('hub:searchers');
    await searchers._cachingPromise;
  }

  async function teardown() {
    if (env) {
      await searchers._cachingPromise;
      await destroyDefaultEnvironment(env);
    }
  }

  describe('empty', function() {
    before(async function(){ await setup({}); });
    after(teardown);

    it("throws when no searcher#get has it", async function() {
      try {
        await searchers.get(env.session, 'local-hub', 'examples', 'nonexistent');
        throw new Error("should not get here");
      } catch (err) {
        expect(err.message).to.match(/No such resource local-hub\/examples\/nonexist/);
      }
    });

    it("searchers#get finds record via internal searcher", async function() {
      let response = await searchers.get(env.session, 'local-hub', 'examples', chocolate.id);
      expect(response.data.attributes['example-flavor']).to.equal('chocolate');
    });

    it("searchers#search finds record via internal searcher", async function() {
      let response = await searchers.search(env.session, { filter: { 'example-flavor': { exact: 'chocolate' } } });
      expect(response.data).length(1);
      expect(response.data[0].attributes['example-flavor']).to.equal('chocolate');
    });

    it("searchers#search finds record via internal searcher with custom analyzer", async function() {
      let response = await searchers.search(env.session, { filter: { 'topping': { exact: 'SPriNkLeS' } } });
      expect(response.data).length(1);
      expect(response.data[0].attributes['topping']).to.equal('sprinkles');
    });
  });

  describe('injectFirst', function() {
    before(async function(){ await setup({ injectFirst: 'vanilla' }); });
    after(teardown);

    it("a plugin's searcher#get can run before the internal searcher", async function() {
      let response = await searchers.get(env.session, 'local-hub', 'examples', chocolate.id);
      expect(response.data.attributes['example-flavor']).to.equal('vanilla');
    });

    it("a plugin's searchers#search can run before the internal searcher", async function() {
      let response = await searchers.search(env.session, { filter: { 'example-flavor': { exact: 'chocolate' } } });
      expect(response.data).length(1);
      expect(response.data[0].attributes['example-flavor']).to.equal('vanilla');
    });

    it("adds source id to model when using searcher#get", async function() {
      let response = await searchers.get(env.session, 'local-hub', 'examples', 'anything');
      expect(response.data).has.deep.property('meta.source', source.id);
    });

    it("adds source id to model when using searcher#search", async function() {
      let response = await searchers.search(env.session, {});
      expect(response.data[0]).has.deep.property('meta.source', source.id);
    });

  });

  describe('injectSecond', function() {
    before(async function(){ await setup({ injectSecond: 'vanilla' }); });
    after(teardown);

    it("a plugin's searcher#get can run after the internal searcher", async function() {
      let response = await searchers.get(env.session, 'local-hub', 'examples', '10000');
      expect(response.data.attributes['example-flavor']).to.equal('vanilla');
    });
  });

  describe('caching', function() {
    beforeEach(async function(){
      await setup({
        injectSecond: 'vanilla',
        metaFor: {
          'examples/1000': {
            'cardstack-cache-control': { 'max-age': 300 }
          }
        }
       });
    });
    afterEach(teardown);

    // I'm manually reaching in here rather than try to wait or use a negative
    // maxAge, because the only bulletproof thing we could do is wait around
    // for expiration, and I don't want to wait around, so instead we'll do
    // something fast that will fail loudly if the implementation changes out
    // from under us.
    async function alterExpiration(type, id, interval) {
      let client = env.lookup(`plugin-client:${require.resolve('@cardstack/pgsearch/client')}`);
      let result = await client.query('update documents set expires = expires + $1 where type=$2 and id=$3', [interval, type, id]);
      if (result.rowCount !== 1) {
        throw new Error(`test was unable to alter expiration`);
      }
    }

    it("can cache searcher#get responses", async function() {
      let response = await searchers.get(env.session, 'local-hub', 'examples', '1000');
      await searchers._cachingPromise;
      expect(response).has.deep.property('data.attributes.example-counter');
      let firstCounter = response.data.attributes['example-counter'];
      response = await searchers.get(env.session, 'local-hub', 'examples', '1000');
      await searchers._cachingPromise;
      let secondCounter = response.data.attributes['example-counter'];
      expect(firstCounter).to.equal(secondCounter);
    });

    it("can cache searcher#get included resources", async function() {
      let { data: { id, type }} = await env.lookup('hub:writers').create(env.session, 'puppies', {
        data: {
          type: 'puppies',
          relationships: {
            example: { data: { type: 'examples', id: '1000' } }
          }
        }
      });
      let response = (await searchers.get(env.session, 'local-hub', type, id, { includePaths: ['example'] })).included[0];
      await searchers._cachingPromise;
      expect(response).has.deep.property('attributes.example-counter');
      let firstCounter = response.attributes['example-counter'];
      response = (await searchers.get(env.session, 'local-hub', type, id, { includePaths: ['example'] })).included[0];
      await searchers._cachingPromise;
      let secondCounter = response.attributes['example-counter'];
      expect(firstCounter).to.equal(secondCounter);
    });

    it("does not return expired searcher#get responses", async function() {
      let response = await searchers.get(env.session, 'local-hub', 'examples', '1000');
      await searchers._cachingPromise;
      expect(response).has.deep.property('data.attributes.example-counter');
      let firstCounter = response.data.attributes['example-counter'];

      await alterExpiration('examples', '1000', '-301 seconds');

      response = await searchers.get(env.session, 'local-hub', 'examples', '1000');
      await searchers._cachingPromise;
      let secondCounter = response.data.attributes['example-counter'];
      expect(firstCounter).to.not.equal(secondCounter);
    });

    it("does not return expired searcher#get included resources", async function() {
      let { data: { id, type }} = await env.lookup('hub:writers').create(env.session, 'puppies', {
        data: {
          type: 'puppies',
          relationships: {
            example: { data: { type: 'examples', id: '1000' } }
          }
        }
      });
      let response = (await searchers.get(env.session, 'local-hub', type, id, { includePaths: ['example'] })).included[0];
      await searchers._cachingPromise;
      expect(response).has.deep.property('attributes.example-counter');
      let firstCounter = response.attributes['example-counter'];

      await alterExpiration('examples', '1000', '-301 seconds');

      response = (await searchers.get(env.session, 'local-hub', type, id, { includePaths: ['example'] })).included[0];
      await searchers._cachingPromise;
      let secondCounter = response.attributes['example-counter'];
      expect(firstCounter).to.not.equal(secondCounter);
    });

    it("does not return expired documents in searcher#search", async function() {
      await searchers.get(env.session, 'local-hub', 'examples', '1000');
      await searchers._cachingPromise;
      await alterExpiration('examples', '1000', '-301 seconds');
      let response = await searchers.search(env.session, { filter: { type: 'examples', id: '1000' }});
      await searchers._cachingPromise;
      expect(response.data).length(0);
    });
  });

  describe('related resource links search', async function() {
    let seeds;

    beforeEach(async function() {
      seeds = new JSONAPIFactory();

      seeds.addResource('content-types', 'treats')
        .withRelated('fields', [
          seeds.addResource('fields', 'crunchiness').withAttributes({
            fieldType: '@cardstack/core-types::integer'
          })
        ]);

      seeds.addResource('content-types', 'puppies')
        .withRelated('fields', [
          seeds.addResource('fields', 'treats').withAttributes({
            fieldType: '@cardstack/core-types::has-many'
          }),
          seeds.addResource('fields', 'favorite-treat').withAttributes({
            fieldType: '@cardstack/core-types::belongs-to'
          }),
          seeds.addResource('fields', 'worst-treat').withAttributes({
            fieldType: '@cardstack/core-types::belongs-to'
          }),
          seeds.addResource('fields', 'soggy-treats').withAttributes({
            fieldType: '@cardstack/core-types::has-many'
          }),
          seeds.addResource('fields', 'crunchiest-treat').withAttributes({
            fieldType: '@cardstack/core-types::belongs-to'
          })
        ]);

      seeds.addResource('treats', 'milkBiscuit').withAttributes({ crunchiness: 9 });
      seeds.addResource('treats', 'banana').withAttributes({ crunchiness: 1 });
      seeds.addResource('treats', 'carrot').withAttributes({ crunchiness: 8 });

    });

    afterEach(teardown);

    it("gets related resources without data for has-many relationships", async function() {
      let query = {
        filter: {
          type: { exact: 'treats' },
          crunchiness: { range: { gt: 5 } }
        },
        sort: 'crunchiness'
      };

      seeds.addResource('puppies', 'vanGogh')
      .withRelatedLink('treats', `/api?${qs.stringify(query)}`);

      env = await createDefaultEnvironment(__dirname + '/../../../tests/ephemeral-test-app', seeds.getModels());
      searchers = env.lookup('hub:searchers');
      let { data:resource } = await searchers.get(env.session, 'local-hub', 'puppies', 'vanGogh');
      expect(resource.relationships.treats.links.related).to.equal(`/api?${qs.stringify(query)}`);
      expect(resource.relationships.treats).not.to.have.property('data');
    });

    it("gets related resources without data for belongs-to relationships", async function() {
      let query = {
        filter: {
          type: { exact: 'treats' }
        },
        sort: '-crunchiness',
        page: {
          size: 1
        }
      };

      seeds.addResource('puppies', 'vanGogh')
      .withRelatedLink('favorite-treat', `/api?${qs.stringify(query)}`);

      env = await createDefaultEnvironment(__dirname + '/../../../tests/ephemeral-test-app', seeds.getModels());
      searchers = env.lookup('hub:searchers');
      let { data:resource } = await searchers.get(env.session, 'local-hub', 'puppies', 'vanGogh');
      expect(resource.relationships['favorite-treat'].links.related).to.equal(`/api?${qs.stringify(query)}`);
      expect(resource.relationships['favorite-treat']).not.to.have.property('data');
    });

    it("gets related resources with data for has-many relationships", async function() {
      let query = {
        filter: {
          type: { exact: 'treats' },
          crunchiness: { range: { gt: 5 } }
        },
        sort: 'crunchiness'
      };

      seeds.addResource('puppies', 'vanGogh')
      .withRelatedLink('treats', `/api?${qs.stringify(query)}`);

      env = await createDefaultEnvironment(__dirname + '/../../../tests/ephemeral-test-app', seeds.getModels());
      searchers = env.lookup('hub:searchers');
      let { data:resource } = await searchers.get(env.session, 'local-hub', 'puppies', 'vanGogh', { includePaths: ['treats'] });
      expect(resource.relationships.treats.links.related).to.equal(`/api?${qs.stringify(query)}`);
      expect(resource.relationships.treats.data).to.eql([
        { type: 'treats', id: 'carrot' },
        { type: 'treats', id: 'milkBiscuit' }
      ]);
    });

    it("gets related resources with data for belongs-to relationships", async function() {
      let query = {
        filter: {
          type: { exact: 'treats' }
        },
        sort: '-crunchiness',
        page: {
          size: 1
        }
      };

      seeds.addResource('puppies', 'vanGogh')
      .withRelatedLink('favorite-treat', `/api?${qs.stringify(query)}`);

      env = await createDefaultEnvironment(__dirname + '/../../../tests/ephemeral-test-app', seeds.getModels());
      searchers = env.lookup('hub:searchers');
      let { data:resource } = await searchers.get(env.session, 'local-hub', 'puppies', 'vanGogh', { includePaths: ['favorite-treat'] });
      expect(resource.relationships['favorite-treat'].links.related).to.equal(`/api?${qs.stringify(query)}`);
      expect(resource.relationships['favorite-treat'].data).to.eql({ type: 'treats', id: 'milkBiscuit' });
    });


    it("gets related resources with data for multiple relationships", async function() {
      let treatsQuery = {
        filter: {
          type: { exact: 'treats' },
          crunchiness: { range: { gt: 5 } }
        },
        sort: 'crunchiness'
      };

      let worstTreatQuery = {
        filter: {
          type: { exact: 'treats' }
        },
        sort: 'crunchiness',
        page: {
          size: 1
        }
      };

      seeds.addResource('puppies', 'vanGogh')
      .withRelatedLink('treats', `/api?${qs.stringify(treatsQuery)}`)
      .withRelatedLink('worst-treat', `/api?${qs.stringify(worstTreatQuery)}`);

      env = await createDefaultEnvironment(__dirname + '/../../../tests/ephemeral-test-app', seeds.getModels());
      searchers = env.lookup('hub:searchers');
      let { included, data:resource } = await searchers.get(env.session, 'local-hub', 'puppies', 'vanGogh', { includePaths: ['treats', 'worst-treat'] });
      expect(resource.relationships.treats.data).to.eql([
        { type: 'treats', id: 'carrot' },
        { type: 'treats', id: 'milkBiscuit' }
      ]);
      expect(resource.relationships['worst-treat'].data).to.eql({ type: 'treats', id: 'banana' });
      expect(included.length).to.eql(3);
      expect(included.map(item => item.type).filter((v, i, a) => a.indexOf(v) === i)).to.eql(['treats']);
      expect(included.map(item => item.id)).to.eql(['carrot', 'milkBiscuit', 'banana']);
    });

    it("searches related resources", async function() {
      let query = {
        filter: {
          type: { exact: 'treats' },
          crunchiness: { range: { gt: 5 } }
        },
        sort: 'crunchiness'
      };

      seeds.addResource('puppies', 'vanGogh')
      .withRelatedLink('treats', `/api?${qs.stringify(query)}`);

      env = await createDefaultEnvironment(__dirname + '/../../../tests/ephemeral-test-app', seeds.getModels());
      searchers = env.lookup('hub:searchers');
      let { data:resource } = await searchers.search(env.session, { filter: { 'type': { exact: 'puppies' } } });
      expect(resource[0].relationships.treats.links.related).to.equal(`/api?${qs.stringify(query)}`);
      expect(resource[0].relationships.treats).not.to.have.property('data');
    });

    it("searches related resources with included data", async function() {
      let query = {
        filter: {
          type: { exact: 'treats' },
          crunchiness: { range: { gt: 5 } }
        },
        sort: 'crunchiness'
      };

      seeds.addResource('puppies', 'vanGogh')
      .withRelatedLink('treats', `/api?${qs.stringify(query)}`);

      env = await createDefaultEnvironment(__dirname + '/../../../tests/ephemeral-test-app', seeds.getModels());
      searchers = env.lookup('hub:searchers');
      let { data:resource } = await searchers.search(env.session, { filter: { 'type': { exact: 'puppies' } }, include: 'treats' });
      expect(resource[0].relationships.treats.links.related).to.equal(`/api?${qs.stringify(query)}`);
      expect(resource[0].relationships.treats.data).to.eql([
        { type: 'treats', id: 'carrot' },
        { type: 'treats', id: 'milkBiscuit' }
      ]);
    });

    it("can return latest result of relationship query when the result of a query changes", async function() {
      let query = {
        filter: {
          type: { exact: 'treats' },
          crunchiness: { range: { gt: 5 } }
        },
        sort: 'crunchiness'
      };

      seeds.addResource('puppies', 'vanGogh')
      .withRelatedLink('treats', `/api?${qs.stringify(query)}`);

      env = await createDefaultEnvironment(__dirname + '/../../../tests/ephemeral-test-app', seeds.getModels());
      searchers = env.lookup('hub:searchers');
      let { data:resource } = await searchers.get(env.session, 'local-hub', 'puppies', 'vanGogh', { includePaths: ['treats'] });
      expect(resource.relationships.treats.links.related).to.equal(`/api?${qs.stringify(query)}`);
      expect(resource.relationships.treats.data).to.eql([
        { type: 'treats', id: 'carrot' },
        { type: 'treats', id: 'milkBiscuit' }
      ]);

      // add another crunchy treat
      await env.lookup('hub:writers').create(env.session, 'treats', {
        data: {
          type: 'treats',
          id: 'broccoli',
          attributes: {
            crunchiness: 6
          }
        }
      });

      let { data:updatedResource } = await searchers.get(env.session, 'local-hub', 'puppies', 'vanGogh', { includePaths: ['treats'] });
      expect(updatedResource.relationships.treats.links.related).to.equal(`/api?${qs.stringify(query)}`);
      expect(updatedResource.relationships.treats.data).to.eql([
        { type: 'treats', id: 'broccoli' },
        { type: 'treats', id: 'carrot' },
        { type: 'treats', id: 'milkBiscuit' }
      ]);
    });

    it("indexes models with related resource links for empty has-many relationships", async function() {
      let query = {
        filter: {
          type: { exact: 'treats' },
          crunchiness: { exact: 0 }
        },
        sort: 'crunchiness'
      };

      seeds.addResource('puppies', 'vanGogh')
      .withRelatedLink('soggy-treats', `/api?${qs.stringify(query)}`);

      env = await createDefaultEnvironment(__dirname + '/../../../tests/ephemeral-test-app', seeds.getModels());
      searchers = env.lookup('hub:searchers');
      let { data:resource } = await searchers.get(env.session, 'local-hub', 'puppies', 'vanGogh', { includePaths: ['soggy-treats'] });
      expect(resource.relationships['soggy-treats'].links.related).to.equal(`/api?${qs.stringify(query)}`);
      expect(resource.relationships['soggy-treats'].data).to.eql([]);
    });

    it("indexes models with related resource links for empty belongs-to relationships", async function() {
      let query = {
        filter: {
          type: { exact: 'treats' },
          crunchiness: { exact: 10 }
        },
        page: {
          size: 1
        }
      };

      seeds.addResource('puppies', 'vanGogh')
      .withRelatedLink('crunchiest-treat', `/api?${qs.stringify(query)}`);

      env = await createDefaultEnvironment(__dirname + '/../../../tests/ephemeral-test-app', seeds.getModels());
      searchers = env.lookup('hub:searchers');
      let { data:resource } = await searchers.get(env.session, 'local-hub', 'puppies', 'vanGogh', { includePaths: ['crunchiest-treat'] });
      expect(resource.relationships['crunchiest-treat'].links.related).to.equal(`/api?${qs.stringify(query)}`);
      expect(resource.relationships['crunchiest-treat'].data).to.eql(null);
    });
  });
});
