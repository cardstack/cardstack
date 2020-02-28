'use strict';

// This is a feature flag supported in ember-cli 3.15+ that gives you faster
// rebuilds, and it makes rebuilding of addons work in embroider.
process.env.BROCCOLI_ENABLED_MEMOIZE = 'true';

const EmberApp = require('ember-cli/lib/broccoli/ember-app');
const { spawn } = require('child_process');
const path = require('path');
const MonacoWebpackPlugin = require('monaco-editor-webpack-plugin');

module.exports = function(defaults) {
  // This is just a placeholder for starting the backend in our tests until we
  // figure out how we want to do this for real.
  if (!process.env.HUB_URL) {
    console.log('Starting Cardstack Hub...'); // eslint-disable-line no-console
    if (process.env.EMBER_ENV === 'test') {
      process.env.PGDATABASE = `test_db_${Math.floor(100000 * Math.random())}`;
      console.log(`  creating hub DB ${process.env.PGDATABASE}`); // eslint-disable-line no-console
    }
    let bin = path.resolve(path.join(__dirname, '..', '..', 'packages', 'hub', 'bin', 'cardstack-hub.js'));
    spawn(process.execPath, [bin], { stdio: [0, 1, 2, 'ipc'] });
  }

  let app = new EmberApp(defaults, {
    hinting: false, // we are doing this as part of the project level linting
    prember: {
      // we're not pre-rendering any URLs yet, but we still need prember because
      // our deployment infrastructure already expects `_empty.html` to exist
      // for handling unknown URLs.
      urls: [],
    },
  });

  // Use `app.import` to add additional libraries to the generated
  // output files.
  //
  // If you need to use different assets in different
  // environments, specify an object as the first parameter. That
  // object's keys should be the environment name and the values
  // should be the asset to use in that environment.
  //
  // If the library that you are including contains AMD or ES6
  // modules that you would like to import into your application
  // please specify an object with the list of modules as keys
  // along with the exports of each module as its value.
  app.import('node_modules/monaco-editor/dev/vs/editor/editor.main.css');

  const languages = ['html', 'css'];
  const features = ['accessibilityHelp', 'colorDetector', 'find', 'folding', 'hover', 'suggest', 'toggleHighContrast'];

  return (function() {
    const Webpack = require('@embroider/webpack').Webpack;
    const { join } = require('path');
    const { writeFileSync } = require('fs');

    return require('@embroider/compat').compatBuild(app, Webpack, {
      staticAddonTestSupportTrees: true,
      staticAddonTrees: true,
      staticHelpers: true,
      staticComponents: true,
      onOutputPath(outputPath) {
        writeFileSync(join(__dirname, '.embroider-app-path'), outputPath, 'utf8');
      },
      packagerOptions: {
        webpackConfig: {
          plugins: [new MonacoWebpackPlugin({ languages, features })],
        },
      },
      packageRules: [
        {
          package: '@cardstack/cardhost',
          appModules: {
            'components/scaffold.js': {
              dependsOnComponents: [
                '<Scaffolding::Base::EmbeddedLayout/>',
                '<Scaffolding::Base::IsolatedLayout/>',
                '<Scaffolding::Base::FieldEditLayout/>',
                '<Scaffolding::Base::FieldViewLayout/>',
                '<Scaffolding::StringField::FieldEditLayout/>',
                '<Scaffolding::StringField::FieldViewLayout/>',
                '<Scaffolding::ImageReferenceField::FieldEditLayout/>',
                '<Scaffolding::ImageReferenceField::FieldViewLayout/>',
                '<Scaffolding::IntegerField::FieldEditLayout/>',
                '<Scaffolding::IntegerField::FieldViewLayout/>',
                '<Scaffolding::BooleanField::FieldEditLayout/>',
                '<Scaffolding::BooleanField::FieldViewLayout/>',
                '<Scaffolding::DateField::FieldEditLayout/>',
                '<Scaffolding::DateField::FieldViewLayout/>',
                '<Scaffolding::DatetimeField::FieldEditLayout/>',
                '<Scaffolding::DatetimeField::FieldViewLayout/>',
                '<Scaffolding::UrlField::FieldEditLayout/>',
                '<Scaffolding::UrlField::FieldViewLayout/>',
              ],
            },
          },
        },
        {
          package: '@cardstack/routing',
          addonModules: {
            'routes/cardstack/common.js': {
              dependsOnComponents: ['<HeadLayout/>'],
            },
          },
        },
        {
          package: 'ember-elsewhere',
          components: {
            '<ToElsewhere/>': {
              acceptsComponentArguments: ['send'],
            },
            '<FromElsewhere/>': {
              yieldsSafeComponents: [true],
            },
          },
        },
        {
          package: 'liquid-fire',
          components: {
            '{{liquid-bind}}': {
              yieldsArguments: ['value'],
            },
          },
        },
        {
          package: 'ember-element-helper',
          addonModules: {
            'helpers/-element.js': {
              dependsOnComponents: ['{{-dynamic-element}}', '{{-dynamic-element-alt}}'],
            },
          },
        },
      ],
    });
  })();
};
