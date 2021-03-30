/* eslint-disable no-useless-escape */
import dynamicCardTransform from 'cardhost/lib/dynamic-card-transform';
import { module, test } from 'qunit';

const COMPILED_TEMPLATE_COMPNENT = `import { setComponentTemplate } from '@ember/component';
import { precompileTemplate } from '@ember/template-compilation';
import templateOnlyComponent from '@ember/component/template-only';
export default setComponentTemplate(precompileTemplate("<h1>{{@model.title}}</h1>", {
  strictMode: true,
  scope: {}
}), templateOnlyComponent());`;

module('Unit | Lib | dynamic-card-transform', function () {
  test('transforms a compiled cards template', function (assert) {
    let result = dynamicCardTransform(
      'dyanmic-component',
      COMPILED_TEMPLATE_COMPNENT
    );

    assert.equal(
      result,
      `define("dyanmic-component", ["exports", "@ember/template-factory", "@ember/component", "@ember/component/template-only"], function (_exports, _templateFactory, _component, _templateOnly) {
  "use strict";

  Object.defineProperty(_exports, "__esModule", {
    value: true
  });
  _exports.default = void 0;

  var _default = (0, _component.setComponentTemplate)((0, _templateFactory.createTemplateFactory)(
  /*
    <h1>{{@model.title}}</h1>
  */
  {
    "block": "[[[10,\\\"h1\\\"],[12],[1,[30,1,[\\\"title\\\"]]],[13]],[\\\"@model\\\"],false,[]]",
    "moduleName": "(unknown template module)",
    "scope": null,
    "isStrictMode": true
  }), (0, _templateOnly.default)());

  _exports.default = _default;
});`
    );
  });
});
