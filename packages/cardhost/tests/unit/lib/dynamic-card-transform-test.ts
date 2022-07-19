/* eslint-disable no-useless-escape */
import dynamicCardTransform from 'cardhost/lib/dynamic-card-transform';
import { module, test } from 'qunit';

const COMPILED_TEMPLATE_COMPONENT = `import { setComponentTemplate } from '@ember/component';
import { precompileTemplate } from '@ember/template-compilation';
import templateOnlyComponent from '@ember/component/template-only';
export default setComponentTemplate(precompileTemplate("<h1>{{@model.title}}</h1>", {
  strictMode: true,
  scope: () => ({})
}), templateOnlyComponent());`;

module('Unit | Lib | dynamic-card-transform', function () {
  test('transforms a compiled cards template', function (assert) {
    let result = dynamicCardTransform(
      'dynamic-component',
      COMPILED_TEMPLATE_COMPONENT
    );
    assert.equal(
      result,
      'define("dynamic-component", ["exports"], function (_exports) {\n  "use strict";\n\n  Object.defineProperty(_exports, "__esModule", {\n    value: true\n  });\n  _exports.default = void 0;\n\n  var _default = Ember._setComponentTemplate(Ember.HTMLBars.template(\n  /*\n    <h1>{{@model.title}}</h1>\n  */\n  {\n    "id": null,\n    "block": "[[[10,\\"h1\\"],[12],[1,[30,1,[\\"title\\"]]],[13]],[\\"@model\\"],false,[]]",\n    "moduleName": "(unknown template module)",\n    "isStrictMode": true\n  }), Ember._templateOnlyComponent());\n\n  _exports.default = _default;\n});'
    );
  });
});
