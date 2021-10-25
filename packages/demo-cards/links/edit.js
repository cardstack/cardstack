import { setComponentTemplate } from '@ember/component';
import { precompileTemplate } from '@ember/template-compilation';
import templateOnlyComponent from '@ember/component/template-only';
import BoxelField from '@cardstack/boxel/components/boxel/field';

export default setComponentTemplate(
  precompileTemplate('<@fields.links/>', {
    strictMode: true,
    scope: () => ({ BoxelField }),
  }),
  templateOnlyComponent()
);
