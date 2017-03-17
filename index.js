/* eslint-env node */

var CssImport = require('postcss-import');
var CssNext = require('postcss-cssnext');

'use strict';

module.exports = {
  name: 'cardstack-suite',
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
  ajax.open('GET', '/cardstack-suite/symbols.svg', true);
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
