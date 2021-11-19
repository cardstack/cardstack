import { setComponentTemplate } from '@ember/component';
import templateOnlyComponent from '@ember/component/template-only';
import { precompileTemplate } from '@ember/template-compilation';

export default setComponentTemplate(
  precompileTemplate('TODO: edit integer here {{@model}}', {
    strictMode: true,
  }),
  templateOnlyComponent()
);
