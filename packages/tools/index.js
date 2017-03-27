/* eslint-env node */

var CssImport = require('postcss-import');
var CssNext = require('postcss-cssnext');
var path = require('path');
var mergeTrees = require('broccoli-merge-trees');

'use strict';

module.exports = {
  name: '@cardstack/tools',
  isDevelopingAddon() {
    return process.env.CARDSTACK_DEV;
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

  treeForApp(tree) {
    let haveRouting;
    try {
      require.resolve('@cardstack/routing')
      haveRouting = true;
    } catch(err) {
      haveRouting = false;
    }
    if (haveRouting) {
      return tree;
    } else {
      return mergeTrees([tree, path.join(__dirname, 'lib/routing-stub')]);
    }
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
