import { setComponentTemplate } from '@ember/component';
import { precompileTemplate } from '@ember/template-compilation';
import templateOnlyComponent from '@ember/component/template-only';

export default setComponentTemplate(
  precompileTemplate(
    '<!-- Inherited from base card EDIT view. Did your card forget to specify its EDIT component? --> <h1>Edit Form</h1>{{#each-in @fields as |name Field|}} <label>{{name}}</label> <Field /> {{/each-in}}',
    {
      strictMode: true,
    }
  ),
  templateOnlyComponent()
);
