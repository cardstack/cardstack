/* eslint-env node */
'use strict';

const whenEnabled = require('@cardstack/plugin-utils/when-enabled');
const CssImport = require('postcss-import');
const CssNext = require('postcss-cssnext');

module.exports = whenEnabled({
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
});
