import { setComponentTemplate } from '@ember/component';
import { precompileTemplate } from '@ember/template-compilation';
import templateOnlyComponent from '@ember/component/template-only';
import BoxelCardContainer from '@cardstack/boxel/components/boxel/card-container';
import './isolated.css';

export default setComponentTemplate(
  precompileTemplate(
    `<article class="card-space-layout">
      <div class="card-space-layout__cover-photo"><@fields.coverPhoto/></div>
      <section class="card-space-layout__module"><@fields.profile/></section>
      <section class="card-space-layout__optional-modules">
        <BoxelCardContainer @displayBoundaries={{true}}>
          <:header>About Me</:header>
          <:default><@fields.bio/></:default>
        </BoxelCardContainer>
        <@fields.links/>
        <@fields.donations/>
      </section>
    </article>`,
    {
      strictMode: true,
      scope: () => ({ BoxelCardContainer }),
    }
  ),
  templateOnlyComponent()
);
