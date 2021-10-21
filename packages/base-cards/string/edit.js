import { setComponentTemplate } from '@ember/component';
import { precompileTemplate } from '@ember/template-compilation';
import templateOnlyComponent from '@ember/component/template-only';
import BoxelInput from '@cardstack/boxel/components/boxel/input';

export default setComponentTemplate(
  precompileTemplate('<BoxelInput type="text" @value="{{@model}}" @onInput={{@set}} ...attributes />', {
    strictMode: true,
    scope: () => ({ BoxelInput }),
  }),
  templateOnlyComponent()
);
