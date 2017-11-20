const { Registry, Container } = require('@cardstack/di');
const JSONAPIFactory = require('../../../tests/stub-project/node_modules/@cardstack/test-support/jsonapi-factory');

describe('hub/plugin-loader', function() {
  let pluginLoader, activePlugins;

  before(async function() {
    let registry = new Registry();
    registry.register('config:project', {
      path: __dirname + '/../../../tests/stub-project',
      allowDevDependencies: true
    }, { instantiate: false });
    pluginLoader = new Container(registry).lookup('hub:plugin-loader');

    let factory = new JSONAPIFactory();
    factory.addResource('plugin-configs', 'sample-plugin-one');
    factory.addResource('plugin-configs', 'sample-plugin-two');
    factory.addResource('plugin-configs', 'sample-plugin-five');

    activePlugins = await pluginLoader.activePlugins(factory.getModels());
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
    expect(one.attributes.features.find(f => f.id === 'sample-plugin-one::x')).is.ok;
    let two = plugins.find(p => p.id === 'sample-plugin-two');
    expect(two.attributes.features.find(f => f.id === 'sample-plugin-two' && f.type === 'writers')).is.ok;
  });

  it('skips non-plugin dependencies', async function() {
    let plugins = await pluginLoader.installedPlugins();
    expect(plugins).not.collectionContains({
      id: 'sample-non-plugin'
    });
  });

  it('locates second-level plugins', async function() {
    let plugins = await pluginLoader.installedPlugins();
    expect(plugins).collectionContains({
      id: 'sample-plugin-two'
    });
  });

  it('identifies singular features (mandatory mode)', function() {
    let feature = activePlugins.lookupFeatureAndAssert('writers', 'sample-plugin-two');
    expect(feature).is.ok;
    expect(feature).has.property('isPluginTwoWriter');
  });

  it('identifies singular features (optional mode)', function() {
    let feature = activePlugins.lookupFeature('writers', 'sample-plugin-two');
    expect(feature).is.ok;
    expect(feature).has.property('isPluginTwoWriter');
  });


  it('identifies named features', function() {
    let feature = activePlugins.lookupFeatureAndAssert('field-types', 'sample-plugin-one::x');
    expect(feature).is.ok;
    expect(feature).has.property('isPluginOneField', 'x');
  });

  it('returns nothing for missing plugin', async function() {
    let feature = await activePlugins.lookupFeature('field-types', 'no-such-plugin');
    expect(feature).is.not.ok;
  });

  it('returns nothing for missing feature in existent plugin', async function() {
    let feature = await activePlugins.lookupFeature('field-types', 'sample-plugin-one::y');
    expect(feature).is.not.ok;
  });

  it('complains about unknown feature type', function() {
    try {
      activePlugins.lookupFeature('coffee-makers', 'sample-plugin-one::x');
      throw new Error("should not get here");
    } catch (err) {
      expect(err.message).to.equal(`No such feature type "coffee-makers"`);
    }
  });

  it('can assert for missing feature', function() {
    try {
      activePlugins.lookupFeatureAndAssert('field-types', 'sample-plugin-one::y');
      throw new Error("should not get here");
    } catch (err) {
      expect(err.message).to.equal(`You're trying to use field-types sample-plugin-one::y but no such feature exists in plugin sample-plugin-one`);
    }
  });


  it('can assert for missing module', function() {
    try {
      activePlugins.lookupFeatureAndAssert('field-types', 'sample-plugin-three::y');
      throw new Error("should not get here");
    } catch (err) {
      expect(err.message).to.equal(`You're trying to use field-types sample-plugin-three::y but the plugin sample-plugin-three is not installed. Make sure it appears in the dependencies section of package.json`);
    }
  });

  it('can assert for unactivated module', function() {
    try {
      activePlugins.lookupFeatureAndAssert('searchers', 'sample-plugin-four');
      throw new Error("should not get here");
    } catch (err) {
      expect(err.message).to.equal(`You're trying to use searchers sample-plugin-four but the plugin sample-plugin-four is not activated`);
    }
  });

  it('respects custom cardstack src paths', function() {
    let feature = activePlugins.lookupFeatureAndAssert('searchers', 'sample-plugin-five');
    expect(feature).is.ok;
    expect(feature).has.property('isPluginFiveSearcher');

  });

  it('lists all features of a given type (non-top naming)', function() {
    let features = activePlugins.listAll('field-types');
    expect(features).to.include('sample-plugin-one::x');
  });

  it('lists all features of a given type (top naming)', function() {
    let features = activePlugins.listAll('searchers');
    expect(features).to.include('sample-plugin-five');
  });

  it('only includes active plugins when listing all by type', function() {
    let features = activePlugins.listAll('searchers');
    expect(features).not.to.include('sample-plugin-four');
  });

  it('can return factory for instantiated features', function() {
    let factory = activePlugins.lookupFeatureFactory('searchers', 'sample-plugin-five');
    expect(factory).is.ok;
    expect(factory.methodOnFiveClass).is.a.function;
  });

  it('can assert for unactivated factory', function() {
    try {
      activePlugins.lookupFeatureFactoryAndAssert('searchers', 'sample-plugin-four');
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
      id: '@cardstack/test-support/authenticator'
    });
  });

  it('automatically activates dependencies of activated plugins', async function() {
    let feature = activePlugins.lookupFeatureAndAssert('writers', 'sample-plugin-autoactivated');
    expect(feature).is.ok;
    expect(feature).has.property('isAutoactivatedWriter');
  });

  it('automatically activates dependencies of auto-activated dependencies', async function() {
    let feature = activePlugins.lookupFeatureAndAssert('middleware', 'sample-plugin-deep-auto-activate');
    expect(feature).is.ok;
    expect(feature).has.property('isDeepMiddleware');
  });

});
