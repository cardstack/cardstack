const { Registry, Container } = require('@cardstack/di');
const JSONAPIFactory = require('../../../tests/stub-project/node_modules/@cardstack/test-support/jsonapi-factory');

describe('hub/plugin-loader', function() {
  let pluginLoader, configuredPlugins;

  before(async function() {
    let registry = new Registry();
    registry.register('config:project', {
      path: __dirname + '/../../../tests/plugin-loader-test-project'
    }, { instantiate: false });
    pluginLoader = new Container(registry).lookup('hub:plugin-loader');

    let factory = new JSONAPIFactory();
    factory.addResource('plugin-configs', 'sample-plugin-one')
      .withAttributes({
        params: { awesomeness: 11 }
      });
    factory.addResource('plugin-configs', 'sample-plugin-four').withAttributes({
      enabled: false
    });

    configuredPlugins = await pluginLoader.configuredPlugins(factory.getModels());
  });

  it('throws if project config is missing', function() {
    expect(() => {
      new Container(new Registry()).lookup('hub:plugin-loader');
    }).to.throw("Failed to locate hub because config:project is not registered");
  });

  it('throws if project config has no path', function() {
    let registry = new Registry();
    registry.register('config:project', {}, { instantiate: false });
    expect(() => {
      new Container(registry).lookup('hub:plugin-loader');
    }).to.throw("Failed to locate hub because config:project does not contain a \"path\"");
  });

  it('locates top-level plugins', async function() {
    let plugins = await pluginLoader.installedPlugins();
    let one = plugins.find(p => p.id === 'sample-plugin-one');
    expect(one).is.ok;
    let two = plugins.find(p => p.id === 'sample-plugin-two');
    expect(two).is.ok;
  });

  it('skips non-plugin dependencies', async function() {
    let plugins = await pluginLoader.installedPlugins();
    expect(plugins).not.collectionContains({
      id: 'sample-non-plugin'
    });
  });

  it('skips plugins with duplicate module names', async function() {
    // note that we're able to test the skipping behavior here because the plugin loader
    // tests don't use createDefaultEnvironment and hence can't set the environment in the
    // container, which is coincidentally convenient. Otherwise this will throw errors in the
    // test environment.
    let plugins = await pluginLoader.installedPlugins();
    expect(plugins.filter(p => p.id === 'sample-plugin-one').length).equals(1);
  });

  it('locates second-level plugins', async function() {
    let plugins = await pluginLoader.installedPlugins();
    expect(plugins).collectionContains({
      id: 'sample-plugin-two'
    });
  });

  it('marks active plugins as enabled', function() {
    let one = configuredPlugins.describe('sample-plugin-one');
    expect(one).is.ok;
    expect(one.attributes.enabled).to.equal(true);
  });

  it('marks inactive plugins as not enabled', function() {
    let four = configuredPlugins.describe('sample-plugin-four');
    expect(four).is.ok;
    expect(four.attributes.enabled).to.equal(false);
  });

  it('augments active plugins with their config', function() {
    let one = configuredPlugins.describe('sample-plugin-one');
    expect(one.attributes).has.deep.property('params.awesomeness', 11);
  });

  it('identifies singular features (mandatory mode)', function() {
    let feature = configuredPlugins.lookupFeatureAndAssert('writers', 'sample-plugin-two');
    expect(feature).is.ok;
    expect(feature).has.property('isPluginTwoWriter');
  });

  it('identifies singular features (optional mode)', function() {
    let feature = configuredPlugins.lookupFeature('writers', 'sample-plugin-two');
    expect(feature).is.ok;
    expect(feature).has.property('isPluginTwoWriter');
  });


  it('identifies named features', function() {
    let feature = configuredPlugins.lookupFeatureAndAssert('field-types', 'sample-plugin-one::x');
    expect(feature).is.ok;
    expect(feature).has.property('isPluginOneField', 'x');
  });

  it('returns nothing for missing plugin', async function() {
    let feature = await configuredPlugins.lookupFeature('field-types', 'no-such-plugin');
    expect(feature).is.not.ok;
  });

  it('returns nothing for missing feature in existent plugin', async function() {
    let feature = await configuredPlugins.lookupFeature('field-types', 'sample-plugin-one::y');
    expect(feature).is.not.ok;
  });

  it('complains about unknown feature type', function() {
    try {
      configuredPlugins.lookupFeatureAndAssert('coffee-makers', 'sample-plugin-one::x');
      throw new Error("should not get here");
    } catch (err) {
      expect(err.message).to.equal(`No such feature type "coffee-makers"`);
    }
  });

  it('can assert for missing feature', function() {
    try {
      configuredPlugins.lookupFeatureAndAssert('field-types', 'sample-plugin-one::y');
      throw new Error("should not get here");
    } catch (err) {
      expect(err.message).to.equal(`You're trying to use field-types sample-plugin-one::y but no such feature exists in plugin sample-plugin-one`);
    }
  });


  it('can assert for missing module', function() {
    try {
      configuredPlugins.lookupFeatureAndAssert('field-types', 'sample-plugin-three::y');
      throw new Error("should not get here");
    } catch (err) {
      expect(err.message).to.equal(`You're trying to use field-types sample-plugin-three::y but the plugin sample-plugin-three is not installed. Make sure it appears in the dependencies section of package.json`);
    }
  });

  it('can assert for unactivated module', function() {
    try {
      configuredPlugins.lookupFeatureAndAssert('searchers', 'sample-plugin-four');
      throw new Error("should not get here");
    } catch (err) {
      expect(err.message).to.equal(`You're trying to use searchers sample-plugin-four but the plugin sample-plugin-four is not activated`);
    }
  });

  it('respects custom cardstack src paths', function() {
    let feature = configuredPlugins.lookupFeatureAndAssert('searchers', 'sample-plugin-five');
    expect(feature).is.ok;
    expect(feature).has.property('isPluginFiveSearcher');

  });

  it('lists all features of a given type (non-top naming)', function() {
    let features = configuredPlugins.featuresOfType('field-types');
    expect(features.map(f => f.id)).to.include('sample-plugin-one::x');
  });

  it('lists all features of a given type (top naming)', function() {
    let features = configuredPlugins.featuresOfType('searchers');
    expect(features.map(f => f.id)).to.include('sample-plugin-five');
  });

  it('only includes active plugins when listing all by type', function() {
    let features = configuredPlugins.featuresOfType('searchers');
    expect(features.map(f => f.id)).not.to.include('sample-plugin-four');
  });

  it('can return factory for instantiated features', function() {
    let factory = configuredPlugins.lookupFeatureFactory('searchers', 'sample-plugin-five');
    expect(factory).is.ok;
    expect(factory.methodOnFiveClass).is.a.function;
  });

  it('can assert for unactivated factory', function() {
    try {
      configuredPlugins.lookupFeatureFactoryAndAssert('searchers', 'sample-plugin-four');
      throw new Error("should not get here");
    } catch (err) {
      expect(err.message).to.equal(`You're trying to use searchers sample-plugin-four but the plugin sample-plugin-four is not activated`);
    }
  });

  it('locates in-repo plugins', async function() {
    // the stub-project has a devDependency
    // on @cardstack/test-support, and @cardstack/test-support
    // contains this in-repo plugin
    let plugins = await pluginLoader.installedPlugins();
    expect(plugins).collectionContains({
      id: 'inner-plugin'
    });
  });

  it('links from plugin to its features', async function() {
    let plugins = await pluginLoader.installedPlugins();
    let one = plugins.find(p => p.id === 'sample-plugin-one');
    expect(one).has.deep.property('relationships.features.data');
    expect(one.relationships.features.data).collectionContains({
      type: 'field-types',
      id: 'sample-plugin-one::x'
    });
  });

  it('links from feature to its plugin', async function() {
    let features = await pluginLoader.installedFeatures();
    let x = features.find(f => f.id === 'sample-plugin-one::x');
    expect(x).has.deep.property('relationships.plugin.data');
    expect(x.relationships.plugin.data).deep.equals({
      type: 'plugins',
      id: 'sample-plugin-one'
    });
  });

  it('automatically activates dependencies of activated plugins', async function() {
    let feature = configuredPlugins.lookupFeatureAndAssert('writers', 'sample-plugin-autoactivated');
    expect(feature).is.ok;
    expect(feature).has.property('isAutoactivatedWriter');
  });

  it('automatically activates dependencies of auto-activated dependencies', async function() {
    let feature = configuredPlugins.lookupFeatureAndAssert('middleware', 'sample-plugin-deep-auto-activate');
    expect(feature).is.ok;
    expect(feature).has.property('isDeepMiddleware');
  });

});
