import { setComponentTemplate } from '@ember/component';
import { precompileTemplate } from '@ember/template-compilation';
import templateOnlyComponent from '@ember/component/template-only';
import BoxelCardContainer from '@cardstack/boxel/components/boxel/card-container';
import './embedded.css';

export default setComponentTemplate(
  precompileTemplate(
    `<BoxelCardContainer @displayBoundaries={{true}}>
      <:header>About Me</:header>
      <:default>
        <div class="bio">
          <h3 class="bio__title"><@fields.name/></h3>
          <p><@fields.description/></p>
        </div>
      </:default>
    </BoxelCardContainer>`,
    {
      strictMode: true,
      scope: () => ({ BoxelCardContainer }),
    }
  ),
  templateOnlyComponent()
);
