import { setComponentTemplate } from '@ember/component';
import { precompileTemplate } from '@ember/template-compilation';
import templateOnlyComponent from '@ember/component/template-only';
import BoxelCardContainer from '@cardstack/boxel/components/boxel/card-container';
import './edit.css';

export default setComponentTemplate(
  precompileTemplate(
    `{{#each-in @fields as |name Field|}}
      <BoxelCardContainer class="card-space-layout-edit" @displayBoundaries={{true}}>
        <:header>{{name}}</:header>
        <:default>
          <div class="card-space-layout-edit__inner"><Field /></div>
        </:default>
      </BoxelCardContainer>
    {{/each-in}}`,
    {
      strictMode: true,
      scope: () => ({ BoxelCardContainer }),
    }
  ),
  templateOnlyComponent()
);
