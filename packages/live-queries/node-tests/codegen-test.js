const { join } = require('path');

const {
  createDefaultEnvironment,
  destroyDefaultEnvironment
} = require('@cardstack/test-support/env');

const JSONAPIFactory = require('@cardstack/test-support/jsonapi-factory');

describe('live-queries codegen', function() {
  let env;
  let liveQuery;
  before(async function() {
    let factory = new JSONAPIFactory();
    factory.addResource('plugin-configs', '@cardstack/live-queries')
    env = await createDefaultEnvironment(join(__dirname, '..'), factory.getModels(), { url: 'https://testing.cardstack.com' });
    const plugins = env.lookup('hub:plugins')
    const activePlugins = await plugins.active();
    liveQuery = activePlugins.lookupFeatureAndAssert('code-generators', '@cardstack/live-queries');
  });

  after(async function () {
    await destroyDefaultEnvironment(env);
  })

  it('returns generated modules based on provided config', async function() {
    liveQuery.publicUrl = 'https://cardstack.com'
    const generatedModules = await liveQuery.generateModules();
    expect(generatedModules.has('environment')).to.equal(true)
    expect(generatedModules.get('environment')).to.include('export const host = "https://testing.cardstack.com:3100/"')
  })
});