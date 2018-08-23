const JSONAPIFactory = require('../../../tests/stub-searcher/node_modules/@cardstack/test-support/jsonapi-factory');
const {
  createDefaultEnvironment,
  destroyDefaultEnvironment
} = require('../../../tests/stub-searcher/node_modules/@cardstack/test-support/env');

describe('hub/searchers/basics', function() {
  let env, chocolate, source;

  async function setup(stubParams) {
    let factory = new JSONAPIFactory();

    source = factory.addResource('data-sources').
      withAttributes({
        sourceType: 'stub-searcher',
        params: stubParams
      });

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
    ]);

    chocolate = factory.addResource('examples').withAttributes({
      exampleFlavor: 'chocolate',
      exampleSize: 'large',
      topping: 'sprinkles'
    });

    env = await createDefaultEnvironment(`${__dirname}/../../../tests/stub-searcher`, factory.getModels());
  }

  async function teardown() {
    if (env) {
      await destroyDefaultEnvironment(env);
    }
  }

  describe('empty', function() {
    before(async function(){ await setup({}); });
    after(teardown);

    it("throws when no searcher#get has it", async function() {
      try {
        await env.lookup('hub:searchers').get(env.session, 'master', 'examples', 'nonexistent');
        throw new Error("should not get here");
      } catch (err) {
        expect(err.message).to.match(/No such resource master\/examples\/nonexist/);
      }
    });

    it("searchers#get finds record via internal searcher", async function() {
      let response = await env.lookup('hub:searchers').get(env.session, 'master', 'examples', chocolate.id);
      expect(response.data.attributes['example-flavor']).to.equal('chocolate');
    });

    it("searchers#search finds record via internal searcher", async function() {
      let response = await env.lookup('hub:searchers').search(env.session, 'master', { filter: { 'example-flavor': { exact: 'chocolate' } } });
      expect(response.data).length(1);
      expect(response.data[0].attributes['example-flavor']).to.equal('chocolate');
    });

    it("searchers#search finds record via internal searcher with custom analyzer", async function() {
      let response = await env.lookup('hub:searchers').search(env.session, 'master', { filter: { 'topping': { exact: 'SPriNkLeS' } } });
      expect(response.data).length(1);
      expect(response.data[0].attributes['topping']).to.equal('sprinkles');
    });
  });

  describe('injectFirst', function() {
    before(async function(){ await setup({ injectFirst: 'vanilla' }); });
    after(teardown);

    it("a plugin's searcher#get can run before the internal searcher", async function() {
      let response = await env.lookup('hub:searchers').get(env.session, 'master', 'examples', chocolate.id);
      expect(response.data.attributes['example-flavor']).to.equal('vanilla');
    });

    it("a plugin's searchers#search can run before the internal searcher", async function() {
      let response = await env.lookup('hub:searchers').search(env.session, 'master', { filter: { 'example-flavor': { exact: 'chocolate' } } });
      expect(response.data).length(1);
      expect(response.data[0].attributes['example-flavor']).to.equal('vanilla');
    });

    it("adds source id to model when using searcher#get", async function() {
      let response = await env.lookup('hub:searchers').get(env.session, 'master', 'examples', 'anything');
      expect(response.data).has.deep.property('meta.source', source.id);
    });

    it("adds source id to model when using searcher#search", async function() {
      let response = await env.lookup('hub:searchers').search(env.session, 'master', {});
      expect(response.data[0]).has.deep.property('meta.source', source.id);
    });

  });

  describe('injectSecond', function() {
    before(async function(){ await setup({ injectSecond: 'vanilla' }); });
    after(teardown);

    it("a plugin's searcher#get can run after the internal searcher", async function() {
      let response = await env.lookup('hub:searchers').get(env.session, 'master', 'examples', '10000');
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
   async function alterExpiration(branch, type, id, interval) {
      let client = env.lookup(`plugin-client:${require.resolve('@cardstack/pgsearch/client')}`);
      let result = await client.query('update documents set expires = expires + $1 where branch=$2 and type=$3 and id=$4', [interval, branch, type, id]);
      if (result.rowCount !== 1) {
        throw new Error(`test was unable to alter expiration`);
      }
    }

    it("can cache searcher#get responses", async function() {
      let response = await env.lookup('hub:searchers').get(env.session, 'master', 'examples', '1000');
      expect(response).has.deep.property('data.attributes.example-counter');
      let firstCounter = response.data.attributes['example-counter'];
      response = await env.lookup('hub:searchers').get(env.session, 'master', 'examples', '1000');
      let secondCounter = response.data.attributes['example-counter'];
      expect(firstCounter).to.equal(secondCounter);
    });

    it("does not return expired searcher#get responses", async function() {
      let response = await env.lookup('hub:searchers').get(env.session, 'master', 'examples', '1000');
      expect(response).has.deep.property('data.attributes.example-counter');
      let firstCounter = response.data.attributes['example-counter'];

      await alterExpiration('master', 'examples', '1000', '-301 seconds');

      response = await env.lookup('hub:searchers').get(env.session, 'master', 'examples', '1000');
      let secondCounter = response.data.attributes['example-counter'];
      expect(firstCounter).to.not.equal(secondCounter);
    });

    it("does not return expired documents in searcher#search", async function() {
      await env.lookup('hub:searchers').get(env.session, 'master', 'examples', '1000');
      await alterExpiration('master', 'examples', '1000', '-301 seconds');
      let response = await env.lookup('hub:searchers').search(env.session, 'master', { filter: { type: 'examples', id: '1000' }});
      expect(response.data).length(0);
    });
  });

});
