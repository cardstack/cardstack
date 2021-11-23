import { setComponentTemplate } from '@ember/component';
import { precompileTemplate } from '@ember/template-compilation';
import templateOnlyComponent from '@ember/component/template-only';
import BoxelField from '@cardstack/boxel/components/boxel/field';
import './edit.css';

export default setComponentTemplate(
  precompileTemplate(
    `<section class="background-edit">
      <header class="background-edit__header">Edit background image</header>
      <BoxelField @label="Cover photo" @fieldMode="edit" class="background-edit__field">
        <@fields.coverPhoto/>
      </BoxelField>
    </section>`,
    {
      strictMode: true,
      scope: () => ({ BoxelField }),
    }
  ),
  templateOnlyComponent()
);
