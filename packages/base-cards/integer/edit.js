import { setComponentTemplate } from '@ember/component';
import Component from '@glimmer/component';
import { precompileTemplate } from '@ember/template-compilation';

export default setComponentTemplate(
  precompileTemplate("<input type='number' value={{@model}} ...attributes />", {
    strictMode: true,
    scope: () => ({}), // NOTE: this is tricking our inline detector into not inlining this component
  }),
  class extends Component {}
);
