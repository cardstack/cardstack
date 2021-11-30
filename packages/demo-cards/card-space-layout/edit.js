import { setComponentTemplate } from '@ember/component';
import { precompileTemplate } from '@ember/template-compilation';
import templateOnlyComponent from '@ember/component/template-only';
import BoxelCardContainer from '@cardstack/boxel/components/boxel/card-container';
import './edit.css';

export default setComponentTemplate(
  precompileTemplate(
    `<section class="card-space-layout-edit">
      {{#each-in @fields as |name Field|}}
        <BoxelCardContainer @displayBoundaries={{true}}>
          <:header>
            {{name}}
          </:header>
          <:default>
            <Field />
          </:default>
        </BoxelCardContainer>
      {{/each-in}}
    </section>`,
    {
      strictMode: true,
      scope: () => ({ BoxelCardContainer }),
    }
  ),
  templateOnlyComponent()
);
