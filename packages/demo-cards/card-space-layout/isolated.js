import { setComponentTemplate } from '@ember/component';
import { precompileTemplate } from '@ember/template-compilation';
import templateOnlyComponent from '@ember/component/template-only';
import BoxelCardContainer from '@cardstack/boxel/components/boxel/card-container';
import './isolated.css';

export default setComponentTemplate(
  precompileTemplate(
    `<article class="card-space-layout">
      <div class="card-space-layout__cover-photo"><@fields.background/></div>
      <section class="card-space-layout__modules card-space-layout__modules--xs">
        <BoxelCardContainer @displayBoundaries={{true}}>
          <:header>Profile</:header>
          <:default><@fields.profile/></:default>
        </BoxelCardContainer>
      </section>
      <section class="card-space-layout__modules card-space-layout__modules--md">
        <BoxelCardContainer @displayBoundaries={{true}}>
          <:header>About Me</:header>
          <:default><@fields.bio/></:default>
        </BoxelCardContainer>
        <BoxelCardContainer @displayBoundaries={{true}}>
          <:header>Links</:header>
          <:default><@fields.links/></:default>
        </BoxelCardContainer>
        <BoxelCardContainer @displayBoundaries={{true}}>
          <:header>Donations</:header>
          <:default><@fields.donations/></:default>
        </BoxelCardContainer>
      </section>
    </article>`,
    {
      strictMode: true,
      scope: () => ({ BoxelCardContainer }),
    }
  ),
  templateOnlyComponent()
);
