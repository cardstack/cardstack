import { setComponentTemplate } from '@ember/component';
import { precompileTemplate } from '@ember/template-compilation';
import templateOnlyComponent from '@ember/component/template-only';
import BoxelCardContainer from '@cardstack/boxel/components/boxel/card-container';

export default setComponentTemplate(
  precompileTemplate('<BoxelCardContainer><h1>Bio</h1></BoxelCardContainer>', {
    strictMode: true,
    scope: () => ({ BoxelCardContainer }),
  }),
  templateOnlyComponent()
);
