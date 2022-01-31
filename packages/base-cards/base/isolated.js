import { setComponentTemplate } from '@ember/component';
import { precompileTemplate } from '@ember/template-compilation';
import templateOnlyComponent from '@ember/component/template-only';
export default setComponentTemplate(
  precompileTemplate(
    `<!-- Inherited from base card isolated view. Did your card forget to specify its isolated component? -->
    {{#each-in @fields as |name Field|}}
      <Field />
    {{/each-in}}
    `,
    {
      strictMode: true,
    }
  ),
  templateOnlyComponent()
);
