import { setComponentTemplate } from '@ember/component';
import { precompileTemplate } from '@ember/template-compilation';
import templateOnlyComponent from '@ember/component/template-only';
import BoxelCardContainer from '@cardstack/boxel/components/boxel/card-container';
import BoxelHeader from '@cardstack/boxel/components/boxel/header';
import './embedded.css';

export default setComponentTemplate(
  precompileTemplate(
    `<BoxelCardContainer @displayBoundaries={{true}}>
      <BoxelHeader>Donations</BoxelHeader>
      <section class="donations">
        <header class="donations__header"><@fields.title/></header>
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
