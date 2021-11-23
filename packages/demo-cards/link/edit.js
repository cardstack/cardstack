import { setComponentTemplate } from '@ember/component';
import { precompileTemplate } from '@ember/template-compilation';
import templateOnlyComponent from '@ember/component/template-only';
import BoxelField from '@cardstack/boxel/components/boxel/field';
import './edit.css';

export default setComponentTemplate(
  precompileTemplate(
    `<div class="link-edit">
      {{#each-in @fields as |name Field|}}
        <BoxelField @label={{name}} @fieldMode="edit" class="link-edit__field">
          <Field />
        </BoxelField>
      {{/each-in}}
    </div>`,
    {
      strictMode: true,
      scope: () => ({ BoxelField }),
    }
  ),
  templateOnlyComponent()
);
