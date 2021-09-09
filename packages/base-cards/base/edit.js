import { setComponentTemplate } from '@ember/component';
import { precompileTemplate } from '@ember/template-compilation';
import templateOnlyComponent from '@ember/component/template-only';

export default setComponentTemplate(
  precompileTemplate(
    `<!-- Inherited from base card EDIT view. Did your card forget to specify its EDIT component? -->
    {{#each-in @fields as |name Field|}}
      <div class="field">
        <label>{{name}}</label>
        <Field />
      </div>
    {{/each-in}}`,
    {
      strictMode: true,
    }
  ),
  templateOnlyComponent()
);
