import { setComponentTemplate } from '@ember/component';
import { precompileTemplate } from '@ember/template-compilation';
import templateOnlyComponent from '@ember/component/template-only';
import { on as realOn } from '@ember/modifier';
import { helper } from '@ember/component/helper';
import BoxelInput from '@cardstack/boxel/components/boxel/input';

// https://github.com/ember-cli/babel-plugin-htmlbars-inline-precompile/issues/379
let on = realOn;

const getTargetValue = helper(([action] /*, hash*/) => {
  return function (value) {
    action(value);
  };
});

export default setComponentTemplate(
  precompileTemplate('<BoxelInput type="text" @value="{{@model}}" @onInput={{getTargetValue @set}} ...attributes />', {
    strictMode: true,
    scope: () => ({ on, getTargetValue, BoxelInput }),
  }),
  templateOnlyComponent()
);
