const {
  createDefaultEnvironment,
  destroyDefaultEnvironment
} = require('@cardstack/test-support/env');

describe('hub/indexers', function() {
  let env;

  before(async function () {
    env = await createDefaultEnvironment(`${__dirname}/..`);
  });

  after(async function() {
    await destroyDefaultEnvironment(env);
  });


  it("indexes seed models", async function() {
    // this seed model comes from createDefaultEnvironment
    let response = await env.lookup('hub:searchers').search('master', { filter: { type: 'plugin-configs' }});
    expect(response.models.map(m => m.attributes.module)).includes('@cardstack/hub');
  });

  it("indexes bootstrap models", async function() {
    let response = await env.lookup('hub:searchers').search('master', { filter: { type: 'plugin-configs' }});
    expect(response.models.map(m => m.attributes.module)).includes('@cardstack/core-types');
  });

});
