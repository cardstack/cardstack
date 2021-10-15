import { setComponentTemplate } from '@ember/component';
import { precompileTemplate } from '@ember/template-compilation';
import templateOnlyComponent from '@ember/component/template-only';
import BoxelCardContainer from '@cardstack/boxel/components/boxel/card-container';
import BoxelHeader from '@cardstack/boxel/components/boxel/header';

export default setComponentTemplate(
  precompileTemplate(
    '<BoxelCardContainer><BoxelHeader @header="Profile" @editable={{true}}/><@fields.username/></BoxelCardContainer>',
    {
      strictMode: true,
      scope: () => ({ BoxelCardContainer, BoxelHeader }),
    }
  ),
  templateOnlyComponent()
);
