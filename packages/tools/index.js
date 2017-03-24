/* eslint-env node */

const CssImport = require('postcss-import');
const CssNext = require('postcss-cssnext');
const path = require('path');
const mergeTrees = require('broccoli-merge-trees');
const Funnel = require('broccoli-funnel');

'use strict';

module.exports = {
  name: '@cardstack/tools',

  isDevelopingAddon() {
    return process.env.CARDSTACK_DEV;
  },

  init: function() {
    if (this._super.init) {
      this._super.init.apply(this, arguments);
    }
    // Shim this.import for support in older versions of ember-cli
    if (!this.import) {
      this._findHost = function findHostShim() {
        var current = this;
        var app;

        // Keep iterating upward until we don't have a grandparent.
        // Has to do this grandparent check because at some point we hit the project.
        do {
          app = current.app || app;
        } while (current.parent.parent && (current = current.parent));

        return app;
      };
      this.import = function importShim(asset, options) {
        var app = this._findHost();
        app.import(asset, options);
      };
    }
  },

  included: function(){
    if (this._super.included) {
      this._super.included.apply(this, arguments);
    }
    this.import('vendor/js-polyfills/url.js');
  },

  options: {
    postcssOptions: {
      compile: {
        enabled: true,
        plugins: [
          { module: CssImport },
          { module: CssNext }
        ]
      }
    }
  },

  treeForVendor(tree){
    var polyfillsPath = path.dirname(require.resolve('js-polyfills'));
    var polyfillsTree = new Funnel(this.treeGenerator(polyfillsPath), {
      include: ['url.js'],
      destDir: 'js-polyfills'
    });
    return mergeTrees([tree, polyfillsTree]);
  },

  contentFor(type) {
    if (type === 'body-footer') {
      return `<script>
  var ajax = new XMLHttpRequest();
  ajax.open('GET', '/@cardstack/tools/symbols.svg', true);
  ajax.send();
  ajax.onload = function(e) {
    var div = document.createElement('div');
    div.innerHTML = ajax.responseText;
    document.body.insertBefore(div, document.body.childNodes[0]);
  };
</script>`;

    }
  }
};
