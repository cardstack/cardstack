import { setComponentTemplate } from '@ember/component';
import { precompileTemplate } from '@ember/template-compilation';
import templateOnlyComponent from '@ember/component/template-only';
import BoxelCardContainer from '@cardstack/boxel/components/boxel/card-container';
import './embedded.css';

export default setComponentTemplate(
  precompileTemplate(
    `<BoxelCardContainer @displayBoundaries={{true}}>
      <:header>Profile</:header>
      <:default>
        <div class="profile">
          <@fields.profilePicture/>
          <h2 class="profile__title"><@fields.name/></h2>
          <@fields.url/>
          <div><@fields.category/></div>
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
