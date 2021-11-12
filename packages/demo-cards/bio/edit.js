import { setComponentTemplate } from '@ember/component';
import { precompileTemplate } from '@ember/template-compilation';
import templateOnlyComponent from '@ember/component/template-only';
import BoxelField from '@cardstack/boxel/components/boxel/field';
import './edit.css';

export default setComponentTemplate(
  precompileTemplate(
    `<section class="bio-edit">
      <header class="bio-edit__header">About Me</header>
      {{#each-in @fields as |name Field|}}
        <BoxelField @label={{name}} @fieldMode="edit" class="bio-edit__field">
          <Field />
        </BoxelField>
      {{/each-in}}
    </section>`,
    {
      strictMode: true,
      scope: () => ({ BoxelField }),
    }
  ),
  templateOnlyComponent()
);
