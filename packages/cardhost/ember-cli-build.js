'use strict';

const EmberApp = require('ember-cli/lib/broccoli/ember-app');

module.exports = function(defaults) {
  let app = new EmberApp(defaults, {
    prember: {
      // we're not pre-rendering any URLs yet, but we still need prember because
      // our deployment infrastructure already expects `_empty.html` to exist
      // for handling unknown URLs.
      urls: []
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

  return (function(){
    const Webpack = require('@embroider/webpack').Webpack;
    const { join } = require('path');
    const { writeFileSync } = require('fs');

    return require("@embroider/compat").compatBuild(app, Webpack, {
      staticAddonTestSupportTrees: true,
      staticAddonTrees: true,
      staticHelpers: true,
      staticComponents: true,
      onOutputPath(outputPath) {
        writeFileSync(join(__dirname, '.embroider-app-path'), outputPath, 'utf8');
      },
      packageRules: [
        {
          package: "@cardstack/core",
          addonModules: {
            "components/card-renderer.js": {
              dependsOnComponents: [
                '<Cards::Default::Isolated/>',
                '<Cards::Default::Embedded/>',
              ]
            },
            "components/field-renderer.js": {
              dependsOnComponents: [
                '<Fields::Cardstack::CoreTypes::StringViewer/>',
                '<Fields::Cardstack::CoreTypes::StringEditor/>',
                '<Fields::Cardstack::CoreTypes::IntegerViewer/>',
                '<Fields::Cardstack::CoreTypes::IntegerEditor/>',
                '<Fields::Cardstack::CoreTypes::DateViewer/>',
                '<Fields::Cardstack::CoreTypes::DateEditor/>',
                '<Fields::Cardstack::CoreTypes::BooleanViewer/>',
                '<Fields::Cardstack::CoreTypes::BooleanEditor/>',
                '<Fields::Cardstack::CoreTypes::CaseInsensitiveViewer/>',
                '<Fields::Cardstack::CoreTypes::CaseInsensitiveEditor/>',
                '<Fields::Cardstack::CoreTypes::BelongsToViewer/>',
                '<Fields::Cardstack::CoreTypes::BelongsToEditor/>',
                '<Fields::Cardstack::CoreTypes::HasManyViewer/>',
                '<Fields::Cardstack::CoreTypes::HasManyEditor/>',
              ]
            },
          }
        },
        {
          package: "@cardstack/routing",
          addonModules: {
            "routes/cardstack/common.js": {
              dependsOnComponents: ["<HeadLayout/>"],
            },
          },
        },
        {
          package: "ember-elsewhere",
          components: {
            "<ToElsewhere/>": {
              acceptsComponentArguments: ["send"],
            },
            "<FromElsewhere/>": {
              yieldsSafeComponents: [true],
            },
          },
        },
        {
          package: "liquid-fire",
          components: {
            "{{liquid-bind}}": {
              yieldsArguments: ["value"],
            },
          },
        },
      ],
    });
  })();
};
