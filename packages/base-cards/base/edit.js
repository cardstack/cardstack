import { setComponentTemplate } from '@ember/component';
import { precompileTemplate } from '@ember/template-compilation';
import templateOnlyComponent from '@ember/component/template-only';
import BoxelField from '@cardstack/boxel/components/boxel/field';

export default setComponentTemplate(
  precompileTemplate(
    `<!-- Inherited from base card EDIT view. Did your card forget to specify its EDIT component? -->
    {{#each-in @fields as |name Field|}}
      <BoxelField @label={{name}} @fieldMode="edit">
        <Field />
      </BoxelField>
    {{/each-in}}`,
    {
      strictMode: true,
      scope: () => ({ BoxelField }),
    }
  ),
  templateOnlyComponent()
);
