const JSONAPIFactory = require('@cardstack/test-support/jsonapi-factory');
const {
  createDefaultEnvironment,
  destroyDefaultEnvironment
} = require('@cardstack/hub/node-tests/support');

describe('hub/searchers', function() {
  let env, chocolate;

  async function setup(stubParams) {
    let factory = new JSONAPIFactory();

    factory.addResource('plugin-configs')
      .withAttributes({
        module: '@cardstack/hub/node-tests/stub-searcher'
      });

    factory.addResource('data-sources').
      withAttributes({
        sourceType: '@cardstack/hub/node-tests/stub-searcher',
        params: stubParams
      });

    factory.addResource('content-types', 'examples').withRelated('fields', [
      factory.addResource('fields', 'example-flavor').withAttributes({
        fieldType: '@cardstack/core-types::string'
      }),
      factory.addResource('fields', 'example-size').withAttributes({
        fieldType: '@cardstack/core-types::string'
      })
    ]);

    chocolate = factory.addResource('examples').withAttributes({
      exampleFlavor: 'chocolate',
      exampleSize: 'large'
    });

    env = await createDefaultEnvironment(factory.getModels());
  }

  afterEach(async function() {
    if (env) {
      await destroyDefaultEnvironment(env);
    }
  });


  it("throws when no searcher#get has it", async function() {
    await setup({});
    try {
      await env.lookup('hub:searchers').get('master', 'examples', 'nonexistent');
      throw new Error("should not get here");
    } catch (err) {
      expect(err.message).to.match(/No such resource master\/examples\/nonexist/);
    }
  });

  it("searchers#get finds record via internal searcher", async function() {
    await setup({});
    let response = await env.lookup('hub:searchers').get('master', 'examples', chocolate.id);
    expect(response.attributes['example-flavor']).to.equal('chocolate');
  });

  it("a plugin's searcher#get can run before the internal searcher", async function() {
    await setup({ injectFirst: 'vanilla' });
    let response = await env.lookup('hub:searchers').get('master', 'examples', chocolate.id);
    expect(response.attributes['example-flavor']).to.equal('vanilla');
  });

  it("a plugin's searcher#get can run after the internal searcher", async function() {
    await setup({ injectSecond: 'vanilla' });
    let response = await env.lookup('hub:searchers').get('master', 'examples', '10000');
    expect(response.attributes['example-flavor']).to.equal('vanilla');
  });

  it("searchers#search finds record via internal searcher", async function() {
    await setup({});
    let response = await env.lookup('hub:searchers').search('master', { filter: { 'example-flavor': { exact: 'chocolate' } } });
    expect(response.models).length(1);
    expect(response.models[0].attributes['example-flavor']).to.equal('chocolate');
  });

  it("a plugin's searchers#search can run before the internal searcher", async function() {
    await setup({ injectFirst: 'vanilla' });
    let response = await env.lookup('hub:searchers').search('master', { filter: { 'example-flavor': { exact: 'chocolate' } } });
    expect(response.models).length(1);
    expect(response.models[0].attributes['example-flavor']).to.equal('vanilla');
  });

});
