import { setComponentTemplate } from '@ember/component';
import { precompileTemplate } from '@ember/template-compilation';
import templateOnlyComponent from '@ember/component/template-only';
import { on as realOn } from '@ember/modifier';
import { helper } from '@ember/component/helper';

// https://github.com/ember-cli/babel-plugin-htmlbars-inline-precompile/issues/379
let on = realOn;

const getTargetValue = helper(([action] /*, hash*/) => {
  return function (event) {
    action(event.target.value);
  };
});

export default setComponentTemplate(
  precompileTemplate(
    '<input type="text" value="{{@model}}" {{on "input" (getTargetValue @set)}} ...attributes />',
    {
      strictMode: true,
      scope: { on, getTargetValue },
    }
  ),
  templateOnlyComponent()
);
