const { Registry, Container } = require('@cardstack/di');
const JSONAPIFactory = require('@cardstack/test-support/jsonapi-factory');

describe('plugin-loader', function() {
  let pluginLoader, activePlugins;

  before(async function() {
    let registry = new Registry();
    registry.register('config:project', {
      path: __dirname + '/stub-project',
      isTesting: true
    }, { instantiate: false });
    pluginLoader = new Container(registry).lookup('hub:plugin-loader');

    let factory = new JSONAPIFactory();
    factory.addResource('plugin-configs')
      .withAttributes({
        module: 'sample-plugin-one',
      });
    factory.addResource('plugin-configs')
      .withAttributes({
        module: 'sample-plugin-two',
      });
    factory.addResource('plugin-configs')
      .withAttributes({
        module: 'sample-plugin-five',
      });

    activePlugins = await pluginLoader.activePlugins(factory.getModels());
  });

  it('throws if project config is missing', function() {
    expect(() => {
      new Container(new Registry()).lookup('hub:plugin-loader');
    }).to.throw("Missing configuration `config:project`");
  });

  it('throws if project config has no path', function() {
    let registry = new Registry();
    registry.register('config:project', {}, { instantiate: false });
    expect(() => {
      new Container(registry).lookup('hub:plugin-loader');
    }).to.throw("`config:project` must have a `path`");
  });

  it('locates top-level plugins', async function() {
    let plugins = await pluginLoader.installedPlugins();
    expect(plugins).collectionContains({
      name: 'sample-plugin-one',
      features: [{ type: "fields", name: "sample-plugin-one::x" }]
    });
    expect(plugins).collectionContains({
      name: 'sample-plugin-two',
      features: [{ type: "writers", name: "sample-plugin-two" }]
    });
  });

  it('skips non-plugin dependencies', async function() {
    let plugins = await pluginLoader.installedPlugins();
    expect(plugins).not.collectionContains({
      name: 'sample-non-plugin'
    });
  });

  it('locates second-level plugins', async function() {
    let plugins = await pluginLoader.installedPlugins();
    expect(plugins).collectionContains({
      name: 'sample-plugin-two'
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
    let feature = activePlugins.lookupFeatureAndAssert('fields', 'sample-plugin-one::x');
    expect(feature).is.ok;
    expect(feature).has.property('isPluginOneField', 'x');
  });

  it('returns nothing for missing plugin', async function() {
    let feature = await activePlugins.lookupFeature('fields', 'no-such-plugin');
    expect(feature).is.not.ok;
  });

  it('returns nothing for missing feature in existent plugin', async function() {
    let feature = await activePlugins.lookupFeature('fields', 'sample-plugin-one::y');
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
      activePlugins.lookupFeatureAndAssert('fields', 'sample-plugin-one::y');
      throw new Error("should not get here");
    } catch (err) {
      expect(err.message).to.equal(`You're trying to use fields sample-plugin-one::y but no such feature exists in plugin sample-plugin-one`);
    }
  });


  it('can assert for missing module', function() {
    try {
      activePlugins.lookupFeatureAndAssert('fields', 'sample-plugin-three::y');
      throw new Error("should not get here");
    } catch (err) {
      expect(err.message).to.equal(`You're trying to use fields sample-plugin-three::y but the plugin sample-plugin-three is not installed. Make sure it appears in the dependencies section of package.json`);
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
    let features = activePlugins.listAll('fields');
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
      name: '@cardstack/test-support/authenticator'
    });
  });

});
