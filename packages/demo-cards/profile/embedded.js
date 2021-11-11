import { setComponentTemplate } from '@ember/component';
import { precompileTemplate } from '@ember/template-compilation';
import templateOnlyComponent from '@ember/component/template-only';
import BoxelCardContainer from '@cardstack/boxel/components/boxel/card-container';
import BoxelHeader from '@cardstack/boxel/components/boxel/header';
import './embedded.css';

export default setComponentTemplate(
  precompileTemplate(
    `<BoxelCardContainer @displayBoundaries={{true}}>
      <BoxelHeader>Profile</BoxelHeader>
      <section class="profile">
        <header class="profile__header">
          <@fields.profilePicture/>
          <h1 class="profile__title"><@fields.name/></h1>
          <div class="profile__url"><@fields.url/></div>
          <span class="profile__label"><@fields.category/></span>
        </header>
        <p><@fields.description/></p>
      </section>
    </BoxelCardContainer>`,
    {
      strictMode: true,
      scope: () => ({ BoxelCardContainer, BoxelHeader }),
    }
  ),
  templateOnlyComponent()
);
